# event7

**Universal Schema Registry Governance Platform**

> One platform to explore, govern, and document your schemas — regardless of your registry provider.

event7 is a provider-agnostic governance layer for Schema Registries. It connects to your existing registry (Confluent, Apicurio, or any custom implementation), and gives your team a unified interface for schema exploration, visual diffing, event cataloging, and AsyncAPI documentation — all without vendor lock-in.

Deploy it as a **SaaS** (Cloudflare Pages + Railway + Supabase) or **on-prem** on your own Kubernetes cluster. Same codebase, same features, one environment variable to switch.

---

## Why event7?

Schema registries are great at storing schemas. They're not great at answering questions like:

- *"Who owns this event? What does it contain? Is it safe to evolve?"*
- *"Show me the diff between v3 and v5 — field by field."*
- *"Generate an AsyncAPI spec from my registry, not by hand."*
- *"Give me a business-friendly catalog of all events, with tags and ownership."*

event7 bridges the gap between **infrastructure** (your registry) and **governance** (your team's understanding of the data).

---

## Features

**Schema Explorer** — Browse subjects, versions, and schema content across all connected registries. Supports Avro and JSON Schema formats.

**Visual Field-Level Diff** — Compare any two versions of a schema with a precise, field-by-field diff. See what was added, removed, modified, and whether changes are breaking.

**Inter-Schema References** — Visualize which schemas reference others (e.g., `Order` → `Address`), detect shared components, and understand your dependency graph.

**Event Catalog** — A business-friendly view of your event landscape. Enrich schemas with descriptions, ownership, tags, and data classification — stored in event7's database, not in your registry.

**AsyncAPI Generation** — Auto-generate AsyncAPI 3.0 specs from your registry schemas, with Avro-to-JSON-Schema conversion built in.

**Compatibility Tracking** — View and monitor compatibility modes (BACKWARD, FORWARD, FULL, NONE) at subject and global levels.

**Encrypted Credentials** — Registry credentials are encrypted at rest with AES-256 (Fernet). event7 never stores plaintext secrets.

---

## Architecture

event7 follows a strict **layered architecture**. Each request flows top-down, and no layer ever skips another:

```
HTTP Request → API Routes → Services → Providers + Cache + DB
```

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│              Next.js / React                         │
├─────────────────────────────────────────────────────┤
│                   API Layer                          │
│         FastAPI routers + dependency injection       │
├─────────────────────────────────────────────────────┤
│                 Service Layer                        │
│    Business logic, orchestration, diff engine        │
├──────────┬──────────────┬───────────────────────────┤
│ Providers│    Cache      │        Database           │
│ (Adapter)│   Redis       │  Supabase OR PostgreSQL   │
│          │               │     (Factory pattern)     │
├──────────┴──────────────┴───────────────────────────┤
│           External Schema Registries                 │
│     Confluent  ·  Apicurio (planned)  ·  Custom     │
└─────────────────────────────────────────────────────┘
```

**Providers** implement an abstract `SchemaRegistryProvider` interface. Adding support for a new registry means creating a single file — no changes to services, routes, or frontend.

**Database** uses a factory pattern with a `DatabaseProvider` abstraction. Switch between Supabase (SaaS) and PostgreSQL (on-prem) with one env var.

---

## Dual-Mode Deployment

event7 runs anywhere — from a fully managed SaaS stack to an air-gapped Kubernetes cluster.

| Component | SaaS Mode | On-Prem / GKE Mode |
|-----------|-----------|---------------------|
| Frontend  | Cloudflare Pages | Docker (Node 22 Alpine) |
| Backend   | Railway | Docker (Python 3.12 slim) |
| Database  | Supabase Cloud | PostgreSQL 15 |
| Cache     | Managed Redis | Redis 7 Alpine |
| Auth      | Supabase Auth | OIDC / LDAP (planned) |
| Switch    | `DB_PROVIDER=supabase` | `DB_PROVIDER=postgresql` |

Both modes share the exact same application code. The `DB_PROVIDER` environment variable is the only difference.

On-prem deployment is fully containerized with multi-stage Dockerfiles and a ready-to-use `docker-compose.gke.yml`.

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 22+
- Redis (or Docker)
- A Schema Registry to connect to (Confluent Cloud, local, etc.)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your settings (Redis, DB, encryption key)

# Run
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your first registry.

### Docker (On-Prem)

```bash
docker compose -f docker-compose.gke.yml up
```

This starts PostgreSQL, Redis, backend, and frontend — all wired together.

---

## Project Structure

```
event7/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (registries, schemas, governance, asyncapi)
│   │   ├── services/       # Business logic, diff engine, AsyncAPI generation
│   │   ├── providers/      # Registry adapters (Confluent, + future providers)
│   │   ├── models/         # Pydantic v2 data contracts (shared across all layers)
│   │   ├── db/             # Database abstraction (Supabase + PostgreSQL)
│   │   ├── cache/          # Redis cache with TTL
│   │   └── utils/          # Encryption, helpers
│   ├── tests/
│   └── migrations/
├── frontend/               # Next.js application
├── docker-compose.gke.yml  # On-prem deployment
└── docker-compose.yml      # Dev (Redis only)
```

---

## Adding a New Provider

event7 is designed to be extended. To add support for a new schema registry:

1. Create `providers/your_registry.py` implementing `SchemaRegistryProvider`
2. Add the type to `ProviderType` enum in `models/registry.py`
3. Register it in `providers/factory.py`

That's it. No changes to services, routes, or frontend. The adapter pattern handles the rest.

---

## Roadmap

**Current (MVP)**
- Confluent Cloud provider (fully implemented and tested)
- Schema CRUD, visual diff, references, catalog, AsyncAPI generation
- Dual-mode database (Supabase + PostgreSQL)
- Freemium model: free tier with 1 registry, 50 schemas

**Next**
- Apicurio Registry provider
- Protobuf format support
- Reference dependency graph visualization
- Dashboard with KPI metrics
- CI/CD pipelines (GitHub Actions)

**Future**
- RBAC and multi-tenant workspaces
- Enterprise SSO (SAML / OIDC)
- Public REST API
- Breaking change notifications
- Schema health scoring
- Snapshot and historical comparison

---

## Tech Stack

**Backend** — Python 3.12, FastAPI, Pydantic v2, httpx, Redis, Fernet (AES-256)

**Frontend** — Next.js, React, TypeScript, Tailwind CSS

**Database** — Supabase (SaaS) or PostgreSQL 15 (on-prem), with full migration scripts

**Infrastructure** — Docker multi-stage builds, docker-compose, Kubernetes-ready

---

## Contributing

Contributions are welcome! Whether it's a new provider, a bug fix, or documentation improvements.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/apicurio-provider`)
3. Commit your changes
4. Open a Pull Request

Please open an issue first for major changes so we can discuss the approach.

---

## License

MIT

---

<p align="center">
  <strong>event7</strong> — Schema governance shouldn't require vendor lock-in.
</p>