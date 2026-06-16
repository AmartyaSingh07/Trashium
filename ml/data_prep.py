"""
Data loading, leakage-safe feature engineering, and the shared sklearn preprocessor
for the MARKET-VALUE model.

KEY ANTI-LEAKAGE RULE
  We predict Market_Value_perKg. Market value is a per-kg PRICE set by
  material / region / demand / quality / season. It does NOT depend on how much the
  user brings (quantity) or how far the hub is (distance / logistics). So those
  transaction variables are deliberately EXCLUDED as model inputs and applied later,
  deterministically, in pricing.py. Feeding them in is exactly what produced the
  fake R2 ~0.999 in v1 (the model rebuilt the payout formula instead of learning price).
"""
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler

import config as C


def load_raw(path=C.DATA_PATH) -> pd.DataFrame:
    path = str(path)
    df = pd.read_excel(path) if path.lower().endswith((".xlsx", ".xls")) else pd.read_csv(path)
    df[C.COL_DATE] = pd.to_datetime(df[C.COL_DATE])
    return df.drop(columns=[c for c in C.COL_DROP if c in df.columns])


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # Calendar features (capture the mild trend/seasonality in market value).
    df["month"]       = df[C.COL_DATE].dt.month
    df["day_of_week"] = df[C.COL_DATE].dt.dayofweek
    df["is_weekend"]  = (df["day_of_week"] >= 5).astype(int)
    # Reference-only transaction economics (NOT used as model features).
    df["logistics_per_kg"] = df[C.COL_LOGISTICS] / df[C.COL_QTY].replace(0, np.nan)
    # Map to the app taxonomy (used for aggregation, not as model input).
    df["app_sector"]    = df[C.COL_REGION].map(C.REGION_TO_SECTOR)
    df["app_wastetype"] = df[C.COL_CATEGORY].map(C.CATEGORY_TO_WASTETYPE)
    return df


# Feature groups for predicting MARKET VALUE (price-setting drivers only).
NUMERIC  = ["month", "day_of_week", "is_weekend"]
NOMINAL  = [C.COL_REGION, C.COL_MATERIAL]
ORDINAL  = [C.COL_DEMAND, C.COL_RISK]
FEATURES = NUMERIC + NOMINAL + ORDINAL

# Transaction variables intentionally EXCLUDED (applied downstream in pricing.py):
TXN_EXCLUDED = [C.COL_QTY, C.COL_DISTANCE, C.COL_LOGISTICS, "logistics_per_kg"]


def build_preprocessor() -> ColumnTransformer:
    numeric_pipe = Pipeline([("impute", SimpleImputer(strategy="median")),
                             ("scale",  StandardScaler())])
    nominal_pipe = Pipeline([("impute", SimpleImputer(strategy="most_frequent")),
                             ("ohe",    OneHotEncoder(handle_unknown="ignore"))])
    ordinal_pipe = Pipeline([("impute", SimpleImputer(strategy="most_frequent")),
                             ("ord",    OrdinalEncoder(
                                 categories=[C.ORDINAL_LEVELS[C.COL_DEMAND],
                                             C.ORDINAL_LEVELS[C.COL_RISK]]))])
    return ColumnTransformer([
        ("num", numeric_pipe, NUMERIC),
        ("nom", nominal_pipe, NOMINAL),
        ("ord", ordinal_pipe, ORDINAL),
    ], remainder="drop")


def chrono_split(df: pd.DataFrame, frac=0.8):
    """Chronological split - train on the past, test on the future (no shuffle)."""
    df = df.sort_values(C.COL_DATE)
    cut = df[C.COL_DATE].quantile(frac)
    return df[df[C.COL_DATE] <= cut].copy(), df[df[C.COL_DATE] > cut].copy()
