# event7

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/Python-3.12+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-000000.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](docker-compose.gke.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](CONTRIBUTING.md)

**Cross-registry schema governance platform for exploring, comparing, enriching, and governing event schemas.**

> One platform to govern your schemas — regardless of your registry provider.  
> Deploy as SaaS or self-hosted. Same codebase, one env var to switch.

📖 **[Full documentation →](https://event7.pages.dev/docs)**

---

## Why event7?

Schema registries store schemas. They don't govern them.

Teams building event-driven systems face the same problems: schemas scattered across registries and environments, no connection between technical metadata and business meaning, painful version comparison, drifting event contracts, and governance locked inside vendor-specific tools.

event7 adds a **provider-agnostic governance layer** above your registries — with business metadata, visual diffing, dependency graphs, catalog capabilities, AI-assisted analysis, and AsyncAPI generation.

---

## Features

| Feature | Description | Tier |
|---------|-------------|------|
| **Schema Explorer** | Browse subjects, versions, formats, and compatibility settings across registries | Community |
| **Visual Diff Viewer** | Side-by-side, field-level diff — additions, removals, modifications, breaking change detection | Community |
| **Event Catalog** | Business-friendly view with search, filter, inline enrichment editing, CSV export | Community |
| **Enrichments** | Tags, ownership, descriptions, classification — stored in event7, not your registry | Community |
| **AsyncAPI Generation** | Auto-generate AsyncAPI 3.0 specs with Avro-to-JSON-Schema conversion | Community |
| **References Graph** | Interactive dependency graph — spot orphans, shared components, and high-impact schemas | Community |
| **Dashboard KPIs** | Schema count, enrichment coverage, compatibility distribution, recent activity | Community |
| **Multi-Provider** | Confluent Cloud, Confluent Platform, Apicurio v3 — one adapter pattern, one UI | Community |
| **AI Agent** | Natural-language commands for drift analysis, coverage audit, and automated enrichments | Pro |
| **Hosted Registry** | Managed Apicurio instance — no infra to maintain | Pro |
| **Governance Rules** | Define validation, quality, and migration rules — stored in event7, provider-agnostic | Community |
| **Extended Metadata** | Custom business attributes beyond tags/owner — structured key-value metadata | Community |
| **Registry Metadata Sync** | Read tags, rules, and metadata from Confluent Catalog API or Apicurio labels | Community |
| **Encryption Tracking** | Display field-level encryption metadata (CSFLE) — visibility without vendor lock-in | Pro |

event7 follows an **open-core** model. The governance engine is free and open-source under **Apache 2.0**. Features with infrastructure costs (AI, managed hosting) are available in paid tiers. See [Licensing](#licensing).

---

## Providers

| Provider | Status |
|----------|--------|
| Confluent Schema Registry (Cloud + Platform) | ✅ Implemented |
| Apicurio Registry v3 | ✅ Implemented |
| AWS Glue Schema Registry | 🔜 Planned |
| Custom / compatible backends | Extensible by design |

Adding a new provider means creating **one file** — no changes to services, routes, or frontend. See [Adding a New Provider](#adding-a-new-provider).

---

## Quick Start (Self-Hosted)

### Docker — full stack in one command

```bash
git clone https://github.com/KTCrisis/event7.git
cd event7

# Generate an encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Configure
cp backend/.env.example backend/.env
# Edit backend/.env — set ENCRYPTION_KEY, DB_PROVIDER=postgresql

# Start everything
docker compose -f docker-compose.gke.yml up -d
```

This starts PostgreSQL 15, Redis 7, Apicurio Registry, backend (FastAPI), and frontend (Next.js).

```
http://localhost:3000  → Frontend
http://localhost:8000  → Backend API + Swagger (/docs)
http://localhost:8081  → Apicurio Registry UI
```

Seed Apicurio with sample schemas to test immediately:

```bash
python scripts/seed_apicurio.py --clean
```

Creates 9 Avro + JSON Schema subjects with cross-references — perfect for testing the diff viewer and references graph.

### Manual setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit: Redis, DB provider, encryption key
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
cp .env.example .env.local  # Edit: NEXT_PUBLIC_API_URL
npm install && npm run dev
```

Health check: `curl http://localhost:8000/health`

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend  (Next.js · React · TypeScript)           │
│  Explorer · Catalog · Diff · Graph · AI · Dashboard │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────┐
│  Backend  (FastAPI · Python 3.12)                   │
│  Routes → Services → Providers + Cache + DB         │
└──────┬──────────────┬───────────────────────────────┘
       │              │
┌──────┴─────┐ ┌──────┴──────┐
│ Confluent  │ │  Apicurio   │  ← your registries
│ Cloud / CP │ │  Registry   │
└────────────┘ └─────────────┘
```

**Layered architecture** — each request flows top-down, no layer skips another:

```
HTTP Request → API Routes → Services → Providers + Cache + DB
```

**Two adapter patterns:**

1. **SchemaRegistryProvider** — one interface, multiple registry implementations. Factory in `providers/factory.py`.
2. **DatabaseProvider** — Supabase for SaaS, PostgreSQL (psycopg2) for self-hosted. Factory in `db/factory.py`, switched via `DB_PROVIDER`.

Enrichments (tags, ownership, descriptions, classification) are stored in event7's own database — never pushed to the registry. This keeps the platform provider-agnostic.

---

## Dual-Mode Deployment

| Component | SaaS | Self-Hosted |
|-----------|------|-------------|
| Frontend  | Cloudflare Pages | Docker (Node 22 Alpine) |
| Backend   | Railway | Docker (Python 3.12 slim) |
| Database  | Supabase Cloud | PostgreSQL 15 |
| Cache     | Managed Redis | Redis 7 |
| Auth      | Supabase Auth (JWT + RLS) | OIDC / LDAP (planned) |
| Switch    | `DB_PROVIDER=supabase` | `DB_PROVIDER=postgresql` |

---

## Project Structure

```
event7/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (registries, schemas, governance, asyncapi, ai)
│   │   ├── services/       # Business logic, diff engine, AsyncAPI generation
│   │   ├── providers/      # Registry adapters (Confluent, Apicurio)
│   │   ├── models/         # Pydantic v2 data contracts
│   │   ├── db/             # Database abstraction (Supabase + PostgreSQL)
│   │   ├── cache/          # Redis with TTL and hierarchical keys
│   │   └── utils/          # AES-256 encryption, helpers
│   ├── tests/              # pytest + pytest-asyncio
│   ├── migrations/         # SQL schema (bootstrap.sql)
│   └── scripts/            # Seed data, test scripts
├── frontend/
│   ├── src/app/            # App Router — dashboard, docs, auth
│   ├── src/components/     # UI components (shadcn/ui, Recharts)
│   ├── src/lib/            # API clients, Supabase helpers
│   └── src/providers/      # React context (registry, auth)
├── docker-compose.gke.yml  # Full stack (PG + Redis + Apicurio + backend + frontend)
└── docker-compose.yml      # Dev (Redis only)
```

---

## Adding a New Provider

1. Create `providers/your_registry.py` implementing `SchemaRegistryProvider`
2. Add the type to `ProviderType` enum in `models/registry.py`
3. Register it in `providers/factory.py`

No changes to services, routes, or frontend. The Apicurio provider was added exactly this way — one file, one factory branch.

The abstract interface covers: `health_check`, `list_subjects`, `get_schema`, `create_schema`, `delete_subject`, `get_versions`, `diff_versions`, `get_references`, `get_dependents`, `get_compatibility`, `check_compatibility`.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts |
| Backend | Python 3.12, FastAPI, Pydantic v2, httpx, loguru |
| Database | Supabase Cloud or PostgreSQL 15 (dual-mode) |
| Cache | Redis 7 with TTL and hierarchical keys |
| Security | AES-256 Fernet encryption, JWT auth, RLS policies |
| Deploy | Cloudflare Pages, Railway, Docker multi-stage, Kubernetes-ready |

---

## Roadmap

| Phase | Status |
|-------|--------|
| Confluent + Apicurio providers | ✅ Done |
| Schema CRUD, visual diff, references, catalog | ✅ Done |
| AsyncAPI 3.0 generation | ✅ Done |
| References graph visualization | ✅ Done |
| Dashboard KPIs | ✅ Done |
| AI Agent (LLM-powered governance) | ✅ Done |
| Dual-mode deployment (SaaS + self-hosted) | ✅ Done |
| Public documentation (/docs) | ✅ Done |
| RLS multi-tenant security | 🔜 Next |
| Hosted registry provisioning (Apicurio-backed) | 🔜 Next |
| Protobuf support | 🔜 Next |
| Cross-registry aggregated view | 🔜 Next |
| Governance Rules engine (provider-agnostic) | 🔜 Next |
| Extended business metadata | 🔜 Next |
| Confluent Catalog API reader (Stream Governance) | 🔜 Next |
| Apicurio metadata sync (labels + rules) | 🔜 Next |
| Encryption tracking (CSFLE metadata) | 🔜 Next |
| AuthProvider abstraction (OIDC / SSO) | 🔜 Planned |
| RBAC, public API, notifications, health scores | 📋 Future |

---

## Contributing

Contributions, feedback, and architecture discussions are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-provider`)
3. Commit your changes
4. Open a Pull Request

Please open an issue first for major changes so we can discuss the approach.

---

## Licensing

event7 follows an **open-core** model:

- **Community** (Apache 2.0) — Schema Explorer, Diff Viewer, Event Catalog, Enrichments, AsyncAPI, References Graph, Dashboard, Multi-Provider support, dual deployment
- **Pro** (Commercial) — AI Agent, Hosted Registry, priority support
- **Enterprise** (Commercial) — OIDC/SSO, RBAC, audit logs, SLA

See the [full licensing details](https://event7.dev/docs/licensing).

---

<p align="center">
  <strong>event7</strong> — Schema governance shouldn't require vendor lock-in.
</p>