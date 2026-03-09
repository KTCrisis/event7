# event7

> Universal Schema Registry Governance Platform

## Quick Start

```bash
# 1. Clone & setup
git clone https://github.com/ktcrisis/event7.git
cd event7
chmod +x setup.sh
./setup.sh

# 2. Configure .env (Supabase credentials)
# Edit .env with your Supabase URL and keys

# 3. Run backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 4. Verify
curl http://localhost:8000/health
```

## Stack

| Component | Technology | Deployment |
|-----------|-----------|------------|
| Frontend | Next.js / React / TypeScript | Cloudflare Pages |
| Backend | FastAPI / Pydantic v2 | Railway → Fly.io |
| Database | PostgreSQL (Supabase) | Supabase Cloud |
| Cache | Redis | Docker (dev) / Upstash (prod) |

## Project Structure

```
event7/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Pydantic Settings
│   │   ├── models/              # Pydantic models (API contracts)
│   │   ├── providers/           # Adapter pattern (multi-registry)
│   │   ├── services/            # Business logic
│   │   ├── api/                 # FastAPI routes
│   │   ├── cache/               # Redis layer
│   │   └── db/                  # Supabase client
│   ├── tests/
│   └── requirements.txt
├── frontend/                    # Next.js
├── docker-compose.yml           # Redis (dev)
└── setup.sh                     # Dev environment setup
```

## License

Proprietary - All rights reserved.
