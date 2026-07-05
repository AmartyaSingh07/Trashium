# TRASHIUM — DEPLOYMENT SECURITY CHECKLIST

> **Run this before going to production.** RLS was deliberately kept OFF during development; this is the
> ordered plan to lock the database down. **Verified against the live project `fqbjjcbrxrokvdwkydze` on
> 2026-07-03** (via the Supabase security advisor + policy/grant/schema queries).
>
> **How to run it safely:** apply on a **Supabase development branch first**, test auth + every role's flows
> there, then merge to production. Each step is reversible. Do NOT paste it all blindly — go section by
> section and re-run the security advisor after each.
>
> Current dev state for reference: `pickup_requests` has RLS ON (mixed policies); everything else is RLS OFF.

---

## 0. Pre-flight
- [ ] Take a schema + policy snapshot (or work on a dev branch) so every step is revertible.
- [ ] Confirm every `profiles` row has the intended `role` (household/crew/admin) — policies below trust it.

---

## 1. Enable RLS + add policies (the 10 currently-off tables + fix the 2 insecure ones)

Supabase default-grants `anon`/`authenticated` on public tables, so **RLS-off = world read/write via the anon
key.** Today that means anyone can read every email and even **rewrite `price_estimates` (ML pricing tampering).**

### 1a. profiles  (enable RLS; admins see all; users edit only safe columns)
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Read: own row, or any row if admin (check_is_admin() is SECURITY DEFINER → no recursion).
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.check_is_admin());

-- Update: only your own row. Column-safety enforced by the trigger below (role/credits not self-editable).
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- INSERT is done by handle_new_user() (SECURITY DEFINER trigger) — no user INSERT policy needed.

-- Column-safety: block privilege/credit self-escalation via the REST API (A2/A3 hardening).
CREATE OR REPLACE FUNCTION public.guard_profiles_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF public.check_is_admin() THEN RETURN NEW; END IF;              -- admins may change anything
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.green_credits IS DISTINCT FROM OLD.green_credits
     OR NEW.kg_recycled IS DISTINCT FROM OLD.kg_recycled
     OR NEW.co2_saved IS DISTINCT FROM OLD.co2_saved
     OR NEW.pickups_completed IS DISTINCT FROM OLD.pickups_completed
     OR NEW.current_streak IS DISTINCT FROM OLD.current_streak
     OR NEW.longest_streak IS DISTINCT FROM OLD.longest_streak
     OR NEW.streak_freezes IS DISTINCT FROM OLD.streak_freezes
     OR NEW.pending_payout_boost_pct IS DISTINCT FROM OLD.pending_payout_boost_pct THEN
    RAISE EXCEPTION 'profiles: protected column change not allowed';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tr_guard_profiles_self_update BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_self_update();
```
> The app only updates `full_name`/`operating_zone`/`preferred_language`, so this trigger is transparent to
> normal use. Gamification writes go through `log_daily_action()` (SECURITY DEFINER → bypasses the trigger's
> non-admin branch? NO — the trigger fires for definer updates too). **Test the daily-ritual flow on the branch**;
> if the trigger blocks `log_daily_action`, add `OR current_setting('app.rpc', true) = '1'` gating or move the
> credit writes to run as a role the trigger exempts. (Simplest: have the RPC `SET LOCAL role` or check
> `session_user`.) Validate before prod.

### 1b. pickup_requests  (DROP the two insecure policies; keep the secure crew ones)
```sql
-- These reference client-writable user_metadata + a hardcoded email → privilege escalation. Remove them.
DROP POLICY IF EXISTS trashium_final_pickups_policy  ON public.pickup_requests;
DROP POLICY IF EXISTS trashium_update_pickups_policy ON public.pickup_requests;

-- Keep (already present & secure): trashium_crew_select_pickups_policy, trashium_crew_update_pickups_policy,
-- trashium_insert_pickups_policy. Add admin read/update via check_is_admin():
CREATE POLICY pickups_admin_all ON public.pickup_requests FOR ALL TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());
```

### 1c. price_estimates  (public READ only — protect ML pricing from tampering)
```sql
ALTER TABLE public.price_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_estimates_read ON public.price_estimates FOR SELECT TO anon, authenticated USING (true);
-- No INSERT/UPDATE/DELETE policy → writes blocked for anon/authenticated. The ML pipeline writes via the
-- service_role key (bypasses RLS), so publish_to_supabase.py keeps working.
```

### 1d. redemption_orders  (own orders; admin all; RPC writes)
```sql
ALTER TABLE public.redemption_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select_own ON public.redemption_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.check_is_admin());
CREATE POLICY orders_admin_update ON public.redemption_orders FOR UPDATE TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());
-- Redemptions are inserted by redeem_marketplace_item() (SECURITY DEFINER) → no user INSERT policy needed.
```

### 1e. marketplace_items / badges  (public catalog READ; admin writes)
```sql
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_read  ON public.marketplace_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY items_admin ON public.marketplace_items FOR ALL TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());   -- marketplace-admin CRUD

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY badges_read  ON public.badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY badges_admin ON public.badges FOR ALL TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());
```

### 1f. user_badges / daily_activity / streak_milestone_claims  (own read; RPC/admin writes)
```sql
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_badges_own ON public.user_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.check_is_admin());
CREATE POLICY user_badges_admin ON public.user_badges FOR ALL TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());   -- admin manual awards

ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_activity_own ON public.daily_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);   -- writes go through log_daily_action() (SECURITY DEFINER)

ALTER TABLE public.streak_milestone_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY streak_claims_own ON public.streak_milestone_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);   -- writes go through log_daily_action()
```

### 1g. ma_trends / model_metrics  (ML tables — read-only to the app, service-role writes)
```sql
ALTER TABLE public.ma_trends    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY ma_trends_read     ON public.ma_trends     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY model_metrics_read ON public.model_metrics FOR SELECT TO anon, authenticated USING (true);
-- ML pipeline writes via service_role (bypasses RLS). Tighten to admin-only read if these shouldn't be public.
```

### 1h. global_impact  (add the honest read policy IF you switch off the aspirational fallbacks)
```sql
-- DEV: intentionally left RLS-ON with 0 policies so the landing shows its aspirational fallback numbers.
-- At deploy, if you want real live stats instead, do A4 (see §5) then:
-- CREATE POLICY global_impact_read ON public.global_impact FOR SELECT TO anon, authenticated USING (true);
-- ...and fix the Number() coercion in components/landing/impact-counter.tsx (L62/70/78/86).
```

---

## 2. Revoke anon EXECUTE on SECURITY DEFINER functions (B10 + the cluster the advisor flagged)
These run with definer privileges and were callable by `anon` via `/rest/v1/rpc/...`.
```sql
REVOKE EXECUTE ON FUNCTION public.get_household_leaderboard()        FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_daily_action(text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_daily_status()               FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_marketplace_item(uuid)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_crew_zone(uuid, text)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_payout_override(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_is_admin()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_is_crew(uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_role()                  FROM anon;
-- Trigger-only functions should not be RPC-callable at all:
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_modified_timestamp_column()      FROM anon, authenticated, public;
-- (Keep EXECUTE ... TO authenticated on the app-called RPCs above; they internally check auth.uid()/role.)
```
> Note: `set_crew_zone` and `set_payout_override` already check `role='admin'` internally — good — but they
> should still not be anon-callable.

---

## 3. Function hardening (advisor WARN — mutable search_path)
```sql
ALTER FUNCTION public.check_is_admin()                     SET search_path = 'public';
ALTER FUNCTION public.get_auth_role()                      SET search_path = 'public';
ALTER FUNCTION public.handle_new_user()                    SET search_path = 'public';
ALTER FUNCTION public.update_modified_timestamp_column()   SET search_path = 'public';
-- (get_daily_status, get_household_leaderboard, log_daily_action, redeem_marketplace_item, set_crew_zone,
--  set_payout_override, check_is_crew already SET search_path — no change.)
```

---

## 4. Auth + code (the last of A2)
- [ ] **Dashboard → Auth → Providers/Policies: enable Leaked Password Protection** (advisor WARN).
- [ ] **Code — remove the hardcoded admin bypass** in `components/layout/navbar.tsx` (~L168–170:
  `isAdminByEmail` / `user?.email === "singhamartya07@gmail.com"`). The server gate in `app/admin/page.tsx`
  (added in Tier 1) + `check_is_admin()` policies now cover admin access properly.
- [ ] Re-run `get_advisors(security)` — expect the `rls_disabled_in_public`, `rls_references_user_metadata`,
  and `anon_security_definer_function_executable` ERRORs to clear.

---

## 5. Related follow-ups (not strictly RLS, but do around deploy)
- [ ] **A4 — earn loop:** add a trigger/RPC so completing a pickup credits the household + rolls up
  `global_impact` (see the audit). Required if you want real landing stats (§1h).
- [ ] **A5 — status vocabulary:** add a CHECK constraint on `pickup_requests.status`
  (`pending|accepted|collected|completed|cancelled`) and align `lib/types.ts` + the admin CSV/discrepancy code.
- [ ] Keep `supabase_schema.sql` in sync (it was regenerated from live on 2026-07-03).
- [ ] **`pickup-proofs` bucket:** currently **public** for demo simplicity (admin views geo-tagged
  collection photos via public URL). These photos reveal **household locations**, so before production:
  flip the bucket to **private**, drop the public `trashium_proof_select_policy`, and serve admin views
  via short-lived **signed URLs** (`createSignedUrl`) minted server-side. Keep the authenticated-only
  insert policy (`trashium_proof_insert_policy`) but scope it tighter (e.g. crew role, or path-prefixed to
  the crew's own pickups) if RLS is enabled on `pickup_requests` writes.

---

## 6. Post-deploy verification
- [ ] Household login: can read/update own profile, cannot read others; cannot PATCH own role/credits via REST.
- [ ] Crew: sees only zone pickups; admin: sees all; anon: cannot read profiles/orders or call the RPCs.
- [ ] `price_estimates` readable but NOT writable via the anon key; ML `publish_to_supabase.py` still works.
- [ ] `get_advisors(security)` returns no ERROR-level lints.
