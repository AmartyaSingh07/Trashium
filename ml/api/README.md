# Trashium Pricing Model — Live Inference API

FastAPI service that serves the trained `.joblib` model over HTTP, because
scikit-learn **cannot run on Vercel serverless**. Next.js (`lib/estimate.ts`)
calls this; if it's down, the app falls back to the precomputed Supabase
`price_estimates` rows — **so the site never breaks.**

```
Next.js (Vercel) ──POST /predict──► this API (Railway/Render/Fly) ──► lr_mv.joblib
       │                                                                (live predict)
       └── on timeout/error ──► Supabase price_estimates  (precomputed fallback)
```

---

## Why FastAPI off-Vercel (and not "just deploy the model to Vercel")

Vercel functions can't bundle sklearn/numpy native wheels and cap function size,
so the model must live in a normal Python container. FastAPI + a container host
(Railway / Render / Fly.io — all have a free or cheap tier and hold the ~53 MB RF
model fine) is the standard pattern. Vercel keeps hosting the Next.js site.

---

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | model file, version, MAPE, known sectors |
| POST | `/predict` | `{sector, material, risk?, demand?, date?}` | `{market_value_per_kg, model_version, region, source}` |
| POST | `/predict-batch` | `{items:[PredictIn,…]}` | `{model_version, results:[…]}` |

`sector` = an operational sector (`Rishra`, `Howrah`, `Shyamnagar`, `Tarakeswar`,
`Hugli-Chinsura`). `material` = a granular material (`Copper`, `Brass`, `Iron`, …).
`risk`/`demand` ∈ `Low|Medium|High`. **Risk and demand are real model features**, so the
returned market value already reflects them — the Next.js side must NOT re-apply its
RISK/DEMAND multipliers to a model-sourced value (it doesn't — see `lib/estimate.ts`).

Example:
```bash
curl -X POST $URL/predict -H 'content-type: application/json' \
  -d '{"sector":"Howrah","material":"Copper","risk":"Low"}'
# {"market_value_per_kg":595.54,"model_version":"mv_v2","region":"Howrah","source":"model"}
```

---

## Run locally

```bash
cd ml
pip install -r api/requirements.txt
uvicorn api.main:app --reload --port 8000
# http://127.0.0.1:8000/health  •  docs at /docs
```

---

## Deploy

The build context is the **`ml/` directory** (the API imports `../config.py`,
`../data_prep.py` and reads `../artifacts/*.joblib` + `metrics.json`).

### Railway (simplest)
1. New Project → Deploy from repo, set **Root Directory = `ml`**.
2. Railway autodetects the `api/Dockerfile`. (Or use the `api/Procfile` with a
   Python buildpack: `pip install -r api/requirements.txt` then the Procfile `web:` line.)
3. Set env vars: `API_TOKEN` (pick a long random string), optionally `ALLOWED_ORIGINS`.
4. Deploy → copy the public URL (e.g. `https://trashium-model.up.railway.app`).

### Render
- New **Web Service**, Root Dir `ml`, Docker, Dockerfile path `api/Dockerfile`.
- Health check path `/health`. Add the same env vars.

### Fly.io
```bash
cd ml
fly launch --dockerfile api/Dockerfile   # accept generated fly.toml
fly secrets set API_TOKEN=<random>
fly deploy
```

### Docker (any host)
```bash
cd ml
docker build -f api/Dockerfile -t trashium-model .
docker run -p 8000:8000 -e API_TOKEN=<random> trashium-model
```

---

## Connect Next.js (Vercel env vars)

Project → Settings → Environment Variables (Production + Preview):

```
MODEL_API_URL        = https://<your-model-host>      # the URL from the deploy step
MODEL_API_TOKEN      = <same value as API_TOKEN>      # only if you set API_TOKEN
MODEL_API_TIMEOUT_MS = 2000                           # optional; default 2000
```

Redeploy the Next.js app. That's the **only** site change needed at runtime —
`lib/estimate.ts` already reads these. **If `MODEL_API_URL` is unset, the app uses the
Supabase table exactly as before** (zero behavior change), so you can deploy the site
and the model independently and in any order.

---

## Updating the model

Re-run the pipeline (`train_models.py` → new `artifacts/`), redeploy this service.
`/health` shows the live `model_version` so you can confirm the rollout. The Supabase
fallback rows can be refreshed separately via `build_price_table.py` +
`publish_to_supabase.py`.
