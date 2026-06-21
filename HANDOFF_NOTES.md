# Trashium — Context Handoff (LATEST: 2026-06-21, session 3)

> Paste this whole file at the start of a new chat to continue without context loss.
> The CURRENT session (live landing rates + PWA support + legal/info pages) is documented first.
> Previous sessions are preserved below. Read together with `CLAUDE.md`.

---

## ✅ DONE THIS SESSION (2026-06-21, session 3)

### 1. Dynamic Landing Page Rates Matrix
- **Objective:** Eliminate hardcoded rates from the public landing page in accordance with CLAUDE.md Rule 3.
- **Implementation:**
  - Added `TILE_MATERIAL_TYPES` in [constants.ts](file:///s:/Developer/Projects/Final%20Year/Trashium/lib/constants.ts) containing 14 operational material categories.
  - Implemented `getTileRatesBySector()` in [pricing.ts](file:///s:/Developer/Projects/Final%20Year/Trashium/lib/pricing.ts) to query the Supabase `price_estimates` table and group rounded payout rates by sector.
  - Built [FlippingRates](file:///s:/Developer/Projects/Final%20Year/Trashium/components/materials/flipping-rates.tsx) component rendering a responsive matrix of flipping cards. Each card displays the live rate, category icon, and a witty ecological insight on its back.
  - Refactored [page.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/app/page.tsx) to fetch the rates on the server side and pass them to the client component.

### 2. Progressive Web App (PWA) Support
- **Objective:** Enable platform installation and offline capability.
- **Implementation:**
  - Created web manifest at [manifest.ts](file:///s:/Developer/Projects/Final%20Year/Trashium/app/manifest.ts) using brand-themed colors.
  - Added service worker `sw.js` and registered it via `ServiceWorkerRegister` in [sw-register.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/components/ui/sw-register.tsx).
  - Built an install prompt component [pwa-install-button.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/components/ui/pwa-install-button.tsx) which integrates into the navbar (collapsing to a minimal icon-only button when scrolled/collapsed, or showing full width in mobile menu).
  - Wired in [layout.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/app/layout.tsx).

### 3. Legal and Information Pages Expansion
- **Objective:** Add standard company information and policy pages with consistent high-end styling.
- **Implementation:**
  - Added page routes under `/about`, `/careers`, `/cookie-policy`, `/privacy-policy`, `/terms-of-service`.
  - Extracted shared structures into [legal-page.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/components/layout/legal-page.tsx), [page-hero.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/components/layout/page-hero.tsx), and [page-shell.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/components/layout/page-shell.tsx).
  - Updated footer links in [footer.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/components/layout/footer.tsx) to route to the new paths.

---

## ⚠️ ACTIVE ISSUES — carry forward (these bit us repeatedly)

1. **`S:` drive corrupts/lags non-native writes.** The sandbox mount intermittently (a) serves
   **stale/truncated cached bytes** on read (grep/wc/git report phantom failures, "binary file
   matches", wrong line counts, files missing from `ls`) and (b) **appends NUL bytes** to files the
   VS Code extension or tools write. This session we hit BOTH: `app/admin/admin-content.tsx` got NUL
   garbage appended **twice** (3,523 then 2,110 bytes) — harmless to logic but **breaks tsc/dev**.
   - **Rule:** the Read/Write/Edit file tools are the source of truth. Do final `tsc`/`build`/NUL
     scans **natively**, not via sandbox.
   - **NUL scan:** `git ls-files '*.ts' '*.tsx' | while read f; do n=$(tr -cd '\000' < "$f" | wc -c); [ "$n" -gt 0 ] && echo "$f $n"; done`
   - **NUL strip (the fix we used):** `cp f f.bak && tr -d '\000' < f.bak > f` then re-verify 0 NUL.
   - If a fresh `ls`/grep says a file/feature is "missing," **re-check via the file tools before
     concluding** — we wrongly told the user the admin work wasn't done because of a stale read.
2. **Native `tsc` is the only trustworthy gate.** The assistant cannot run native `tsc`/`npm` here.
   After any change, the user must run:
   `cd "S:\Developer\Projects\Final Year\Trashium" && npx tsc --noEmit && npm run dev`.

---

## Project (unchanged baseline)

Next.js 16 (Turbopack) / React 19 / TS5 / Tailwind v4 / Supabase. Roles: `household` →
`/dashboard`,`/marketplace`,`/profile`; `crew` → `/crew`; `admin` → `/admin`.
Repo: `S:\Developer\Projects\Final Year\Trashium`. **Supabase project ref: `fqbjjcbrxrokvdwkydze`**
(ACTIVE_HEALTHY). Sectors: Rishra, Howrah, Shyamnagar, Tarakeswar, Hugli-Chinsura.
Brand tokens (globals.css): terra `#C2703D`, sage `#8FA37E`, bark `#2A2218`, linen `#F4EFE3`,
amber `#E8A44A`. Fonts: `font-syne` (headings), `font-dm` (body), `font-jetbrains` (numbers/₹).

---

## ✅ DONE THIS SESSION

### 1. Kinetic Typography Loader — DONE & wired
3D "fly-in/fly-out" kinetic text loader themed to Trashium's pipeline.
- **Phrases (all five, cycling):** `SEGREGATING → UPCYCLING → CALCULATING PAYOUT → PLANTING SEEDS →
  SAVING PLANETS`. Multi-word phrases keep spaces as non-animated gaps.
- **Files:** `components/ui/loading-animation.tsx` (typed `KineticTypographyLoader`, props `words?`,
  `label?`, `fadeOut?`; `'use client'`; reduced-motion safe per #12 — cross-fade, no 3D throws);
  `app/globals.css` (`.loader-container` bark backdrop + linen→amber gradient chars + terra glow,
  `@keyframes fly-in`/`fly-out`, `.loader-container--out`, reduced-motion block);
  `app/loading.tsx` (root route-transition loader); `components/ui/site-load-gate.tsx` (first-open
  splash, **once per session** via `sessionStorage`, fades ~1.4s / 0.7s reduced-motion, wired in
  `app/layout.tsx`); `app/login/page.tsx` + `app/signup/page.tsx` (full loader overlay while `loading`).
- **UX (locked):** loader is event-bound — users see 1–2 words, NOT the full ~17s cycle. Five phrases
  are a *pool*, not a forced wait.
- **`proxy.ts`:** user fixed the Next-16 middleware→proxy deprecation separately (`middleware.ts`→
  `proxy.ts`, `middleware()`→`proxy()`); `CLAUDE.md` updated. `lib/supabase/middleware.ts` helper left as-is.

### 2. Price Estimator Rehaul — built by VS Code extension, verified by us
**THREE estimators existed, all with hardcoded rates (CLAUDE.md #3 violation); all now route through
one shared, model-ready contract.** The ML model predicts **market value/kg only** — logistics/payout/
margin are deterministic math AFTER it.
- **Shared contract / model seam:**
  - `lib/estimator-types.ts` — `EstimateInput` (wasteType, sector, quantityKg, risk, demand?,
    distanceKm?, pincode?, latlng?, boostPct?) + `EstimateResult`.
  - `lib/pricing-constants.ts` — mirrors `/ml/config.py`: `COMMISSION 0.15`, `LOGISTICS_BASE 111.06`,
    `LOGISTICS_PER_KM 4.80`, `MIN_MARGIN_PER_KG 0.50`, `RISK_MULTIPLIER {1.0/0.92/0.82}`,
    `DEMAND_MULTIPLIER {0.95/1.0/1.07}`, `ROAD_FACTOR 1.3`, `HUB_LATLNG {22.68,88.34}`,
    `SECTOR_HUB_DISTANCE_KM` (Rishra 6.9, Howrah 15.9, Shyamnagar 23.8, Tarakeswar 52.3,
    Hugli-Chinsura 33.9), **`EXPECTED_STOPS_PER_RUN 8`** (from §4).
  - `lib/pricing-math.ts` — pure client-safe math mirroring `/ml/pricing.py`.
  - **`lib/estimate.ts` — THE MODEL SEAM.** `'use server'`. `estimateQuote(input)` →
    `getMarketValuePerKg(input)` (reads `price_estimates.market_price_per_kg` × risk×demand today).
    **To connect the live model: replace ONLY `getMarketValuePerKg`'s body** + drop the manual
    multipliers in that branch. `TODO(connect-model)`. No UI/contract change needed.
- **Estimators wired to `estimateQuote()`:** `components/dashboard/schedule-pickup-modal.tsx`
  (household, live preview + boost); `app/crew/crew-content.tsx` (crew on-site recalc; "penalty"
  remapped to Low/Med/High risk; sector from `operating_zone`); `app/admin/admin-content.tsx`
  (old `baseRate` switch removed).
- **Icon:** `price-estimator.png` in the **`gamification-levels`** bucket (plural). URL:
  `${SUPABASE_URL}/storage/v1/object/public/gamification-levels/price-estimator.png`.
- **Plan:** `PRICE_ESTIMATOR_REHAUL_PLAN.md`.

### 3. Admin Monitoring + Payout Override Hub — built by extension, verified by us
Admin hub was **not empty** (already had `CrewHubAssignment`→`set_crew_zone` RPC, real pickup table,
marketplace admin, plus **hardcoded MOCK analytics** that looked like filler). Decision: admin =
oversight + **highest authority to override payouts** (household/crew read-only on final number).
- **New components (rendered in `admin-content.tsx` ~42–43, 539–543):**
  `components/admin/payout-override.tsx` (pickup-bound supervisory estimator + manual override),
  `components/admin/price-grid.tsx` (read-only `price_estimates` 5×7 monitor).
- **DB — APPLIED LIVE (migration `admin_payout_override`):** `pickup_requests` gained
  `payout_override NUMERIC`, `override_by UUID REFERENCES profiles(id)`, `override_at TIMESTAMPTZ`.
  Authoritative payout = `COALESCE(payout_override, estimated_price)`. RPC
  `set_payout_override(p_pickup_id uuid, p_amount numeric)` — SECURITY DEFINER, **admin-only role
  guard**, negative check, `GRANT EXECUTE … TO authenticated`. Mirrored in `supabase_schema.sql`
  (~63–65 cols, ~698–740 RPC).
- **Plan:** `ADMIN_HUB_MONITORING_PLAN.md` (locked: override pickup-bound; crew presence = last-seen
  first; mock metrics → remove not fake; seam stays one-function). ⚠️ The plan's "replace mock
  analytics / remove fabricated metrics" work **may not be fully implemented** — verify (OPEN ITEM #1).

### 4. Per-Stop Logistics Fix — DONE this session (fixes the crew ₹0)
**Root cause of crew "₹ Dynamic Sync = 0":** NOT a bug, NOT waiting for the model. The full ~₹111
cost of one truck *trip* was charged to a single household ÷ weight; for 12.5 kg cheap plastic
(~₹13/kg) logistics/kg (₹15) > value/kg → floored to ₹0. The model only predicts market value, so it
would NOT fix this.
- **Fix (2 lines, seam untouched):** `lib/pricing-constants.ts` added `EXPECTED_STOPS_PER_RUN = 8`;
  `lib/pricing-math.ts` `estimateLogisticsCost` → `(LOGISTICS_BASE + LOGISTICS_PER_KM*km)/EXPECTED_STOPS_PER_RUN`.
- **Verified:** Plastic Howrah 12.5 kg ₹0 → **₹106**; 5 kg → ₹28; Tarakeswar 12.5 kg → ₹84; Metal
  12.5 kg → ₹1,262. `git diff lib/estimate.ts` empty (seam intact). `EXPECTED_STOPS_PER_RUN=8` is a
  tunable ops assumption.
- **Plan:** `LOGISTICS_PER_STOP_FIX_PLAN.md`.

### 5. PostgREST embed bug — FIXED this session
Adding `override_by → profiles(id)` made a **second** FK between `pickup_requests` and `profiles`, so
the admin fetch's shorthand `profiles(...)` errored ("more than one relationship was found…").
- **Fix:** `app/admin/admin-content.tsx` ~line 101 →
  `.select('*, profiles!pickup_requests_user_id_fkey(full_name, email)')`.
- Other `profiles(` embeds checked: only `app/admin/page.tsx` (on `redemption_orders`, different
  table, single FK) — unaffected. Future override-author UI: use `profiles!pickup_requests_override_by_fkey(...)`.

---

## Live DB facts (verified, project `fqbjjcbrxrokvdwkydze`)
- `price_estimates` **populated** (35 rows = full 5×7 grid, real ML values: Metal ~₹105–109/kg,
  Plastic ~₹8–9/kg, Paper ~₹6–7/kg; `min(price_per_kg)=0` for some combos = legit post-logistics).
  Estimators are **already live** on this table — blank weight → "₹ Dynamic Sync"; weight → real number.
- Buckets: `gamification-badges`, `gamification-levels` (has `price-estimator.png` + Level01–20 art),
  `marketplace-items`. All public.
- `pickup_requests` FKs to profiles: `pickup_requests_user_id_fkey` (household) +
  `pickup_requests_override_by_fkey` (new) — disambiguate embeds.

---

## ⚠️ VERIFY FIRST on resuming (not yet checked natively)
```bash
cd "S:\Developer\Projects\Final Year\Trashium"
git ls-files '*.ts' '*.tsx' | while read f; do n=$(tr -cd '\000' < "$f" | wc -c); [ "$n" -gt 0 ] && echo "NUL: $f $n"; done
npx tsc --noEmit && npm run dev
```
Eyeball: loader on first load (incognito) + auth redirect; crew estimator 12.5 kg plastic ~₹106 (not 0);
admin hub renders payout-override + price-grid; admin "Fetch Error" gone.

---

## OPEN ITEMS / NEXT TASKS (start here)
1. **Verify admin mock-data cleanup** (`ADMIN_HUB_MONITORING_PLAN.md` §5): replace hardcoded analytics
   (`2,450/Month`, sector-throughput literals, `getSectorRankings` mocks) with real aggregates or
   remove. Confirm if the extension did this; if not, it's the next build. Rule: no fiction as live data.
2. **Admin override UI polish:** confirm `payout-override.tsx` is pickup-bound (select pending pickup →
   computed payout → override → `set_payout_override`), shows margin + `belowMinMargin`, and that
   payout displays everywhere read `COALESCE(payout_override, estimated_price)`.
3. **`TODO(ml-logistics-sync)`:** the `/EXPECTED_STOPS_PER_RUN` divisor was applied in the app but NOT
   in `/ml/pricing.py` + `/ml/config.py`. Sync Python + re-run ML publish, or document divergence.
4. **`TODO(connect-model)`:** when model ready, swap ONLY `getMarketValuePerKg` in `lib/estimate.ts`.
5. **Map-pin distance** (optional): `SECTOR_CENTRE_LATLNG` + Leaflet pin UI unwired; uses
   `SECTOR_HUB_DISTANCE_KM` fallback. `TODO(distance-matrix)`.
6. **Landing rates** (`app/page.tsx` ~46–48): decorative "₹12/45/kg" cards contradict the live
   estimator. `TODO(landing-rates)` — cosmetic.

---

## Uncommitted / git
This session's loader+estimator+admin+logistics work is **unstaged** (user commits after eyeballing).
`proxy.ts` rename already committed. Untracked: three PLAN `.md`s, `lib/estimate.ts`,
`lib/estimator-types.ts`, `lib/pricing-constants.ts`, `components/admin/payout-override.tsx`,
`components/admin/price-grid.tsx`, the two handoff files. DB migration `admin_payout_override` is
**already live** (no file to run). Suggested commits: (a) loader, (b) estimator contract + 3
estimators + logistics fix, (c) admin hub + override.

---

## Hard rules (unchanged)
- **No hardcoded prices** (#3) — via `estimateQuote()` / `price_estimates` / constants file.
- **Model seam stays one-function** — UIs never touch the model/`price_estimates` directly; override
  layers ON TOP (`COALESCE`), never inside the seam. Admin-only override at data layer (RPC role check).
- Server/client split (#2/#4); Leaflet `ssr:false` (#7); sectors from `lib/constants.ts` (#5);
  reduced-motion (#12); schema sync `supabase_schema.sql` (#10); ML stays Python (#9); don't duplicate
  `CrewHubAssignment`/pickup table. **Trust file tools over sandbox; verify natively.**

---
---

# [HISTORICAL] Trashium — Gamification & Daily Ritual Overhaul Handoff

> This document captures the completed implementation of the **Daily Grove Ritual** system, backend streak tracking, leaderboard integrations, and current workspace health.

## TL;DR

The household gamification and daily ritual features are now **fully implemented, authoritative, and deployed**. 
All source files are clean (0 NUL-byte corruption detected), and the Next.js production build compiling type-checks with **zero errors**.

---

## 1. Features Implemented

### A. Server-Authoritative Daily Ritual Engine (Backend)
- **Tables Created:**
  - `daily_activity` — Tracks login, waste segregation log, and quiz correct/incorrect counts per user per day.
  - `streak_milestone_claims` — Keeps a ledger of claimed streak milestone rewards (3, 7, 14, 30 days) to prevent double claiming.
- **RPC Functions (`SECURITY DEFINER`):**
  - `log_daily_action(p_action TEXT)` — The single authority for daily credits. Handles streak validation, milestone claims, freezes/shields consumption, and applies the streak multiplier.
  - `get_daily_status()` — Hydrates the client dashboard with today's activity progress, streak stats, and freezes count.

### B. Interactive Daily Grove Ritual Widget
- A custom widget ([daily-ritual.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/components/ui/daily-ritual.tsx)) integrates a weekly canopy progress circle, streak shield counts, and milestone chests.
- Action combo meters track check-in, waste sorting, and eco quizzes.
- Streak multipliers scale credits dynamically (e.g. `1 + 0.05 * streak`).

### C. Households-Only Leaderboard System
- **RPC Function:** `get_household_leaderboard()` filters out administrative/crew accounts, resolves sectors from pickup history, and ranks real household users by Green Credits.
- The UI ([leaderboard-podium.tsx](file:///s:/Developer/Projects/Final%20Year/Trashium/components/ui/leaderboard-podium.tsx)) is fully wired, featuring staggered load animations and a "credits to overtake" helper.

### D. Visual Polish & Brand Integration
- Unified color palette classes (`Cream`, `Espresso`, `Sage`, `Copper`) and gradient flows (`from-amber-warm to-terra`).
- Fully accessible via standard screen transitions and respects `prefers-reduced-motion` settings.

---

## 2. Current State & Verification

- **TypeScript Compilation:** Passed successfully (`npx tsc --noEmit` is clean).
- **Environment:** Next.js 16.2.4 (Turbopack) + React 19 + TypeScript 5, Supabase, Tailwind CSS v4.
- **File System Health:** A full search for zero-byte NUL corruption returns clean.

---

## 3. Next Steps & Phase 2 Action Items

1. **Storage Buckets:** Verify that the Supabase storage buckets (`gamification-badges`, `marketplace-items`, `gamification-levels`) are created and populated.
2. **Artwork Uplink:** Upload custom PNG icons for badges `b1..b15` to match the filenames mapped in [IMAGE_MANIFEST.md](file:///s:/Developer/Projects/Final%20Year/Trashium/IMAGE_MANIFEST.md) and execute SQL updates on the database `badges` table to associate them.
3. **Turn on RLS (Phase 2):** When ready to enforce policies on the new tables, uncomment the staged RLS code at the end of [supabase_schema.sql](file:///s:/Developer/Projects/Final%20Year/Trashium/supabase_schema.sql).
