"""
Trashium pricing model — live inference service (FastAPI).

WHY THIS EXISTS
  scikit-learn cannot run inside Vercel serverless functions, so the trained
  model is served here as a standalone HTTP API (host on Railway / Render / Fly).
  Next.js (lib/estimate.ts) calls POST /predict; if this service is slow or down,
  the app falls back to the precomputed Supabase price_estimates rows — so the
  site never breaks.

CONTRACT
  POST /predict        -> predict Market_Value_perKg for one (sector, material, risk, demand).
  POST /predict-batch  -> same, many at once (used by the multi-material pickup flow).
  GET  /health         -> liveness + which model/version is loaded.

The app sends OPERATIONAL SECTOR names (e.g. "Rishra"); the model was trained on
dataset REGION names (e.g. "Srirampore"). We reverse-map sector->region here.
Risk/Demand are real model features — they are applied INSIDE the model, so the
Next.js side must NOT re-multiply them when it uses a model-sourced value.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import List, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Reuse the pipeline's single source of truth for features + mappings.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config as C          # noqa: E402
import data_prep as P       # noqa: E402

# ---- Load the production model chosen by the pipeline (metrics.json) ---- #
_metrics = json.loads((C.ARTIFACT_DIR / "metrics.json").read_text())
_BEST = "lr_mv.joblib" if _metrics["best_model"] == "linear_regression" else "rf_mv.joblib"
_MODEL = joblib.load(C.ARTIFACT_DIR / _BEST)
_MODEL_VERSION = _metrics.get("model_version", C.MODEL_VERSION)

# sector (app) -> region (dataset / model vocabulary)
SECTOR_TO_REGION = {v: k for k, v in C.REGION_TO_SECTOR.items()}

# Optional shared secret: set API_TOKEN on the host and the same on the Next.js side.
API_TOKEN = os.environ.get("API_TOKEN")

app = FastAPI(title="Trashium Pricing Model", version=str(_MODEL_VERSION))
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class PredictIn(BaseModel):
    sector: str = Field(..., description="Operational sector, e.g. 'Rishra'")
    material: str = Field(..., description="Granular material, e.g. 'Copper'")
    risk: str = Field("Medium", description="Low | Medium | High")
    demand: str = Field("Medium", description="Low | Medium | High")
    date: Optional[str] = Field(None, description="ISO date; defaults to today (UTC)")


class PredictOut(BaseModel):
    model_config = {"protected_namespaces": ()}  # allow the model_version field name
    market_value_per_kg: float
    model_version: str
    region: str
    source: str = "model"


class BatchIn(BaseModel):
    items: List[PredictIn]


def _auth(authorization: Optional[str]) -> None:
    """Enforce the shared bearer token when API_TOKEN is configured (no-op otherwise)."""
    if not API_TOKEN:
        return
    if authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="invalid or missing API token")


def _row(p: PredictIn):
    when = dt.date.fromisoformat(p.date) if p.date else dt.datetime.utcnow().date()
    region = SECTOR_TO_REGION.get(p.sector, p.sector)  # tolerate a region passed directly
    df = pd.DataFrame([{
        "month": when.month,
        "day_of_week": when.weekday(),
        "is_weekend": int(when.weekday() >= 5),
        "Region": region,
        "Material Type": p.material,
        "Market Demand": p.demand if p.demand in ("Low", "Medium", "High") else "Medium",
        "Quality Defect Risk": p.risk if p.risk in ("Low", "Medium", "High") else "Medium",
    }])[P.FEATURES]
    return df, region


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": _BEST,
        "model_version": _MODEL_VERSION,
        "best_model": _metrics["best_model"],
        "mape_pct": _metrics.get(_metrics["best_model"], {}).get("mape_pct"),
        "sectors": list(SECTOR_TO_REGION),
    }


@app.post("/predict", response_model=PredictOut)
def predict(p: PredictIn, authorization: Optional[str] = Header(default=None)):
    _auth(authorization)
    X, region = _row(p)
    mv = float(_MODEL.predict(X)[0])
    return PredictOut(market_value_per_kg=round(mv, 2), model_version=str(_MODEL_VERSION), region=region)


@app.post("/predict-batch")
def predict_batch(b: BatchIn, authorization: Optional[str] = Header(default=None)):
    _auth(authorization)
    if not b.items:
        return {"model_version": _MODEL_VERSION, "results": []}
    rows, regions = [], []
    for it in b.items:
        X, region = _row(it)
        rows.append(X)
        regions.append(region)
    X = pd.concat(rows, ignore_index=True)
    preds = _MODEL.predict(X)
    return {
        "model_version": _MODEL_VERSION,
        "results": [
            {"market_value_per_kg": round(float(v), 2), "region": r, "source": "model"}
            for v, r in zip(preds, regions)
        ],
    }
