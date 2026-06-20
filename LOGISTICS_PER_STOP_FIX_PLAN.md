# Logistics Fix — Per-Stop Cost Allocation Plan

> **Audience:** the VS Code Claude extension that will execute this later.
> **Status:** PLAN ONLY — do not build yet.
> **Goal:** stop small/low-value loads quoting ₹0, WITHOUT diverging from the ML pipeline's fitted
> rate card, and WITHOUT touching the ML model seam.

---

## 0. The diagnosis (why ₹0 happens — confirmed, not a bug)

The estimator math is correct. The ₹0 is real economics, not a code fault, and **the ML model will
NOT change it.** Breakdown:

```
payout/kg = market_value/kg × (1 − COMMISSION) − logistics/kg
logistics/kg = (LOGISTICS_BASE + LOGISTICS_PER_KM × distance) / quantity_kg
             = (111.06 + 4.80 × km) / qty
```

The model only predicts `market_value/kg`. The **logistics subtraction is deterministic business
math that sits AFTER the model** (`lib/pricing-math.ts`), so swapping in the live model leaves the
₹0 exactly as-is.

Worked example (live table values, Plastic ≈ ₹13.29/kg market):

| Load | logistics/kg | payout/kg | total |
|---|---|---|---|
| Plastic, Howrah, 12.5 kg | ₹14.99 | **₹0.00** | **₹0** |
| Plastic, Howrah, 20 kg | ₹9.37 | ₹1.02 | ₹20 |
| Plastic, Howrah, 50 kg | ₹3.75 | ₹6.65 | ₹332 |
| Metal, Howrah, 12.5 kg | ₹14.99 | ₹87.88 | ₹1,098 |

**Root cause:** the full ~₹111 cost of an entire truck *trip* is charged to ONE household. A real
collection run visits many households per trip, so the per-household share should be a fraction of
that. Charging each household the full solo-trip cost is what zeroes out small plastic loads.

---

## 1. The fix — allocate logistics per stop, not per household-as-sole-trip

Replace "each household pays the whole trip" with "each household pays its **share** of the trip."

**Approach (recommended): expected-stops divisor + small fixed per-stop component.**
- A trip's fixed cost (`LOGISTICS_BASE`) is shared across the expected number of stops on a run.
- The distance component still scales, but per-stop, not per-solo-trip.

```
EXPECTED_STOPS_PER_RUN = 8          // tune to ops reality; conservative default
per_stop_fixed   = LOGISTICS_BASE / EXPECTED_STOPS_PER_RUN      // 111.06 / 8 ≈ 13.88
per_stop_distance= LOGISTICS_PER_KM × distance_km / EXPECTED_STOPS_PER_RUN
logistics_cost_for_stop = per_stop_fixed + per_stop_distance
logistics_per_kg = logistics_cost_for_stop / quantity_kg
```

Re-run of the same cases with `EXPECTED_STOPS_PER_RUN = 8`:

| Load | logistics/kg (new) | payout/kg (new) | total (new) |
|---|---|---|---|
| Plastic, Howrah, 12.5 kg | ₹1.87 | ₹9.42 | **₹118** (was ₹0) |
| Plastic, Howrah, 5 kg | ₹4.68 | ₹6.61 | ₹33 (was ₹0) |
| Metal, Howrah, 12.5 kg | ₹1.87 | ₹100.99 | ₹1,262 |

Small plastic loads now pay fairly; high-value loads barely change. **This stays faithful to the ML
rate card** (same `LOGISTICS_BASE`/`PER_KM` constants) — it only corrects the *allocation*, which is
the genuinely wrong part.

> Alternative knobs (document, don't implement unless asked): a hard `LOGISTICS_PER_STOP_CAP` ceiling
> on logistics/kg; or a `MIN_PAYOUT_PER_KG` floor. The divisor approach is preferred because it has a
> real-world meaning (stops per run) rather than an arbitrary cap.

---

## 2. Files to change (small, surgical — model seam untouched)

### EDIT — `lib/pricing-constants.ts`
Add the allocation knob next to the existing logistics constants:
```ts
// A collection run visits multiple households; the fixed trip cost is shared across stops.
// Tune to ops reality. Higher = cheaper per-stop logistics. TODO(ops-calibrate).
export const EXPECTED_STOPS_PER_RUN = 8;
```
Do NOT change `LOGISTICS_BASE` / `LOGISTICS_PER_KM` — they stay aligned with `/ml/config.py`.

### EDIT — `lib/pricing-math.ts`
Change ONLY the logistics cost function to allocate per stop. Keep the signature so callers don't
change:
```ts
export function estimateLogisticsCost(distanceKm: number): number {
  // Per-STOP share of a multi-stop run, not the full solo-trip cost.
  return (LOGISTICS_BASE + LOGISTICS_PER_KM * distanceKm) / EXPECTED_STOPS_PER_RUN;
}
```
`logisticsPerKg`, `userPayoutPerKg`, `buildResult` are unchanged — they consume the above.

> **Keep `/ml/pricing.py` in sync (CLAUDE.md, single-source-of-truth rule).** The Python serve-time
> `estimate_logistics_cost` mirrors this; apply the same `/ EXPECTED_STOPS_PER_RUN` there (and add
> the constant to `/ml/config.py`) so the table the pipeline publishes matches the app math.
> If you'd rather not touch Python now, note the divergence explicitly: `TODO(ml-logistics-sync)`.

### NOT changed (important)
- `lib/estimate.ts` — the model seam (`getMarketValuePerKg`). **Untouched.** Model integration stays
  a one-function swap. This fix is strictly in the post-model logistics math.
- No UI changes required — all three estimators (household/crew/admin) call `estimateQuote()` and
  pick up the corrected number automatically.

---

## 3. Optional polish (only if you want it)

Even after the fix, an *extremely* small load at a *very* far sector can still approach ₹0 (correct).
To avoid a bare ₹0 ever reading as broken, optionally show a label instead:
- When `userPayoutTotal === 0`: render "Load too small to be profitable on this route" instead of
  "₹0". UI-only, in the crew/household/admin estimator result. `TODO(zero-payout-copy)`.

---

## 4. Verification (native, per the S: drive corruption warning)

```bash
cd "S:\Developer\Projects\Final Year\Trashium"
git ls-files '*.ts' '*.tsx' | while read f; do n=$(tr -cd '\000' < "$f" | wc -c); [ "$n" -gt 0 ] && echo "NUL: $f $n"; done
npx tsc --noEmit && npm run dev
```
Functional checks:
- Plastic, any sector, 12.5 kg → now a **non-zero** payout (was ₹0).
- Metal / high-value loads → barely changed (sanity: fix didn't inflate them).
- Same number shows in household, crew, AND admin estimators (shared contract intact).
- `lib/estimate.ts` (model seam) shows **no diff** — confirms model integration stays seamless.
- If Python synced: re-run the ML publish and confirm `price_estimates.logistics_per_kg` dropped
  correspondingly; if NOT synced, `TODO(ml-logistics-sync)` is recorded.

---

## 5. One-line summary for the build

Change `estimateLogisticsCost` in `lib/pricing-math.ts` to divide the trip cost by
`EXPECTED_STOPS_PER_RUN` (new constant). That's the whole fix. Everything else — model seam, UI,
override, types — stays exactly as-is.
