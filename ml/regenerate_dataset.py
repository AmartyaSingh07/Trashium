"""
Regenerate the training dataset so the two crew/market signals behave correctly:

  * QUALITY DEFECT RISK lowers market value (raw file had ~no effect).
  * MARKET DEMAND raises market value (raw file had it INVERTED: low demand -> high price).

Method (work from the raw upload, change ONLY these two effects):
  1. Remove the raw file's per-(material, demand) effect by dividing each row's market
     value by that cell's relative factor  ->  a demand-neutral base value.
  2. Re-apply a correct demand multiplier (High > Medium > Low).
  3. Apply the quality-risk haircut.
  4. Add mild noise; recompute the base user payout (commission = 0) for back-compat.

Material / region / date / quantity / distance / logistics are untouched.

Run:  python regenerate_dataset.py
"""
from pathlib import Path
import numpy as np
import pandas as pd
import config as C

SEED = 42
NOISE_SD = 0.015
SRC = Path(__file__).resolve().parent / "data" / "source_raw.xlsx"
OUT = Path(__file__).resolve().parent / "data" / "dataset_learnable.xlsx"   # canonical training file (corrected)

COL_MV   = C.COL_MARKETVAL
COL_RISK = C.COL_RISK
COL_DEM  = C.COL_DEMAND
COL_MAT  = C.COL_MATERIAL


def main():
    rng = np.random.default_rng(SEED)
    df = pd.read_excel(SRC)

    # 1) Demand-neutral base: divide out the raw per-(material, demand) relative factor.
    mat_mean = df.groupby(COL_MAT)[COL_MV].transform("mean")
    cell_mean = df.groupby([COL_MAT, COL_DEM])[COL_MV].transform("mean")
    raw_demand_factor = (cell_mean / mat_mean).replace(0, np.nan).fillna(1.0)
    neutral = df[COL_MV] / raw_demand_factor

    # 2) Correct demand + 3) risk + 4) noise
    dem_mult  = df[COL_DEM].map(C.DEMAND_MULTIPLIER).astype(float)
    risk_mult = df[COL_RISK].map(C.RISK_MULTIPLIER).astype(float)
    noise     = rng.normal(1.0, NOISE_SD, len(df)).clip(0.95, 1.05)
    df[COL_MV] = (neutral * dem_mult * risk_mult * noise).round(2)

    # Recompute base payout (commission = 0): payout/kg = MV/kg - logistics/kg
    logistics_per_kg = df[C.COL_LOGISTICS] / df[C.COL_QTY].replace(0, np.nan)
    df[C.COL_PAYOUT] = (df[COL_MV] - logistics_per_kg).round(2)

    df.to_excel(OUT, index=False)
    print(f"Wrote {OUT}  ({len(df):,} rows)")
    cop = df[df[COL_MAT] == "Copper"]
    print("Copper MV by DEMAND (should rise Low->High):",
          cop.groupby(COL_DEM)[COL_MV].mean().round(1).to_dict())
    print("Copper MV by RISK  (should fall Low->High):",
          cop.groupby(COL_RISK)[COL_MV].mean().round(1).to_dict())


if __name__ == "__main__":
    main()
