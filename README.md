# event7

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/Python-3.12+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-000000.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](docker-compose.gke.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](CONTRIBUTING.md)

**Cross-registry schema governance platform for exploring, comparing, enriching, and governing event schemas.**

> One platform to govern your schemas — regardless of your registry provider.  
> Deploy as SaaS or on-prem. Same codebase, one env var to switch.

---

## Why event7?

Schema registries are great at storing schemas. They're not great at governance.

In practice, teams building event-driven systems run into the same problems: schemas scattered across registries and environments, no connection between technical metadata and business meaning, painful version comparison, drifting event contracts, and governance fragmented across vendor-specific tools.

event7 solves this by adding a **cross-registry governance layer** above your registries — with business metadata, visual diffing, dependency analysis, catalog capabilities, and AsyncAPI alignment.

---

## What you can do with event7

- **Connect registries** — Register external schema registries, validate connectivity, manage access from one place
- **Explore schemas** — Browse subjects, versions, formats, and compatibility settings across all connected registries
- **Diff versions visually** — Compare any two schema versions with a precise, field-by-field diff (additions, removals, modifications, breaking change detection)
- **Trace references** — Inspect inter-schema dependencies (e.g., `Order` → `Address`), detect shared components, support impact analysis
- **Enrich with business context** — Attach descriptions, ownership, tags, and data classification to schemas — stored in event7, not in your registry
- **Build an event catalog** — A business-friendly view of your event landscape for both developers and stakeholders
- **Generate AsyncAPI specs** — Auto-generate AsyncAPI 3.0 documentation from registry schemas, with Avro-to-JSON-Schema conversion built in
- **Secure credentials** — Registry credentials encrypted at rest with AES-256 (Fernet). event7 never stores plaintext secrets
- **Hosted registry (coming soon)** — No registry yet? event7 can provision an Apicurio-backed registry for you — connect or create, from the same UI

---

## Current focus

event7 is built for **multi-provider evolution**, with two fully implemented providers — **Confluent Schema Registry** and **Apicurio Registry v3** — tested in production conditions.

| Provider | Status |
|----------|--------|
| Confluent Schema Registry | ✅ Implemented |
| Apicurio Registry v3 | ✅ Implemented |
| AWS Glue Schema Registry | 🔜 Planned |
| Custom / compatible backends | Extensible by design |

Adding a new provider means creating **one file** — no changes to services, routes, or frontend. Apicurio was added this way as a concrete proof of the adapter pattern. See [Adding a New Provider](#adding-a-new-provider).

---

## Who is event7 for?

- **Platform engineering teams** managing Kafka infrastructure and schema standards
- **Event-driven architecture teams** who need visibility across domains and registries
- **Data platform teams** governing event contracts at scale
- **Integration / middleware teams** bridging producers and consumers across environments
- **Architecture governance teams** enforcing schema standards and compatibility policies

Two primary personas drive the product: **developers** (schema explorer, diff, references) and **business stakeholders** (catalog, tags, ownership, event documentation).

---

## Architecture

event7 follows a strict **layered architecture**. Each request flows top-down, and no layer ever skips another:

```
HTTP Request → API Routes → Services → Providers + Cache + DB
```

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│            Next.js / React / TypeScript              │
├─────────────────────────────────────────────────────┤
│                   API Layer                          │
│         FastAPI routers + dependency injection       │
├─────────────────────────────────────────────────────┤
│                 Service Layer                        │
│    Business logic, orchestration, diff engine        │
├──────────┬──────────────┬───────────────────────────┤
│ Providers│    Cache      │        Database           │
│ (Adapter)│   Redis       │  Supabase OR PostgreSQL   │
│ pattern  │               │   (Factory pattern)       │
├──────────┴──────────────┴───────────────────────────┤
│           External Schema Registries                 │
│    Confluent  ·  Apicurio  ·  Glue (planned)  ·  …  │
└─────────────────────────────────────────────────────┘
```

**Two adapter patterns** power the extensibility:

1. **SchemaRegistryProvider** — Abstract interface for registry access. Each provider (Confluent, Apicurio, …) implements it. Factory in `providers/factory.py`.
2. **DatabaseProvider** — Abstract interface for persistence. Supabase for SaaS, PostgreSQL (psycopg2) for on-prem. Factory in `db/factory.py`, switched via `DB_PROVIDER` env var.

Enrichments (tags, ownership, descriptions, classification) are stored in event7's own database — not pushed to the registry. This keeps the platform **provider-agnostic by design**.

---

## Dual-Mode Deployment

event7 runs anywhere — from a fully managed SaaS stack to an air-gapped Kubernetes cluster. Same codebase, same features.

| Component | SaaS Mode | On-Prem / GKE Mode |
|-----------|-----------|---------------------|
| Frontend  | Cloudflare Pages | Docker (Node 22 Alpine, standalone) |
| Backend   | Railway | Docker (Python 3.12 slim) |
| Database  | Supabase Cloud | PostgreSQL 15 |
| Cache     | Managed Redis | Redis 7 Alpine |
| Auth      | Supabase Auth (RLS + JWT) | OIDC / LDAP (planned) |
| Switch    | `DB_PROVIDER=supabase` | `DB_PROVIDER=postgresql` |

On-prem deployment is fully containerized with multi-stage Dockerfiles and a ready-to-use `docker-compose.gke.yml`.

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 22+
- Redis (or Docker)
- A Schema Registry to connect to (Confluent Cloud, Apicurio, local, etc.)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: Redis, DB provider, encryption key

uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/health`

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL, Supabase keys (if SaaS mode)

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your first registry.

### Docker (fully local, on-prem mode)

```bash
docker compose -f docker-compose.gke.yml up
```

Starts PostgreSQL 15, Redis 7, Apicurio Registry, backend, and frontend — all wired together. A seed script is available to populate Apicurio with sample schemas:

```bash
python scripts/seed_apicurio.py          # Populate with 9 sample schemas
python scripts/seed_apicurio.py --clean   # Reset and repopulate
```

---

## Typical workflow

1. Sign in (Supabase Auth or dev mode)
2. Register a schema registry connection (Confluent Cloud, Apicurio, etc.)
3. Validate connectivity (health check)
4. Browse subjects, versions, and schema content
5. Compare versions with the visual diff viewer
6. Inspect references and dependencies
7. Enrich schemas with business metadata (owner, tags, classification)
8. Generate AsyncAPI specs from your registry
9. Use the event catalog for cross-team visibility

---

## Project Structure

```
event7/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (registries, schemas, governance, asyncapi)
│   │   ├── services/       # Business logic, diff engine, AsyncAPI generation
│   │   ├── providers/      # Registry adapters (Confluent, Apicurio)
│   │   ├── models/         # Pydantic v2 data contracts (shared across all layers)
│   │   ├── db/             # Database abstraction (Supabase + PostgreSQL via factory)
│   │   ├── cache/          # Redis cache with TTL and hierarchical keys
│   │   └── utils/          # AES-256 encryption, helpers
│   ├── tests/              # pytest + pytest-asyncio
│   ├── migrations/         # SQL schema (bootstrap.sql)
│   └── scripts/            # Seed data (seed_apicurio.py), test scripts
├── frontend/               # Next.js 14+ application
│   ├── src/app/            # App Router pages
│   ├── src/components/     # UI components
│   ├── src/lib/            # API clients and utilities
│   └── src/providers/      # React context providers
├── docker-compose.gke.yml  # On-prem deployment (PG + Redis + Apicurio + backend + frontend)
└── docker-compose.yml      # Dev (Redis only)
```

---

## Adding a New Provider

event7 is designed to be extended. To add support for a new schema registry:

1. Create `providers/your_registry.py` implementing `SchemaRegistryProvider`
2. Add the type to `ProviderType` enum in `models/registry.py`
3. Register it in `providers/factory.py`

That's it. No changes to services, routes, or frontend. The adapter pattern handles the rest. The Apicurio provider (`providers/apicurio.py`) was added exactly this way — one file, one factory branch, zero changes elsewhere.

The abstract interface covers: `health_check`, `list_subjects`, `get_schema`, `create_schema`, `delete_subject`, `get_versions`, `diff_versions`, `get_references`, `get_dependents`, `get_compatibility`, and `check_compatibility`.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Supabase SSR Auth |
| Backend | Python 3.12, FastAPI, Pydantic v2, httpx, loguru |
| Database | Supabase Cloud or PostgreSQL 15 (dual-mode via factory) |
| Cache | Redis 7 with TTL and hierarchical key strategy |
| Security | AES-256 Fernet encryption, JWT auth, RLS policies |
| Infrastructure | Docker multi-stage builds, docker-compose, Kubernetes-ready |

---

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **MVP** | Confluent + Apicurio providers, schema CRUD, visual diff, references, catalog, AsyncAPI generation (with Kafka bindings), dual-mode DB, freemium model (1 registry / 50 schemas free) | ✅ Core done |
| **Next** | Hosted registry provisioning (Apicurio-backed), Protobuf support, reference graph visualization, dashboard KPIs, CI/CD (GitHub Actions) | 🔜 In progress |
| **Future** | RBAC & multi-tenant workspaces, enterprise SSO (SAML/OIDC), public REST API, breaking change notifications, schema health scoring, AI-assisted governance & contract analysis | 📋 Planned |

---

## Screenshots

> Coming soon — schema explorer, diff viewer, event catalog, AsyncAPI generation.

---

## Contributing

Contributions, feedback, and architecture discussions are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/apicurio-provider`)
3. Commit your changes
4. Open a Pull Request

Please open an issue first for major changes so we can discuss the approach.

---

## License

[MIT](LICENSE)

---

<p align="center">
  <strong>event7</strong> — Schema governance shouldn't require vendor lock-in.
</p>