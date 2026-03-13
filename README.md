<p align="center">
  <img src="assets/logo-event7.svg" alt="event7" width="360" />
</p>

<p align="center">
  <strong>Universal schema registry governance platform</strong><br/>
  <em>Explore, govern, and document your event schemas — regardless of your registry provider.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB.svg?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Next.js-000000.svg?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/AsyncAPI-3.0-4F46E5.svg" alt="AsyncAPI" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-Welcome-brightgreen.svg" alt="PRs Welcome" /></a>
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

---

## Features

### Explore

| Feature | Description | Tier |
|---------|-------------|------|
| **Schema Explorer** | Browse subjects, versions, formats, and compatibility across registries | Community |
| **Visual Diff Viewer** | Side-by-side field-level diff with breaking change detection (Avro + JSON Schema) | Community |
| **References Graph** | Interactive dependency graph — spot orphans, shared components, and hotspots | Community |
| **Dashboard KPIs** | Schema count, enrichment coverage, compatibility distribution, layer distribution | Community |

### Govern

| Feature | Description | Tier |
|---------|-------------|------|
| **Event Catalog** | Business view with broker badges, data layers, ownership, classification, AsyncAPI drawer | Community |
| **Enrichments** | Tags, ownership, descriptions, data layers, classification — stored in event7, not your registry | Community |
| **Governance Rules** | Conditions, transforms, validations, policies — 4 built-in templates (RAW/CORE/REFINED/APP) | Community |
| **Governance Scoring** | Three-axis scoring (enrichments + rules + schema quality) with confidence indicator | Community |
| **Channel Model** | Map schemas to Kafka topics, RabbitMQ exchanges, Redis streams, Pulsar, NATS, cloud brokers | Community |
| **AsyncAPI Import** | Import a spec → creates channels, bindings, enrichments, and registers schemas in one click | Community |
| **AsyncAPI Generation** | Generate 3.0 specs with Kafka bindings, key schema, Avro conversion, examples | Community |
| **Smart Registration** | Routes schemas to the right registry — Apicurio accepts all, Confluent-like only Kafka schemas | Community |

### Tools

| Feature | Description | Tier |
|---------|-------------|------|
| **Multi-Provider** | Confluent Cloud, Confluent Platform, Apicurio v3, Karapace, Redpanda — same UI | Community |
| **AI Agent (BYOM)** | Natural-language governance commands with 6 context fetchers + 3 write actions | Community |
| **AI Agent Managed** | Hosted LLM with tokens included — zero config | Pro |
| **Hosted Registry** | Managed Apicurio for brokers without native SR (Redis, RabbitMQ, NATS) | Pro |
| **Provider Rule Sync** | Import/push Confluent ruleSet + Apicurio rules, drift detection | Pro |
| **AsyncAPI Export Mode 3** | Export real event7 channels as multi-broker specs | Pro |
| **Channel Health** | Lag, throughput, consumer group monitoring | Enterprise |
| **OIDC / SSO** | Okta, Azure AD, Keycloak integration | Enterprise |
| **RBAC** | Role-based access per registry and subject | Enterprise |

event7 follows an **open-core** model. The governance engine is free and open-source under **Apache 2.0**. See [Licensing](#licensing).

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
docker compose -f docker-compose.local.yml up -d
```

```
http://localhost:3000  → Frontend
http://localhost:8000  → Backend API + Swagger (/docs)
http://localhost:8081  → Apicurio Registry
```

### Seed with sample data

```bash
# 10 schemas with cross-references in Apicurio
python scripts/seed_apicurio.py --url http://localhost:8081

# 9 enrichments, 7 channels (Kafka + RabbitMQ + Redis), 9 bindings, 7 rules
python scripts/seed_event7.py --url http://localhost:8000
```

### Two starting paths

**Existing registry with schemas** → Connect → Explore → Enrich → Govern

**Empty registry** → Connect → Import AsyncAPI spec → Everything created in one click

### Manual setup

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && cp .env.example .env.local
npm install && npm run dev
```

Health check: `curl http://localhost:8000/health`

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend  (Next.js · Cloudflare Pages)                      │
│  Explorer · Catalog · Channels · Diff · Graph · Rules · AI   │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST API
┌───────────────────────────┴──────────────────────────────────┐
│  Backend  (FastAPI · Railway / GKE)                          │
│  Services → Providers → Cache (Redis)                        │
│            → Database (Supabase / PostgreSQL)                 │
│            → Channels · Rules · Enrichments · AsyncAPI Specs  │
└──────┬──────────────┬────────────────────────────────────────┘
       │              │
┌──────┴─────┐ ┌──────┴──────┐
│ Confluent  │ │  Apicurio   │  ← your registries (schemas live here)
│ Cloud / CP │ │  Registry   │
└────────────┘ └─────────────┘

  event7 = governance layer
  schemas → registry (external)
  channels + rules + enrichments → event7 DB
```

**Two adapter patterns:**

1. **SchemaRegistryProvider** — one interface, multiple registry implementations.
2. **DatabaseProvider** — Supabase for SaaS, PostgreSQL (psycopg2) for self-hosted.

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
│   ├── tests/              # pytest + pytest-asyncio (import fixtures, unit tests)
│   ├── migrations/         # SQL schema (bootstrap.sql, channel_model, governance_rules)
│   └── scripts/            # Seed data (seed_apicurio.py, seed_event7.py)
├── frontend/
│   ├── src/app/            # App Router — dashboard, docs, auth
│   │   └── docs/           # Public documentation (intro, features, channels, rules, API ref, licensing)
│   ├── src/components/     # UI components (shadcn/ui, Recharts, d3-force)
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

event7 follows an **open-core** model:

| Tier | License | Includes |
|------|---------|----------|
| **Free** | SaaS terms | Core governance, 1 registry, 50 schemas, AI Agent BYOM |
| **Community** | Apache 2.0 | Everything free, unlimited, self-hosted |
| **Pro** | Commercial | Provider sync, hosted registry, AI managed, AsyncAPI export Mode 3 |
| **Enterprise** | Commercial | OIDC/SSO, RBAC, channel monitoring, audit logs, SLA |

See the [full licensing details](https://event7.pages.dev/docs/licensing).

---

<p align="center">
  <strong>event7</strong> — Schema governance shouldn't require vendor lock-in.
</p>