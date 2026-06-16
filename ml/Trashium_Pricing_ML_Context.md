# Trashium Pricing ML — Project Context & Session Handoff

> **Purpose of this file.** A complete, self-contained record of the pricing-model work so
> anyone — a teammate, or a brand-new AI chat — can continue **without losing context**.
> Pair it with the zipped `ml/` folder (code + artifacts). If you are an AI assistant picking
> this up: read this file top-to-bottom, then open the files in `ml/` listed in §10.

---

## TL;DR (current state)

- **What the models do:** predict **Market Value per kg** (the only uncertain quantity), then
  *derive* the user payout with the business formula. We do **not** predict payout directly —
  that leaks the formula and gives a meaningless R² ≈ 0.999.
- **Production model:** Linear Regression on `log(market value)` — test **MAPE 6.11%**
  (Random Forest challenger 9.80%). Auto-selected by lowest MAPE.
- **Profit:** payout uses a commission `c` (default **15%**) so Trashium keeps `margin = c × MV`.
  With `c = 0` the system reproduces the original (zero-margin) formula exactly.
- **Data fixed:** quality risk now lowers value; market demand now raises value (raw file had
  risk ≈ no effect and demand **inverted**).
- **Status:** pipeline runs end-to-end; all verification gates pass; rate table + SQL generated;
  report-ready guide written (`Trashium_Pricing_Model_Training_Guide.docx`).
- **Pending (your call):** wire `lib/pricing.ts` to the new columns; add a minimum-quantity rule;
  plug a real recycler price feed (hook is ready).

---

## 1. Project overview

Trashium is a scrap/recycling marketplace. A crew visits a household, records the waste, and the
app must quote a **per-kilogram payout in ₹**. The app is **Next.js + Supabase**; pricing rates
live in a Supabase table `price_estimates(waste_type, area, price_per_kg, logistics_per_kg,
market_price_per_kg, profit_per_kg, model_version)` and are read by `lib/pricing.ts`.

The `ml/` pipeline turns two years of historical scrap data into those rates.

**Crew form**
- Inputs: **Material Type, Quantity, Quality Defect Risk**.
- **Distance** is automatic: user gives their registered ID → their pincode → hub distance.
- **Demand** is *not* a crew input (defaults to the latest-known state, or `Medium`).
- Output: **user payout per kg (₹)** (and the rupee total).

---

## 2. Business goal and the formulas

Goal: a payout that is **fair to households** and **profitable for Trashium**.

**Payout (verified against all 73,100 rows, error ≤ ₹0.05 = rounding):**
```
User Payout / kg = Market Value / kg − (Logistics Cost ÷ Quantity)
```
Whole-pickup form: `(Quantity × Market Value) − Logistics Cost`, divided by Quantity = per-kg.

**Margin rule (the accounting identity provided):**
```
Profit Margin / kg = Market Value / kg − User Payout / kg − (Logistics Cost ÷ Quantity)
```

### ⚠️ The two formulas cancel to ₹0
Substituting payout into margin: `MV − (MV − L/Q) − L/Q = 0`. Confirmed on the full dataset
(mean −0.0000, range ±0.05). As written, the household gets everything except logistics and
**Trashium earns nothing**.

### The fix — a commission lever `c`
The margin formula is correct; the lever that makes it positive is the **payout**:
```
Payout / kg = MarketValue/kg × (1 − c) − Logistics/Quantity
Margin / kg = MarketValue/kg − Payout/kg − Logistics/Quantity = c × MarketValue/kg   (≥ 0)
```
- `c = 0` → original zero-margin formula (exact).
- `c = 0.15` (default) → Trashium keeps 15% of market value; households get the rest minus logistics.
- Knob: `TRASHIUM_COMMISSION` in `config.py`. Floor: `MIN_MARGIN_PER_KG = 0.50`.

---

## 3. Key decisions and findings (the heart of this work)

| # | Decision | Why |
|---|----------|-----|
| 1 | **Predict Market Value, not payout** | Payout = exact function of MV, logistics, quantity. Predicting it just rebuilds the formula → fake R² ≈ 0.999 (identity recovery, not skill). MV is the only externally-uncertain quantity. |
| 2 | **Commission `c` for profit (default 15%)** | The provided payout + margin formulas cancel to ₹0. A commission is the only lever that pays Trashium while keeping the payout formula. `c=0` = original. |
| 3 | **Regenerate data so quality risk is learnable** | In the raw file, risk had ≈0 effect on value (Copper High ₹582.8 vs Low ₹584.3) yet it's a crew input. Now risk multiplies value ×1.00/0.92/0.82 (Low/Med/High). |
| 4 | **Correct the demand direction** | Raw file had demand **inverted** (low demand → higher price; avg factor Low ×1.17, High ×0.90). Corrected to ×0.95/1.00/1.07 (higher demand → higher value). |
| 5 | **Model `log(market value)`** | Risk/demand are **multiplicative**. On the raw scale a linear model subtracts a fixed ₹ amount — too small for copper and enough to push cardboard/plastic **negative**. Log makes effects additive, keeps predictions > 0, recovers the true ×0.92/0.82 ratios. Evaluate with **MAPE** (values span ₹8–1,200/kg). |

**Leakage, measured:** a model fed the transaction variables to predict payout scores
R² 0.9986 but MAPE 9.96% — *worse* than the honest market-value model (6.11%). R² flatters
leakage; relative error exposes it. **Rule: judge pricing by MAPE; never feed the model variables
that appear in the target's own formula.**

---

## 4. The data and its regeneration

- **Source (raw upload):** `selected_cities_two_year_daily_dataset.xlsx` — 73,100 rows,
  14 Jun 2024 → 14 Jun 2026, one observation per series per day.
- **Shape:** 5 regions × 20 materials × ~731 days = **100 daily series**.
- **Regions:** Howrah, Hugli Chinsurah, Naihati, Srirampore, Tarakeswar.
- **Categories (8):** Plastic Scrap, Paper & Packaging, E-Waste, Battery Scrap, Ferrous Metal,
  Non-Ferrous Metal, Vehicle Scrap, Appliance Scrap.
- **Columns:** Date, Region, Waste Category, Material Type, Quantity (Kg), Distance ( KM),
  Logistics Cost, Market Demand, Quality Defect Risk, Market_Value_perKg (INR),
  Total_User_Payout_perKg (INR).
- **Value range:** ₹8/kg (Cardboard) → ₹1,204/kg (Catalytic Converter); ~15% within-material spread.

**Regeneration** (`regenerate_dataset.py`): start from the raw upload, **(a)** remove the raw
per-material demand effect and re-apply the correct demand multiplier, **(b)** apply the risk
multiplier, **(c)** add ±1.5% noise, **(d)** recompute the base payout. Material/region/date/
quantity/distance/logistics are untouched.
- Output (canonical training file): `data/dataset_learnable.xlsx`
- Provenance copy of the raw upload: `data/source_raw.xlsx`
- After regen — Copper by demand: Low ₹558 → Med ₹577 → High ₹616 (rises ✔);
  by risk: Low ₹598 → Med ₹550 → High ₹491 (falls ✔).

> **Note:** the old `data/dataset.xlsx` (a different, v1 schema with `Target_User_Payout`) is
> locked in this workspace and is **not** used. The canonical file is `dataset_learnable.xlsx`.

### Region → operational sector map
`Howrah→Howrah`, `Hugli Chinsurah→Hugli-Chinsura`, `Tarakeswar→Tarakeswar`,
`Srirampore→Rishra` (nearest-neighbour), `Naihati→Shyamnagar` (nearest-neighbour).

### Category → app WasteType map
Plastic Scrap→Plastic, Paper & Packaging→Paper, E-Waste & Battery Scrap→E-Waste,
Ferrous/Non-Ferrous/Vehicle/Appliance Scrap→Metal. App types **Glass / Organic / Mixed** have no
dataset coverage → `FALLBACK_RATES = {Glass 4.50, Organic 1.50, Mixed 3.00}`.

---

## 5. The three models and results

| Model | Role | Training |
|-------|------|----------|
| **Linear Regression (log MV)** | Production predictor | shared preprocessor → `LinearRegression` on `log(MV)`, chronological 80/20 split |
| **Random Forest (log MV)** | Non-linear challenger / monitor / fallback | 120 trees, depth 18, bootstrap 0.5, sqrt features, on `log(MV)` |
| **Moving Average** | Trend guardrail, cold-start, drift monitor | trailing SMA 7/15/30/90 + EMA(30) + 30-day volatility per (region, material) on MV |

**Test-set metrics** (`artifacts/metrics.json`, n_train 58,500 / n_test 14,600):

| Model | MAE (₹/kg) | RMSE | R² | MAPE |
|-------|-----------|------|-----|------|
| Linear Regression (log MV) | 5.87 | 9.73 | 0.999 | **6.11%** |
| Random Forest (log MV) | 12.95 | 24.67 | 0.992 | 9.80% |
| Leakage demo (predict payout w/ txn vars) | 6.71 | 10.20 | 0.999 | 9.96% |

Per-material MAE — easiest: Cardboard ₹0.67, Plastic ₹1.53, Newspaper ₹1.98. Hardest (rare,
high-value): Catalytic Converter ₹75.5, Brass ₹48.4, Copper ₹30.4 (candidates for per-material
models or more data).

---

## 6. Feature design (leakage-free)

- **Model inputs (price drivers only):** Material Type, Region, Market Demand, Quality Defect Risk,
  calendar (month, day-of-week, is_weekend).
- **Excluded on purpose:** Quantity, Distance, Logistics — they don't set the per-kg price; they're
  applied later, deterministically, in `pricing.py`. Including them caused the v1 leakage.
- **Encoding:** one-hot (Material, Region); ordinal Low<Medium<High (Demand, Risk); standardized
  calendar numerics; median / most-frequent imputation. Same preprocessor at train & serve time.
- **Target:** `log(Market_Value_perKg)` via `TransformedTargetRegressor(func=log, inverse=exp)`.

---

## 7. Profit / commission layer

`Margin/kg = c × MV` — scales with item value, never negative for `c ≥ 0`. Single knob
`TRASHIUM_COMMISSION` in `config.py`. Sample generated rates (`price_estimates_seed.csv`):

| Sector | Waste type | Market value /kg | Logistics /kg | Payout /kg | Margin /kg |
|--------|-----------|-----------------:|--------------:|-----------:|-----------:|
| Howrah | Metal | ₹131.55 | ₹2.70 | ₹109.12 | ₹19.73 |
| Shyamnagar | Metal | ₹131.33 | ₹3.64 | ₹107.99 | ₹19.70 |
| Howrah | E-Waste | ₹66.04 | ₹4.09 | ₹52.04 | ₹9.91 |
| Howrah | Plastic | ₹13.29 | ₹1.89 | ₹9.40 | ₹1.99 |
| Howrah | Paper | ₹10.02 | ₹1.49 | ₹7.02 | ₹1.50 |

---

## 8. Crew form → live quote (serving)

1. Crew enters **Material, Quantity, Quality risk**.
2. Pincode → **hub distance**.
3. Distance → **logistics** via rate card: `Logistics = 111.06 + 4.80 × km` (fit r = 0.79).
4. **Demand** defaults to latest-known / `Medium`.
5. Predict **market value** (best model) → apply formula → show payout/kg + total.

End-to-end simulations (Howrah hub, demand = Medium):

| Material | Qty | Dist | Risk | Market value /kg | Payout /kg | Margin /kg | User total |
|----------|----:|-----:|------|-----------------:|-----------:|-----------:|-----------:|
| Copper | 30 | 12 km | Low | ₹595.30 | ₹500.38 | ₹89.30 | ₹15,012 |
| Copper | 30 | 12 km | High | ₹494.06 | ₹414.33 | ₹74.11 | ₹12,430 |
| Plastic | 50 | 20 km | Low | ₹13.28 | ₹7.15 | ₹1.99 | ₹357 |
| Cardboard | 40 | 25 km | Medium | ₹7.47 | ₹0.57 | ₹1.12 | ₹23 |

Risk bites correctly (high-risk copper pays ≈₹86/kg less). Cardboard over 25 km barely clears
logistics — a real signal that low-value paper needs a **minimum-quantity rule**.

**Cold-start / guardrail:** for a new (region, material) series, or when the model price drifts
more than a few volatilities from the moving average, fall back to / clamp toward the SMA.
Pricing math lives once in `pricing.py` and should be mirrored by `lib/pricing.ts`.

---

## 9. Real recycler price feed (override hook)

`build_price_table.py` will use real market values in place of the model's where provided:
- Drop a CSV at `data/market_prices.csv` with columns `waste_type, area, market_price_per_kg`,
  **or** set env `TRASHIUM_MARKET_FEED=/path/to/feed.csv`.
- Matching rows are recomputed (`payout = MV×(1−c) − logistics/kg`, `margin = c×MV`) and marked
  `source = "feed"`. Tested working. Template: `data/market_prices.sample.csv`.
- No retraining is needed to use a feed — it overrides at table-build time.

---

## 10. File map (`ml/`)

| File | Purpose |
|------|---------|
| `config.py` | Schema, taxonomy maps, **business knobs** (commission, risk/demand multipliers, logistics rate card, demand default) |
| `regenerate_dataset.py` | Builds `data/dataset_learnable.xlsx` (risk + demand corrected) from `data/source_raw.xlsx` |
| `data_prep.py` | Loading, **leakage-free** features, shared preprocessor, chronological split |
| `pricing.py` | **Single source of truth** for logistics / payout / margin math (mirror in `lib/pricing.ts`) |
| `train_models.py` | Trains LR + RF on `log(MV)`; writes `metrics.json`, `lr_mv.joblib`, `rf_mv.joblib`; includes leakage demo |
| `moving_average.py` | Per-series SMA/EMA/volatility on MV → `artifacts/ma_trends_latest.csv` |
| `build_price_table.py` | Predict MV → payout & margin → 5×7 rate table; applies feed override → `price_estimates_seed.{csv,sql}` |
| `verify.py` | Sanity gates: leakage, positivity, risk/demand monotonicity, margin & formula checks |
| `publish_to_supabase.py` | Upserts the rate table into Supabase (unchanged from v1; schema-compatible) |
| `artifacts/` | `metrics.json`, `*.joblib`, `ma_trends_latest.csv`, `price_estimates_seed.{csv,sql}` |
| `Trashium_Pricing_Model_Training_Guide.docx` | Report-ready write-up of all the above |

---

## 11. How to run

```bash
cd ml
pip install -r requirements.txt
python regenerate_dataset.py     # data/dataset_learnable.xlsx (risk + demand corrected)
python train_models.py           # lr_mv.joblib, rf_mv.joblib, metrics.json
python moving_average.py          # ma_trends_latest.csv
python build_price_table.py       # price_estimates_seed.{csv,sql}  (auto-picks best model)
python verify.py                  # sanity gates
python publish_to_supabase.py     # needs SUPABASE_URL + SUPABASE_SERVICE_KEY
```

---

## 12. Verification status (all passing)

- No transaction variables among model features.
- Predictions strictly **positive** (log target).
- **Risk monotonic down**, **demand monotonic up** in model predictions.
- All model-row margins **> 0**; `margin = c × MV` and the payout formula reproduce exactly.
- Only Glass/Organic/Mixed fallback rows fall below the ₹0.50 margin floor (flagged).

---

## 13. Limitations & next steps

- **Synthetic prices look easy.** This dataset's MV is near-deterministic, so R²/MAPE are very
  high. On a real recycler feed expect more noise and lower R² — that's where the model earns its
  keep. The override hook (§9) is ready.
- **Glass / Organic / Mixed** have no data → fallback rates that barely clear logistics. Collect
  data or set deliberate business rates.
- **Minimum-quantity rule** recommended so small loads of cheap material aren't logistics-negative.
- **Wire `lib/pricing.ts`** to read `market_price_per_kg` / `profit_per_kg` end-to-end.
- **Premium metals** (Catalytic Converter, Copper, Brass) concentrate error — consider
  per-material or gradient-boosting models.
- **Retraining cadence:** refresh the rate table nightly; full retrain monthly or on a drift alert
  (RF-vs-SMA divergence).

---

## 14. Environment constraints & gotchas (for whoever continues)

- The workspace mount used during this session **blocks file deletion**; truncate-write and rename
  work. Practical effect: a few **scratch files in `ml/v2/`** (`t.txt`, `t3.txt`, `README.txt`,
  empty `data/` & `artifacts/`) and an old `data/dataset.xlsx` couldn't be removed here — **safe to
  delete on your machine.** They are not used by the pipeline.
- Canonical training file is `data/dataset_learnable.xlsx` (not the locked `data/dataset.xlsx`).
- Sandbox had 2 CPU cores, so RF size was tuned for speed (120 trees). Increase if you have more.

---

## 15. Key constants (quick reference)

```
TRASHIUM_COMMISSION = 0.15          # Trashium's cut of market value (0 = original zero-margin)
MIN_MARGIN_PER_KG   = 0.50          # flag thin items
RISK_MULTIPLIER     = {Low:1.00, Medium:0.92, High:0.82}   # higher risk → lower value
DEMAND_MULTIPLIER   = {Low:0.95, Medium:1.00, High:1.07}   # higher demand → higher value
LOGISTICS_BASE=111.06, LOGISTICS_PER_KM=4.80               # logistics = base + per_km*distance
DEFAULT_DEMAND = "Medium"           # demand isn't a crew input
MODEL_TARGET   = log(Market_Value_perKg)                   # production target
BEST_MODEL     = Linear Regression  (auto-selected by lowest MAPE)
MODEL_VERSION  = "mv_v2",  RANDOM_STATE = 42
```

---

## 16. Session log (what we did, in order)

1. Inspected the uploaded dataset and the existing `ml/` pipeline (v1).
2. Verified the payout formula against the data; found the **margin cancels to ₹0**.
3. Found the v1 **leakage** (predicting payout → fake R² 0.999); decided to predict **market value**.
4. Confirmed **quality risk had ~no effect** and **demand was inverted** in the raw data.
5. Chose: predict MV → apply formula; commission for profit; regenerate data for learnable risk;
   build both a guide and the code.
6. Refactored the pipeline: leakage-free features, `log` target, commission profit layer.
7. Discovered raw-scale linear models go **negative** for cheap items → switched to **log target**.
8. **Corrected the demand inversion**; retrained (LR MAPE improved to 6.11%).
9. Added the **real market-price feed override** hook (tested).
10. Verified everything; produced `metrics.json`, the rate table + SQL, the `.docx` guide, and this
    context file.

*End of handoff. Open `ml/` and start from §10/§11.*
