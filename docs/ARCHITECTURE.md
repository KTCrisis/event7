# event7 — Architecture Reference

> Internal reference document. Describes the project structure, the role of each file,
> the patterns used, and the conventions to follow.
>
> **Repo**: github.com/KTCrisis/event7 (private)
> **Last updated**: 5 avril 2026

---

## Core principle

The architecture follows a **layered pattern**. Every request flows top-down,
and each layer has a single responsibility:

```
HTTP Request → Route (api/) → Service (services/) → Provider (providers/) + Cache + DB
```

No layer skips another. A route never talks directly to the provider,
a service doesn't know about FastAPI.

---

## Project structure

```
event7/
├── .env.example
├── docker-compose.local.yml       # Full local stack: PG + Redis + Apicurio + backend + frontend
├── docs/                          # Design documents (12 files)
├── backend/
│   ├── .env                       # Local config (NOT versioned)
│   ├── Dockerfile                 # Multi-stage Python 3.12 slim
│   ├── pyproject.toml             # ruff, pytest config
│   ├── requirements.txt
│   ├── migrations/
│   │   ├── bootstrap_supabase.sql     # Supabase (with auth.users FK + RLS)
│   │   └── bootstrap_postgresql.sql   # Standalone PostgreSQL (no Supabase deps)
│   ├── scripts/
│   │   ├── test_confluent.py
│   │   └── seed_schemas.py
│   ├── tests/
│   │   ├── test_auth.py               # JWT, 18 tests
│   │   ├── test_lifecycle.py          # Provider close, 10 tests
│   │   ├── test_supabase_client.py    # DB mutations, 12 tests
│   │   ├── test_registries_routes.py  # Integration, 6 tests
│   │   ├── test_validator.py          # Schema validation + contextual severity
│   │   └── test_asyncapi_import.py    # 7 fixtures, 11 tests
│   └── app/
│       ├── main.py                    # FastAPI entry point + lifespan (DB + Redis init)
│       ├── config.py                  # Pydantic Settings, @lru_cache
│       ├── models/                    # Pydantic v2 models (zero logic)
│       │   ├── schema.py              # SubjectInfo, SchemaDetail, SchemaDiff, SchemaReference
│       │   ├── registry.py            # RegistryCreate, RegistryResponse, ProviderType
│       │   ├── governance.py          # Enrichment, CatalogEntry, CompatibilityMode
│       │   ├── governance_rules.py    # 10 enums + 14 models (rules, templates, scoring)
│       │   ├── channel.py             # Channel, ChannelSubject, 8 enums (22 broker types)
│       │   ├── validator.py           # SchemaValidateRequest/Response, Verdict, RuleViolation
│       │   ├── asyncapi.py            # AsyncAPISpec, AsyncAPIGenerateRequest
│       │   ├── asyncapi_overview.py   # AsyncAPIOverviewResponse, KPIs
│       │   ├── export.py              # EventCatalogExport, ExportSchema, ExportChannel
│       │   └── auth.py                # UserContext
│       ├── providers/                 # SR adapter pattern (provider-agnostic)
│       │   ├── base.py                # ABC: SchemaRegistryProvider (11 methods)
│       │   ├── confluent.py           # Confluent Cloud + Platform
│       │   ├── apicurio.py            # Apicurio Registry v3 (native + ccompat)
│       │   └── factory.py             # type + credentials → provider instance
│       ├── services/                  # Business logic / orchestration
│       │   ├── schema_service.py      # Provider + cache + enrichments orchestrator
│       │   ├── diff_service.py        # Field-level diff (Avro, JSON Schema)
│       │   ├── asyncapi_service.py    # AsyncAPI 3.0 generation (22 brokers, governance)
│       │   ├── asyncapi_import_service.py  # AsyncAPI import (preview + apply, 29 protocols)
│       │   ├── channel_service.py     # Channel CRUD + bindings + auto-detect TNS
│       │   ├── governance_rules_service.py # Rules CRUD + templates + scoring (21 methods)
│       │   ├── validator_service.py   # Schema validation (compat + rules + diff → verdict)
│       │   ├── rules_evaluator.py     # Dry-run rule evaluation (6 evaluators)
│       │   └── rules_context_resolver.py  # Contextual severity (3 factors, delta stacking)
│       ├── api/                       # FastAPI routers
│       │   ├── dependencies.py        # DI: registry_id → decrypt → provider → SchemaService
│       │   ├── registries.py          # CRUD connections
│       │   ├── schemas.py             # Schemas, diff, versions, references, validate
│       │   ├── governance.py          # Catalog, enrichments, export
│       │   ├── rules.py               # Governance rules, templates, scoring (9 endpoints)
│       │   ├── channels.py            # Channels, bindings, channel-map, auto-detect
│       │   ├── asyncapi.py            # Generate, retrieve, edit, YAML, overview, import
│       │   ├── export.py              # EventCatalog export endpoint
│       │   ├── ai.py                  # AI Agent: chat (SSE) + execute + status
│       │   ├── ai_context.py          # Live context fetchers (6 commands)
│       │   ├── ai_actions.py          # Tool definitions (3 tools) + executors
│       │   └── hosted.py              # Hosted registry stub (501)
│       ├── cache/
│       │   └── redis_cache.py         # Async Redis wrapper, TTL 5min
│       ├── db/                        # DB adapter pattern (dual-mode)
│       │   ├── base.py                # ABC: DatabaseProvider (39 methods)
│       │   ├── supabase_client.py     # SupabaseDatabase (SaaS mode)
│       │   ├── postgresql_client.py   # PostgreSQLDatabase (self-hosted, psycopg2 sync)
│       │   └── factory.py             # DB_PROVIDER env → implementation
│       └── utils/
│           ├── encryption.py          # Fernet AES-256 encrypt/decrypt credentials
│           └── auth.py                # get_current_user (Supabase JWT)
├── frontend/                          # Next.js 15 + TypeScript + Tailwind + shadcn/ui
│   ├── Dockerfile                     # Multi-stage Node 22 Alpine (standalone via sed)
│   ├── middleware.ts                  # Auth guard (bypass when Supabase not configured)
│   ├── next.config.ts                # Rewrites /api/v1/* → backend
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/           # Authenticated routes
│       │   │   ├── page.tsx           # Dashboard (KPIs, governance, coverage)
│       │   │   ├── schemas/           # Schema Explorer (list + detail + evolution tab)
│       │   │   ├── diff/              # Visual Diff Viewer
│       │   │   ├── catalog/           # Event Catalog (enrichments, governance score toggle)
│       │   │   ├── rules/             # Governance Rules (list, editor, templates)
│       │   │   ├── channels/          # Channel Model (list, detail, bindings)
│       │   │   ├── asyncapi/          # AsyncAPI (generate, import, viewer)
│       │   │   ├── validate/          # Schema Validator (input + report)
│       │   │   ├── references/        # References Graph (d3-force SVG)
│       │   │   ├── ai/               # AI Agent (chat terminal, SSE)
│       │   │   └── settings/          # Settings (registry connections)
│       │   ├── (public)/              # /login
│       │   └── docs/                  # Documentation pages (features, API, licensing, roadmap)
│       ├── components/
│       │   ├── layout/                # Sidebar, Topbar, AuthProvider
│       │   ├── schemas/               # SchemaDetail, EvolutionTimeline, SchemaContent
│       │   ├── catalog/               # CatalogTable, enrichment editors
│       │   ├── rules/                 # RuleEditor, GovernanceScore, TemplateManager
│       │   ├── channels/              # ChannelDetail, binding editors
│       │   ├── asyncapi/              # AsyncAPIViewer, AsyncAPIImport
│       │   ├── references/            # ReferencesGraph (d3-force), GraphSidebar
│       │   ├── ai/                    # AIContent (chat terminal, action cards)
│       │   ├── settings/              # RegistryForm, connection test
│       │   ├── docs/                  # DocsSidebar, DocsHeader
│       │   └── ui/                    # shadcn/ui primitives
│       ├── types/                     # TypeScript interfaces (10 files)
│       └── lib/
│           ├── api/                   # API client functions (9 files)
│           └── supabase/              # Supabase clients (null-safe, auth bypass)
└── generator-event7/                  # EventCatalog generator plugin (planned, not started)
```

---

## Dual-mode architecture

event7 runs in two modes from the **same codebase**, driven by environment variables:

| Variable | SaaS | Self-hosted |
|----------|------|-------------|
| `DB_PROVIDER` | `supabase` | `postgresql` |
| `DATABASE_URL` | *(not used)* | `postgresql://user:pass@host:5432/event7` |
| `SUPABASE_URL` | `https://xxx.supabase.co` | *(not used)* |
| `AUTH_ENABLED` | `true` | `false` |
| `OLLAMA_HOST` | `https://ollama.com` | `http://ollama:11434` |

### Two adapter patterns

**1. DatabaseProvider** (`db/base.py`) — ABC with 39 methods:

| Domain | Methods |
|--------|---------|
| Lifecycle | `connect()`, `disconnect()`, `ping()` |
| Registries | get, get_by_id, create, delete |
| Enrichments | get, get_for_registry, upsert |
| AsyncAPI | get, delete, upsert, get_for_registry, get_bound_subjects |
| Audit | log_audit |
| Governance Rules | list, get, create, update, delete, count |
| Governance Templates | list, get, create, update, delete |
| Channels | get, get_by_id, create, update, delete |
| Channel Subjects | get_for_channel, create, delete, get_for_subject |

Implementations: `SupabaseDatabase` (supabase-py) and `PostgreSQLDatabase` (psycopg2 sync).

**2. SchemaRegistryProvider** (`providers/base.py`) — ABC with 11 methods:

`health_check`, `list_subjects`, `get_schema`, `create_schema`, `delete_subject`, `get_versions`, `diff_versions`, `get_references`, `get_dependents`, `get_compatibility`, `check_compatibility`

Implementations: `ConfluentProvider` (Cloud + Platform) and `ApicurioProvider` (v3, native + ccompat).

---

## Layer details

### `main.py` — Entry point

Creates FastAPI app, manages lifespan (startup: connect Redis + DB via factory, shutdown: disconnect), registers 9 routers. Declares global `redis_cache` and `db_client` instances.

### `config.py` — Centralized configuration

Single `Settings` class reading `.env` via Pydantic Settings. `@lru_cache` ensures single parse.
All code uses `get_settings()` — never `os.getenv()` directly.

Key fields: `db_provider`, `database_url`, `supabase_url`, `encryption_key`, `redis_url`, `cors_origins` (JSON array), `auth_enabled`, `ollama_host`, `ollama_model`, `ollama_api_key`.

### `models/` — Data contracts

Pydantic v2 models only — zero logic, zero external imports. Shared language between all layers.

| File | Key models |
|------|-----------|
| `schema.py` | SubjectInfo, SchemaDetail, SchemaVersion, SchemaDiff, FieldDiff, SchemaReference |
| `registry.py` | RegistryCreate, RegistryResponse, RegistryHealth, ProviderType |
| `governance.py` | Enrichment, CatalogEntry, CompatibilityMode, DataClassification |
| `governance_rules.py` | 10 enums (RuleScope, RuleKind, EnforcementStatus...) + 14 models (GovernanceScore, RuleScoreBreakdown...) |
| `channel.py` | Channel, ChannelSubject, BrokerType (22 types), BindingStrategy, BindingStatus, SchemaRole |
| `validator.py` | SchemaValidateRequest/Response, CompatibilityResult, GovernanceResult, DiffResult, Verdict, RuleViolation |
| `asyncapi.py` | AsyncAPISpec, AsyncAPIGenerateRequest |
| `asyncapi_overview.py` | AsyncAPIOverviewResponse, KPIs, drift detection |
| `export.py` | EventCatalogExport, ExportSchema, ExportChannel |
| `auth.py` | UserContext |

### `providers/` — Multi-registry abstraction

| File | Description |
|------|-------------|
| `base.py` | ABC interface (stable — rarely changes) |
| `confluent.py` | Confluent Cloud + Platform. httpx + Basic Auth. Handles 40401/40408 fallback. |
| `apicurio.py` | Apicurio v3. Dual API: native v3 + ccompat `/apis/ccompat/v7`. Health via `/apis/registry/v3/system/info`. |
| `factory.py` | ProviderType → concrete class. Accepts encrypted or plain credentials. |

### `services/` — Business logic

| File | Role |
|------|------|
| `schema_service.py` | Orchestrates provider + cache + enrichments. Cache pattern: check Redis → miss → provider → enrich from DB → cache (TTL 5min) → return. |
| `diff_service.py` | Pure function. Avro field diff, JSON Schema property diff, breaking change detection. |
| `asyncapi_service.py` | AsyncAPI 3.0 generation. 22 broker types, protocol-aware servers, channel bindings, governance metadata, key schema detection, Avro→JSON Schema conversion. ~1100 lines. |
| `asyncapi_import_service.py` | AsyncAPI import. Preview (dry-run) + apply. 29 protocol mappings, Tier 2 broker detection/extraction. ~900 lines. |
| `channel_service.py` | Channel CRUD + bindings + TNS auto-detect heuristic. |
| `governance_rules_service.py` | Rules CRUD + templates (create, clone, apply) + 3-axis scoring with contextual severity. 21 methods. |
| `validator_service.py` | Schema validation: compatibility (SR) + governance rules + diff → PASS/WARN/FAIL verdict. |
| `rules_evaluator.py` | Dry-run rule evaluation. 6 evaluators: require-doc, require-fields, naming-convention, max-fields, field-regex. Skips runtime rules (CEL, ENCRYPT). |
| `rules_context_resolver.py` | Adjusts rule severity by enrichment context (classification, binding_count, data_layer). Delta stacking, clamped [info..critical]. |

### `api/` — HTTP routes

| File | Endpoints | Description |
|------|:---------:|-------------|
| `registries.py` | 4 | CRUD connections (POST test+encrypt+store, GET list, GET health, DELETE) |
| `schemas.py` | 13 | Subjects, versions, diff, references, dependents, compatibility, validate |
| `governance.py` | 4 | Catalog, catalog export (CSV/JSON), enrichment CRUD |
| `rules.py` | 9 | Rules CRUD, templates (list, apply, create, clone, delete), scoring |
| `channels.py` | 8+ | Channels CRUD, bindings, channel-map, reverse lookup, auto-detect |
| `asyncapi.py` | 7+ | Generate, retrieve, edit, YAML export, overview (dual-mode), import preview/apply |
| `export.py` | 1 | EventCatalog export (aggregated payload) |
| `ai.py` | 3 | Chat (SSE stream), execute (confirmed action), status |
| `hosted.py` | 1 | Hosted registry stub (501) |
| `dependencies.py` | — | DI: registry_id → decrypt → provider → SchemaService |

### `cache/redis_cache.py`

Async Redis wrapper. Methods: `get`, `set`, `delete`, `delete_pattern`. JSON serialization, configurable TTL (default 5min). Key convention: `event7:{registry_id}:{type}:{subject}`.

### `db/` — Database (dual-mode)

| File | Class | Driver | Usage |
|------|-------|--------|-------|
| `base.py` | `DatabaseProvider` | *(abstract)* | 39-method contract |
| `supabase_client.py` | `SupabaseDatabase` | `supabase-py` | SaaS mode |
| `postgresql_client.py` | `PostgreSQLDatabase` | `psycopg2` (sync) | Self-hosted |
| `factory.py` | `create_database()` | — | Reads `DB_PROVIDER` |

psycopg2 (sync) chosen over asyncpg — asyncpg caused `ConnectionDoesNotExistError` with uvicorn multi-worker. Matches the synchronous call pattern of both DB implementations.

### `utils/`

| File | Role |
|------|------|
| `encryption.py` | Fernet AES-256 encrypt/decrypt credentials |
| `auth.py` | `get_current_user()` — Supabase JWT verification |

---

## Frontend architecture

### Stack

Next.js 15 (App Router), TypeScript, React 19, Tailwind CSS + shadcn/ui (New York variant, Slate/Cyan-Teal palette), JetBrains Mono, dark-only.

### Pages (10)

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | KPIs, governance coverage, enforcement funnel |
| Schema Explorer | `/schemas` | Subject list + detail panel with Schema/Evolution tabs |
| Visual Diff | `/diff` | Side-by-side schema diff viewer |
| Catalog | `/catalog` | Enrichment table with governance score toggle |
| Rules | `/rules` | Governance rules list, scope-adaptive editor, template manager |
| Channels | `/channels` | Channel list + detail with bindings |
| AsyncAPI | `/asyncapi` | Generate, import, viewer |
| Validate | `/validate` | Schema validator (input form + 3-section report) |
| References | `/references` | d3-force dependency graph with sidebar |
| AI Agent | `/ai` | Terminal-style chat with SSE streaming |
| Settings | `/settings` | Registry connections |

### Key patterns

- `ApiClient` (`lib/api/client.ts`) — centralized HTTP with optional auth header
- Supabase clients return `null` when env vars not set → auth bypass
- `useRegistry()` hook returns `{ selected, registries, select, refresh, loading }`
- Dark-only UI — no light mode
- Sonner toasts for all user feedback
- shadcn/ui components with New York variant

---

## Request flow example

`GET /api/v1/registries/{id}/subjects/{subject}/diff?v1=1&v2=2`

```
1. api/schemas.py        → receives request, FastAPI injects SchemaService
2. api/dependencies.py   → fetch registry from DB, decrypt credentials, create provider, wrap in SchemaService
3. services/schema_service.py → check Redis cache, if miss → provider.diff_versions()
4. providers/confluent.py     → fetch both versions via SR REST API
5. services/diff_service.py   → field-level comparison
6. Result bubbles up: SchemaDiff → Redis cache → JSON HTTP → frontend
```

---

## Storage principles

| DB (persistent) | Redis (cache TTL 5min) | Never duplicated |
|-----------------|----------------------|------------------|
| Registries, credentials (encrypted) | Subject lists, schemas | Schemas (source = SR) |
| Enrichments, channels, rules | Versions, diffs, compat modes | Versions (source = SR) |
| AsyncAPI specs, audit logs | Reference graph | |
| Governance templates, scoring | | |

**Principle**: the registry remains the source of truth for schemas. The DB stores what the registry doesn't know.

---

## Supported registries

| Provider | Status | Notes |
|----------|:------:|-------|
| Confluent SR (Cloud + Platform) | Production | Primary provider |
| Apicurio Registry v3 | Production | Native v3 + ccompat API |
| Karapace (Aiven) | Via Confluent | Confluent-compatible API |
| Redpanda SR | Via Confluent | Confluent-compatible API |
| AWS Glue SR | Planned | |
| Azure SR | Planned | |

---

## Database tables

| Table | Description | Key |
|-------|-------------|-----|
| `registries` | SR connections, AES-256 encrypted credentials | `(user_id, name)` |
| `enrichments` | Business metadata (description, owner, tags, classification, data_layer) | `(registry_id, subject)` |
| `governance_rules` | Rules with scope, type, severity, enforcement status | `(registry_id, rule_name)` |
| `governance_templates` | Built-in + custom rule templates | `(template_name)` |
| `channels` | Message exchange points (22 broker types) | `(registry_id, address, broker_type)` |
| `channel_subjects` | N:N binding between channels and subjects | `(channel_id, subject_name, schema_role)` |
| `asyncapi_specs` | Generated or imported specs (is_auto_generated flag) | `(registry_id, subject)` |
| `schema_snapshots` | Periodic snapshots for offline diff | `(registry_id, subject, version)` |
| `audit_logs` | User action journal | — |

Two migration files: `bootstrap_supabase.sql` (with RLS + auth.users FK) and `bootstrap_postgresql.sql` (standalone, idempotent).

---

## Infrastructure

| Component | Dev local | SaaS prod | Self-hosted |
|-----------|----------|-----------|-------------|
| Frontend | `next dev` | Cloudflare Pages (OpenNext) | Docker standalone |
| Backend | `uvicorn --reload` | Railway | Docker |
| Database | Supabase Cloud | Supabase Cloud | PostgreSQL 15 |
| Cache | Docker Redis | Upstash / Railway | Redis 7 |
| SR | Confluent Cloud | Confluent Cloud | Apicurio v3 / Confluent Platform |
| AI | Ollama Cloud | Ollama Cloud (kimi-k2.5) | Local Ollama (llama3.1:8b) |

Docker Compose (`docker-compose.local.yml`): PG 15 + Redis 7 + Apicurio v3.2.1 + backend + frontend.

---

## Conventions

- **All config via `get_settings()`** — never `os.getenv()` directly
- **`datetime.now(timezone.utc)`** — `datetime.utcnow()` is deprecated in Python 3.12
- **Pydantic v2 models in `models/`** — zero logic, just typed data
- **Routes never call providers directly** — always through services
- **psycopg2 sync** — not asyncpg. Both DB implementations are sync.
- **Cache keys**: `event7:{registry_id}:{type}:{subject}` via `cache_key()`
- **Linter**: ruff (config in `pyproject.toml`)
- **English for code and docs**, French for discussions
- **Dark-only UI** — no light mode
- **shadcn/ui** with New York variant, Sonner toasts
- **CORS_ORIGINS** must be JSON array in `.env`

---

## Adding a new provider

### Schema Registry provider

1. Create `providers/new.py` implementing `SchemaRegistryProvider`
2. Add type in `models/registry.py` (`ProviderType` enum)
3. Add case in `providers/factory.py`
4. No changes needed in services, routes, or frontend.

### Database provider

1. Create `db/new_client.py` implementing `DatabaseProvider`
2. Add case in `db/factory.py`
3. No changes needed in services, routes, or frontend.

---

## Licensing

Apache 2.0 open-core. Tiers: Free (SaaS, 1 registry, 50 schemas), Community (self-hosted, unlimited), Pro (AI, hosted registry, configurable weights), Enterprise (OIDC/SSO, RBAC, audit).

---

## Design documents

All in `docs/`:

| Document | Scope |
|----------|-------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | This document |
| [GOVERNANCE_RULES_ENGINE.md](GOVERNANCE_RULES_ENGINE.md) | Rules, policies, templates, scoring |
| [RULE_EDITOR_BEHAVIOR.md](RULE_EDITOR_BEHAVIOR.md) | Scope-adaptive form behavior |
| [CONTEXTUAL_SEVERITY.md](CONTEXTUAL_SEVERITY.md) | How severity adjustment works today |
| [SEVERITY_SCORING_DESIGN.md](SEVERITY_SCORING_DESIGN.md) | Full scoring vision (exposure + semantic) |
| [SCHEMA_VALIDATOR_DESIGN.md](SCHEMA_VALIDATOR_DESIGN.md) | Validation pipeline (compat + rules + diff) |
| [CHANNEL_MODEL_DESIGN.md](CHANNEL_MODEL_DESIGN.md) | Channel abstraction, 22 brokers, binding strategy |
| [ASYNCAPI_GENERATOR_V2_DESIGN.md](ASYNCAPI_GENERATOR_V2_DESIGN.md) | Protocol-aware generation, 22 brokers |
| [ASYNCAPI_DUAL_MODE_DESIGN.md](ASYNCAPI_DUAL_MODE_DESIGN.md) | Overview tab, import/generate modes |
| [SCHEMA_EVOLUTION_DESIGN.md](SCHEMA_EVOLUTION_DESIGN.md) | Version timeline in Explorer |
| [REFERENCES_GRAPH_V2_DESIGN.md](REFERENCES_GRAPH_V2_DESIGN.md) | Transitive chain, layout modes, export |
| [EVENTCATALOG_PLUGIN_DESIGN.md](EVENTCATALOG_PLUGIN_DESIGN.md) | Generator plugin for EventCatalog |
| [AI_AGENT.md](AI_AGENT.md) | AI Agent architecture (SSE, tools, context) |
