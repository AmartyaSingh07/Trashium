"""
Publish the model outputs into Supabase so the Next.js app can read them.

Upserts:
  price_estimates   <- artifacts/price_estimates_seed.csv  (rates the app already reads)
  ma_trends         <- artifacts/ma_trends_latest.csv       (guardrail / cold-start)
  model_metrics     <- artifacts/metrics.json               (monitoring)

Needs env vars (use the SERVICE-ROLE key; it bypasses RLS for writes):
  SUPABASE_URL, SUPABASE_SERVICE_KEY
Run nightly (cron / GitHub Action):  python publish_to_supabase.py
"""
import json
import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

import config as C

load_dotenv()


def main():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    sb = create_client(url, key)

    # 1) price_estimates (waste_type, area=sector, price_per_kg + profit columns)
    rates = pd.read_csv(C.ARTIFACT_DIR / "price_estimates_seed.csv")
    payload = rates[["waste_type", "area", "price_per_kg", "logistics_per_kg",
                     "market_price_per_kg", "profit_per_kg", "model_version"]].to_dict("records")
    sb.table("price_estimates").upsert(payload, on_conflict="waste_type,area").execute()
    print(f"upserted {len(payload)} price_estimates rows")

    # 2) ma_trends (latest per sector x waste type — aggregate the per-series file)
    ma = pd.read_csv(C.ARTIFACT_DIR / "ma_trends_latest.csv")
    ma_app = (ma.groupby(["app_sector", "app_wastetype"])[["sma_7", "sma_15", "sma_30", "sma_90", "vol_30"]]
                .mean().round(2).reset_index()
                .rename(columns={"app_sector": "sector", "app_wastetype": "waste_type"}))
    sb.table("ma_trends").upsert(ma_app.to_dict("records"), on_conflict="sector,waste_type").execute()
    print(f"upserted {len(ma_app)} ma_trends rows")

    # 3) model_metrics
    m = json.loads((C.ARTIFACT_DIR / "metrics.json").read_text())
    sb.table("model_metrics").insert({
        "model_version": m["model_version"],
        "mae": m["random_forest"]["mae"], "rmse": m["random_forest"]["rmse"],
        "r2": m["random_forest"]["r2"],
    }).execute()
    print("inserted model_metrics row")


if __name__ == "__main__":
    main()
