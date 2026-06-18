-- Households-only leaderboard. SECURITY DEFINER bypasses RLS for a read-only,
-- limited-column projection. Admin/crew are excluded by the role filter.
-- Returns no email (privacy). Sector is the most frequent completed-pickup location;
-- households with no completed pickup get a null sector (UI buckets them as "Unassigned").
create or replace function public.get_household_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  sector text,
  green_credits numeric,
  kg_recycled numeric
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    coalesce(p.full_name, 'Eco Warrior') as display_name,
    mode() within group (order by pr.location) as sector,   -- most frequent pickup sector
    p.green_credits,
    p.kg_recycled
  from profiles p
  left join pickup_requests pr
    on pr.user_id = p.id
   and pr.status in ('collected','processed','completed')
  where p.role = 'household'
  group by p.id, p.full_name, p.green_credits, p.kg_recycled;
$$;

grant execute on function public.get_household_leaderboard() to anon, authenticated;
