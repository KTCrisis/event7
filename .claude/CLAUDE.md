# CLAUDE.md — event7

> Context file for Claude Code. Read this before any task.

## Current Status (April 5, 2026)

Last session: 20 design docs archived, 100 new tests (186 total, 0 failures), `_STRICT_MODES` defense in depth, seed scripts aligned, `seed_enrichements.sh` removed.
State: **stable, feature-complete MVP**. Docker stack works. Deployed on Cloudflare Pages + Railway + Supabase.
Reddit: 1 thread on r/apachekafka, 4 stars, 25 unique clones, 0 forks. Reddit follow-up done.

### Next actions (prioritized)
1. **Severity escalation indicator in validator UI** — show "warning → error" with reason (restricted, binding count, etc.)
2. **Validator integration in Explorer/Catalog** — "Validate" button in schema-detail and catalog pages
3. **AsyncAPI batch generate** — `POST /asyncapi/generate-all` endpoint + frontend Batch tab
4. **Set up analytics** — Plausible/Umami on docs or README badge to track real adoption
5. **First real deployment** — NexDigital mission or public launch (HN, Product Hunt)

### What's done (verified April 5)
- All 186 tests passing (0 failures)
- AsyncAPI Overview frontend tab (KPIs, subject table, status/origin/sync badges, inline actions)
- EventCatalog generator plugin (4-phase pipeline, mappers, templates, build-ready)
- Reddit follow-up posted
- 20 design docs in `docs/` with implementation status tracked

---

## What is event7

event7 is an **open-source, provider-agnostic schema registry governance platform**. It sits at layer 3 (Governance) in a 5-layer event-driven model:

```
1 Infra/Broker → 2 Schema Registry → 3 Governance (event7) → 4 Spec/Contract (AsyncAPI) → 5 Documentation (EventCatalog)
```

**event7 is a governance layer, NOT a registry.** Schemas live in the SR (source of truth). Enrichments, channels, rules, and AsyncAPI specs live in event7's own database. This keeps governance provider-agnostic.

Tagline: *Explore, validate, and govern.*

---

## Repo & Structure

**Repo:** `github.com/KTCrisis/event7` (private) — monorepo with root `package.json`.

```
event7/
├── backend/                    # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── main.py             # Entry point, lifespan (DB + Redis init), 9 routers
│   │   ├── config.py           # Pydantic Settings, @lru_cache, single source of config
│   │   ├── models/             # 10 Pydantic v2 model files (zero logic)
│   │   ├── api/                # 12 FastAPI router files, 56+ endpoints
│   │   │   └── dependencies.py # DI: registry_id → decrypt → provider → SchemaService
│   │   ├── services/           # 9 service files (business logic)
│   │   ├── providers/          # SR adapter pattern (base.py ABC → confluent.py, apicurio.py)
│   │   │   └── factory.py      # type + credentials → provider instance
│   │   ├── cache/              # redis_cache.py — async Redis wrapper, TTL 5min
│   │   ├── db/                 # DB adapter pattern (base.py ABC → supabase, postgresql)
│   │   │   └── factory.py      # DB_PROVIDER env → SupabaseDatabase | PostgreSQLDatabase
│   │   └── utils/
│   │       ├── encryption.py   # Fernet AES-256 encrypt/decrypt credentials
│   │       └── auth.py         # Supabase JWT verification
│   ├── tests/                  # 9 test files, 186 tests, pytest + pytest-asyncio
│   ├── migrations/             # bootstrap_supabase.sql + bootstrap_postgresql.sql
│   ├── scripts/                # seed_schemas.py, seed_apicurio.py, seed_event7.py, test_confluent.py
│   ├── Dockerfile              # Multi-stage Python 3.12 slim, 2 workers
│   └── requirements.txt
├── frontend/                   # Next.js 16 + TypeScript + React 19 + Tailwind v4 + shadcn/ui
│   ├── src/app/                # 11 dashboard pages + 13 docs pages
│   ├── src/components/         # 40+ components (11 feature directories)
│   ├── src/types/              # 10 TypeScript type files
│   ├── src/lib/api/            # 9 API client modules
│   ├── next.config.ts          # Rewrites /api/v1/* → backend
│   ├── middleware.ts           # Auth guard (bypass when Supabase not configured)
│   ├── Dockerfile              # Multi-stage Node 22 Alpine, injects standalone via sed
│   └── .env.local              # NEXT_PUBLIC_API_URL (not committed)
├── generator-event7/           # EventCatalog generator plugin (TypeScript/tsup, CJS)
│   ├── src/                    # index.ts, event7-client.ts, mappers/, templates/
│   ├── package.json            # @event7/generator-eventcatalog v0.1.0
│   └── tsup.config.ts          # Build CJS for EventCatalog require()
├── docs/                       # 20 design documents (see Key Design Documents)
├── docker-compose.local.yml    # Full local stack: PG 15 + Redis 7 + Apicurio + backend + frontend
└── .env.example                # Backend env template
```

---

## Architecture — Layered Pattern

Every request flows top-down. **No layer skips another.**

```
HTTP Request → Route (api/) → Service (services/) → Provider (providers/) + Cache + DB
```

### Two Adapter Patterns

1. **SchemaRegistryProvider** (`providers/base.py` ABC, 16 methods) — Confluent, Apicurio, etc.
2. **DatabaseProvider** (`db/base.py` ABC, 39 methods) — `SupabaseDatabase` (SaaS) or `PostgreSQLDatabase` (self-hosted).

Factory in `providers/factory.py` and `db/factory.py`. `DB_PROVIDER` env var switches DB mode.

### Storage Principle

| event7 DB (persistent) | Redis (cache TTL 5min) | Never duplicated |
|-------------------------|------------------------|------------------|
| Registries, credentials (encrypted) | Subject lists, schemas | Schemas (source = SR) |
| Enrichments, channels, rules | Versions, diffs, compat modes | Versions (source = SR) |
| AsyncAPI specs, audit logs, templates | Reference graph | |

---

## Stack

### Backend
- **Python 3.12**, FastAPI, Pydantic v2, uvicorn (uvloop, httptools, 2 workers)
- **psycopg2** (sync) for PostgreSQL — NOT asyncpg (causes ConnectionDoesNotExistError with uvicorn multi-worker)
- **supabase-py** for SaaS mode
- **Redis 7** via async wrapper
- **cryptography** (Fernet AES-256) for credential encryption
- **loguru** for logging, **httpx** for SR HTTP calls
- **fastavro** for Avro, **jsonschema** for JSON Schema, **PyYAML** for YAML

### Frontend
- **Next.js 16** (App Router), TypeScript, React 19
- **Tailwind CSS v4** + **shadcn/ui** (New York style, Slate/Cyan-Teal palette, Outfit font, **dark-only**)
- **Recharts** for charts, **d3** for reference graph
- **@asyncapi/react-component** for AsyncAPI spec rendering
- **Sonner** for toasts, **Lucide** for icons

### Infrastructure
- SaaS: Cloudflare Pages (frontend) + Railway (backend) + Supabase Cloud (DB)
- Self-hosted: Docker Compose (`docker-compose.local.yml`) → PG 15 + Redis 7 + Apicurio + backend + frontend
- AI: Ollama (local or cloud, optional)

---

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | KPIs, governance coverage, enforcement funnel |
| `/schemas` | Schema Explorer | Subject list + detail panel with Schema/Evolution tabs |
| `/diff` | Diff Viewer | Side-by-side LCS diff with inline highlighting |
| `/catalog` | Catalog | Enrichment table, search, filters, governance score toggle, export |
| `/rules` | Governance Rules | Rules list, scope-adaptive editor, template manager |
| `/channels` | Channels | Channel list + detail with bindings (22 broker types) |
| `/asyncapi` | AsyncAPI | Overview (KPIs, table, badges, inline actions) + Import tab |
| `/validate` | Schema Validator | Input form + 3-section report (compat + governance + diff) |
| `/references` | References Graph | d3-force SVG with namespace colors, filters, sidebar |
| `/ai` | AI Agent | Terminal-style chat with SSE streaming, action cards |
| `/settings` | Settings | Registry connections (connect + hosted) |
| `/docs/*` | Documentation | 13 pages (getting-started, concepts, features, API ref, etc.) |

---

## Development Environment

- **OS:** Windows WSL2, VS Code Remote
- **Python:** pip + venv (no poetry)
- **Node:** npm (not yarn/pnpm)

### Quick Start (local full stack)

```bash
# Generate encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Set in .env: ENCRYPTION_KEY=<generated_key>

# Start everything
docker compose -f docker-compose.local.yml up --build
```

Frontend: http://localhost:3000 — Backend: http://localhost:8000 — Apicurio: http://localhost:8081

### Seed Data

```bash
# Seed Apicurio with 9 schemas + references + compat rules
python scripts/seed_apicurio.py --url http://localhost:8081

# Create registry in event7 UI (Settings → Connect → Apicurio → http://apicurio:8080)

# Seed event7 with enrichments + channels + rules
python scripts/seed_event7.py
```

For Confluent: `python scripts/seed_schemas.py` (requires `.env` with CONFLUENT_SR_* vars). Same 9 subjects, same references.

### Key Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `ENCRYPTION_KEY` | Yes | Fernet key (generate, don't invent) |
| `DB_PROVIDER` | Yes | `supabase` or `postgresql` |
| `DATABASE_URL` | If PG | `postgresql://user:pass@host:5432/event7` |
| `REDIS_URL` | No | Default `redis://localhost:6379/0` |
| `AUTH_ENABLED` | No | `false` for local dev |
| `CORS_ORIGINS` | No | **Must be JSON array**: `["http://localhost:3000"]` |
| `NEXT_PUBLIC_API_URL` | Frontend | Default `http://localhost:8000` |
| `OLLAMA_HOST` | No | Empty = AI disabled. `https://ollama.com` or `http://ollama:11434` |
| `OLLAMA_MODEL` | No | e.g. `kimi-k2.5:cloud` or `llama3.1:8b` |

---

## Code Conventions

### Python (backend)

- **All config via `get_settings()`** — never use `os.getenv()` directly
- **`datetime.now(timezone.utc)`** — `datetime.utcnow()` is deprecated in Python 3.12
- **Pydantic v2 models in `models/`** — zero logic, just typed data structures
- **Routes never call providers directly** — always go through services
- **psycopg2 sync** — not asyncpg. Supabase client is also sync. Both wrapped in async routes
- **Cache keys:** `event7:{registry_id}:{type}:{subject}` via `cache_key()` helper
- **Linter:** ruff (config in `pyproject.toml`)

### TypeScript (frontend)

- **`useRegistry()` returns** `{ selected, registries, select, refresh, loading }` — NOT `selectedRegistry`
- **`Record<string, ...>`** for dynamic lookup maps (not `Record<BrokerType, ...>` — causes TS indexing errors)
- **Dark-only UI** — no light mode
- **shadcn/ui components** with New York variant
- **Sonner toasts** for all user feedback

### General

- **English for code and docs**, French for discussions
- **Targeted patches over full rewrites**

---

## Testing

```bash
cd backend
python -m pytest tests/ -v                              # All tests (186)
python -m pytest tests/test_auth.py -v                  # Single file
python -m pytest tests/ -v --cov=app --cov-report=term-missing  # With coverage
```

| Test File | Tests | Scope |
|-----------|:-----:|-------|
| `test_auth.py` | 21 | JWT decode, get_current_user, dev mode |
| `test_lifecycle.py` | 10 | Provider close, dependency lifecycle |
| `test_supabase_client.py` | 15 | DB mutations, delete/create/upsert |
| `test_registries_routes.py` | 6 | Route integration, multi-tenant |
| `test_validator.py` | 23 | Validation pipeline, verdict logic, _STRICT_MODES |
| `test_context_resolver.py` | 40 | All severity branches, stacking, clamping |
| `test_governance_rules_service.py` | 33 | Scoring, enrichment points, _is_rule_met |
| `test_channel_service.py` | 27 | CRUD, bindings, filters, coherence warnings |
| `test_asyncapi_import.py` | 11 | 7 broker fixtures, protocol mapping |

Pattern: mock provider (`AsyncMock`), mock DB (`MagicMock`), mock cache (`AsyncMock`). Tests use `conftest.py` for shared fixtures and JWT helpers.

---

## Known Gotchas

| Gotcha | Detail |
|--------|--------|
| **Apicurio ccompat path** | `/apis/ccompat/v7` (with 's'), NOT `/api/ccompat/v7` |
| **Apicurio references** | Must be inside `content` block, not alongside it (silently ignored otherwise) |
| **Apicurio has 2 config systems** | Native v3 API + ccompat API require separate configuration calls |
| **Apicurio healthcheck** | Use `/apis/registry/v3/system/info`, not the generic health endpoint |
| **CORS_ORIGINS format** | Must be JSON array in `.env`: `["http://localhost:3000"]` |
| **Supabase anon key** | Must be the long JWT, not the short one |
| **credentials_encrypted column** | `text` not `bytea` (Supabase hex-encodes bytea, breaks Fernet base64) |
| **Frontend standalone mode** | Injected via `sed` in Dockerfile — `next.config.ts` unchanged for Cloudflare compat |
| **Cloudflare Pages** | Requires `public/_routes.json` with excludes for `/_next/static/*` etc. |
| **Cloudflare secrets** | Use `npx wrangler pages secret put VAR_NAME`, never the UI (bug with OpenNext) |
| **`_STRICT_MODES`** | event7 detects breaking changes independently of SR when mode is BACKWARD/FORWARD/FULL or TRANSITIVE variants |
| **Verdict logic** | Only promotes (WARN→FAIL, PASS→WARN), never demotes |
| **Verdict case** | Backend returns uppercase (PASS/WARN/FAIL), frontend must `.toLowerCase()` before matching config keys |
| **Contextual severity** | `rules_context_resolver.py` adjusts severity based on enrichment context. Escalations stack but cap at critical/floor at info. Default rules: restricted→+1, binding>=5→+1, RAW→-1, APPLICATION→+1 |
| **AsyncAPI round-trip** | `PROTOCOL_TO_BROKER` (29 entries) ↔ `BROKER_TO_PROTOCOL` (22 entries) maps ensure import/generate fidelity |

---

## API Surface

All endpoints under `/api/v1/`. **56+ endpoints** in 9 router groups:

- **Registries** (4) — CRUD connections (`/registries`)
- **Schemas** (13) — list, detail, versions, diff, references, dependents, compatibility, validate
- **Governance** (4) — catalog, catalog export (CSV/JSON), enrichment CRUD
- **Governance Rules** (13) — rules CRUD, templates (list/create/clone/apply/delete), scoring
- **Channels** (10) — channels CRUD, bindings, channel-map, reverse lookup, auto-detect
- **AsyncAPI** (8) — generate, retrieve, edit, YAML export, overview (dual-mode + drift), import preview/apply
- **EventCatalog Export** (1) — aggregated payload for generator plugin
- **AI Agent** (3) — chat (SSE stream), execute (confirmed action), status
- **Hosted Registry** (2) — 501 stubs

Swagger UI: `http://localhost:8000/docs`

---

## Supported Schema Registries

| Provider | Status | Notes |
|----------|--------|-------|
| Confluent SR (Cloud + Platform) | Production | Primary provider |
| Apicurio Registry v3 | Production | Native v3 + ccompat API |
| Karapace (Aiven) | Via Confluent provider | Confluent-compatible API |
| Redpanda SR | Via Confluent provider | Confluent-compatible API |
| AWS Glue SR | Planned (P2) | |
| Azure SR | Planned (P3) | |

---

## Docker Compose (local full stack)

`docker-compose.local.yml` — 5 services:

| Service | Image | Port |
|---------|-------|:----:|
| postgres | postgres:15-alpine | 5432 |
| redis | redis:7-alpine | 6379 |
| apicurio | apicurio/apicurio-registry:latest-release | 8081 |
| backend | Custom (Python 3.12 slim) | 8000 |
| frontend | Custom (Node 22 Alpine) | 3000 |

PostgreSQL auto-migrates from `bootstrap_postgresql.sql` via docker-entrypoint-initdb.d.

---

## Licensing

Apache 2.0 open-core. Tiers: Free (SaaS, 1 registry, 50 schemas), Community (self-hosted, unlimited), Pro (AI, hosted registry, configurable weights, provider rule sync), Enterprise (OIDC/SSO, RBAC, audit).

---

## Key Design Documents

All in `docs/` — see `docs/README.md` for index:

| Document | Scope |
|----------|-------|
| ARCHITECTURE.md | Full project structure, layers, conventions |
| PRODUCT_SPEC.md | Vision, pricing, hosted registry, security |
| GO_TO_MARKET.md | Competitive landscape, GTM phases |
| SCHEMA_REGISTRY_PROVIDERS.md | Confluent vs Redpanda vs Karapace vs Apicurio |
| GOVERNANCE_RULES_ENGINE.md | Rules, templates, scoring history |
| RULE_EDITOR_BEHAVIOR.md | Scope-adaptive form reference |
| CONTEXTUAL_SEVERITY.md | Current severity calculation (Phase 0) |
| SEVERITY_SCORING_DESIGN.md | Full scoring vision (Phases 1-5) |
| SCHEMA_VALIDATOR_DESIGN.md | Validation pipeline design |
| CHANNEL_MODEL_DESIGN.md | 22 brokers, binding strategy, data layers |
| ASYNCAPI_GENERATOR_V2_DESIGN.md | Protocol-aware generation |
| ASYNCAPI_DUAL_MODE_DESIGN.md | Overview tab, drift detection |
| SCHEMA_EVOLUTION_DESIGN.md | Version timeline |
| REFERENCES_GRAPH_V2_DESIGN.md | Transitive chain, layout modes |
| EVENTCATALOG_PLUGIN_DESIGN.md | Generator plugin |
| AI_AGENT.md | SSE streaming, context injection, tools |
| RAILWAY_DEPLOYMENT.md | Backend deployment guide |
| CLOUDFLARE_DEPLOYMENT.md | Frontend deployment guide |
| TESTING.md | Test structure, coverage gaps |
