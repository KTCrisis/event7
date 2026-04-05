# event7 — Railway Deployment Guide

> Deploy backend FastAPI + Redis on Railway, with Supabase Cloud as DB.
>
> **Status:** Production (deployed)
> **Last updated:** 5 avril 2026

---

## Architecture

```
Cloudflare Pages (frontend)
    | NEXT_PUBLIC_API_URL
Railway (backend FastAPI)
    | SUPABASE_URL          | REDIS_URL
Supabase Cloud              Railway Redis addon
(PostgreSQL + Auth)         (cache)
    |
Confluent Cloud (Schema Registry)
```

---

## Step 1 — Create Railway project

1. [railway.app](https://railway.app) → Sign in with GitHub
2. **New Project** → **Deploy from GitHub Repo** → select `KTCrisis/event7`
3. Don't deploy yet

## Step 2 — Configure backend service

- **Settings → Build**: Root Directory = `backend`, Builder = Dockerfile
- **Settings → Networking**: Generate Domain → `event7-backend-production-xxxx.up.railway.app`

## Step 3 — Add Redis

- **+ New → Database → Redis** in same project
- Railway auto-links `REDIS_URL` to backend service

## Step 4 — Environment variables

```env
# Database (Supabase Cloud)
DB_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Redis (auto-populated by Railway addon)
# REDIS_URL=redis://default:xxx@xxx.railway.internal:6379

# Security
ENCRYPTION_KEY=your-fernet-key-base64
AUTH_ENABLED=true

# CORS (must be JSON array)
CORS_ORIGINS=["https://event7.pages.dev","http://localhost:3000"]

# App
DEBUG=false
PORT=8000
```

Generate encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

`SUPABASE_JWT_SECRET`: Supabase Dashboard → Settings → API → JWT Secret.

## Step 5 — Dockerfile

Ensure the CMD uses Railway's PORT:
```dockerfile
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

## Step 6 — Deploy

Push to main → Railway auto-builds. Test:
```bash
curl https://event7-backend-production-xxxx.up.railway.app/health
# {"status": "healthy", "services": {"redis": "ok", "database": "ok"}, "database_provider": "SupabaseDatabase"}
```

## Step 7 — Configure Cloudflare Pages

Environment variable:
```
NEXT_PUBLIC_API_URL=https://event7-backend-production-xxxx.up.railway.app
```

## Step 8 — Configure Supabase Auth

- **Site URL**: `https://event7.pages.dev`
- **Redirect URLs**: `https://event7.pages.dev/**`

## Step 9 — Test end-to-end

1. Open `https://event7.pages.dev`
2. Sign in with Supabase user
3. Settings → create Confluent registry
4. Verify health check
5. Explore schemas

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails | Verify Root Directory = `backend` in Railway Settings |
| CORS errors | `CORS_ORIGINS` must be JSON array, exact domain, no trailing slash |
| Redis connection refused | Redis addon must be in same Railway project, uses `railway.internal` |
| Supabase auth errors | Check `SUPABASE_JWT_SECRET` (not anon key). Verify Site URL. |
| 502 Bad Gateway | Check logs for DB/Redis connection errors at startup |

---

## Costs (free tier)

| Service | Free Tier | Limit |
|---------|-----------|-------|
| Railway | $5 credit/month | ~500h runtime |
| Supabase | Free plan | 500MB DB, 2GB transfer |
| Cloudflare Pages | Free | 500 builds/month |
| Confluent Cloud | $400 free credit | Schema Registry included |
