# Granular Material Pricing — Analysis & Integration Guide

> Goal: stop squashing the dataset's **20 specific materials** into 7 broad buckets, so
> Copper, Brass, Iron, etc. each get their own price instead of all quoting at one blended
> "Metal" rate. This document is **suggestions only** — no site code (`app/`, `components/`,
> `lib/`) has been modified. The only thing already applied is the **Supabase data change**
> (new `material_type` column + 100 granular rows), which is additive and backward-compatible.

---

## 1. Input / Output Analysis

### 1.1 What the model actually consumes

The trained model (`lr_mv.joblib`, production) predicts **`Market_Value_perKg (INR)`** from
**7 features only** (`ml/data_prep.py`):

| Group | Feature | Notes |
|---|---|---|
| Numeric | `month`, `day_of_week`, `is_weekend` | calendar / seasonality |
| Nominal | `Region`, **`Material Type`** | one-hot encoded |
| Ordinal | `Market Demand`, `Quality Defect Risk` | encoded Low<Med<High |

> **Key fact for this task:** `Material Type` is already a model feature, and it is the
> **20-value granular column** (Aluminum, Brass, Copper, … Catalytic Converter). The model
> was never trained on the 7 buckets. Squashing happens **after** prediction, only in
> `build_price_table.py` when it `groupby("app_wastetype")`. So going granular requires
> **no retraining** (see §4).

**Transaction variables are deliberately excluded** (`TXN_EXCLUDED` in `data_prep.py`):
`Quantity (Kg)`, `Distance (KM)`, `Logistics Cost`, `logistics_per_kg`. They are downstream
formula inputs, applied later — feeding them in caused v1's fake R²≈0.999.

### 1.2 How user payout is derived (`ml/pricing.py`, locked formula)

```
logistics_cost   = LOGISTICS_BASE(111.06) + LOGISTICS_PER_KM(4.80) × distance_km
logistics_per_kg = logistics_cost / quantity_kg
user_payout/kg   = market_value/kg × (1 − COMMISSION 0.15) − logistics_per_kg   (clip ≥ 0)
margin/kg        = COMMISSION × market_value/kg                                  (always ≥ 0)
```

Crew/household enters only **Material, Quantity, Quality Risk**. Distance is auto-derived from
pincode→hub. Risk/demand are applied as multipliers at serve time (`lib/estimate.ts`).

### 1.3 The three tables — what each needs

**`price_estimates`** — the only table the app reads at quote time.
- *Read by:* `lib/estimate.ts` → `getMarketValuePerKg()` via key `(area, waste_type)`.
- *Columns:* `waste_type, area, price_per_kg, logistics_per_kg, market_price_per_kg, profit_per_kg, model_version` + now **`material_type`** (added).
- *What changed:* granular rows are keyed on `(material_type, area)`; `waste_type` is retained on each row as the **fallback bucket** so old code still resolves.

**`ma_trends`** — **not currently a DB table.** Moving averages live only as the artifact
`artifacts/ma_trends_latest.csv` (per region+material SMA/EMA/volatility). It is a cold-start
baseline and drift guardrail, **not a feature** and **not read by the app**. If you ever want
it queryable, the natural schema is `(region, material_type, sma_7, sma_15, sma_30, sma_90, ema_30, vol_30, computed_at)` — already keyed on the granular material, so no squashing concern.

**`model_metrics`** — **not currently a DB table.** Metrics live as `artifacts/metrics.json`.
If you want it in Supabase for an admin/eval view, suggested schema:
`(model_version, target, best_model, n_train, n_test, mae, rmse, r2, mape_pct, created_at)`.
This is per-model, independent of material granularity.

---

## 2. Avoid Waste-Type Squashing — the 20 materials

The granularity to preserve (matches the dataset exactly — verified against `dataset_learnable.xlsx`):

| Category (dataset) | Materials | App bucket (fallback) |
|---|---|---|
| Non-Ferrous Metal | Aluminum, Brass, Copper | Metal |
| Ferrous Metal | Iron, Stainless Steel, Tin | Metal |
| Vehicle Scrap | Car Body, Catalytic Converter, Radiator | Metal |
| Appliance Scrap | AC Compressor | Metal |
| Battery Scrap | Car Battery, Inverter Battery, Lead Acid Battery, Lithium Ion Battery, Two Wheeler Battery, UPS Battery | E-Waste *(Battery in app)* |
| Paper & Packaging | Cardboard, Newspaper | Paper |
| E-Waste | E-Waste | E-Waste |
| Plastic Scrap | Plastic | Plastic |

Fallback-only app types (no dataset coverage): **Glass, Organic, Mixed**.

---

## 3. Pipeline changes (SUGGESTED — apply when you next retrain/rebuild)

### 3.1 `config.py` — add a material→bucket map (keep the category map for fallback)

```python
# Granular leaf material -> app bucket (fallback when no granular row exists).
MATERIAL_TO_WASTETYPE = {
    "Aluminum": "Metal", "Brass": "Metal", "Copper": "Metal",
    "Iron": "Metal", "Stainless Steel": "Metal", "Tin": "Metal",
    "Car Body": "Metal", "Catalytic Converter": "Metal", "Radiator": "Metal",
    "AC Compressor": "Metal",
    "Car Battery": "E-Waste", "Inverter Battery": "E-Waste",
    "Lead Acid Battery": "E-Waste", "Lithium Ion Battery": "E-Waste",
    "Two Wheeler Battery": "E-Waste", "UPS Battery": "E-Waste",
    "Cardboard": "Paper", "Newspaper": "Paper",
    "E-Waste": "E-Waste", "Plastic": "Plastic",
}
```

### 3.2 `data_prep.py` — add the leaf→bucket column (no feature change)

In `add_features()`, alongside `app_wastetype`:
```python
df["app_material"] = df[C.COL_MATERIAL]                       # passthrough, the 20 leaf values
df["app_bucket"]   = df[C.COL_MATERIAL].map(C.MATERIAL_TO_WASTETYPE)
```
`FEATURES` stays **unchanged** — the model already uses `Material Type`. This is purely for
the aggregation/export grid.

### 3.3 `build_price_table.py` — group by material, not by bucket

Replace the `groupby(["app_sector", "app_wastetype"])` block with a granular grouping that
keeps the bucket as a carried column, and emit `material_type` into the seed:
```python
grp = df.groupby(["app_sector", "app_material"])
agg = grp.apply(lambda d: pd.Series({
    "waste_type":          d["app_bucket"].iloc[0],          # carry the fallback bucket
    "market_price_per_kg": d["pred_mv"].median(),
    "logistics_per_kg":    d[C.COL_LOGISTICS].sum() / d[C.COL_QTY].sum(),
    "n_rows":              len(d),
}), include_groups=False).reset_index().rename(
    columns={"app_sector": "area", "app_material": "material_type"})
# ... same payout/profit math ...
# Fallback rows for Glass/Organic/Mixed: set material_type = waste_type.
```
And in `to_sql()`, add `material_type` to the column list and switch the conflict target to
`ON CONFLICT (material_type, area)`.

> A ready-to-run version of these granular rows is already generated at
> `artifacts/` → see `granular_prices.csv` / `granular_upsert.sql` in the outputs folder.

---

## 4. Retraining check — **NOT required**

The `.joblib` models do **not** need retraining. Reasons:
1. The production model already trains on `Material Type` (20 values), not the 7 buckets.
2. Going granular only changes **post-prediction aggregation** (group by material instead of
   bucket) and the **export key** — both downstream of the model.
3. The same `model.predict(df[FEATURES])` call produces per-material market values directly;
   we just stop collapsing them with `median()` over a bucket.

You would only retrain if you (a) changed the feature set, (b) regenerated the dataset, or
(c) wanted a separate per-material model — none of which this task needs.

---

## 5. Frontend integration guide (SUGGESTED — site code unchanged)

### 5.1 Good news: the UI already lists all 20 materials

`components/dashboard/schedule-pickup-modal.tsx` already renders a **grouped checkbox list**
from `WASTE_CATALOG` in `lib/waste-items.ts` (Aluminum, Brass, Copper, … all present). The
gap is **pricing**, not UI: `toEntries()` maps each leaf label to its 7-value `bucket`, and
`lib/estimate.ts` looks up `(area, waste_type=bucket)`. So Brass and Iron resolve to the same
"Metal" row today.

### 5.2 The minimal change to go granular (3 edits, all in `lib/`)

1. **`lib/waste-items.ts`** — carry the leaf label through instead of (or alongside) the
   bucket. Add a `material` field to each entry and a `toMaterialEntries()` that passes
   `{ material: label, wasteType: bucket, quantityKg }`.

2. **`lib/estimator-types.ts`** — add optional `material?: string` to the estimate input.

3. **`lib/estimate.ts`** — in `getMarketValuePerKg()`, try the granular row first, fall back
   to the bucket row (this is why the bucket rows were kept in the DB):
   ```ts
   let { data } = await supabase
     .from("price_estimates")
     .select("market_price_per_kg, price_per_kg, model_version")
     .eq("area", input.sector)
     .eq("material_type", input.material ?? input.wasteType)   // granular key
     .maybeSingle();
   if (!data) {                                                // fallback to bucket
     ({ data } = await supabase
       .from("price_estimates")
       .select("market_price_per_kg, price_per_kg, model_version")
       .eq("area", input.sector)
       .eq("waste_type", input.wasteType)
       .maybeSingle());
   }
   ```
   Risk/demand multipliers stay exactly as they are.

> Because the DB still holds the bucket rows, you can ship the DB change now and the UI change
> later with **zero downtime** — old quotes keep working, new ones get granular precision.

### 5.3 Checkbox list to configure in the Next.js form (already in `WASTE_CATALOG`)

```
Metals:            Aluminum, Brass, Copper, Iron, Stainless Steel, Tin
Batteries:         Car Battery, Inverter Battery, Lead Acid Battery,
                   Lithium Ion Battery, Two Wheeler Battery, UPS Battery
Vehicle Scrap:     Car Body, Catalytic Converter, Radiator
Appliances:        AC Compressor
Paper & Packaging: Cardboard, Newspaper
E-Waste:           E-Waste
Plastics:          Plastic
Other (fallback):  Glass, Organic, Mixed
```

### 5.4 Type note

`lib/types.ts` `WasteType` (the 7-ish buckets) can stay as-is — it remains the **fallback
bucket** and the `pickup_requests.waste_type` storage value (`dominantBucket()` still works).
If you want strict typing on the new material field, add:
```ts
export type MaterialType =
  | "Aluminum" | "Brass" | "Copper" | "Iron" | "Stainless Steel" | "Tin"
  | "Car Body" | "Catalytic Converter" | "Radiator" | "AC Compressor"
  | "Car Battery" | "Inverter Battery" | "Lead Acid Battery"
  | "Lithium Ion Battery" | "Two Wheeler Battery" | "UPS Battery"
  | "Cardboard" | "Newspaper" | "E-Waste" | "Plastic"
  | "Glass" | "Organic" | "Mixed";
```

---

## 6. What was applied to Supabase (already done)

- Added `material_type text NOT NULL` to `price_estimates`; backfilled existing rows
  (`material_type = waste_type`).
- Replaced the `(waste_type, area)` PRIMARY KEY with a surrogate `id` PK + a unique index on
  `(material_type, area)`.
- Upserted **100 granular rows** (`model_version = 'mv_v2_granular'`), 20 materials × 5 sectors.
- **Kept** the original 40 bucket rows (`mv_v2`, `seed_ewaste`) as fallback.

Live table now: 125 rows total. Existing frontend continues to resolve via the bucket rows
until you ship the §5.2 lookup change.

---

## 7. Live model serving (FastAPI) — APPLIED

The `.joblib` model is now served live via a FastAPI service (`ml/api/`), and the site is
wired to call it with a safe Supabase fallback. Full deploy steps: **`ml/api/README.md`**.

**Why FastAPI off-Vercel:** sklearn can't run in Vercel functions. The model runs in a normal
Python container (Railway/Render/Fly); Vercel keeps hosting the site.

**What was added**
- `ml/api/main.py` — FastAPI app. Loads the model that `metrics.json` selects (LR today),
  reverse-maps **sector → region** (the app sends `Rishra`; the model trained on `Srirampore`),
  exposes `POST /predict`, `POST /predict-batch`, `GET /health`. Optional `API_TOKEN` bearer auth.
- `ml/api/requirements.txt`, `Dockerfile`, `Procfile`, `.env.example`, `README.md`.

**Site changes (minimal, non-breaking)**
- `lib/pricing-constants.ts` — added `MODEL_API_URL`, `MODEL_API_TOKEN`, `MODEL_API_TIMEOUT_MS`
  (all from env; default empty).
- `lib/estimate.ts` — `getMarketValuePerKg()` now calls the model **first** (2 s timeout), then
  falls back to the Supabase rows on any error. **Critical correctness fix:** risk/demand are real
  model features, so a model-sourced value is used as-is; the `RISK_MULTIPLIER × DEMAND_MULTIPLIER`
  adjustment is applied **only** on the Supabase-table fallback path (those rows are risk-neutral).

**Safety:** `MODEL_API_URL` defaults to `""`. Until you set it on Vercel, the app behaves exactly
as before (table-only). Set the three env vars → redeploy → it goes live. No UI changes needed.

**Verified:** API returns correct predictions (Copper Howrah Low ₹595.54, High ₹494.26; batch
Iron/Brass via sector→region map); risk moves the price; whole project `tsc --noEmit` passes.
