# event7 — Cloudflare Pages Deployment Guide

> Deploy frontend Next.js on Cloudflare Pages via OpenNext.
>
> **Status:** Production (deployed at event7.pages.dev)
> **Last updated:** 5 avril 2026

---

## Architecture

```
Cloudflare Pages (frontend)
    | NEXT_PUBLIC_API_URL
Railway (backend FastAPI)
    | NEXT_PUBLIC_SUPABASE_URL
Supabase Cloud (Auth)
```

Next.js is built via OpenNext and deployed as a Cloudflare Worker + static assets.

---

## Build pipeline

```
next build → @opennextjs/cloudflare build → .open-next/
    ├── _worker.js        (Cloudflare Worker — SSR + middleware)
    ├── _routes.json      (static vs worker routing)
    ├── _next/static/     (CSS, JS, fonts — served directly)
    ├── assets/
    └── public/
```

Script: `npm run pages:build` runs 5 steps: clean → next build → opennext build → copy assets → rename worker.

---

## Required config files

### `open-next.config.ts`

```typescript
import type { OpenNextConfig } from '@opennextjs/cloudflare'

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      proxyExternalRequest: 'fetch',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'direct',
    },
  },
  edgeExternals: ['node:crypto'],
  middleware: {
    external: true,
    override: {
      wrapper: 'cloudflare-edge',
      converter: 'edge',
      proxyExternalRequest: 'fetch',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'direct',
    },
  },
}

export default config
```

For KV caching in prod, replace `incrementalCache: 'dummy'` with the KV override and configure `NEXT_CACHE_WORKERS_KV` namespace.

### `wrangler.toml`

```toml
name = "event7"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".open-next"
```

### `public/_routes.json`

**CRITICAL** — without this, static assets (`_next/static/*`) return 404.

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/_next/static/*", "/assets/*", "/favicon.ico", "/icon.svg"]
}
```

---

## Cloudflare Pages Dashboard config

**Build & deployments:**
- Root directory: `frontend`
- Build command: `npm run pages:build`
- Build output directory: `.open-next`

**Environment variables:**
- `NEXT_PUBLIC_SUPABASE_URL` → Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → long JWT anon key (`eyJ...`)
- `NEXT_PUBLIC_API_URL` → Railway backend URL
- `NODE_VERSION` → `20`

**Important:** Use `npx wrangler pages secret put VAR_NAME` to set secrets — never the Cloudflare UI (bug with OpenNext).

---

## Deploy

### Git auto-deploy

Push to `main` → Cloudflare auto-builds and deploys.

### CLI manual deploy

```bash
npm run pages:build
npx wrangler pages deploy .open-next --project-name event7 --commit-dirty=true
```

---

## Frontend standalone mode (Docker)

For self-hosted Docker deployment, Next.js standalone mode is injected via `sed` in the Dockerfile — `next.config.ts` stays unchanged for Cloudflare compatibility.

```dockerfile
# In frontend/Dockerfile
RUN sed -i 's/};/output: "standalone",};/' next.config.ts
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|---------|
| CSS/JS 404 in prod | `_routes.json` missing | Create `public/_routes.json` with static excludes |
| Build prompt interactive in CI | `open-next.config.ts` missing | Create full config file |
| Build prompt wrangler in CI | `wrangler.toml` missing | Create with `pages_build_output_dir` |
| KV binding error | Empty `id` in wrangler.toml | Use `incrementalCache: 'dummy'` |
| Worker instead of Pages | Wrong type at creation | Delete and recreate as Pages (not Workers) |
| `Can't resolve 'tailwindcss'` | Resolver climbs to parent dir | `turbopack.root: import.meta.dirname` in next.config.ts |
| Font not applied | `variable` on body instead of html | `className={font.variable}` on `<html>` |
| Git embedded repository | `frontend/.git` created by shadcn init | `rm -rf frontend/.git` |

---

## Auth flow

```
Request → middleware.ts → updateSession()
  ├── Valid session + dashboard route → pass through
  ├── Valid session + auth route → redirect /
  ├── No session + dashboard route → redirect /login
  └── No session + auth route → pass through
```

When Supabase env vars are not set, middleware bypasses auth entirely (self-hosted mode).

---

## API routing

| Mode | Mechanism |
|------|-----------|
| Dev | `next.config.ts` rewrites `/api/v1/*` → `http://localhost:8000/api/v1/*` |
| Prod | `NEXT_PUBLIC_API_URL` points directly to Railway backend |

The `ApiClient` (`lib/api/client.ts`) auto-injects Supabase Bearer token when available.
