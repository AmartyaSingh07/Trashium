# Trashium — P0 Database Lockdown: RLS Rehearsal Plan

> **ACTIVE NEXT STEP:** local rehearsal PASSED + app changes done/tsc-green; the only remaining task is
> applying `supabase/security_lockdown.sql` to PROD section-by-section (get_advisors between, DDL only on
> explicit "apply") and shipping the paired app changes. Ship SQL + app together; restore prod `.env.local`.

> Status: **REHEARSED on local; NOT yet applied to prod.** No prod DDL until an explicit "apply".
> Grounded in the read-only baseline captured 2026-07-06 (see `SECURITY_AUDIT_PRELAUNCH.md`
> and `DEPLOYMENT_SECURITY_CHECKLIST.md`). This plan supersedes the checklist where the live
> DB differed from its snapshot — corrections are called out inline.

## Execution vehicle — DECIDED: Local Supabase CLI (Free tier)

Branching + leaked-password protection both require **Pro** → permanently skipped (Free tier only).
Leaked-password stays an accepted WARN. Rehearsal runs on the **local Supabase CLI stack** (Docker).
The lockdown SQL is `supabase/security_lockdown.sql` (idempotent). Everything below is vehicle-independent;
the concrete local runbook is at the end.

## Local CLI rehearsal runbook

Repo state: `supabase/migrations/` has 0002–0006 (no 0001 base); the full schema is in
`supabase_schema.sql`; no `config.toml` yet. So seed local from the snapshot, not the migration chain.

```bash
# 0. One-time: init config (creates supabase/config.toml). Docker Desktop must be running.
supabase init            # if it complains config exists, skip
supabase start           # boots local Postgres+Auth+Studio; prints API URL + anon/service keys

# 1. Load the production schema snapshot into the local DB
#    (local db url is printed by `supabase status` as "DB URL")
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f supabase_schema.sql

# 2. Create one test user per role via local Studio (http://127.0.0.1:54323 → Authentication → Add user),
#    OR sign up through the app. handle_new_user() makes them 'household'; then promote:
#    UPDATE public.profiles SET role='crew'  WHERE email='crew@test.local';
#    UPDATE public.profiles SET role='admin' WHERE email='admin@test.local';

# 3. Point the app at local: copy prod .env.local aside, then set the LOCAL keys from `supabase status`
cp .env.local .env.local.prodbak
#    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase status>
npm run dev              # exercise the app BEFORE lockdown to confirm baseline works

# 4. Apply the lockdown, then re-test everything
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f supabase/security_lockdown.sql

# 5. Reset to redo from clean: `supabase db reset` won't replay the base (no 0001), so instead:
supabase stop && supabase start   # fresh local db, then repeat steps 1–4
```

When every role passes locally (matrix below), restore prod env (`mv .env.local.prodbak .env.local`),
and apply `security_lockdown.sql` to prod — via the Supabase MCP `apply_migration` on your explicit
"apply", section by section, re-running `get_advisors` between sections.

### Must-pass local checks (the risky bits)
- **Daily ritual:** log in as household → trigger a daily action → **green_credits increments**. This proves
  the hardened `guard_profiles_self_update` exempts `log_daily_action()` (the `current_user <> 'authenticated'`
  branch). If credits DON'T move, the guard is still blocking the RPC — stop and revisit.
- **Redeem:** household redeems a marketplace item → balance drops, order appears (proves `redeem_marketplace_item`
  bypasses the guard + orders RLS).
- **Profile self-tamper blocked:** household cannot PATCH own `role`/`green_credits` via REST (should error).
- **Admin panel:** pickup list + realtime + cancel + status update (browser client → RLS-governed).
- **Crew:** sees pickups via `check_is_crew`; **anon:** cannot read profiles/orders or call the RPCs.

## Baseline facts that shape the plan

- RLS **off** on 10 tables: `badges, daily_activity, ma_trends, marketplace_items, model_metrics,
  price_estimates, profiles, redemption_orders, streak_milestone_claims, user_badges`.
- `global_impact` RLS on / no policy (intentional landing fallback — leave).
- `pickup_requests` RLS on with **5 policies** (checklist said 2):
  - Keep (clean): `trashium_crew_select_pickups_policy`, `trashium_crew_update_pickups_policy`,
    `trashium_insert_pickups_policy`.
  - Drop (insecure — reference `user_metadata.role` + hardcoded email `singhamartya07@gmail.com`):
    `trashium_final_pickups_policy` (SELECT), `trashium_update_pickups_policy` (UPDATE).
- **Correction:** `check_is_crew(uuid)` returns true for role IN ('crew','admin'), so admin already
  passes the crew policies. Dropping the 2 insecure policies does **not** cut admin access.
- 11 SECURITY DEFINER functions currently anon+authenticated executable.
- 4 functions with mutable search_path: `handle_new_user, get_auth_role, check_is_admin,
  update_modified_timestamp_column`.
- `pickup-proofs` public bucket + broad SELECT policy leaks household GPS.
- Roles: `profiles.role` is the source of truth (default 'household' via `handle_new_user`);
  admin/crew are set manually. App page.tsx gates already trust `profiles.role`. Current counts:
  1 admin, 6 crew, 10 household — so `check_is_admin()` works for the real admin account.

## Steps (all reversible; verify each on the chosen vehicle before prod)

### Step 0 — Vehicle + pre-checks
Stand up the rehearsal vehicle (A/B/C). Confirm the admin `profiles.role='admin'` carried over.

### Step 1 — Function search_path (lowest risk)
`ALTER FUNCTION public.handle_new_user() SET search_path = public;` and likewise for
`get_auth_role()`, `check_is_admin()`, `update_modified_timestamp_column()`. Clears 4 WARNs.

### Step 2 — EXECUTE grants (per-function, NOT blanket)
- `REVOKE EXECUTE ... FROM anon` on all 11 SECURITY DEFINER functions.
- `REVOKE EXECUTE ... FROM anon, authenticated` on the **trigger functions**
  `handle_new_user()` and `apply_pickup_completion()` (both `RETURNS trigger`; fire as definer
  regardless of grants — never need RPC exposure).
- Keep `authenticated` EXECUTE on: `log_daily_action, get_daily_status, get_household_leaderboard,
  redeem_marketplace_item` (app RPCs); `check_is_crew, check_is_admin, get_auth_role` (RLS-eval
  helpers); `set_crew_zone, set_payout_override` (both internally gate on auth.uid()+role='admin').

### Step 3 — Fix `pickup_requests` policies
1. (Optional, explicit) Add `trashium_admin_pickups_policy` (SELECT+UPDATE, authenticated)
   `USING check_is_admin()` / `WITH CHECK check_is_admin()` — belt-and-suspenders; admin already
   rides `check_is_crew`.
2. Drop `trashium_final_pickups_policy` and `trashium_update_pickups_policy`.
Verify: admin panel list + realtime + cancel + status update (browser client → RLS-governed).
Clears 2 ERRORs and removes the hardcoded email from the DB.

### Step 4 — Enable RLS + policies on the 10 off tables (the big flip)
Each `ENABLE ROW LEVEL SECURITY` needs a complete policy set or reads go empty / writes fail.
- **profiles** — select/update own + admin select all. ⚠️ Test that `guard_profiles_self_update`
  does not block `log_daily_action`'s credit writes (daily-ritual end-to-end).
- **daily_activity, streak_milestone_claims** — select own; writes via definer RPCs (bypass RLS).
- **redemption_orders** — select own + admin select all + admin update status; insert via
  `redeem_marketplace_item` (definer).
- **user_badges** — select own + admin insert (award).
- **badges, marketplace_items, price_estimates, ma_trends, model_metrics** — reference/read data;
  decide read audience per table (authenticated vs anon). Clears 10 ERRORs.

### Step 5 — Storage lockdown (`pickup-proofs`)
Bucket → private; drop `trashium_proof_select_policy`; admin/crew views switch to signed URLs
(app-code change); add upload size + MIME validation in `crew-content.tsx`.

### Step 6 — App code: remove email bypass
Strip `isAdminByEmail` from `components/layout/navbar.tsx` (~L174–175, 183, 203); rely on
`role === 'admin'`. Safe — admin `profiles.role` is already 'admin'. Keep tsc/lint green.

### Step 7 — Verify + sync
Re-run `get_advisors(security)` → expect 0 ERROR (leaked-password WARN persists on Free).
Update `supabase_schema.sql` to match. Apply to prod only on explicit "apply".

## Verification matrix (run per vehicle before prod)
For each of anon / household / crew / admin: landing, login+redirect, dashboard (streaks, redeem),
crew hub (pickup list, status, proof upload), admin (pickup list+realtime+cancel+status, catalog
CRUD, award badge, order status). Confirm no silent-empty reads and no failed writes.

## Biggest risks
1. Step 4 profiles RLS × `guard_profiles_self_update` × `log_daily_action` (untested).
2. Incomplete policy sets on the 10-table flip → silent empty reads.
Both are why the rehearsal vehicle exists.
