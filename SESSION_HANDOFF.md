# TRASHIUM — SESSION HANDOFF (paste into a fresh chat; fully self-contained)

You have **NO prior context** — everything you need is here. Do **not** re-derive state or
re-run the audit; the work below is finished and verified. After reading, **wait for my next
query** and act on it. (There is no pre-assigned task in this handoff.)

**Your role:** coordinating architect + reviewer. Application code is written in the **VS Code
Claude Code extension ("Fable")**; DB changes go through the **Supabase connector** available in
this chat. This chat writes specs/prompts for Fable and **reviews the resulting diffs by reading
the actual files** — never trust a summary. (Past reviews this way caught a `useGrouping` currency
bug, a stranded GSAP reveal, a landing string-coercion trap, and — most recently — a fictional
"offline cache" banner Fable missed. Read the real code every time.)

---

## 0. Project + stack

**Trashium** — incentivized waste-management platform (households + collection crews, West Bengal).
Households schedule recyclables pickups, earn **Green Credits**, unlock eco-levels; collectors/admins
manage routes, pricing, ops. Final-year project; goal is a polished, correct **live demo**.
Repo root: `S:\Developer\Projects\Final Year\Trashium`.

**Stack:** Next.js **16** (App Router) + React **19**, TypeScript 5, Tailwind v4 + custom CSS tokens,
shadcn/Base-UI/Radix, Motion + GSAP (ScrollTrigger), Leaflet/react-leaflet, Recharts, Supabase
(Auth + Postgres + RLS; **project id `fqbjjcbrxrokvdwkydze`**), next-intl (en/hi/bn). Python ML
pricing pipeline in `/ml` publishes to the Supabase `price_estimates` table.

> Next.js 16 + React 19 is newer than most training data — `proxy.ts` (not `middleware.ts`), async
> request APIs, RSC, `force-dynamic` are intentional. Read `node_modules/next/dist/docs/` before
> flagging them.

---

## 1. What's DONE (do not redo)

- **UI/UX rehaul ("Editorial Botanical")** — 6 sessions, COMPLETE. `tsc` clean; theme frozen; all
  ML/RPC/realtime/map tripwires preserved. Shared primitives: `components/motion/*` (GSAP
  `set`-then-`to` reveal, reduced-motion safe) + `components/ui/animated-number.tsx` (NumberFlow;
  credits keep grouping, ₹ uses `useGrouping:false`).
- **Tier 1** (A1 admin server role-gate, navbar collapse fix, NumberFlow clipping, C/D cleanups) — DONE.
- **Tier 2** (deleted QA account; A3 profile-save via RLS-off on `profiles`; A6 schema regen; A7 =
  keep aspirational landing numbers via fallback constants) — DONE.
- **Tier 3 — ALL DONE, reviewed, committed (`f007d750`):**
  - **A5** — unified pickup-status vocabulary to `pending/accepted/collected/completed/cancelled`;
    added a `CHECK` constraint; repaired every consumer (admin CSV/discrepancy, `DONE_STATUSES`,
    `PickupStatus`, StatusBadge, recent-pickups, crew). Phantom `confirmed`/`processed`/`assigned`/
    `dispatched` are gone.
  - **A4** — earn loop: a DB trigger credits the household on a pickup entering `completed`
    (details in §4). Idempotent; existing rows not backfilled.
  - **B2** — pickups geocode to sector-centre lat/lng at insert (`SECTOR_DEPOTS[location]`); crew
    depot from `profile.operating_zone` (fallback "Howrah"); "N stops without coordinates" banner.
    Legacy rows backfilled (0 missing coords).
  - **B5** — restored the admin "Pickup Management" table (filter + per-row status `Select` locked
    to the canonical five + loading skeleton).
  - **B6** — crew incident report now persists to `pickup_requests.notes`; all offline "cached
    mutations" fictions relabeled honest (the lock already *blocks* writes).
- **Lint cleanup — DONE.** `npm run lint` exits **0**. `.claude/**` + `.agents/**` added to
  `eslint.config.mjs` ignores; admin/dashboard `any`s typed; structural rules handled with scoped
  `eslint-disable` + reasons (React-Compiler set-state-in-effect / purity — working code, not refactored).
- **D4 doc-sync — DONE** (docs only): `AGENTS.md` palette hex corrected; `CLAUDE.md` fixed
  `quiz_wrong`→`quiz_strike`, `streak_freezes` default 0→1, and `CrewRouteMap`→`OptimizedRouteMap`
  as the active map. **These doc edits may be uncommitted at paste time — if so, commit them.**

## 2. What remains (deferred BY DESIGN — not oversights)

- **B9** — pricing-seam RLS skew: a **frozen-ML, report-only** note. Not actionable without touching
  the frozen pricing path. Leave as a note.
- **All RLS hardening** — parked in `DEPLOYMENT_SECURITY_CHECKLIST.md` for **deploy time**. Dev runs
  RLS-off intentionally. Do NOT enable RLS now.
- Optional, if I ask: a role-by-role end-to-end demo smoke test; the pre-existing design flags
  (`animate-bounce` in tracking, tier-icon `<img alt="">` in profile).

---

## 3. HARD GUARDRAILS (every phase)

- Keep the site running and `npx tsc --noEmit` **green**. `npm run lint` currently exits 0 — keep it.
- **Do NOT touch the ML pipeline:** `/ml/**`, `lib/pricing.ts`, `lib/pricing-math.ts`,
  `lib/estimate.ts`, the `price_estimates` table, the pickup quote in
  `components/dashboard/schedule-pickup-modal.tsx`, and the flow ML → Supabase → server `page.tsx`
  → props → client `*-content.tsx`. (A4's trigger only *consumes* the already-computed payout.)
- **Frozen logic** (restyle/extend around, don't rewrite): RPCs `redeem_marketplace_item`,
  `log_daily_action`, `get_daily_status`, `get_household_leaderboard`; the A4 trigger
  `tr_apply_pickup_completion`; the realtime channels; Leaflet map islands
  (`components/maps/OptimizedRouteMap`, `app/dashboard/tracking/tracking-map`).
- **Theme FROZEN.** Correct tokens (source of truth: `app/globals.css` CSS custom properties):
  Linen `#F4EFE3`, Parchment `#EDE5D8`, Terra `#C2703D`, Terra-deep `#A0522D`, Clay `#8B5E3C`,
  Sand `#D9BA8E`, Amber-warm `#E8A44A`, Sage `#8FA37E`, Sage-deep `#4A6741`, Moss `#3D5C3A`,
  Bark `#2A2218`, Smoke `#6B5744`, Destructive `#C0392B`. Fonts: h1/h2 Cormorant, h3–h6 Syne,
  body DM Sans, data JetBrains Mono. (AGENTS.md is now corrected, but always trust `globals.css`.)
- **RLS is intentionally OFF in dev.** Do NOT enable it / do RLS hardening now. Live now:
  `pickup_requests` + `global_impact` RLS ON; everything else OFF.
- Respect `prefers-reduced-motion`; reuse i18n keys (en/hi/bn); keep the server/client split.

---

## 4. Live DB facts (verified — trust these)

Supabase project `fqbjjcbrxrokvdwkydze`. Connector tools: `list_tables`, `execute_sql` (read-only
queries), `apply_migration` (DDL), `get_advisors`.

- **`pickup_requests`** cols incl.: `user_id` (uuid), `location` (text = one of the 5 sectors),
  `estimated_weight` (numeric, NOT NULL), `estimated_price` (numeric, nullable), `payout_override`
  (numeric, nullable), `latitude`/`longitude` (numeric, nullable), `notes` (text, nullable),
  `status` (text, NOT NULL) with `CHECK (status IN
  ('pending','accepted','collected','completed','cancelled'))`, `credited_at` (timestamptz — A4
  idempotency marker). Triggers: `tr_set_pickup_updated_at` (timestamp) + **`tr_apply_pickup_completion`**.
- **A4 earn loop** = `apply_pickup_completion()` (SECURITY DEFINER, `search_path=public`), fired
  BEFORE UPDATE OF status. On transition **into `completed`** (guarded `OLD.status IS DISTINCT FROM
  'completed'` AND `credited_at IS NULL`): `green_credits += round(COALESCE(payout_override,
  estimated_price,0))`, `kg_recycled += estimated_weight`, `co2_saved += estimated_weight*1.05`,
  `pickups_completed += 1`; rolls up `global_impact.total_kg_recycled`/`total_co2_saved`; sets
  `credited_at`. **Sole crediter on completion — never write these columns from the client.**
- **Profiles are SEEDED** with demo values unrelated to pickup rows (e.g. `pickups_completed=28` vs
  5 real completed rows). That's why A4 does **not** backfill the 48 pre-existing completed rows.
- **`global_impact`** (single row id=1) cols: `total_kg_recycled`, `total_co2_saved`,
  `total_households` (NO `total_green_credits` — the landing reads a fallback for that; A7).
- **`SECTOR_DEPOTS`** (`lib/constants.ts`) maps each of `Rishra/Howrah/Shyamnagar/Tarakeswar/
  Hugli-Chinsura` → `{lat,lng}`; keys == `OPERATIONAL_SECTORS` == `pickup_requests.location` values.
- `supabase_schema.sql` mirrors all of the above (kept authoritative — CLAUDE.md rule 10).

**DB change protocol:** verify with read-only `execute_sql` first; prefer a dev branch for risky
DDL; keep changes reversible; **wait for my explicit "apply" per change**; mirror schema changes
into `supabase_schema.sql`. A safe way to test a trigger without residue: run the mutation inside a
`DO $$ … RAISE EXCEPTION 'result: %', … $$;` block so it rolls back and returns the values.

---

## 5. How code changes work (Fable + review loop)

1. I ask for something → you verify current state (read real files / query DB read-only), surface any
   genuine product decision, then write a **paste-ready Fable prompt** with exact files, line refs,
   and the frozen/theme/ML guardrails restated.
2. I paste it into Fable; Fable edits + runs `npx tsc --noEmit` (the only fully-trusted gate).
3. I paste Fable's summary back → **you review the actual diff** (`git diff` in the sandbox, or read
   files) before declaring done. Verify frozen files are truly untouched.
4. Update `supabase_schema.sql` / `CLAUDE.md` when schema or conventions change. Save durable facts
   to memory.

---

## 6. File map (repo root)

- `CLAUDE.md` / `AGENTS.md` — agent rules + architecture (both now doc-synced/correct).
- `supabase_schema.sql` — authoritative, mirrors live (incl. A4/A5).
- `T3_*_SPEC.md` / `T3_*_BUILD.md` — Tier 3 specs + build handoffs (reference format).
- `S1_BUILD_SPEC.md … S6_BUILD_SPEC.md` + `VSCODE_HANDOFF_PROMPT.md` — rehaul specs/prompts.
- `DEPLOYMENT_SECURITY_CHECKLIST.md` — all deferred RLS/security hardening (deploy-time).
- `TIER1_FIX_PROMPT.md`, `AUDIT_HANDOFF_PROMPT.md`, `KNOWN_ISSUES.md`, `REALTIME_SEND_FIX_SPEC.md`
  — historical context.
- App: `app/{dashboard,crew,admin,marketplace,profile,login,signup}/…` (`page.tsx` = server/auth,
  `*-content.tsx` = client). `lib/{types,constants,gamification,badges,pricing*,estimate}.ts`.
  `components/{ui,dashboard,admin,maps,motion,landing,layout,materials}`.

---

## 7. Environment quirks

- **`S:` is a flaky network drive** — intermittent I/O errors; once corrupted a Next dev build
  (spurious `/login` 404, fixed by deleting `.next` + restart). If routes 404 oddly, clean-restart dev.
- `npx tsc --noEmit` is the only fully-trusted gate. **Sandbox bash is intermittently down/times
  out** (file tools are the source of truth; `Glob` is unreliable on `S:` — use `Grep`).
- Line endings are **LF** via `.gitattributes`. After Fable work, land it with
  `git add --renormalize . && git commit`. Latest commit at handoff time: **`f007d750`** (Tier 3 +
  lint). D4 doc edits may still be uncommitted.
- Auth-gated pages need role sessions; realtime + GPS + Leaflet can't be driven headlessly → some
  verification is a manual dev pass.

---

## 8. Ready

Everything actionable from the audit is closed. **Wait for my next query and act on it** — following
the guardrails above, verifying against real files/DB, and routing code to Fable + DB to the connector.
