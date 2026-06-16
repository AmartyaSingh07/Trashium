"""
Model 3 - Moving Average (trend) on MARKET VALUE, per (Region, Material) series.

Leakage-safe trailing SMAs (7/15/30/90), EMA(30) and 30-day volatility. Three jobs:
  (1) guardrail for the RF market-value prediction,
  (2) cold-start fallback when a series has too little history,
  (3) drift monitor (RF vs SMA gap, scaled by volatility).

Run:  python moving_average.py
"""
import pandas as pd
import config as C
import data_prep as P

WINDOWS = (7, 15, 30, 90)


def compute_moving_averages(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values([C.COL_REGION, C.COL_MATERIAL, C.COL_DATE]).copy()
    g = df.groupby([C.COL_REGION, C.COL_MATERIAL])[C.COL_MARKETVAL]
    for w in WINDOWS:
        df[f"sma_{w}"] = g.transform(lambda s: s.shift(1).rolling(w, min_periods=1).mean())
    df["vol_30"] = g.transform(lambda s: s.shift(1).rolling(30, min_periods=5).std())
    df["ema_30"] = g.transform(lambda s: s.shift(1).ewm(span=30, adjust=False).mean())
    return df


def latest_trends(df: pd.DataFrame) -> pd.DataFrame:
    """Most-recent SMA/vol per (Region, Material), mapped to the app taxonomy."""
    ma = compute_moving_averages(P.add_features(df))
    latest = ma.sort_values(C.COL_DATE).groupby([C.COL_REGION, C.COL_MATERIAL]).tail(1)
    cols = [C.COL_REGION, C.COL_MATERIAL, "app_sector", "app_wastetype",
            "sma_7", "sma_15", "sma_30", "sma_90", "vol_30"]
    return latest[cols].reset_index(drop=True)


if __name__ == "__main__":
    raw = P.load_raw()
    out = latest_trends(raw)
    out.to_csv(C.ARTIFACT_DIR / "ma_trends_latest.csv", index=False)
    print(out.head(10).to_string(index=False))
    print(f"\nSaved -> artifacts/ma_trends_latest.csv  ({len(out)} series)")
