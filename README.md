<p align="center">
  <img src="assets/logo-event7.svg" alt="event7" width="360" />
</p>

<p align="center">
  <strong>Universal schema registry governance platform</strong><br/>
  <em>Explore, validate, and govern your event schemas — across any registry, any broker, any spec.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB.svg?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Next.js-000000.svg?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white" alt="Docker" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-Welcome-brightgreen.svg" alt="PRs Welcome" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Apache%20Kafka-231F20.svg?logo=apachekafka&logoColor=white" alt="Kafka" />
  <img src="https://img.shields.io/badge/Confluent-000000.svg?logo=confluent&logoColor=white" alt="Confluent" />
  <img src="https://img.shields.io/badge/Apicurio-E6392A.svg" alt="Apicurio" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1.svg?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D.svg?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/AsyncAPI-3.0-4F46E5.svg" alt="AsyncAPI" />
  <img src="https://img.shields.io/badge/CloudEvents-4285F4.svg" alt="CloudEvents" />
</p>

<p align="center">
  📖 <a href="https://event7.pages.dev/docs"><strong>Documentation</strong></a> · 
  🚀 <a href="https://event7.pages.dev"><strong>Live Demo</strong></a> · 
  💬 <a href="https://github.com/KTCrisis/event7/issues"><strong>Issues</strong></a>
</p>

---

## Why event7?

Schema registries store schemas. They don't govern them.

Teams building event-driven systems face the same problems: schemas scattered across registries, no connection between technical metadata and business meaning, drifting event contracts, and governance locked inside vendor-specific tools.

event7 adds a **provider-agnostic governance layer** above your registries. Schemas stay in your registry (Confluent, Apicurio, Karapace, Redpanda). Everything else — enrichments, channels, rules, AsyncAPI specs — lives in event7.

**event7 is not a registry. It's the governance layer your registries are missing.**

### Two missions, one platform

**Explore** — Help developers version schemas with confidence: visual diff with breaking change detection, dependency graph to anticipate impact, and governance rules that validate schemas both technically (compatibility) and functionally (naming, required fields, documentation).

**Govern** — Give organizations a single place to govern events across any registry and any broker: enrichments, ownership, data layers, scoring, channel model, AsyncAPI import/export — all provider-agnostic, all stored in event7.

### How event7 fits

```
Schema Registry  →  event7                →  AsyncAPI / CloudEvents  →  EventCatalog / Backstage
  (stores)          (governs + validates)      (specifies)                (documents)
```

event7 is not a registry, not a documentation portal, not a Kafka ops tool. It's the governance and validation layer that sits between your infrastructure and your documentation.

---

## Features

### Explore

| Feature | Description |
|---------|-------------|
| **Schema Explorer** | Browse subjects, versions, formats, and compatibility across registries |
| **Visual Diff Viewer** | Side-by-side field-level diff with breaking change detection (Avro + JSON Schema) |
| **References Graph** | Interactive dependency graph — spot orphans, shared components, and hotspots |
| **Dashboard KPIs** | Schema count, enrichment coverage, compatibility distribution, governance score funnel |

### Govern

| Feature | Description |
|---------|-------------|
| **Event Catalog** | Business view with broker badges, data layers, ownership, classification, AsyncAPI drawer |
| **Enrichments** | Tags, ownership, descriptions, data layers, classification — stored in event7, not your registry |
| **Governance Rules** | Conditions, transforms, validations, policies — 4 built-in templates (RAW/CORE/REFINED/APP) |
| **Governance Scoring** | Three-axis scoring (enrichments + rules + schema quality) with confidence indicator |
| **Channel Model** | Map schemas to Kafka topics, RabbitMQ exchanges, Redis streams, Pulsar, NATS, cloud brokers |
| **AsyncAPI Import** | Import a spec → creates channels, bindings, enrichments, and registers schemas in one click |
| **AsyncAPI Generation** | Generate 3.0 specs with Kafka bindings, key schema, Avro conversion, examples |
| **Smart Registration** | Routes schemas to the right registry — Apicurio accepts all, Confluent-like only Kafka schemas |

### Tools

| Feature | Description |
|---------|-------------|
| **Multi-Provider** | Confluent Cloud, Confluent Platform, Apicurio v3, Karapace, Redpanda — same UI |
| **AI Agent (BYOM)** | Natural-language governance commands with 6 context fetchers + 3 write actions |

All features above are free and open-source under **Apache 2.0**. Commercial tiers (Pro, Enterprise) are described in the [licensing page](https://event7.pages.dev/docs/licensing).

---

## Providers

| Provider | Status |
|----------|--------|
| Confluent Schema Registry (Cloud + Platform) | ✅ Implemented |
| Apicurio Registry v3 | ✅ Implemented |
| Karapace (Aiven) | ✅ Compatible (Confluent API) |
| Redpanda Schema Registry | ✅ Compatible (Confluent API) |
| AWS Glue Schema Registry | 🔜 Planned |
| Azure Schema Registry | 🔜 Planned |
| Google Pub/Sub Schemas | 📋 Future |
| Pulsar Schema Registry | 📋 Future |

Adding a new provider means creating **one file** — no changes to services, routes, or frontend. See [Adding a New Provider](#adding-a-new-provider).

---

## Quick Start

### Prerequisites

- **Docker** and **Docker Compose** (v2)
- **Python 3.12+** (for seed scripts only — not needed if you skip seeding)
- **Git**

### 1. Clone and configure

```bash
git clone https://github.com/KTCrisis/event7.git
cd event7

# Generate an encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Configure backend
cp backend/.env.example backend/.env
# Edit backend/.env — set ENCRYPTION_KEY with the key above, set DB_PROVIDER=postgresql
```

### 2. Start the full stack

```bash
docker compose -f docker-compose.local.yml up -d --build
```

This starts 5 services:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Next.js UI |
| **Backend** | http://localhost:8000 | FastAPI + Swagger (`/docs`) |
| **Apicurio** | http://localhost:8081 | Schema Registry (empty) |
| **PostgreSQL** | localhost:5432 | Database (auto-migrated) |
| **Redis** | localhost:6379 | Cache |

Verify everything is running:

```bash
curl http://localhost:8000/health
# → {"status":"ok","database":"ok","cache":"ok"}
```

### 3. Connect Apicurio in event7

1. Open http://localhost:3000/settings
2. Click **Connect Registry**
3. Fill in:
   - **Name:** `Local Apicurio`
   - **Provider:** `Apicurio`
   - **URL:** `http://apicurio:8080` (internal Docker network name — not localhost)
4. Save — event7 tests the connection and encrypts the credentials

> **Note:** Use `apicurio:8080` (the Docker service name), not `localhost:8081`. The backend connects from inside the Docker network.

At this point you have two options:

---

### Path A — Explore empty (import an AsyncAPI spec)

With an empty registry and a connected Apicurio, you can import an AsyncAPI spec to bootstrap everything:

1. Go to **AsyncAPI** → **Import** tab
2. Paste or upload an AsyncAPI 3.0 YAML/JSON spec
3. Click **Preview** — event7 shows what will be created (channels, bindings, enrichments, schemas)
4. Click **Apply** — channels, bindings, enrichments are created in event7, and schemas are registered in Apicurio via Smart Registration

This is the fastest way to go from zero to a fully governed set of events.

---

### Path B — Seed with sample data (recommended for evaluation)

The seed scripts create a realistic e-commerce domain with cross-references, multi-broker channels, and governance rules.

#### Step 1: Seed schemas into Apicurio

```bash
cd backend
pip install requests pyyaml   # if not already installed

python scripts/seed_apicurio.py --url http://localhost:8081
```

This creates **10 Avro + JSON Schema subjects** with cross-references (Order → Customer → Address, etc.) and multiple versions (User v1 → v2 with role field).

#### Step 2: Connect the registry in event7

If you haven't already (step 3 above), connect Apicurio in Settings. Once connected, go to **Schema Explorer** — you should see all 10 subjects with their versions, formats, and compatibility modes.

#### Step 3: Seed event7 governance data

```bash
python scripts/seed_event7.py --url http://localhost:8000
```

This creates:
- **9 enrichments** — descriptions, owners, tags, classification, data layers (RAW/CORE/REFINED/APP)
- **7 channels** — 5 Kafka topics + 1 RabbitMQ exchange + 1 Redis stream
- **9 bindings** — N:N mappings between channels and subjects (value + key roles)
- **7 governance rules** — naming conventions, required fields, compliance checks

You can skip specific sections:

```bash
python scripts/seed_event7.py --skip-enrichments    # channels + rules only
python scripts/seed_event7.py --skip-channels        # enrichments + rules only
python scripts/seed_event7.py --skip-rules           # enrichments + channels only
```

#### What you should see

| Page | What's there |
|------|-------------|
| **Dashboard** | Schema count, enrichment coverage %, compatibility distribution, data layer chart, governance score funnel |
| **Schema Explorer** | 10 subjects, multiple versions, Avro + JSON Schema formats |
| **Visual Diff** | Pick `com.event7.User` → diff v1 vs v2 → see `role` field added (non-breaking) |
| **References Graph** | Interactive d3-force graph — `Order` → `Customer` → `Address` chain, orphan detection |
| **Event Catalog** | Business view with broker badges (Kafka/RabbitMQ/Redis), data layers, ownership, classification |
| **Channels** | 7 channels across 3 broker types, with bindings and data layers |
| **Rules** | 7 governance rules — some global, some per-subject, with severity levels |

---

### Manual setup (without Docker)

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, ENCRYPTION_KEY
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && cp .env.example .env.local
npm install && npm run dev
```

You'll need PostgreSQL 15+ and Redis 7+ running separately, plus an Apicurio or Confluent SR to connect to.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend                                                    │
│  Explorer · Catalog · Channels · Diff · Graph · Rules · AI   │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST API
┌───────────────────────────┴───────────────────────────────────┐
│  Backend  (FastAPI)                                           │
│  Services → Providers → Cache (Redis)                         │
│            → Database (Supabase / PostgreSQL)                 │
│            → Channels · Rules · Enrichments · AsyncAPI Specs  │
└──────┬──────────────┬─────────────────────────────────────────┘
       │              │
┌──────┴─────┐ ┌──────┴──────┐
│ Confluent  │ │  Apicurio   │  ← your registries (schemas live here)
│ SR  / CP   │ │  Registry   │
└────────────┘ └─────────────┘

  event7 = governance layer
  schemas → registry (external)
  channels + rules + enrichments → event7 DB
```

**Two adapter patterns:**

1. **SchemaRegistryProvider** — one interface, multiple registry implementations.
2. **DatabaseProvider** — Supabase for SaaS, PostgreSQL for self-hosted.

Enrichments, channels, rules, and AsyncAPI specs are stored in event7's own database — never pushed to the registry. This keeps governance provider-agnostic.

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
│   │   ├── api/            # FastAPI routers (registries, schemas, governance, channels, asyncapi, rules, ai)
│   │   ├── services/       # Business logic, diff, AsyncAPI generation + import, channel service, rules
│   │   ├── providers/      # Registry adapters (Confluent, Apicurio)
│   │   ├── models/         # Pydantic v2 data contracts
│   │   ├── db/             # Database abstraction (Supabase + PostgreSQL)
│   │   ├── cache/          # Redis with TTL and hierarchical keys
│   │   └── utils/          # AES-256 encryption, helpers
│   ├── tests/              # pytest + pytest-asyncio (unit + import fixtures)
│   ├── migrations/         # SQL schema (bootstrap, channel_model, governance_rules)
│   └── scripts/            # Seed data (seed_apicurio.py, seed_event7.py)
├── frontend/
│   ├── src/app/            # App Router — dashboard, docs, auth
│   │   └── docs/           # Public documentation (intro, features, channels, rules, API ref, licensing)
│   ├── src/components/     # UI components (shadcn/ui, Recharts, d3-force)
│   ├── src/lib/            # API clients, Supabase helpers
│   └── src/providers/      # React context (registry, auth)
├── docker-compose.local.yml  # Full stack (PG + Redis + Apicurio + backend + frontend)
└── docker-compose.yml      # Dev (Redis only)
```

---

## Adding a New Provider

1. Create `providers/your_registry.py` implementing `SchemaRegistryProvider`
2. Add the type to `ProviderType` enum in `models/registry.py`
3. Register it in `providers/factory.py`

No changes to services, routes, or frontend. The Apicurio provider was added exactly this way — one file, one factory branch.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts, d3-force |
| Backend | Python 3.12, FastAPI, Pydantic v2, httpx, loguru |
| Database | Supabase Cloud or PostgreSQL 15 (dual-mode) |
| Cache | Redis 7 with TTL and hierarchical keys |
| Security | AES-256 Fernet encryption, JWT auth, RLS policies |
| Deploy | Cloudflare Pages, Railway, Docker multi-stage, Kubernetes-ready |

---

## Roadmap

| Feature | Status |
|---------|--------|
| Confluent + Apicurio providers | ✅ Done |
| Schema Explorer, Visual Diff, References Graph | ✅ Done |
| Event Catalog with enrichments | ✅ Done |
| AsyncAPI 3.0 generation (Kafka bindings, key schema) | ✅ Done |
| Dashboard KPIs (Recharts) | ✅ Done |
| AI Agent (6 context commands + 3 actions) | ✅ Done |
| Governance Rules engine (CRUD, templates, scoring) | ✅ Done |
| Channel Model (9 broker types, N:N bindings, data layers) | ✅ Done |
| AsyncAPI Import (preview + apply, multi-broker) | ✅ Done |
| Smart schema registration (provider-type routing) | ✅ Done |
| Catalog enriched (broker badges, updated, AsyncAPI drawer) | ✅ Done |
| Dual-mode deployment (SaaS + self-hosted) | ✅ Done |
| Public documentation (/docs) | ✅ Done |
| RLS multi-tenant security | 🔜 Next |
| Hosted registry provisioning (Apicurio-backed) | 🔜 Next |
| AuthProvider OIDC | 🔜 Next |
| Protobuf support | 🔜 Next |
| Cross-registry aggregated view | 🔜 Next |
| Provider Rule Sync (Confluent + Apicurio) | 🔜 Planned |
| AsyncAPI Export Mode 3 (real channels → spec) | 🔜 Planned |
| CloudEvents support | 🔜 Planned |
| AWS Glue / Azure SR providers | 🔜 Planned |
| RBAC, SSO, audit logs | 📋 Future |

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

See the [full licensing details](https://event7.pages.dev/docs/licensing).

---

<p align="center">
  <strong>event7</strong> — Schema governance shouldn't require vendor lock-in.
</p>