# Trashium pricing model API — container for Railway / Render / Fly.io.
# Build context = the /ml directory (the API imports ../config.py and ../data_prep.py
# and reads ../artifacts/*.joblib + metrics.json), so build from inside /ml:
#   docker build -f api/Dockerfile -t trashium-model .
FROM python:3.11-slim

WORKDIR /app

# System deps kept minimal; sklearn/numpy wheels are prebuilt.
COPY api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Pipeline code + the trained artifacts the API loads at startup.
COPY config.py data_prep.py ./
COPY artifacts ./artifacts
COPY api ./api

ENV PORT=8000
EXPOSE 8000

# Honour the platform's $PORT (Railway/Render inject it); default 8000 locally.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
