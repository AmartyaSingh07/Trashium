# TRASHIUM — PRE-LAUNCH SECURITY AUDIT

> Audit of the project against the 10-point "Security Problems to Fix Before Launching" guide
> (@swapsays_wtf), grounded in the **live** state of the code and the Supabase project
> `fqbjjcbrxrokvdwkydze`. Verified **2026-07-05** via the Supabase security advisor, a live
> `pg_class` RLS query, and direct reads of the repo.
>
> **This is the plan only — no changes have been made.** The database/RLS remediation SQL already
> exists, fully written, in `DEPLOYMENT_SECURITY_CHECKLIST.md`; this document validates it against
> live state, adds the *application-layer* items that checklist doesn't cover, and sequences
> everything into one prioritized run order.

---

## TL;DR — where we stand

The project's **biggest risk is a single class of problem: the database is world-readable/writable.**
Ten public tables (including `profiles`, `redemption_orders`, `daily_activity`) have **Row Level
Security OFF**, and Supabase auto-grants the `anon` key on public tables — so **anyone with the
public anon key (which ships in the frontend by design) can read every user's email and credits,
forge marketplace orders, and even rewrite the ML price table.** This maps directly to Guide #4
(No Role-Level Security) and is confirmed as **ERROR-level** by Supabase's own advisor.

The good news: **secrets hygiene, auth, and injection are already in decent shape** (Supabase does
the heavy lifting), and the entire DB fix is already written in `DEPLOYMENT_SECURITY_CHECKLIST.md`.
The remaining new work is small and app-layer: **HTTP security headers, file-upload validation, a
few auth toggles, and cleanup of a hardcoded admin bypass.**

| Priority | Theme | Status |
|---|---|---|
| **P0 — blockers** | RLS off on 10 tables; insecure `pickup_requests` policies; anon-callable SECURITY DEFINER RPCs; hardcoded admin bypass | ❌ Must fix before any public deploy |
| **P1 — important** | Security headers; leaked-password protection; public+listable proof bucket (leaks home GPS); upload validation | ⚠️ Fix before launch |
| **P2 — hardening** | Zod input validation; Sentry error monitoring; `.env.example`; rate-limit posture; function `search_path`; shared demo password | 🟡 Nice-to-have / do around deploy |
| **N/A** | LLM security (no runtime LLM); CORS (no custom API) | ✅ Not applicable |

---

## Guide item-by-item audit (with evidence)

### 1. Exposed Secrets — ✅ MOSTLY OK (P2 polish)
**Evidence:** `.gitignore` ignores `.env*` (line 36); `git ls-files` shows **no env file is tracked**;
grep for `service_role` / JWT-shaped strings found **only `process.env.*` references** — no hardcoded
keys in source. `seed-crew-accounts.mjs` correctly reads the service-role key from the environment.
**Risk:** Low. The one key that ships to the browser is the Supabase **anon** key, which is designed
to be public — *but it is only safe when RLS backs it*, which today it does not (see #4).
**To do (P2):**
- Add a committed **`.env.example`** listing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (names only, empty values) so the required vars are documented.
- At deploy, set secrets in the **host's env config** (Vercel project settings), never in code.
- Note: `seed-crew-accounts.mjs` hardcodes a shared demo password `Trashium@2026` — fine for a demo,
  but rotate it (or move to an env var) if the deployment is ever public-facing (see #5).

### 2. No Rate Limiting — ⚠️ PARTIAL (P2)
**Evidence:** there is **no `app/api` directory** — the app has no custom backend routes. All data
access goes directly to Supabase (PostgREST + Auth + RPC) with the anon key.
**Risk:** Moderate. Rate limiting is therefore **delegated to the Supabase platform** (Auth endpoints
have built-in limits) and to the host/CDN. The realistic abuse surface is repeated RPC calls
(`log_daily_action`, `redeem_marketplace_item`) and auth brute-force.
**To do (P2):**
- Confirm/tune **Supabase Auth rate limits** in the dashboard (Auth → Rate Limits).
- If deploying on Vercel/Cloudflare, enable their **edge rate limiting / WAF** for the app origin.
- Once anon `EXECUTE` is revoked on the RPCs (see #4/§2 of the deploy checklist), the RPC surface is
  authenticated-only, which sharply limits anonymous abuse.

### 3. No Input Validation — ✅ LOW RISK (delegated to DB)
**Evidence:** no Zod/validation library in `package.json`. Writes go through the Supabase client
(PostgREST + parameterized RPC), **not raw SQL string interpolation** — so classic SQL injection is
not the exposure here. The ML Python pipeline also uses parameterized upserts.
**Risk:** Low for injection. The real gap is **authorization, not injection** (covered by #4). Current
"server-side validation" = DB `CHECK` constraints (e.g. `status`, `waste_type`) + the RPCs' internal
checks + (once enabled) RLS.
**To do:** primarily covered by enabling RLS (#4). Optional hardening: keep tightening `CHECK`
constraints and column-level guards (the `guard_profiles_self_update()` trigger in the deploy
checklist §1a is exactly this pattern).

**Zod integration (P2 — requested).** Adding **`zod`** (new dependency) is worthwhile as
*defense-in-depth + type-safe parsing + better form UX* — but note clearly: **Zod on the client is
not a security control** (a user can bypass it and hit PostgREST/RPC directly). The real enforcement
stays RLS + DB `CHECK` constraints + the RPCs' internal checks. Use Zod at these boundaries:
- **Forms → Supabase:** validate before write in `schedule-pickup-modal.tsx` (weight, waste_type,
  sector, address, date/slot), signup/login inputs, and marketplace redemption inputs — surface a
  `400`-equivalent inline error and block the call on failure.
- **RPC params + responses:** define schemas for `redeem_marketplace_item` / `log_daily_action`
  args and `.parse()` the shapes returned from `get_daily_status` / `get_household_leaderboard`, so a
  malformed row fails loudly instead of rendering `undefined`.
- **Env validation at boot:** a small `lib/env.ts` Zod schema that asserts
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist and are well-formed — fails the
  build early instead of at runtime.
- **If any `app/api` Route Handler or Server Action is ever added,** Zod-validate its body server-side
  (this is where Zod becomes a *real* security control).
Effort: ~half a day for the high-value forms + env schema; incremental after that. Frozen-logic note:
do **not** re-validate/transform the ML estimator inputs in a way that changes the quote contract —
validate shape only, pass values through untouched.

### 4. No Role-Level Security — ❌ CRITICAL (P0) — the headline issue
**Evidence (live advisor + `pg_class`, 2026-07-05):**
- **RLS OFF on 10 public tables:** `profiles`, `redemption_orders`, `daily_activity`,
  `streak_milestone_claims`, `user_badges`, `badges`, `marketplace_items`, `price_estimates`,
  `ma_trends`, `model_metrics`. Advisor level: **ERROR** (`rls_disabled_in_public`). Because Supabase
  grants `anon`/`authenticated` on public tables, **RLS-off = world read/write via the anon key.**
- **`pickup_requests` has 2 insecure policies** (`trashium_final_pickups_policy`,
  `trashium_update_pickups_policy`) that trust client-editable `user_metadata` + a hardcoded email →
  **privilege escalation.** Advisor level: **ERROR** (`rls_references_user_metadata`).
- **11 SECURITY DEFINER functions are callable by `anon`** via `/rest/v1/rpc/...` — including
  `set_payout_override` and `set_crew_zone`. Advisor level: **WARN**.
- **Hardcoded admin bypass:** `components/layout/navbar.tsx:174`
  (`user?.email === "singhamartya07@gmail.com"`) and the same email baked into three
  `supabase_schema.sql` policies (lines 650–657).
**Risk:** Critical — silent data leakage of every user's email/credits, order forgery, ML price
tampering, and admin impersonation. **This is a hard blocker for a public deploy.**
**To do (P0):** execute the already-written plan in **`DEPLOYMENT_SECURITY_CHECKLIST.md` §1–§4**:
- §1: enable RLS + add policies on all 10 tables; drop the 2 insecure `pickup_requests` policies.
- §2: `REVOKE EXECUTE ... FROM anon` on the SECURITY DEFINER functions.
- §4: remove the hardcoded email bypass in `navbar.tsx` (the server gate in `app/admin/page.tsx`
  + `check_is_admin()` policies already cover admin access correctly).
> ⚠️ **DB protocol:** apply on a **Supabase dev branch first**, test every role's flows, re-run the
> advisor after each section, then merge. Route all DDL through the connector — read-only verify
> first, wait for explicit "apply." Mirror changes into `supabase_schema.sql` (CLAUDE.md rule 10).

### 5. Weak Authentication — ✅ MOSTLY HANDLED (one toggle, P1)
**Evidence:** auth is **Supabase Auth via `@supabase/ssr`** — password hashing (bcrypt), JWT
signing/expiry, and refresh tokens in **httpOnly cookies** are all handled by the platform (an
established library, per the guide's own recommendation). Session refresh runs in `proxy.ts`.
**Gap:** the advisor flags **Leaked Password Protection = disabled** (WARN).
**To do (P1):**
- Dashboard → Auth → enable **Leaked Password Protection** (HaveIBeenPwned check).
- (Optional) rotate the shared demo crew password; consider requiring email confirmation + a stronger
  password policy if the deploy is public. MFA for admin is a nice-to-have, not required for a demo.

### 6. CORS Misconfiguration — ✅ N/A
**Evidence:** no custom API layer to misconfigure; Supabase manages CORS for its own endpoints, and
the host (Vercel) serves the frontend. **No wildcard CORS exists in the codebase.**
**To do:** none now. If a custom `app/api` route is ever added, use an explicit origin allowlist.

### 7. Missing HTTP Security Headers — ⚠️ REAL GAP (P1, easy win)
**Evidence:** `next.config.ts` contains **no `headers()` block** — so CSP, `X-Frame-Options`,
`Strict-Transport-Security`, `X-Content-Type-Options`, and `Referrer-Policy` are not set.
**Risk:** Moderate — clickjacking, MIME-sniffing, and no HTTPS pinning. Free protection currently
left on the table.
**To do (P1):** add a `headers()` async function to `next.config.ts` (or `vercel.json`) setting:
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, and a **Content-Security-
Policy**. ⚠️ CSP needs care: the app uses a **WebGL Ribbons** background (OGL), GSAP, Leaflet tiles
(external image host), Supabase (`*.supabase.co` for API/storage/realtime `wss:`), and Google Fonts —
the CSP must allow those `connect-src`/`img-src`/`style-src`/`font-src` origins or the app breaks.
Recommend starting with `Content-Security-Policy-Report-Only` to validate before enforcing.

### 8. Unsafe File Uploads — ⚠️ MODERATE (P1)
**Evidence:** the crew geo-proof upload (`app/crew/crew-content.tsx`) uses `accept="image/*"`
(a UX hint only), trusts `proofFile.type` as the content-type (`crew-content.tsx:125`), and has
**no file-size cap and no server-side MIME/extension check** (`handleProofFile`, L74–83). The target
bucket **`pickup-proofs` is public AND listable** — advisor: `public_bucket_allows_listing` (WARN).
**Risk:** Moderate-to-high **privacy** issue: these photos reveal **household GPS locations**, and a
public+listable bucket lets anyone enumerate every proof photo. Also unbounded upload size.
**To do (P1):** this is partly pre-planned in `DEPLOYMENT_SECURITY_CHECKLIST.md §5`:
- Flip `pickup-proofs` to **private**; drop the broad public SELECT policy; serve admin views via
  short-lived **signed URLs** (`createSignedUrl`, minted server-side).
- Scope the INSERT policy to the **crew role / path-prefixed to the crew's own pickups**.
- Add **client + server size limit** (e.g. ≤ 5 MB) and validate MIME on the server (edge function or
  the RPC path) rather than trusting `file.type`. Filenames are already derived from the pickup path,
  not the original filename — good.

### 9. Leaking Errors to Users — ✅ LOW (P2, optional)
**Evidence:** no custom API returns raw stack traces; Next.js **hides server stack traces in
production** by default; Supabase errors are surfaced as user-facing toasts and `console.error`'d
client-side only.
**Risk:** Low.
**Sentry integration (P2 — requested).** Adding **`@sentry/nextjs`** (new dependency) is a good call:
it delivers exactly what the guide asks for under #9 — capture **full error context server-side**
(timestamp, route, user id, sanitized input) while users only ever see generic messages. It also
signals production maturity. Plan:
- Run the official wizard: `npx @sentry/wizard@latest -i nextjs` — it scaffolds
  `sentry.{client,server,edge}.config.ts`, wraps `next.config.ts`, and adds an example route.
- Put the **Sentry DSN in host env vars**, not in code (`SENTRY_DSN` /
  `NEXT_PUBLIC_SENTRY_DSN`) — add both to `.env.example` (#1).
- **Scrub PII** before send (`beforeSend`): strip household emails, addresses, and the geo-proof
  lat/lng from breadcrumbs/events — these are exactly the sensitive fields RLS is protecting, so they
  must not leak into an error tracker either.
- Set a modest `tracesSampleRate` (e.g. 0.1) to stay within the free tier.
- Coexistence: Sentry's `next.config.ts` wrapper (`withSentryConfig`) must wrap the **existing
  `withNextIntl(...)`** export — compose them, don't replace. And it must not clobber the security
  `headers()` block from #7 (Sentry appends its own tunnel route; verify headers still apply).
Effort: ~1–2 hours including the PII scrub.

### 10. AI/LLM-Specific Security — ✅ N/A
**Evidence:** the app makes **no runtime LLM API calls** (no OpenAI/Anthropic SDK in `package.json`).
The "ML" is an **offline Python pricing pipeline** that publishes a static price table to Supabase; no
user-facing model inference or prompt surface exists.
**To do:** none.

---

## RLS rollout — doing it "at the last" safely

**Question: is it risky to flip RLS on right at the end?** The *timing* is fine — RLS is genuinely the
last thing that should be promoted to production. The **only** danger is flipping it **blind, on
production, without a rehearsal.** RLS-off is currently load-bearing: the app works today because the
anon key has unrestricted access. The instant RLS turns on, any read/write not covered by a policy
**silently returns empty or fails** — no thrown error, just missing data. So the rule is: **rehearse
on a Supabase dev branch, prove every role's flows there, then merge — do not toggle it on prod
minutes before the demo.**

### What specifically can break here
| Area | Why it could break | Covered by |
|---|---|---|
| **Daily ritual / streaks** | The `guard_profiles_self_update` trigger may block `log_daily_action`'s credit writes — **the one untested unknown** | deploy-checklist §1a — **must test on branch** |
| **Pricing / marketplace / badges** | `price_estimates`, `marketplace_items`, `badges` go blank without an explicit read policy | deploy-checklist §1c/§1e |
| **Profiles reads** | Dashboard/crew/admin read `profiles`; needs own-or-admin read policy | deploy-checklist §1a/§1b |
| **Browser client in a server component** | If any exists (CLAUDE.md rule 4), it newly fails under RLS as `anon` | Phase-0 grep, below |
| **Leaderboard / redemptions / daily log** | Go through SECURITY DEFINER RPCs → **bypass RLS, safe** | no change |
| **Crew GPS / tracking realtime** | Broadcast channels, not table `postgres_changes` → table RLS shouldn't gate them | **confirm during test** |

### De-risked rollout sequence
1. **Rehearse now, deploy later.** Create the dev branch and apply the full §1–§4 SQL there **today**,
   even though you'll only merge to prod at the end. Rehearsing early surfaces the trigger/credit-write
   issue while there's time to fix it — waiting until launch week is the actual risk, not RLS itself.
2. **Phase-0 grep** for any browser-client misuse in server components before enabling:
   check every `page.tsx`/server file imports `lib/supabase/server`, not `client`.
3. **Apply section by section, re-running `get_advisors(security)` after each** — never paste all at once.
4. **Full role test on the branch:** household (own data only, daily ritual credits, redeem), crew
   (zone pickups, proof upload), admin (sees all, marketplace CRUD, status advance), anon (blocked).
5. **Freeze the branch as the "RLS-on" state.** At launch, merge it — that's the single last step. If
   anything regresses, the branch merge is revertible.
6. Keep `supabase_schema.sql` in sync after merge (CLAUDE.md rule 10).

**Bottom line:** schedule the *merge* last, but do the *rehearsal* early. That gives you a "flip the
switch" launch step that's already been proven green.

---

## Pre-launch checklist (from the guide) — current status

| Check | Status |
|---|---|
| `.env` not committed to git | ✅ Verified (gitignored, not tracked) |
| Secrets set in the host's env config | ⬜ Do at deploy (Vercel env vars) |
| Debug mode off in production | ✅ Next.js prod build (verify no stray `NODE_ENV`/debug flags) |
| Database not publicly exposed | ❌ **RLS off on 10 tables — fix (P0)** |
| HTTPS enforced | ⬜ Host provides TLS; add **HSTS** header (P1, #7) |
| Rate limiting on public endpoints | ⚠️ Delegated to Supabase/host (P2, #2) |
| CORS restricted to known origins | ✅ N/A (no custom API) |
| Role-level security on all user-data routes | ❌ **The P0 RLS work (#4)** |
| Error messages show nothing internal | ✅ Next hides prod stack traces |

---

## Recommended execution order (the "flawless plan")

**Phase 0 — Prep (do first, no risk)**
1. Create a **Supabase dev branch** (or take a schema + policy snapshot) so every DB step is reversible.
2. Confirm every `profiles.role` value is correct (household/crew/admin) — the new policies trust it.

**Phase 1 — P0 database lockdown, REHEARSED EARLY on a dev branch** (pre-written in `DEPLOYMENT_SECURITY_CHECKLIST.md`)
3. Phase-0 grep for browser-client-in-server-component misuse (see RLS rollout §2).
4. §1 — enable RLS + add policies on the 10 tables; drop the 2 insecure `pickup_requests` policies.
5. §2 — revoke anon `EXECUTE` on the SECURITY DEFINER RPCs.
6. §3 — set `search_path` on the 4 flagged functions.
7. §4 — remove the hardcoded admin-email bypass in `navbar.tsx`.
8. Re-run `get_advisors(security)` after each section → expect all ERROR-level lints to clear. **Full
   role test on the branch** (esp. the daily-ritual credit-write trigger risk). Freeze the branch as
   the proven "RLS-on" state; **merge it as the final launch step** (see the RLS rollout section).

**Phase 2 — P1 app-layer hardening** (new work this audit adds)
9. Add HTTP security headers to `next.config.ts` (CSP in report-only first). (#7)
10. Enable Leaked Password Protection in the Auth dashboard. (#5)
11. Lock down the `pickup-proofs` bucket → private + signed URLs; add upload size/MIME validation. (#8)

**Phase 3 — P2 polish (incl. the two requested additions)**
12. **Integrate Zod** — env schema + high-value form validation (schedule pickup, signup, redemption). (#3)
13. **Integrate Sentry** (`@sentry/nextjs` wizard) with a PII scrub in `beforeSend`; compose its
    config wrapper with `withNextIntl`; DSN in host env vars. (#9)
14. Add `.env.example` (incl. the Sentry DSN vars); set host env vars at deploy. (#1)
15. Confirm Supabase/host rate limits (#2); rotate the demo crew password (#5).

**Phase 4 — Post-deploy verification** (per deploy-checklist §6)
16. Household can read/update only its own profile; cannot PATCH role/credits via REST.
17. Crew sees only its zone; admin sees all; anon cannot read profiles/orders or call RPCs.
18. `price_estimates` readable but not writable via anon; ML `publish_to_supabase.py` still works.
19. `get_advisors(security)` returns **zero ERROR-level lints**; headers verified via a response-header
    check; trigger a test error and confirm Sentry captures it **with PII scrubbed**.

---

## Effort estimate

- **Phase 1 (P0):** ~½ day — SQL is written; the work is *rehearse-early on a branch* + careful role
  testing + a final merge. Watch the one open question in deploy-checklist §1a (does the
  `guard_profiles_self_update` trigger block `log_daily_action`'s credit writes? — **must be tested on
  the branch**).
- **Phase 2 (P1):** ~½ day — headers (small, CSP needs iteration), one auth toggle, bucket + upload
  validation (a focused `crew-content.tsx` + storage-policy change).
- **Phase 3 (P2):** ~1 day — Zod (~½ day for env + high-value forms), Sentry (~1–2 hrs incl. PII
  scrub), plus `.env.example` and the small toggles.

New dependencies to be added (flagged per the no-new-deps guardrail, both explicitly requested):
**`zod`** and **`@sentry/nextjs`**.

Nothing here touches the frozen ML pipeline, the A4 credit trigger, realtime channels, or the theme.
Zod validates estimator input **shape only** — it must not alter the frozen quote contract.
