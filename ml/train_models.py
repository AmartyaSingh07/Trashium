"""
Train & evaluate the pricing models on the MARKET-VALUE target.

  Model 1  Linear Regression  - interpretable baseline (on log market value)
  Model 2  Random Forest      - non-linear challenger (on log market value)
  Model 3  Moving Average     - per-series trend (see moving_average.py)

WHY LOG TARGET: risk/demand act as MULTIPLIERS on a material's base value
(High risk ~= -18%, etc.). On the raw scale a single linear coefficient applies a
fixed rupee haircut - too small for premium metals and large enough to push cheap
items (cardboard/plastic) NEGATIVE. Modelling log(value) makes those effects
additive, keeps every prediction > 0, and gets the % effects right across the
8 INR/kg -> 1200 INR/kg range. We therefore score on a relative metric (MAPE) too.

LEAKAGE DEMO (kept on the record): predicting PAYOUT from price drivers + the
transaction variables (qty, distance, logistics) rebuilds the formula -> R2 ~0.999.

Outputs (ml/artifacts/): rf_mv.joblib, lr_mv.joblib, metrics.json
Run:  python train_models.py
"""
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import config as C
import data_prep as P


def _scores(y, pred):
    y = np.asarray(y, float); pred = np.asarray(pred, float)
    mape = float(np.mean(np.abs((y - pred) / np.clip(np.abs(y), 1e-9, None))) * 100)
    return {"mae":  round(float(mean_absolute_error(y, pred)), 3),
            "rmse": round(float(np.sqrt(mean_squared_error(y, pred))), 3),
            "r2":   round(float(r2_score(y, pred)), 4),
            "mape_pct": round(mape, 2)}


def _log_model(regressor):
    """Wrap a regressor so it trains on log(value) and predicts in rupees (always > 0)."""
    return Pipeline([("prep", P.build_preprocessor()),
                     ("model", TransformedTargetRegressor(
                         regressor=regressor, func=np.log, inverse_func=np.exp))])


def _leakage_demo(train, test):
    """v1-style: predict PAYOUT using price drivers + transaction vars => identity recovery."""
    num = ["month", "day_of_week", "is_weekend", C.COL_QTY, C.COL_DISTANCE, C.COL_LOGISTICS]
    nom = [C.COL_REGION, C.COL_MATERIAL]
    ordc = [C.COL_DEMAND, C.COL_RISK]
    pre = ColumnTransformer([
        ("num", Pipeline([("i", SimpleImputer(strategy="median")), ("s", StandardScaler())]), num),
        ("nom", Pipeline([("i", SimpleImputer(strategy="most_frequent")),
                          ("o", OneHotEncoder(handle_unknown="ignore"))]), nom),
        ("ord", Pipeline([("i", SimpleImputer(strategy="most_frequent")),
                          ("o", OrdinalEncoder(categories=[C.ORDINAL_LEVELS[C.COL_DEMAND],
                                                           C.ORDINAL_LEVELS[C.COL_RISK]]))]), ordc),
    ])
    feats = num + nom + ordc
    tr = train.sample(min(15000, len(train)), random_state=C.RANDOM_STATE)
    m = Pipeline([("prep", pre), ("rf", RandomForestRegressor(
        n_estimators=60, max_depth=16, max_samples=0.6,
        random_state=C.RANDOM_STATE, n_jobs=-1))])
    m.fit(tr[feats], tr[C.COL_PAYOUT])
    return _scores(test[C.COL_PAYOUT], m.predict(test[feats]))


def main():
    df = P.add_features(P.load_raw())
    train, test = P.chrono_split(df, frac=0.8)
    X_tr, y_tr = train[P.FEATURES], train[C.COL_TARGET]
    X_te, y_te = test[P.FEATURES],  test[C.COL_TARGET]
    print(f"train={len(train):,} | test={len(test):,} | target=log({C.COL_TARGET})")

    # ---- Model 1: Linear Regression on log value ------------------------- #
    lr = _log_model(LinearRegression())
    lr.fit(X_tr, y_tr)
    lr_metrics = _scores(y_te, lr.predict(X_te))
    print("LinearRegression :", lr_metrics)

    # ---- Model 2: Random Forest on log value ----------------------------- #
    rf = _log_model(RandomForestRegressor(
        n_estimators=400, max_depth=18, min_samples_split=5, min_samples_leaf=2,
        max_features="sqrt", max_samples=0.5, random_state=C.RANDOM_STATE, n_jobs=-1))
    rf.fit(X_tr, y_tr)
    rf_pred = rf.predict(X_te)
    rf_metrics = _scores(y_te, rf_pred)
    print("RandomForest     :", rf_metrics)

    # Per-material MAE for the RF.
    per_mat = (test.assign(pred=rf_pred, ae=lambda d: (d[C.COL_TARGET] - d["pred"]).abs())
                   .groupby(C.COL_MATERIAL)["ae"].mean().round(2).sort_values())

    # Feature importances (unwrap the TransformedTargetRegressor -> fitted RF).
    fitted_rf = rf.named_steps["model"].regressor_
    ohe = rf.named_steps["prep"].named_transformers_["nom"]["ohe"].get_feature_names_out(P.NOMINAL)
    names = P.NUMERIC + list(ohe) + P.ORDINAL
    imp = (pd.Series(fitted_rf.feature_importances_, index=names)
             .sort_values(ascending=False).head(12).round(4))

    # ---- Leakage demo ---------------------------------------------------- #
    leak = _leakage_demo(train, test)
    print("LEAKAGE DEMO - RF predicting PAYOUT w/ txn vars:", leak, " <- fake win")

    best = "linear_regression" if lr_metrics["mape_pct"] <= rf_metrics["mape_pct"] else "random_forest"

    joblib.dump(rf, C.ARTIFACT_DIR / "rf_mv.joblib")
    joblib.dump(lr, C.ARTIFACT_DIR / "lr_mv.joblib")
    out = {"model_version": C.MODEL_VERSION, "target": "log(" + C.COL_TARGET + ")",
           "selection_metric": "mape_pct", "best_model": best,
           "n_train": int(len(train)), "n_test": int(len(test)),
           "linear_regression": lr_metrics,
           "random_forest": rf_metrics,
           "leakage_demo_predicting_payout_with_txn_vars": leak,
           "rf_top_features": imp.to_dict(),
           "rf_worst_material_mae": per_mat.tail(5).to_dict(),
           "rf_best_material_mae": per_mat.head(5).to_dict()}
    (C.ARTIFACT_DIR / "metrics.json").write_text(json.dumps(out, indent=2))
    print(f"\nBest model by MAPE: {best}")
    print("Top features:\n", imp.to_string())
    print("\nSaved -> artifacts/rf_mv.joblib, lr_mv.joblib, metrics.json")
    return out


if __name__ == "__main__":
    main()
