# Price Estimator Rehaul — Implementation Plan

> **Audience:** the VS Code Claude extension that will execute this plan.
> **Author context:** scoped against the live codebase + the v2 ML pricing contract
> (`/ml/pricing.py`, `/ml/config.py`, `Trashium_Pricing_ML_Context.md`) on 2026-06-19.
> **Two goals:** (1) swap the hardcoded estimator icon for the Supabase bucket icon;
> (2) rehaul the estimator so its **inputs and math match the v2 ML serving contract**,
> ready for the live model to be dropped in later.

---

## 0. Decisions locked with the user (do not re-litigate)

| Topic | Decision |
|---|---|
| **Distance input** | Support **both**: a **pincode field** (reliable default) **and** an optional **Leaflet map pin** (lat/lng → haversine-to-nearest-hub × road-factor). Pin is an enhancement; pincode is the fallback so the form is never blocked. |
| **Quality Defect Risk** | **Add** a Low / Medium / High selector — it is a real v2 model input. |
| **Scope** | **Full**: rebuild both estimators' inputs to match the model, define a typed `estimate()` contract, route everything through `lib/pricing.ts`, and **stub the model call** behind that contract so the live model drops in with no UI churn. |
| **Icon** | Use `price-estimator.png` from the `gamification-levels` bucket; remove the hardcoded lucide `Calculator` icon. |
| **Role hierarchy** | **Admin = oversight + highest authority.** The admin hub *monitors* the crew hub and crew members; its estimator is a **supervisory/override** tool, not a peer data-entry calculator. Admin can view the model/crew result and **manually override the final payout with authority** (logged). **Crew = on-site field recalculation.** **Household = self-serve booking preview.** All three read the same `estimateQuote()`; only **admin** may override its output. |
| **Landing page rates** | `app/page.tsx` (lines 46–48) shows decorative "₹12/kg / ₹8 / ₹45" marketing cards. Not a live calc, but they'll contradict the real estimator. **Decision: leave functionally, but flag** — replace with live `price_estimates` values or generic copy in a later pass. `TODO(landing-rates)`. |

⚠️ **Honest caveat on the map distance** (tell the reviewer, keep in code comments):
the v2 model was trained on **pincode → hub road distance**. A map pin yields **straight-line
(haversine)** distance, which underestimates road distance (~1.3× typical). We multiply by a
`ROAD_FACTOR` constant as an approximation and leave a `TODO(distance-matrix)` to swap in a real
routing distance later. This is acceptable for the demo; it is not the exact training feature.

---

## 1. The v2 ML serving contract (the spec we are matching)

Source of truth: `/ml/pricing.py` + `/ml/config.py` + `Trashium_Pricing_ML_Context.md` §6, §"serve-time".

**Model predicts:** `Market_Value_perKg` (INR) — the only uncertain quantity. Everything else is
deterministic algebra applied *after* the prediction.

**Model inputs (price drivers only):** Material Type (→ our `WasteType`), Region (→ our
operational sector), Market Demand (Low/Med/High), Quality Defect Risk (Low/Med/High), calendar
(month, day-of-week, is_weekend).

**NOT model inputs — applied deterministically after** (this is the v1-leakage fix, do not feed
these to the model): Quantity, Distance, Logistics.

**Serve-time flow:**
```
1. user → registered pincode (or map pin) → hub distance_km
2. logistics_cost   = LOGISTICS_BASE + LOGISTICS_PER_KM * distance_km   (111.06 + 4.80×km)
3. logistics_per_kg = logistics_cost / quantity_kg
4. market_value/kg  = MODEL.predict(material, region, demand, risk, calendar)   ← the only ML call
5. user_payout/kg   = market_value/kg * (1 - COMMISSION) - logistics_per_kg     (COMMISSION = 0.15)
6. margin/kg        = COMMISSION * market_value/kg
7. payout_total     = max(user_payout/kg, 0) * quantity_kg
```

Constants (mirror exactly, do **not** invent): `COMMISSION = 0.15`, `LOGISTICS_BASE = 111.06`,
`LOGISTICS_PER_KM = 4.80`, `MIN_MARGIN_PER_KG = 0.50`, `DEFAULT_DEMAND = "Medium"`,
`RISK_MULTIPLIER = {Low:1.00, Medium:0.92, High:0.82}`, `DEMAND_MULTIPLIER = {Low:0.95, Medium:1.00, High:1.07}`.

**Sectors (5):** Rishra, Howrah, Shyamnagar, Tarakeswar, Hugli-Chinsura (`lib/constants.ts`).
**Waste types (7):** Plastic, Paper, Glass, Metal, E-Waste, Organic, Mixed (`lib/types.ts`).

---

## 2. Current state — what exists today

### 2a. `price_estimates` table (live Supabase, project `fqbjjcbrxrokvdwkydze`)
Columns: `waste_type, area, price_per_kg, logistics_per_kg, market_price_per_kg, profit_per_kg,
model_version, created_at`. Unique on `(waste_type, area)`. This is the **nightly-published
aggregate grid** (5 sectors × 7 types). It is *not* per-request; it has no distance/risk/demand
dimension. **Keep using it as the cold-start / aggregate fallback.**

### 2b. `lib/pricing.ts` (server) + `lib/pricing-math.ts` (client)
- `getRate(sector, wasteType)` → reads one `price_estimates` row.
- `quoteFromRate(rate, weightKg)` / `quotePickup(...)` → turns a row + weight into a quote.
- `applyBoost(amount, pct)` (in `pricing-math.ts`) — marketplace payout booster, client-safe.
- **Gap:** there is no per-request `estimate()` that takes distance + risk + demand the way the
  v2 model does. The table-based path ignores them.

### 2c. Household estimator — `components/dashboard/schedule-pickup-modal.tsx`
✅ Already correct in spirit: reads `price_estimates` (no hardcoded rates), applies boost.
❌ Missing v2 inputs: no quality risk, no distance/pincode, weight is a coarse 4-bucket range.

### 2d. Crew on-site estimator — `app/crew/crew-content.tsx` (lines ~44–58 + ~322–373) — **ALSO HARDCODED**
This is the **third** estimator (easy to miss: it uses a 🧮 emoji + `getCalculatedPayout`, not the
lucide icon). Purpose is legitimate and distinct: an **on-site doorstep recalculation** for when the
collected weight/quality differs from the household's booking ("if load discrepancies occur").
❌ **Hardcoded rates** again: `rate = 12` (PET), `8` (Cardboard), `45` (Aluminum) — lines 52–54.
❌ Only **3 materials**, not the 7 `WasteType`s.
❌ Models quality as a **"Quality Impurity Penalty"** (`0 / 0.2 / 0.5 / 0.8` linear multiplier) —
   the right *concept* (this is Quality Defect Risk) but the **wrong math**: the ML contract uses
   `RISK_MULTIPLIER = {Low 1.00, Medium 0.92, High 0.82}`, applied to **market value**, not a flat
   payout haircut.
❌ **No sector / distance / logistics** — it's pure `weight × rate × (1 − penalty)`.
→ Same rule-3 violation; must route through `estimateQuote()` like the others.

### 2e. Admin estimator — `app/admin/admin-content.tsx` (lines ~358–411) — **THE MAIN PROBLEM**
❌ **Hardcoded `switch` of base rates** (`Plastic ₹12, Paper ₹8, Metal ₹45, …`).
❌ **Fake `±5%` urban/rural multiplier** (`mapSectorToArea`).
❌ Completely bypasses `price_estimates` AND the ML model.
→ **Violates CLAUDE.md rule #3 ("Do not hard-code prices").** This is the core rip-out.
The lucide `Calculator` icon is imported at **line 38**; the estimator card JSX renders lower down.

---

## 3. Target architecture

```
                          ┌─────────────────────────────────────────┐
   Estimator UI  ─────────▶  lib/pricing.ts :: estimateQuote(input)  │
  (household +            │   1. resolve distance_km (pincode|pin)   │
   admin + crew,         │   2. get market_value/kg:                │
   typed input)          │        • LIVE: callModel(input)  [stub]  │
                          │        • FALLBACK: price_estimates row   │
                          │   3. apply pricing-math (commission,     │
                          │      logistics, payout, margin)          │
                          │   → returns typed EstimateResult         │
                          └─────────────────────────────────────────┘
```

**Single typed contract** both UIs call. The model is hidden behind `getMarketValuePerKg()`
which today returns the table value and tomorrow calls the real model — **no UI change needed
when you connect it.**

---

## 4. Files to create / change

### NEW — `lib/estimator-types.ts`
Typed contract shared by UI + pricing. (Keep types separate so client components can import
without pulling server-only Supabase code.)
```ts
export type RiskLevel = "Low" | "Medium" | "High";
export type DemandLevel = "Low" | "Medium" | "High";

export interface EstimateInput {
  wasteType: WasteType;          // material
  sector: string;                // one of OPERATIONAL_SECTORS (region)
  quantityKg: number;            // exact or midpoint of a range
  risk: RiskLevel;               // NEW — real model input
  demand?: DemandLevel;          // optional; defaults to "Medium"
  distanceKm?: number;           // resolved from pincode or map pin; optional → sector default
  pincode?: string;              // raw input (for audit / future real routing)
  latlng?: { lat: number; lng: number }; // optional map pin
  boostPct?: number | null;      // marketplace payout booster
}

export interface EstimateResult {
  marketValuePerKg: number;
  logisticsPerKg: number;
  userPayoutPerKg: number;       // after commission + logistics, floored at 0
  marginPerKg: number;
  userPayoutTotal: number;       // what the household sees
  marginTotal: number;
  belowMinMargin: boolean;
  distanceKm: number;
  source: "model" | "table" | "fallback";
  modelVersion: string | null;
}
```

### NEW — `lib/pricing-constants.ts`
Mirror the ML constants in **one** place so they never drift from `/ml/config.py`:
```ts
export const COMMISSION = 0.15;
export const LOGISTICS_BASE = 111.06;
export const LOGISTICS_PER_KM = 4.80;
export const MIN_MARGIN_PER_KG = 0.50;
export const DEFAULT_DEMAND = "Medium" as const;
export const RISK_MULTIPLIER   = { Low: 1.00, Medium: 0.92, High: 0.82 } as const;
export const DEMAND_MULTIPLIER = { Low: 0.95, Medium: 1.00, High: 1.07 } as const;
export const ROAD_FACTOR = 1.3; // haversine → approx road distance; TODO(distance-matrix)

// Central collection depot for the Hooghly belt (~Konnagar / Hindmotor area).
// Roughly central to all five operational sectors. Confirm against your real depot.
export const HUB_LATLNG = { lat: 22.68, lng: 88.34 } as const;

// Per-sector hub distance (km) fallback when no pincode/pin given.
// Computed = haversine(sector_centre, HUB_LATLNG) × ROAD_FACTOR, rounded.
// (straight-line → road-approx, so these already include the road factor.)
//   Rishra 5.3→6.9 · Howrah 12.2→15.9 · Shyamnagar 18.3→23.8 ·
//   Tarakeswar 40.3→52.3 · Hugli-Chinsura 26.1→33.9
export const SECTOR_HUB_DISTANCE_KM: Record<string, number> = {
  "Rishra": 6.9,
  "Howrah": 15.9,
  "Shyamnagar": 23.8,
  "Tarakeswar": 52.3,
  "Hugli-Chinsura": 33.9,
};

// Sector-centre coordinates (verified, see Sources in the chat that produced this plan).
// Used for haversine when a map pin is dropped: distance = haversine(pin, HUB_LATLNG)×ROAD_FACTOR.
// The pin itself is the household's location; these centres are the per-sector defaults /
// sanity anchors. Swap any with the household's actual pin at runtime.
export const SECTOR_CENTRE_LATLNG: Record<string, { lat: number; lng: number }> = {
  "Rishra":         { lat: 22.7261, lng: 88.3274 },
  "Howrah":         { lat: 22.5958, lng: 88.2636 },
  "Shyamnagar":     { lat: 22.8365, lng: 88.3956 },
  "Tarakeswar":     { lat: 22.8900, lng: 88.0200 },
  "Hugli-Chinsura": { lat: 22.9088, lng: 88.3967 },
};

// NOTE: these are realistic placeholders, not surveyed depot/road figures. Tarakeswar is
// genuinely far west (~52 km road-approx) — that is correct, not a bug. Replace HUB_LATLNG
// and re-derive SECTOR_HUB_DISTANCE_KM if your real depot differs. TODO(hub-coords).
```

### EDIT — `lib/pricing-math.ts` (client-safe pure math)
Add pure functions mirroring `/ml/pricing.py` exactly. Keep `applyBoost` as-is.
```ts
export function estimateLogisticsCost(distanceKm: number): number;       // base + perKm*km
export function logisticsPerKg(distanceKm: number, qtyKg: number): number;
export function userPayoutPerKg(mvPerKg: number, logPerKg: number): number; // *(1-COMMISSION) - log
export function marginPerKg(mvPerKg: number): number;                     // COMMISSION * mv
export function haversineKm(a: LatLng, b: LatLng): number;
export function buildResult(mvPerKg, distanceKm, qtyKg, source, modelVersion, boostPct): EstimateResult;
```
All rounding to 2 dp, payout floored at 0, `belowMinMargin = margin < MIN_MARGIN_PER_KG`.

### EDIT — `lib/pricing.ts` (server entrypoint)
Add the orchestrator + the model seam:
```ts
// The ONE call both UIs use.
export async function estimateQuote(input: EstimateInput): Promise<EstimateResult>;

// Distance resolution: pin (haversine×ROAD_FACTOR) → pincode lookup → sector default.
function resolveDistanceKm(input): number;

// THE MODEL SEAM — swap this body when the live model is connected.
// Today: read market_price_per_kg from price_estimates (table), apply RISK/DEMAND multipliers
//        client-side so risk/demand visibly affect the number even pre-model.
// Tomorrow: POST input → model endpoint, return predicted market value.
async function getMarketValuePerKg(input): Promise<{ value: number; source; modelVersion }>;
// ^ leave a clearly-marked  TODO(connect-model)  here.
```
Keep `getRate` / `quoteFromRate` / `quotePickup` for backward compat (the schedule modal still
calls a thin version) but have them delegate to the new path where practical.

> **Note on risk/demand pre-model:** since `price_estimates` has no risk/demand axis, multiply the
> table's `market_price_per_kg` by `RISK_MULTIPLIER[risk] * DEMAND_MULTIPLIER[demand]` so the UI
> *responds* to those inputs today. When the real model lands it already conditions on them, so
> **remove the manual multipliers in the `getMarketValuePerKg` model branch** (leave them only in
> the table-fallback branch). Document this clearly.

### EDIT — `components/dashboard/schedule-pickup-modal.tsx` (household)
- Add a **Quality Risk** select (Low/Medium/High, default Medium) — same styling tokens as the
  existing selects (`bg-linen/60 border-sand/55 …`).
- Add a **Pincode** input + optional **"Pin on map"** affordance (see §5 for the map note).
- Replace the inline `price_estimates` fetch (lines ~128–139) with a single
  `estimateQuote(input)` call; show a **live payout preview** before submit (see §6 UI).
- Persist what the schema supports: keep writing `estimated_price` (now = `userPayoutTotal`).
  Distance/risk are inputs to the estimate; only store them if you add columns (see §7).

### EDIT — `app/admin/admin-content.tsx` (admin) — **rip-out**
- **Delete** the hardcoded `switch (estimatorWaste)` base-rate block and the `±5%`
  urban/rural multiplier in `handleCalculate` (lines ~370–411).
- **Delete** the `mapSectorToArea` dependence for pricing (keep it only if used elsewhere).
- Route the admin calculator through the **same `estimateQuote()`** contract, with the same new
  inputs (risk, distance/pincode). Admin can additionally see `marginPerKg` / `belowMinMargin`.
- **Replace the lucide `Calculator` icon** (import at line 38) with the bucket image (see §8).

**Admin role = oversight + override (highest authority).** The admin hub monitors the crew hub and
crew members; its estimator is **supervisory**, not peer data-entry. So beyond running
`estimateQuote()`, the admin card should:
- Show the **system-computed** payout (model/table) as the baseline, read-only.
- Provide a clearly-labelled **"Manual override (₹)"** field so the admin can set a final payout
  *after their own consideration* — this is the authority household/crew do **not** have.
- Surface the **margin** and a **`belowMinMargin` warning** so overrides are informed (e.g. "this
  override drops platform margin below ₹0.50/kg").
- Treat the override as the authoritative value if present, else fall back to the computed estimate.
- **Log the override** (who/when/baseline→final) if a column/table exists — see §7
  `TODO(override-audit)`; at minimum keep it visually distinct from the auto value.
Do **not** let crew or household override; their estimators are read-only on the final number.

### EDIT — `app/crew/crew-content.tsx` (crew on-site estimator) — **rip-out + remap**
- **Delete** `getCalculatedPayout` (lines ~49–58) with its hardcoded `rate = 12 / 8 / 45`.
- **Replace** the 3-option material `<select>` with the full 7 `WasteType`s.
- **Remap "Quality Impurity Penalty"** to the model's **risk** input: collapse the 4 penalty
  options onto Low/Medium/High (e.g. 0% → Low, 20% → Medium, 50%/80% → High), or — better — show a
  Low/Med/High `RiskLevel` selector directly and drop the fake percentages. The crew's on-site
  observation *is* the quality-risk signal the model expects.
- **Default the sector** from the pickup the crew is currently servicing (they're at a known
  address), so distance/logistics flow through `estimateQuote()` like everywhere else. If no active
  pickup context, fall back to a sector picker.
- Route the final number through `estimateQuote()`; keep the "Dynamic Sync" empty-state label.
- **Swap the 🧮 emoji** (line ~325) for the bucket icon (see §8) — same `<img>` snippet.
- Keep this estimator's distinct copy ("verify weights at the doorstep") — it's a real workflow,
  just needs correct math underneath. This view is **crew-role only**; do not add household
  gamification here.

### EDIT — `supabase_schema.sql` (only if §7 columns are added)
Per CLAUDE.md rule #10, reflect any new `pickup_requests` columns here.

---

## 5. Map-based distance (the user's idea) — how to wire it

You already have Leaflet (`components/maps/CrewRouteMap.tsx`, `react-leaflet` v5). Reuse it.

- Add a small **"Drop a pin"** Leaflet map (lazy-loaded, `ssr: false` per CLAUDE.md rule #7) in
  the estimator. On click, capture `{lat, lng}`.
- `resolveDistanceKm`: if `latlng` present → `haversineKm(latlng, SECTOR_HUB_LATLNG[sector]) *
  ROAD_FACTOR`; else if `pincode` resolvable → distance lookup; else `SECTOR_HUB_DISTANCE_KM[sector]`.
- **Caveat (put in a comment + a tiny UI tooltip):** haversine ≠ road distance; `ROAD_FACTOR`
  is an approximation. `TODO(distance-matrix)` to swap in OSRM / a real routing API.
- **Requires** real hub coordinates in `SECTOR_HUB_LATLNG` — flag this as a data TODO for the user.
  Until filled, distance falls back to `SECTOR_HUB_DISTANCE_KM` and the map is decorative.

---

## 6. UI / UX rehaul (use the `/frontend-design` skill — brand-faithful, not generic)

**Aesthetic direction:** the estimator is a *moment of delight* — "watch your trash become
worth." Keep it inside the existing earthy-premium system; do **not** introduce new fonts/colors.

Tokens (already in `app/globals.css`): `--color-terra #C2703D`, `--color-sage #8FA37E`,
`--color-bark #2A2218`, `--color-linen #F4EFE3`, `--color-amber-warm #E8A44A`; fonts
`font-syne` (headings), `font-dm` (body), `font-jetbrains` (the **number** — use mono for the ₹).

**Layout (both estimators share a card):**
- Header row: the **bucket icon** (`price-estimator.png`, ~28–32px, `rounded`) + Syne title
  "Payout Estimator".
- Inputs in a tidy 2-col grid on `sm+`: Waste Type · Quantity · Sector · Quality Risk · Pincode
  (+ optional map toggle). Reuse existing `Select`/`Input` styling exactly.
- **Result panel** — the hero: large `font-jetbrains` rupee figure (`userPayoutTotal`) with a
  **CountUp** animation (you already have `components/ui/count-up.tsx` — reuse it, it's
  reduced-motion safe per CLAUDE.md rule #12). Sub-line: `₹{userPayoutPerKg}/kg × {qty}kg`.
- Secondary chips (subtle): logistics/kg, and for **admin only** margin/kg + a `belowMinMargin`
  warning pill (terra/destructive) when `margin < 0.50`.
- A small **"how this is calculated"** disclosure that lists the formula (transparency = trust).
- If a marketplace boost is active, keep the existing sage "+X% boost applied" pill.

**Micro-interactions (respect `prefers-reduced-motion`):** CountUp on the figure; a soft
terra→amber gradient sweep on the result panel when a new estimate lands; staggered input reveal
on open. Nothing that violates rule #12 — gate all of it behind the reduced-motion check that
already exists in the codebase.

**Empty/disabled state:** before required inputs are set, show the icon + "Select a material and
weight to see your payout" rather than a zero.

---

## 7. Optional schema additions (only if you want to persist the new inputs)

`pickup_requests` currently stores `estimated_price`, `estimated_weight`, `location`, `waste_type`.
If you want the new inputs persisted (useful for later model audit), add — and mirror in
`supabase_schema.sql`:
- `quality_risk text check (quality_risk in ('Low','Medium','High'))` (nullable, default 'Medium')
- `distance_km numeric` (nullable)
- `pincode text` (nullable)
- optionally `market_value_per_kg numeric`, `margin_per_kg numeric` for analytics.

**If you'd rather not touch the schema now:** skip this; the estimate still works, you just don't
persist risk/distance. Mark `TODO(persist-estimate-inputs)`.

**Admin override audit** (`TODO(override-audit)`): if you want admin payout overrides logged, add
to `pickup_requests` (or a small `price_overrides` table): `payout_override numeric` (nullable),
`override_by uuid` (FK profiles), `override_at timestamptz`, `override_reason text`. Mirror in
`supabase_schema.sql` (#10). RLS: only `role = admin` may write these. If skipped, the override is
session-only and not persisted — fine for the demo, note it.

---

## 8. Icon swap — exact steps

1. Add a bucket base const near the other ones (pattern already used in `dashboard-content.tsx`
   line 49 / `profile-content.tsx`):
   ```ts
   const LEVEL_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ||
     "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/gamification-levels`;
   ```
2. In the estimator card header, replace `<Calculator … />` with:
   ```tsx
   <img
     src={`${LEVEL_BUCKET_BASE}/price-estimator.png`}
     alt=""                       /* decorative; title text carries the label */
     className="h-8 w-8 object-contain"
     loading="lazy"
   />
   ```
3. Remove the now-unused `Calculator` import (line 38 of `admin-content.tsx`) **only if** no other
   usage remains — grep first.
4. Bucket is **public**, so a plain `<img src>` works (same as badges/levels elsewhere). No signed
   URL needed.

---

## 9. Order of execution (suggested)

1. `lib/pricing-constants.ts` + `lib/estimator-types.ts` (no UI risk).
2. Extend `lib/pricing-math.ts` with the pure formulas; unit-check against `/ml/pricing.py`
   numbers (a known `(mv, dist, qty)` → expected payout).
3. Add `estimateQuote()` + model seam to `lib/pricing.ts` (table-backed today).
4. Icon swap in all three (admin lucide, crew 🧮 emoji) — quick win, removes rule-3 surfaces.
5. Rip out admin hardcoded rates → route through `estimateQuote()`.
6. Rip out crew hardcoded rates → route through `estimateQuote()`, remap penalty → risk,
   default sector from the serviced pickup.
7. Household modal: add risk + pincode/map, switch to `estimateQuote()`, live preview UI.
8. `/frontend-design` polish pass on the shared estimator card (all three reuse it).
8. (Optional) schema columns + `supabase_schema.sql` sync.
9. **Verify natively** (see §10).

---

## 10. Verification (MANDATORY — native, per the S: drive warning)

The sandbox mount lags/serves stale bytes; trust the file tools and run checks **natively**:
```bash
cd "S:\Developer\Projects\Final Year\Trashium"
# NUL-corruption scan
git ls-files '*.ts' '*.tsx' | while read f; do n=$(tr -cd '\000' < "$f" | wc -c); [ "$n" -gt 0 ] && echo "$f $n"; done
npx tsc --noEmit            # must be clean
npm run lint
npm run dev                 # eyeball both estimators
```
**Functional checks:**
- **No** estimator references hardcoded rates: grep `baseRate`, `case "Metal"`, `getCalculatedPayout`,
  `rate = 12`, `rate = 45` → all gone across admin **and** crew.
- Same `(wasteType, sector, qty, risk)` gives the **same** number in household, admin **and** crew
  (one shared contract — verify all three agree on a sample input).
- Crew "impurity penalty" now maps to Low/Med/High risk and moves the number the **same direction**
  as the model (more risk → lower payout), not the old flat `×(1−penalty)`.
- Changing **Quality Risk** Low→High **lowers** payout (×1.00 → ×0.82). Changing **Demand**
  Low→High **raises** it. (Monotonicity matches the model's guarantees.)
- A known hand-computed case matches `/ml/pricing.py` `quote()` within rounding.
- Reduced-motion: CountUp + gradient sweep disabled when OS requests it.
- Icon renders from the bucket (network tab shows `gamification-levels/price-estimator.png` 200).

---

## 11. Guardrails (house rules — do not break)

- **No hardcoded prices** anywhere (CLAUDE.md #3) — all numbers come from `price_estimates` /
  the model / the documented constants file. The constants file mirrors `/ml/config.py`; it is
  business config, not invented prices.
- **Server vs client split** (#2): `lib/pricing.ts` stays server (Supabase). Pure math +
  types are client-safe. The modal is a client component; it calls a server action / route or
  passes inputs to a server function — do **not** import the server Supabase client into the
  client bundle.
- **Leaflet is client-only** (#7): lazy-load the pin map with `ssr: false`.
- **Sectors from `lib/constants.ts`** (#5); **waste types from `lib/types.ts`**.
- **Reduced motion** (#12) for every new animation.
- **Schema sync** (#10) if columns added.
- **ML stays Python** (#9): the TS side only *consumes* the model via the seam; no training in TS.
- Don't regress the marketplace **payout boost** path — keep `applyBoost`/`pending_payout_boost_pct`.
- **Role hierarchy is load-bearing:** household + crew estimators are **read-only on the final
  number** (they consume `estimateQuote()`); **only admin** may override it, with authority, and
  ideally an audit trail. Enforce admin-only override at the data layer (RLS / role check), not just
  in the UI. The admin hub is oversight of the crew hub + crew members — its estimator reflects that
  supervisory role, not a duplicate of the field calculator.
- **Don't** silently "fix" the landing-page marketing rates (`app/page.tsx`) in this pass unless
  asked — they're flagged as `TODO(landing-rates)`, a separate copy decision.
```
```
