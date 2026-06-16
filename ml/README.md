# Trashium Pricing ML (v2 — market-value model)

Turns the historical scrap dataset into live, profitable per-kg pricing for the app.

## What the models predict
We predict **Market Value / kg** (the only genuinely uncertain quantity), then *derive*
the payout with the business formula. Predicting the payout directly leaks the formula
(fake R² ≈ 0.999); see `Trashium_Pricing_Model_Training_Guide.docx` for the full reasoning.

| Model | File | Role | Test MAPE |
|-------|------|------|-----------|
| Linear Regression (log value) | `train_models.py` | **Production predictor** | **6.11%** |
| Random Forest (log value) | `train_models.py` | Non-linear challenger / monitor | 9.80% |
| Moving Average | `moving_average.py` | Trend guardrail, cold-start, drift monitor | — |

## Business formulas (single source of truth: `pricing.py`)
```
logistics/kg   = logistics_cost / quantity            # rate card: 111.06 + 4.80*km
user_payout/kg = market_value/kg * (1 - COMMISSION) - logistics/kg
margin/kg      = market_value/kg - user_payout/kg - logistics/kg = COMMISSION * market_value/kg
```
`COMMISSION` (default 0.15) lives in `config.py`. **`COMMISSION = 0` reproduces the original
zero-margin formula.** Without it, payout and margin cancel and Trashium earns ₹0.

## Data corrections (`regenerate_dataset.py`)
The raw upload had **quality risk with ~no effect** and **demand inverted**. We regenerate
`data/dataset_learnable.xlsx` so risk lowers value (×1.00/0.92/0.82) and demand raises it
(×0.95/1.00/1.07). Original upload kept as `data/source_raw.xlsx`.

## Run the pipeline
```bash
python regenerate_dataset.py     # data/dataset_learnable.xlsx (risk + demand corrected)
python train_models.py           # lr_mv.joblib, rf_mv.joblib, metrics.json
python moving_average.py          # ma_trends_latest.csv
python build_price_table.py       # price_estimates_seed.{csv,sql} (auto-picks best model)
python verify.py                  # sanity gates
python publish_to_supabase.py     # upsert into price_estimates
```

## Real recycler price feed (optional override)
Drop `data/market_prices.csv` (`waste_type, area, market_price_per_kg`) — or set env
`TRASHIUM_MARKET_FEED` — and `build_price_table.py` uses those values instead of the model's
where provided (rows marked `feed`). Template: `data/market_prices.sample.csv`.

## How it maps to the app
Output lands in `price_estimates(waste_type, area, price_per_kg, logistics_per_kg,
market_price_per_kg, profit_per_kg, model_version)`, read by `lib/pricing.ts`.
Dataset regions → `OPERATIONAL_SECTORS`; categories → 7 app `WasteType`s (see `config.py`).
Glass/Organic/Mixed have no dataset coverage → `FALLBACK_RATES`.
