-- ═══════════════════════════════════════════════════════════════════════════
-- TRASHIUM — P0 SECURITY LOCKDOWN (RLS + grants + function hardening)
-- ───────────────────────────────────────────────────────────────────────────
-- REHEARSE LOCALLY FIRST (Supabase CLI local stack). Do NOT run against prod
-- until every role's flows pass locally. Idempotent: safe to re-run.
-- Built from DEPLOYMENT_SECURITY_CHECKLIST.md §1–§3 + baseline corrections
-- (2026-07-06): adds apply_pickup_completion revoke; guard trigger exempts
-- SECURITY DEFINER RPCs so daily-credits/redeem keep working.
-- Leaves global_impact (§1h) untouched — intentional landing fallback.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1a. profiles ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select      ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own  ON public.profiles;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.check_is_admin());

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- INSERT handled by handle_new_user() (SECURITY DEFINER trigger) — no policy needed.

-- Column-safety: block role/credit self-escalation via the REST API.
-- Use COLUMN-LEVEL UPDATE grants, NOT a trigger. (A SECURITY DEFINER trigger sees
-- current_user = the function owner, never 'authenticated', so a current_user-based
-- guard never fires — verified failing in local rehearsal 2026-07-06.) authenticated
-- may update only personalization columns; SECURITY DEFINER RPCs run as the owner and
-- bypass column grants, so log_daily_action()/redeem_marketplace_item() still write credits.
-- NOTE: admin shares the 'authenticated' Postgres role, so admin is also limited to these
-- columns for DIRECT writes — acceptable, since no app code has admin write other profile
-- columns via the browser client (all such writes go through definer RPCs).
DROP TRIGGER   IF EXISTS tr_guard_profiles_self_update ON public.profiles;
DROP FUNCTION  IF EXISTS public.guard_profiles_self_update();
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT  UPDATE (full_name, operating_zone, preferred_language, avatar_url)
  ON public.profiles TO authenticated;

-- The pickup modal clears its own one-time payout boost after use. That column is
-- intentionally NOT self-grantable (a household could otherwise inflate it), so the write
-- moves into a SECURITY DEFINER RPC that only nulls the caller's own row.
-- ⚠ APP CHANGE REQUIRED: components/dashboard/schedule-pickup-modal.tsx must call
--   supabase.rpc('consume_payout_boost') instead of .update({ pending_payout_boost_pct: null }).
CREATE OR REPLACE FUNCTION public.consume_payout_boost()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  UPDATE public.profiles SET pending_payout_boost_pct = NULL, updated_at = now()
  WHERE id = auth.uid();
END; $$;
REVOKE EXECUTE ON FUNCTION public.consume_payout_boost() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_payout_boost() TO authenticated;

-- ── 1b. pickup_requests (drop the 2 insecure policies; add explicit admin) ────
-- admin already passes the crew policies (check_is_crew = role IN crew/admin);
-- pickups_admin_all is explicit belt-and-suspenders and harmless.
DROP POLICY IF EXISTS trashium_final_pickups_policy  ON public.pickup_requests;
DROP POLICY IF EXISTS trashium_update_pickups_policy ON public.pickup_requests;
DROP POLICY IF EXISTS pickups_admin_all              ON public.pickup_requests;
CREATE POLICY pickups_admin_all ON public.pickup_requests FOR ALL TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- ── 1c. price_estimates (public read; writes only via service_role) ───────────
ALTER TABLE public.price_estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS price_estimates_read ON public.price_estimates;
CREATE POLICY price_estimates_read ON public.price_estimates FOR SELECT TO anon, authenticated USING (true);

-- ── 1d. redemption_orders (own; admin all; RPC inserts) ───────────────────────
ALTER TABLE public.redemption_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_select_own   ON public.redemption_orders;
DROP POLICY IF EXISTS orders_admin_update ON public.redemption_orders;
CREATE POLICY orders_select_own ON public.redemption_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.check_is_admin());
CREATE POLICY orders_admin_update ON public.redemption_orders FOR UPDATE TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- ── 1e. marketplace_items / badges (public read; admin CRUD) ──────────────────
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS items_read  ON public.marketplace_items;
DROP POLICY IF EXISTS items_admin ON public.marketplace_items;
CREATE POLICY items_read  ON public.marketplace_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY items_admin ON public.marketplace_items FOR ALL TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS badges_read  ON public.badges;
DROP POLICY IF EXISTS badges_admin ON public.badges;
CREATE POLICY badges_read  ON public.badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY badges_admin ON public.badges FOR ALL TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- ── 1f. user_badges / daily_activity / streak_milestone_claims ────────────────
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_badges_own   ON public.user_badges;
DROP POLICY IF EXISTS user_badges_admin ON public.user_badges;
CREATE POLICY user_badges_own ON public.user_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.check_is_admin());
CREATE POLICY user_badges_admin ON public.user_badges FOR ALL TO authenticated
  USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_activity_own ON public.daily_activity;
CREATE POLICY daily_activity_own ON public.daily_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);  -- writes via log_daily_action() (SECURITY DEFINER)

ALTER TABLE public.streak_milestone_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS streak_claims_own ON public.streak_milestone_claims;
CREATE POLICY streak_claims_own ON public.streak_milestone_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);  -- writes via log_daily_action()

-- ── 1g. ma_trends / model_metrics (read-only to app; service-role writes) ─────
ALTER TABLE public.ma_trends     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ma_trends_read     ON public.ma_trends;
DROP POLICY IF EXISTS model_metrics_read ON public.model_metrics;
CREATE POLICY ma_trends_read     ON public.ma_trends     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY model_metrics_read ON public.model_metrics FOR SELECT TO anon, authenticated USING (true);

-- ── 2. EXECUTE grants: revoke PUBLIC + anon, keep authenticated ───────────────
-- Functions default-grant EXECUTE TO PUBLIC, so revoking `anon` ALONE is a no-op —
-- anon still executes via PUBLIC (verified: anon ran log_daily_action in local
-- rehearsal until PUBLIC was revoked). Must revoke FROM PUBLIC, then GRANT authenticated.
REVOKE EXECUTE ON FUNCTION public.get_household_leaderboard()        FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.get_household_leaderboard()        TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_daily_action(text)            FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.log_daily_action(text)            TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_daily_status()               FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.get_daily_status()               TO authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_marketplace_item(uuid)     FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.redeem_marketplace_item(uuid)     TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_crew_zone(uuid, text)         FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.set_crew_zone(uuid, text)         TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_payout_override(uuid, numeric) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.set_payout_override(uuid, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_is_admin()                  FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.check_is_admin()                  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_is_crew(uuid)              FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.check_is_crew(uuid)              TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_auth_role()                  FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.get_auth_role()                  TO authenticated;
-- Trigger-only functions: execute for no one.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_pickup_completion()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_modified_timestamp_column()    FROM PUBLIC, anon, authenticated;

-- ── 3. Function hardening (mutable search_path) ───────────────────────────────
ALTER FUNCTION public.check_is_admin()                   SET search_path = 'public';
ALTER FUNCTION public.get_auth_role()                    SET search_path = 'public';
ALTER FUNCTION public.handle_new_user()                  SET search_path = 'public';
ALTER FUNCTION public.update_modified_timestamp_column() SET search_path = 'public';

-- ── 4. Storage: lock down pickup-proofs (private bucket + scoped policies) ─────
-- These photos are geo-tagged household locations. Make the bucket private, drop the
-- public read policy, restrict read to crew+admin (for signed-URL minting) and insert to crew.
-- ⚠ APP CHANGE REQUIRED (paired): app/admin/admin-content.tsx must render proofs via
--   supabase.storage.from('pickup-proofs').createSignedUrl(path, 3600) instead of the public URL.
UPDATE storage.buckets SET public = false WHERE id = 'pickup-proofs';

DROP POLICY IF EXISTS trashium_proof_select_policy ON storage.objects;
DROP POLICY IF EXISTS trashium_proof_read          ON storage.objects;
CREATE POLICY trashium_proof_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pickup-proofs'
         AND (public.check_is_crew(auth.uid()) OR public.check_is_admin()));

DROP POLICY IF EXISTS trashium_proof_insert_policy ON storage.objects;
DROP POLICY IF EXISTS trashium_proof_insert        ON storage.objects;
CREATE POLICY trashium_proof_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pickup-proofs' AND public.check_is_crew(auth.uid()));
-- Paths are timestamped (crew-content builds `${pickup.id}/${Date.now()}.ext`), so the
-- upsert never collides → INSERT policy suffices; no UPDATE policy is granted intentionally.

COMMIT;

-- After COMMIT: re-run get_advisors(security) → expect 0 ERROR (leaked-password
-- WARN persists on Free plan). Storage lockdown (pickup-proofs) + navbar email
-- bypass removal are handled separately (see RLS_REHEARSAL_PLAN.md §5–§6).
