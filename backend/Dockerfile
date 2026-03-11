# ============================================
# event7 Backend — FastAPI
# Placement: backend/Dockerfile
# ============================================

# --- Stage 1: Dependencies ---
FROM python:3.12-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir psycopg2-binary>=2.9.0

# --- Stage 2: Runtime ---
FROM python:3.12-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

COPY app/ ./app/
COPY migrations/ ./migrations/

RUN groupadd -r event7 && useradd -r -g event7 -d /app event7
RUN chown -R event7:event7 /app
USER event7

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2 --loop uvloop --http httptools --no-access-log"]