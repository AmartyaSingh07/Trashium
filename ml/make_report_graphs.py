"""ML Results generator for Trashium pricing models."""
import json, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from sklearn.pipeline import Pipeline
from sklearn.compose import TransformedTargetRegressor
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (mean_absolute_error, mean_squared_error, r2_score,
                             confusion_matrix, precision_score, recall_score, f1_score,
                             accuracy_score)
import config as C
import data_prep as P
warnings.filterwarnings("ignore")
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "report_graphs")
os.makedirs(OUT, exist_ok=True)
GREEN, BARK, CLAY, SAND, SLATE = "#4a7c59", "#3a2e26", "#c06d3f", "#d9c4a3", "#6b7a8f"

def reg_scores(y, pred):
    y = np.asarray(y, float); pred = np.asarray(pred, float)
    mape = float(np.mean(np.abs((y - pred) / np.clip(np.abs(y), 1e-9, None))) * 100)
    return {"mae": round(float(mean_absolute_error(y, pred)), 3),
            "rmse": round(float(np.sqrt(mean_squared_error(y, pred))), 3),
            "r2": round(float(r2_score(y, pred)), 4),
            "mape_pct": round(mape, 2)}

def tol_acc(y, pred, tol):
    y = np.asarray(y, float); pred = np.asarray(pred, float)
    return round(float(np.mean(np.abs(pred - y) / np.clip(np.abs(y), 1e-9, None) <= tol) * 100), 2)

def log_model(regressor):
    return Pipeline([("prep", P.build_preprocessor()),
                     ("model", TransformedTargetRegressor(regressor=regressor, func=np.log, inverse_func=np.exp))])

df = P.add_features(P.load_raw())
train, test = P.chrono_split(df, frac=0.8)
X_tr, y_tr = train[P.FEATURES], train[C.COL_TARGET]
X_te, y_te = test[P.FEATURES], test[C.COL_TARGET]
print(f"train={len(train):,}  test={len(test):,}")

lr = log_model(LinearRegression()); lr.fit(X_tr, y_tr); lr_pred = lr.predict(X_te)
rf = log_model(RandomForestRegressor(n_estimators=400, max_depth=18, min_samples_split=5,
      min_samples_leaf=2, max_features="sqrt", max_samples=0.5, random_state=C.RANDOM_STATE, n_jobs=-1))
rf.fit(X_tr, y_tr); rf_pred = rf.predict(X_te)
ma_df = train.groupby([C.COL_REGION, C.COL_MATERIAL])[C.COL_TARGET].mean()
ma_pred = test.apply(lambda r: ma_df.get((r[C.COL_REGION], r[C.COL_MATERIAL]), train[C.COL_TARGET].mean()), axis=1).values

lr_m, rf_m, ma_m = reg_scores(y_te, lr_pred), reg_scores(y_te, rf_pred), reg_scores(y_te, ma_pred)
print("LR:", lr_m); print("RF:", rf_m); print("MA:", ma_m)

tols = [0.05, 0.10, 0.15]
acc = {"linear_regression": {f"within_{int(t*100)}pct": tol_acc(y_te, lr_pred, t) for t in tols},
       "random_forest": {f"within_{int(t*100)}pct": tol_acc(y_te, rf_pred, t) for t in tols},
       "moving_average": {f"within_{int(t*100)}pct": tol_acc(y_te, ma_pred, t) for t in tols}}

q = train[C.COL_TARGET].quantile([0.25, 0.5, 0.75]).values
edges = [-np.inf, q[0], q[1], q[2], np.inf]
labels = ["Budget", "Standard", "Valuable", "Premium"]
to_band = lambda v: pd.cut(v, bins=edges, labels=labels)
y_band, lr_band, rf_band = to_band(np.asarray(y_te, float)), to_band(lr_pred), to_band(rf_pred)
cm = confusion_matrix(y_band, lr_band, labels=labels)
def cls(yb, pb):
    return {"accuracy": round(float(accuracy_score(yb, pb)),4),
            "precision": [round(float(x),4) for x in precision_score(yb, pb, labels=labels, average=None, zero_division=0)],
            "recall": [round(float(x),4) for x in recall_score(yb, pb, labels=labels, average=None, zero_division=0)],
            "f1": [round(float(x),4) for x in f1_score(yb, pb, labels=labels, average=None, zero_division=0)],
            "macro_f1": round(float(f1_score(yb, pb, labels=labels, average='macro', zero_division=0)),4)}
band_lr, band_rf = cls(y_band, lr_band), cls(y_band, rf_band)
print("band acc LR:", band_lr["accuracy"], "RF:", band_rf["accuracy"])

metrics = {"n_train": int(len(train)), "n_test": int(len(test)), "rf_n_estimators": 400,
    "price_band_edges_inr": [round(float(x),2) for x in q],
    "regression": {"linear_regression": lr_m, "random_forest": rf_m, "moving_average": ma_m},
    "tolerance_accuracy_pct": acc,
    "band_classification": {"labels": labels, "linear_regression": band_lr, "random_forest": band_rf,
                            "confusion_matrix_lr": cm.tolist()}}
json.dump(metrics, open(os.path.join(os.path.dirname(OUT), "results_metrics.json"), "w"), indent=2)

plt.rcParams.update({"font.size": 11, "axes.edgecolor": "#888", "axes.grid": True,
                     "grid.alpha": 0.25, "figure.facecolor": "white", "axes.facecolor": "white"})
models = ["Moving\nAverage", "Random\nForest (400)", "Linear\nRegression"]
colors = [SLATE, CLAY, GREEN]

# 1 MAPE
fig, ax = plt.subplots(figsize=(7.2,4.2))
mapes = [ma_m["mape_pct"], rf_m["mape_pct"], lr_m["mape_pct"]]
bars = ax.bar(models, mapes, color=colors, width=0.6, edgecolor="white")
for b,v in zip(bars,mapes): ax.text(b.get_x()+b.get_width()/2, v+0.4, f"{v:.2f}%", ha="center", fontweight="bold")
ax.set_ylabel("MAPE  (lower = better)"); ax.set_ylim(0, max(mapes)*1.25)
ax.set_title("Model Selection Metric - Mean Absolute Percentage Error", fontweight="bold")
ax.annotate("selected", xy=(2, lr_m["mape_pct"]), xytext=(2, lr_m["mape_pct"]+max(mapes)*0.28),
            ha="center", color=GREEN, fontweight="bold", arrowprops=dict(arrowstyle="->", color=GREEN))
plt.tight_layout(); plt.savefig(f"{OUT}/g1_mape.png", dpi=150); plt.close()

# 2 error metrics
fig, ax = plt.subplots(figsize=(8.4,4.6))
metr=["MAE (Rs)","RMSE (Rs)","MAPE (%)"]; lr_v=[lr_m["mae"],lr_m["rmse"],lr_m["mape_pct"]]; rf_v=[rf_m["mae"],rf_m["rmse"],rf_m["mape_pct"]]
x=np.arange(len(metr)); w=0.38
b1=ax.bar(x-w/2,lr_v,w,label="Linear Regression",color=GREEN,edgecolor="white")
b2=ax.bar(x+w/2,rf_v,w,label="Random Forest (400)",color=CLAY,edgecolor="white")
for bs in (b1,b2):
    for b in bs: ax.text(b.get_x()+b.get_width()/2,b.get_height()+0.3,f"{b.get_height():.2f}",ha="center",fontsize=9,fontweight="bold")
ax.set_xticks(x); ax.set_xticklabels(metr); ax.set_ylabel("Error (lower = better)")
ax.set_title("Error Metrics - Linear Regression vs Random Forest", fontweight="bold"); ax.legend()
plt.tight_layout(); plt.savefig(f"{OUT}/g2_error_metrics.png", dpi=150); plt.close()

# 3 R2
fig, ax = plt.subplots(figsize=(7.2,4.2))
r2s=[ma_m["r2"],rf_m["r2"],lr_m["r2"]]
bars=ax.bar(models,r2s,color=colors,width=0.6,edgecolor="white")
for b,v in zip(bars,r2s): ax.text(b.get_x()+b.get_width()/2,v-0.03,f"{v:.4f}",ha="center",color="white",fontweight="bold")
ax.set_ylabel("R2  (higher = better)"); ax.set_ylim(min(r2s)*0.98,1.005)
ax.set_title("Coefficient of Determination (R2)", fontweight="bold")
plt.tight_layout(); plt.savefig(f"{OUT}/g3_r2.png", dpi=150); plt.close()

# 4 tolerance
fig, ax = plt.subplots(figsize=(8.0,4.6))
tl=["Within +/-5%","Within +/-10%","Within +/-15%"]
lr_a=[acc["linear_regression"][f"within_{int(t*100)}pct"] for t in tols]; rf_a=[acc["random_forest"][f"within_{int(t*100)}pct"] for t in tols]
x=np.arange(len(tl)); w=0.38
b1=ax.bar(x-w/2,lr_a,w,label="Linear Regression",color=GREEN,edgecolor="white")
b2=ax.bar(x+w/2,rf_a,w,label="Random Forest (400)",color=CLAY,edgecolor="white")
for bs in (b1,b2):
    for b in bs: ax.text(b.get_x()+b.get_width()/2,b.get_height()+0.8,f"{b.get_height():.1f}%",ha="center",fontsize=9,fontweight="bold")
ax.set_xticks(x); ax.set_xticklabels(tl); ax.set_ylabel("Predictions within tolerance (%)"); ax.set_ylim(0,105)
ax.set_title("Prediction Accuracy at Price Tolerance Bands", fontweight="bold"); ax.legend(loc="lower right")
plt.tight_layout(); plt.savefig(f"{OUT}/g4_tolerance.png", dpi=150); plt.close()

# 5 confusion
fig, ax = plt.subplots(figsize=(5.8,5.2))
cmap=LinearSegmentedColormap.from_list("earth",["#f6f1e7",GREEN]); im=ax.imshow(cm,cmap=cmap)
ax.set_xticks(range(4)); ax.set_yticks(range(4)); ax.set_xticklabels(labels); ax.set_yticklabels(labels)
ax.set_xlabel("Predicted price band"); ax.set_ylabel("Actual price band")
ax.set_title(f"Confusion Matrix - Linear Regression\n(price-band accuracy = {band_lr['accuracy']*100:.1f}%)", fontweight="bold")
thr=cm.max()/2
for i in range(4):
    for j in range(4): ax.text(j,i,f"{cm[i,j]:,}",ha="center",va="center",color="white" if cm[i,j]>thr else BARK,fontweight="bold")
plt.tight_layout(); plt.savefig(f"{OUT}/g5_confusion.png", dpi=150); plt.close()

# 6 pred vs actual
fig, ax = plt.subplots(figsize=(6.0,6.0))
idx=np.random.RandomState(0).choice(len(y_te),size=min(4000,len(y_te)),replace=False)
ax.scatter(np.asarray(y_te)[idx],lr_pred[idx],s=6,alpha=0.25,color=GREEN,edgecolors="none")
lims=[0,np.percentile(np.asarray(y_te),99.5)]
ax.plot(lims,lims,"--",color=BARK,lw=1.2,label="perfect prediction"); ax.set_xlim(lims); ax.set_ylim(lims)
ax.set_xlabel("Actual market value (Rs/kg)"); ax.set_ylabel("Predicted market value (Rs/kg)")
ax.set_title("Predicted vs Actual - Linear Regression", fontweight="bold"); ax.legend()
plt.tight_layout(); plt.savefig(f"{OUT}/g6_pred_vs_actual.png", dpi=150); plt.close()
print("DONE - graphs + results_metrics.json in", OUT)
