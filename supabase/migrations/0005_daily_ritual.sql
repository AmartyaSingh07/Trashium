-- ============================================================================
-- Daily Grove Ritual — authoritative daily-action + streak engine.
-- Credits for daily actions now move ONLY through log_daily_action() (SECURITY
-- DEFINER, uses auth.uid()); caps/streaks/chests are server-tracked, not client.
-- RLS disabled for now to match the project's current decision (TODO(RLS)).
-- ============================================================================

-- A1. One row per user per day.
create table if not exists public.daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  logged_in boolean not null default false,
  segregated boolean not null default false,
  quizzes_correct int not null default 0,
  quiz_strikes int not null default 0,
  perfect_day boolean not null default false,
  credits_earned numeric not null default 0,
  primary key (user_id, activity_date)
);
alter table public.daily_activity disable row level security;

-- A2. Additive streak columns on profiles.
alter table public.profiles
  add column if not exists current_streak int not null default 0,
  add column if not exists longest_streak int not null default 0,
  add column if not exists last_activity_date date,
  add column if not exists streak_freezes int not null default 1;  -- everyone starts with 1 shield

-- A3. Milestone chest claim ledger (each chest claimed once).
create table if not exists public.streak_milestone_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone int not null,                 -- 3 / 7 / 14 / 30
  claimed_at timestamptz not null default now(),
  primary key (user_id, milestone)
);
alter table public.streak_milestone_claims disable row level security;

-- A4. log_daily_action — single source of truth for daily-action credits.
create or replace function public.log_daily_action(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date := current_date;
  v_row    public.daily_activity%rowtype;
  v_prof   public.profiles%rowtype;
  v_logged boolean; v_segr boolean; v_qc int; v_qs int; v_perfect boolean;
  v_base int := 0; v_mult numeric := 1.0; v_award numeric := 0; v_total numeric := 0;
  v_perfect_fired boolean := false;
  v_freeze_used boolean := false;
  v_chest jsonb := null; v_chest_reward int := 0; v_chest_freeze int := 0;
  v_streak int; v_longest int; v_freezes int;
  v_weekly int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_action not in ('login','segregate','quiz_correct','quiz_strike') then
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;

  select * into v_prof from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  insert into public.daily_activity (user_id, activity_date) values (v_uid, v_today)
  on conflict (user_id, activity_date) do nothing;
  select * into v_row from public.daily_activity where user_id = v_uid and activity_date = v_today for update;

  -- Caps (reject when exhausted). Login is idempotent: a repeat just no-ops the award.
  if p_action = 'segregate' and v_row.segregated then
    return jsonb_build_object('ok', false, 'reason', 'already_segregated');
  elsif p_action = 'quiz_correct' and v_row.quizzes_correct >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'quiz_cap');
  elsif p_action = 'quiz_strike' and v_row.quiz_strikes >= 2 then
    return jsonb_build_object('ok', false, 'reason', 'strike_cap');
  end if;

  v_streak  := v_prof.current_streak;
  v_longest := v_prof.longest_streak;
  v_freezes := v_prof.streak_freezes;

  -- Streak advances on the first credit-earning action of the day (not quiz_strike,
  -- not a repeat login that earns nothing).
  if p_action in ('login','segregate','quiz_correct')
     and (v_prof.last_activity_date is distinct from v_today)
     and not (p_action = 'login' and v_row.logged_in) then
    if v_prof.last_activity_date = v_today - 1 then
      v_streak := v_streak + 1;
    elsif v_prof.last_activity_date = v_today - 2 and v_freezes > 0 then
      v_freezes := v_freezes - 1; v_streak := v_streak + 1; v_freeze_used := true;  -- shield covers one missed day
    else
      v_streak := 1;
    end if;
    v_longest := greatest(v_longest, v_streak);
    v_prof.last_activity_date := v_today;
  end if;

  v_mult := least(2.0, 1 + 0.05 * v_streak);

  -- Base credit for this action (repeat login earns 0).
  if p_action = 'login' and not v_row.logged_in then v_base := 1;
  elsif p_action = 'segregate' then v_base := 2;
  elsif p_action = 'quiz_correct' then v_base := 1;
  else v_base := 0;  -- quiz_strike or repeat login
  end if;
  v_award := round(v_base * v_mult);
  v_total := v_award;

  -- Apply the action to today's row.
  v_logged := v_row.logged_in or p_action = 'login';
  v_segr   := v_row.segregated or p_action = 'segregate';
  v_qc     := v_row.quizzes_correct + (case when p_action = 'quiz_correct' then 1 else 0 end);
  v_qs     := v_row.quiz_strikes + (case when p_action = 'quiz_strike' then 1 else 0 end);
  v_perfect := v_row.perfect_day;

  -- Perfect Day capstone (login + segregate + ≥1 correct quiz), once per day.
  if not v_perfect and v_logged and v_segr and v_qc >= 1 then
    v_perfect := true; v_perfect_fired := true;
    v_total := v_total + round(5 * v_mult);
  end if;

  -- Milestone chest (claim-once). Grants credits, and a shield at 7 & 30.
  if p_action in ('login','segregate','quiz_correct') and v_streak in (3,7,14,30)
     and not exists (select 1 from public.streak_milestone_claims where user_id = v_uid and milestone = v_streak) then
    v_chest_reward := case v_streak when 3 then 10 when 7 then 20 when 14 then 40 when 30 then 100 end;
    v_chest_freeze := case when v_streak in (7,30) then 1 else 0 end;
    insert into public.streak_milestone_claims (user_id, milestone) values (v_uid, v_streak);
    v_total := v_total + v_chest_reward;
    v_freezes := v_freezes + v_chest_freeze;
    v_chest := jsonb_build_object('milestone', v_streak, 'reward', v_chest_reward, 'freeze', v_chest_freeze);
  end if;

  update public.daily_activity set
    logged_in = v_logged, segregated = v_segr, quizzes_correct = v_qc,
    quiz_strikes = v_qs, perfect_day = v_perfect, credits_earned = credits_earned + v_total
  where user_id = v_uid and activity_date = v_today;

  update public.profiles set
    green_credits = green_credits + v_total,
    current_streak = v_streak, longest_streak = v_longest,
    last_activity_date = v_prof.last_activity_date, streak_freezes = v_freezes,
    updated_at = now()
  where id = v_uid
  returning green_credits into v_prof.green_credits;

  select count(distinct activity_date) into v_weekly
  from public.daily_activity
  where user_id = v_uid and activity_date > v_today - 7
    and (logged_in or segregated or quizzes_correct > 0);

  return jsonb_build_object(
    'ok', true,
    'awarded', v_total,
    'base', v_base,
    'multiplier', v_mult,
    'current_streak', v_streak,
    'longest_streak', v_longest,
    'perfect_day', v_perfect_fired,
    'freezes', v_freezes,
    'freeze_used', v_freeze_used,
    'chest', v_chest,
    'green_credits', v_prof.green_credits,
    'caps', jsonb_build_object(
      'quizzes_correct', v_qc, 'quiz_strikes', v_qs,
      'segregated', v_segr, 'logged_in', v_logged
    ),
    'weekly_active_days', v_weekly
  );
end;
$$;

grant execute on function public.log_daily_action(text) to authenticated;

-- A5. get_daily_status — read-only hydration for the ritual widget.
create or replace function public.get_daily_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := current_date;
  v_row public.daily_activity%rowtype;
  v_prof public.profiles%rowtype;
  v_weekly int;
  v_claims int[];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_prof from public.profiles where id = v_uid;
  select * into v_row from public.daily_activity where user_id = v_uid and activity_date = v_today;

  select count(distinct activity_date) into v_weekly
  from public.daily_activity
  where user_id = v_uid and activity_date > v_today - 7
    and (logged_in or segregated or quizzes_correct > 0);

  select coalesce(array_agg(milestone order by milestone), '{}') into v_claims
  from public.streak_milestone_claims where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'activity_date', v_today,
    'logged_in', coalesce(v_row.logged_in, false),
    'segregated', coalesce(v_row.segregated, false),
    'quizzes_correct', coalesce(v_row.quizzes_correct, 0),
    'quiz_strikes', coalesce(v_row.quiz_strikes, 0),
    'perfect_day', coalesce(v_row.perfect_day, false),
    'credits_earned', coalesce(v_row.credits_earned, 0),
    'current_streak', coalesce(v_prof.current_streak, 0),
    'longest_streak', coalesce(v_prof.longest_streak, 0),
    'streak_freezes', coalesce(v_prof.streak_freezes, 0),
    'weekly_active_days', coalesce(v_weekly, 0),
    'claimed_milestones', to_jsonb(v_claims)
  );
end;
$$;

grant execute on function public.get_daily_status() to authenticated;
