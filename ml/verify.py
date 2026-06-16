"""Verification checks for the v2 market-value pricing pipeline."""
import json, joblib, numpy as np, pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
import config as C, data_prep as P, pricing

def line(t): print("\n" + "="*8 + " " + t + " " + "="*8)

df = P.add_features(P.load_raw())
train, test = P.chrono_split(df, 0.8)

# 1) Structural leakage check
line("1) LEAKAGE: model features exclude transaction vars")
bad = [f for f in P.FEATURES if f in (C.COL_QTY, C.COL_DISTANCE, C.COL_LOGISTICS, "logistics_per_kg")]
print("features:", P.FEATURES); print("PASS" if not bad else f"FAIL: {bad}")

# 2) Risk monotonicity with the current best (LR) model
line("2) RISK now moves the PREDICTED price (best model)")
m = json.loads((C.ARTIFACT_DIR/"metrics.json").read_text())
best = "lr_mv.joblib" if m["linear_regression"]["mae"] <= m["random_forest"]["mae"] else "rf_mv.joblib"
model = joblib.load(C.ARTIFACT_DIR/best); print("best model:", best)
def predict_grid(material):
    base = dict(month=6, day_of_week=2, is_weekend=0,
                **{C.COL_REGION:"Howrah", C.COL_MATERIAL:material, C.COL_DEMAND:"Medium"})
    rows = [{**base, C.COL_RISK:r} for r in ["Low","Medium","High"]]
    X = pd.DataFrame(rows)[P.FEATURES]
    return dict(zip(["Low","Medium","High"], model.predict(X).round(1)))
for mat in ["Copper","Plastic","E-Waste"]:
    g = predict_grid(mat); mono = g["Low"]>=g["Medium"]>=g["High"]
    print(f"  {mat:10s} {g}  monotonic_down={mono}")

# 3) Experiment: predict LOG(market value) so multiplicative risk/demand become additive
line("3) EXPERIMENT: LR on log(market value)")
ytr = np.log(train[C.COL_TARGET]); yte = test[C.COL_TARGET]
lrlog = Pipeline([("prep",P.build_preprocessor()),("m",LinearRegression())]).fit(train[P.FEATURES], ytr)
pred = np.exp(lrlog.predict(test[P.FEATURES]))
print(f"  log-LR  MAE={mean_absolute_error(yte,pred):.3f}  R2={r2_score(yte,pred):.4f}   (vs linear-LR MAE={m['linear_regression']['mae']})")
def predict_grid_log(material):
    base = dict(month=6, day_of_week=2, is_weekend=0,
                **{C.COL_REGION:"Howrah", C.COL_MATERIAL:material, C.COL_DEMAND:"Medium"})
    X = pd.DataFrame([{**base, C.COL_RISK:r} for r in ["Low","Medium","High"]])[P.FEATURES]
    p = np.exp(lrlog.predict(X)); return dict(zip(["Low","Med","High"], p.round(1)))
for mat in ["Copper","Plastic"]:
    print(f"  log-LR {mat}: {predict_grid_log(mat)}  (true mult: Low=1.0,Med=.92,High=.82)")

# 4) Formula reproduction + positive margin on the price table
line("4) PRICE TABLE: margin = c*MV, payout = MV*(1-c) - logistics/kg, margin>0")
tbl = pd.read_csv(C.ARTIFACT_DIR/"price_estimates_seed.csv")
c = C.TRASHIUM_COMMISSION
tbl["margin_check"] = (tbl["market_price_per_kg"]*c)
tbl["payout_check"] = (tbl["market_price_per_kg"]*(1-c) - tbl["logistics_per_kg"]).clip(lower=0)
ok_m = np.allclose(tbl["profit_per_kg"], tbl["margin_check"], atol=0.02)
ok_p = np.allclose(tbl["price_per_kg"], tbl["payout_check"], atol=0.02)
print(f"  margin formula reproduces: {ok_m} | payout formula reproduces: {ok_p}")
print(f"  model rows margin>0: {(tbl[tbl.source=='model']['profit_per_kg']>0).all()}")
print(f"  rows below MIN_MARGIN {C.MIN_MARGIN_PER_KG}: {tbl[tbl.profit_per_kg<C.MIN_MARGIN_PER_KG]['waste_type'].tolist()}")

# 5) End-to-end serve-time quote (simulates the crew form)
line("5) CREW-FORM SIMULATION (material, qty, distance, risk -> payout)")
for material, qty, dist, risk in [("Copper",30,12,"Low"), ("Copper",30,12,"High"),
                                  ("Plastic",50,20,"Low"), ("Cardboard",40,25,"Medium")]:
    X = pd.DataFrame([dict(month=6,day_of_week=2,is_weekend=0,
        **{C.COL_REGION:"Howrah",C.COL_MATERIAL:material,C.COL_DEMAND:C.DEFAULT_DEMAND,C.COL_RISK:risk})])[P.FEATURES]
    mv = float(model.predict(X)[0])
    q = pricing.quote(mv, dist, qty)
    print(f"  {material:9s} qty={qty:>3} dist={dist:>2}km risk={risk:6s} "
          f"-> MV/kg={q['market_value_per_kg']:>7.2f}  payout/kg={q['user_payout_per_kg']:>7.2f}  "
          f"margin/kg={q['margin_per_kg']:>6.2f}  user_total=Rs{q['user_payout_total']:>8.2f}")
