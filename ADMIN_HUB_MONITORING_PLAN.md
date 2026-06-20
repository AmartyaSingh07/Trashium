# Admin Hub — Monitoring & Override Implementation Plan

> **Audience:** the VS Code Claude extension that will execute this later.
> **Status:** PLAN ONLY — do not build yet (per user, 2026-06-19).
> **Grounded against** the live `app/admin/admin-content.tsx` + `components/admin/*` +
> Supabase project `fqbjjcbrxrokvdwkydze` as they actually exist today.

---

## 0. Key finding — the admin hub is NOT empty (correct the mental model first)

The user said "I can't see any monitoring option." That's a **perception issue, not a missing
feature**: the monitoring UI already exists but is built almost entirely on **hardcoded mock data**,
so it reads as placeholder filler. What's already there:

| Surface | Where | State today |
|---|---|---|
| Pickup management table (real) | `admin-content.tsx` ~535+ | ✅ **Real** — `fetchFullFledgedData()` reads `pickup_requests` + `profiles` |
| Crew roster + zone assignment | `components/admin/crew-hub-assignment.tsx` (rendered line 603) | ✅ **Real** — reads `profiles` where role in (crew,collector), writes via `set_crew_zone` RPC |
| Marketplace admin (catalog/orders/badges) | `components/admin/marketplace-admin.tsx` (line 607) | ✅ Real |
| "Performance Analytics Matrix" | `admin-content.tsx` 447–498 | ❌ **Hardcoded mock** ("2,450 / Month", "3.4 pickups/user", "5 Pending") |
| "Sector-wise Throughput & Minting" | `admin-content.tsx` 500–524 | ❌ **Hardcoded mock** (per-sector kg/credits literals) |
| "Operations Live Monitoring Stream" | `admin-content.tsx` 527+ | ⚠️ Partly real (export button) — verify data source |
| `getSectorRankings()` | `admin-content.tsx` 113+ | ❌ **Hardcoded mock** people/values per sector |
| Price/payout estimator | — | ❌ **Removed** in the rehaul; only a TODO comment remains (lines 310–311) |

**So the rehaul is mostly: replace mock data with real queries + add the estimator/override back.**
Do NOT rebuild the crew roster or pickup table from scratch — they already work.

---

## 1. Decisions locked with the user

| Topic | Decision |
|---|---|
| **Scope** | All four surfaces: (1) crew roster + zones, (2) live pickup queue across crews, (3) payout estimator + override, (4) price-grid monitor. |
| **Override persistence** | **Persist with audit trail** (recommended & accepted in principle). Admin authority must *stick* and be *attributable*. Small schema change, admin-only RLS. If the user later wants zero-schema, fall back to display-only. |
| **Admin role** | Oversight of the crew hub + crew members, with **highest authority** to override a payout "after their own consideration." Household/crew are read-only on the final number; only admin overrides. |
| **Mock data** | Replace the hardcoded analytics/throughput/rankings with real aggregates where a source exists; clearly label anything that must stay illustrative. |
| **Override binding** (was open Q1) | **LOCKED: bind overrides to a specific pending pickup.** Admin selects a pending pickup, sees its system-computed payout, overrides if warranted, saves. Makes the override authoritative & meaningful (it changes what the household is paid), not an abstract calculator. |
| **Crew presence** (was open Q2) | **LOCKED: simpler last-seen first**, real-time GPS "broadcasting now" as a later enhancement (`TODO(crew-presence-realtime)`). Use a last-activity signal for v1; don't block the hub on Realtime wiring. |
| **Mock metrics with no source** (was open Q3) | **LOCKED: remove them** rather than fake them. No fiction presented as live ops data. A metric with no real source is omitted (or tagged "sample" only if structurally needed). |
| **ML model seam** | **Keep the estimator wired so the live model drops in at ONE function with zero UI/contract changes.** All three estimators (household/crew/admin) already call `estimateQuote()` → `getMarketValuePerKg()`; the live model replaces only that function body. See §10. |

---

## 2. Surface-by-surface plan

### Surface 1 — Crew roster + zones  ✅ mostly done, light polish only
`crew-hub-assignment.tsx` already lists crew and assigns `operating_zone` via `set_crew_zone`.
- **Add (optional):** an active/offline indicator. Real signal source = the GPS broadcast the crew
  page already emits (`tracking:{zone}` Supabase Realtime channel in `crew-content.tsx`). Admin can
  subscribe read-only to show "broadcasting now." If that's too much, show last-seen from a
  `profiles.last_activity_date` style column instead. Mark `TODO(crew-presence)`.
- **Do not** duplicate this component elsewhere.

### Surface 2 — Live pickup queue across crews  ✅ data real, presentation upgrade
The pickup table already reads all `pickup_requests` with `profiles`. Enhance for *monitoring*:
- Group/filter by **sector** (`location`) and by **assigned crew** so admin sees per-crew progress.
- Show the status lifecycle counts (pending → confirmed → collected → processed) as a small
  per-sector summary strip (these are **real** counts from the already-fetched `pickups` array —
  compute client-side, no new query).
- Keep the existing status-update controls (admin already advances pickup status here).

### Surface 3 — Payout estimator + override  ❌ build new (the core authority piece)
Rebuild the estimator that was ripped out, as a **supervisory** tool (not a peer calculator):
- Inputs reuse the shared contract: `estimateQuote({ wasteType, sector, quantityKg, risk })` from
  `lib/estimate.ts` — already live and table-backed. Same inputs as crew/household.
- **Display the system-computed result read-only:** `userPayoutTotal`, `userPayoutPerKg`,
  `marginPerKg`, `belowMinMargin` warning pill. Admin sees margin (household/crew don't).
- **Add a "Manual override (₹)" field** — admin's authority. If set, it becomes the authoritative
  payout for that pickup; else the computed estimate stands.
- **Bind it to a specific pickup (LOCKED):** admin picks a pending pickup from a selector, the card
  pre-fills `wasteType/sector/quantity` from that pickup and shows its computed payout; admin
  overrides if warranted, saves. The override writes back to *that pickup row*. This makes the
  override meaningful (it changes what the household is paid), not an abstract calculator. A
  free-standing "what-if" mode (no pickup selected) may exist as a secondary convenience, but the
  authoritative path is pickup-bound.
- Show a warning when an override pushes margin below `MIN_MARGIN_PER_KG` (0.50) — informed authority.
- Icon: the bucket image `price-estimator.png` (see §4), not a lucide glyph.

### Surface 4 — Price-grid monitor  ❌ build new (read-only)
A read-only view of the live `price_estimates` table — the ML output admin oversees:
- Render the 5×7 grid (sector × waste type) of `price_per_kg`, with `market_price_per_kg`,
  `logistics_per_kg`, `profit_per_kg`, `model_version`.
- **Flag risk cells:** highlight where `profit_per_kg < MIN_MARGIN_PER_KG` (0.50) or `price_per_kg = 0`
  (the table currently has min payout ₹0.00 — admin should *see* those).
- Show `model_version` + `created_at` so admin knows how fresh the ML publish is.
- Pure read; RLS already allows all to read `price_estimates`.

---

## 3. Schema + backend (for the persisted override)

Per CLAUDE.md #10, mirror everything in `supabase_schema.sql`.

**Option A (recommended) — columns on `pickup_requests`:**
```sql
ALTER TABLE pickup_requests
  ADD COLUMN payout_override   numeric,           -- admin-set final payout (INR); NULL = use estimate
  ADD COLUMN override_by       uuid REFERENCES profiles(id),
  ADD COLUMN override_at       timestamptz,
  ADD COLUMN override_reason   text;
```
- **Authoritative payout** for a pickup = `COALESCE(payout_override, estimated_price)`.
- **RLS / RPC:** writes must be **admin-only**. Prefer a SECURITY DEFINER RPC
  `set_payout_override(p_pickup_id uuid, p_amount numeric, p_reason text)` that checks the caller's
  role = admin, writes the four columns, and returns the new row — consistent with the existing
  `set_crew_zone` / `log_daily_action` RPC pattern. Do **not** let client write these columns directly.
- **Audit:** the four columns *are* the audit trail (who/when/why/amount). If a fuller ledger is
  wanted later, add a `payout_overrides` history table — `TODO(override-ledger)`.

**Why not display-only:** the user defined admin as having authority to make changes that *stick*.
An override that vanishes on refresh isn't authority. Cost is modest (4 columns + 1 RPC).

---

## 4. Icon

Reuse the bucket pattern already in the codebase (`dashboard-content.tsx` line 49):
```ts
const LEVEL_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/gamification-levels`;
// <img src={`${LEVEL_BUCKET_BASE}/price-estimator.png`} alt="" className="h-7 w-7 object-contain" />
```
Use it in the estimator card header. Remove the unused `TrendingUp`/`Calculator` import if no longer
referenced (grep first).

---

## 5. Replace the mock analytics with real aggregates

These are currently fabricated and make the hub look like a placeholder. Replace where a real
source exists; otherwise label clearly as illustrative.

| Mock today | Real source |
|---|---|
| `getSectorRankings()` people/values | `get_household_leaderboard()` RPC (already exists) filtered per sector, OR `profiles` grouped by `operating_zone`/`location`. |
| "Points Issuance Velocity 2,450/mo" | Aggregate `green_credits` deltas — if not tracked over time, compute a real total and **drop the "/Month"** rather than fake a rate. |
| "Sector throughput kg/mo & minted credits" | `SUM(estimated_weight)` and credit sums from `pickup_requests` grouped by `location`. Real and easy. |
| "5 Pending Approval" etc. | Real status counts from `pickup_requests` (already in the `pickups` array). |

**Rule:** no invented numbers in the admin hub after this pass. If a metric has no real source yet,
either omit it or tag it visually as "sample" — don't present fiction as live ops data.

---

## 6. UI / UX (use `/frontend-design`, stay in the existing system)

- Tokens already in `globals.css`: terra `#C2703D`, sage `#8FA37E`, bark `#2A2218`, linen `#F4EFE3`,
  amber `#E8A44A`; fonts `font-syne` (headings), `font-dm` (body), `font-jetbrains` (numbers/₹).
- The admin hub already uses a glass-card grid aesthetic — **match it**, don't introduce a new style.
- Lay the four surfaces as cards in the existing `lg:grid-cols-2` deck. Estimator + price-grid can
  pair on one row; roster + pickup-queue on another (roster/queue already exist — reflow, don't rebuild).
- Override field: clearly distinct (terra accent), with the computed baseline shown struck-through or
  beside it, and the margin-warning pill when below min.
- Respect `prefers-reduced-motion` for any CountUp/animation (CLAUDE.md #12). Reuse `count-up.tsx`.

---

## 7. Guardrails (house rules)

- **No hardcoded prices/rates** (#3) — estimator goes through `estimateQuote()`; override is an
  explicit admin action, not a fabricated rate.
- **Admin-only override enforced at the data layer** (RLS/RPC role check), not just hidden in UI.
  Household + crew stay read-only on the final number.
- **Server/client split** (#2/#4): `estimateQuote` is a server action already; the override write
  goes through a server RPC. Don't import the server Supabase client into client bundles.
- **Sectors from `lib/constants.ts`** (#5); waste types from `lib/types.ts`.
- **Schema sync** (#10) for the override columns/RPC.
- **Don't duplicate** `CrewHubAssignment` or the pickup table — extend what's there.
- **ML stays Python** (#9): admin overrides are a business action layered on top, not model retraining.

---

## 8. Verification (native, per the S: drive corruption warning)

The S: mount has appended NUL bytes to admin files before (fixed this session). After building, run
**natively** (sandbox reads lag/corrupt):
```bash
cd "S:\Developer\Projects\Final Year\Trashium"
git ls-files '*.ts' '*.tsx' | while read f; do n=$(tr -cd '\000' < "$f" | wc -c); [ "$n" -gt 0 ] && echo "NUL: $f $n"; done
npx tsc --noEmit && npm run lint && npm run dev
```
Functional checks:
- Admin override saves, persists across refresh, and is admin-only (a crew/household session cannot
  write it — test RLS).
- Authoritative payout = `COALESCE(payout_override, estimated_price)` everywhere it's read.
- Price-grid flags the ₹0 / below-margin cells that really exist in `price_estimates`.
- No remaining fabricated numbers presented as live metrics (grep `2,450`, `1,450 kg`, the rankings mocks).
- Margin warning fires when an override drops margin below ₹0.50/kg.
- **Model-seam invariant holds:** grep the new admin estimator for direct `price_estimates` /
  model calls — there should be **none**. It must call only `estimateQuote()`. Confirm connecting
  the live model would touch only `lib/estimate.ts` (no admin/crew/household component edits).
- `source` / `modelVersion` are surfaced (table-vs-model tag visible) so the future cutover is auditable.

---

## 9. Resolved decisions (were open questions — now LOCKED)

1. **Override binding → pickup-bound.** Overrides attach to a selected pending pickup and write back
   to that row. Authoritative, not an abstract calculator. (See §2 Surface 3.)
2. **Crew presence → last-seen first.** Use a simple last-activity signal for v1; real-time GPS
   "broadcasting now" is a later enhancement (`TODO(crew-presence-realtime)`).
3. **Mock metrics with no source → removed**, not faked. No fiction presented as live ops data.

---

## 10. ML model seam — keep the estimator drop-in ready (do NOT break this)

The whole point of the estimator architecture is that the **live ML model wires in at exactly ONE
place with zero UI or contract churn.** Preserve this through the admin build:

**The single swap point:** `getMarketValuePerKg(input)` in `lib/estimate.ts`. Today its body reads
`market_price_per_kg` from the `price_estimates` table and applies the risk/demand multipliers.
Tomorrow, the live model replaces *only that body*:

```ts
// TODAY (table-backed): read price_estimates, apply RISK_MULTIPLIER × DEMAND_MULTIPLIER here.
// TOMORROW (model-backed): call the model with (wasteType, sector, demand, risk, calendar);
//   the model already conditions on risk/demand → REMOVE the manual multipliers in this branch.
async function getMarketValuePerKg(input): Promise<{ value; source; modelVersion }>
```

**Rules to keep it seamless (enforce during the admin build):**
- **Never call the model or `price_estimates` directly from any UI** (household, crew, or the new
  admin estimator). Every estimate flows through `estimateQuote()` → `getMarketValuePerKg()`. The
  admin estimator is just another caller — same input/output types.
- **Do not duplicate the pricing math** into the admin component. Reuse `estimateQuote()` and the
  `EstimateInput`/`EstimateResult` types from `lib/estimator-types.ts`. If admin needs margin
  fields, they already exist on `EstimateResult`.
- **Keep `source` + `modelVersion` on the result** and surface them in the admin price-grid /
  estimator (e.g. a "table" vs "model" tag, and the model version). This makes the eventual cutover
  visible and auditable — admin can see at a glance whether a number came from the table or the
  live model.
- **The admin override is layered ON TOP of the seam, not inside it.** Flow:
  `estimateQuote()` → computed payout → admin may override → `COALESCE(payout_override, computed)`.
  The override never touches `getMarketValuePerKg`; swapping in the model changes the *computed*
  baseline only, and overrides keep working unchanged.
- When the model lands, the **only** file that changes for pricing is `lib/estimate.ts` (plus
  whatever client/env the model call needs). No admin/crew/household component edits. Verify this
  invariant holds after the admin build — if the admin estimator reaches around the seam, that's a
  regression.

**Net:** after the admin hub ships, connecting the real model is still a one-function change.
```
