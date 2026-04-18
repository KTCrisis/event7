# event7 — Application Model & Full Lineage — Design Document

**Version:** 1.0.0
**Date:** 12 avril 2026
**Authors:** Marc / Claude
**Status:** Draft — Design review

---

## 1. Context & motivation

### The problem

event7 governs schemas and maps them to channels (topics, exchanges, queues). But the chain stops there. The question "who produces and who consumes this schema?" has no answer inside event7 today.

In practice, Marc navigates between schemas, checks which topics are associated, and tries to figure out which applications consume those schemas. This requires mental reconstruction across multiple views (Schemas Explorer, Channels, References Graph) and often falls back to Confluent Cloud UI or `kafka-consumer-groups` CLI.

### What exists today

| Object | Model | Stored in | UI |
|--------|-------|-----------|-----|
| Schema (subject) | `models/schema.py` | Schema Registry (source of truth) | Schemas Explorer |
| Enrichment | `models/governance.py` | event7 DB | Catalog |
| Channel | `models/channel.py` | event7 DB | Channels page |
| Binding (schema-channel) | `ChannelSubjectResponse` | event7 DB | Channel detail |
| Reference (schema-schema) | Parsed from schema content | Computed | References Graph |
| Application (producer/consumer) | **Does not exist** | — | — |

The missing object is **Application** — the software component that produces or consumes events on a channel using a schema.

### The vision

Complete the lineage chain natively in event7:

```
Application (producer) → Channel → Schema → Channel → Application (consumer)
```

This enables:
- "Show me everything about this schema" → channels + producers + consumers in one view
- "Show me the full event flow" → lineage graph from source to sink
- Governance rules on flows ("restricted data cannot reach public topics")
- AsyncAPI generation with real producer/consumer metadata
- Sensibilisation: highlight schemas with no documented producers/consumers

### Design principles

1. **Application is an event7 object** — stored in DB, not read from a broker. Broker discovery (Kafka AdminClient) is an optional enrichment source, not a requirement.
2. **Provider-agnostic** — works without Kafka, without Confluent, without any broker connection. Applications can be declared manually, imported from AsyncAPI specs, or auto-discovered.
3. **Progressive adoption** — event7 works without applications (as today). Adding applications enriches existing views without breaking anything.
4. **AsyncAPI is the pivot format** — applications map to AsyncAPI `servers`, `channels`, and `operations` (publish/subscribe). Import and export are bidirectional.
5. **No runtime data** — event7 does not track consumer lag, offsets, or partition assignments. That belongs to monitoring tools (Confluent Cloud, Conduktor, Grafana). event7 tracks the topology, not the telemetry.

---

## 2. Data model

### 2.1 Applications table

```sql
CREATE TABLE applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_id     UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    name            VARCHAR(500) NOT NULL,
    display_name    VARCHAR(500),
    description     TEXT,
    app_type        VARCHAR(50) NOT NULL DEFAULT 'service',  -- service, lambda, connector, stream_processor, gateway
    team            VARCHAR(200),
    owner           VARCHAR(200),
    tags            TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',                      -- free-form (repo_url, runtime, language, etc.)
    discovery_origin VARCHAR(50) DEFAULT 'manual',           -- manual, asyncapi_import, kafka_admin, confluent_api
    is_auto_detected BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(registry_id, name)
);
```

### 2.2 Application-Channel bindings table

```sql
CREATE TABLE application_channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    channel_id      UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,                     -- producer, consumer, both
    consumer_group  VARCHAR(500),                             -- Kafka-specific, nullable
    description     TEXT,
    is_auto_detected BOOLEAN DEFAULT FALSE,
    discovery_origin VARCHAR(50) DEFAULT 'manual',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(application_id, channel_id, role)
);
```

### 2.3 Relationships

```
Application ──N:N──> Channel ──N:N──> Schema (Subject)
     │                   │                  │
     │ application_channels (role)          │
     │                   │ channel_subjects (binding)
     │                   │                  │
     └── team, owner     └── broker_type    └── enrichments, governance
```

Full lineage path: `Application (producer) → application_channels → Channel → channel_subjects → Schema → channel_subjects → Channel → application_channels → Application (consumer)`

### 2.4 Pydantic models

New file: `backend/app/models/application.py`

```python
class AppType(str, Enum):
    SERVICE = "service"
    LAMBDA = "lambda"
    CONNECTOR = "connector"
    STREAM_PROCESSOR = "stream_processor"
    GATEWAY = "gateway"

class AppRole(str, Enum):
    PRODUCER = "producer"
    CONSUMER = "consumer"
    BOTH = "both"

class DiscoveryOrigin(str, Enum):
    MANUAL = "manual"
    ASYNCAPI_IMPORT = "asyncapi_import"
    KAFKA_ADMIN = "kafka_admin"
    CONFLUENT_API = "confluent_api"

class ApplicationCreate(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    app_type: AppType = AppType.SERVICE
    team: str | None = None
    owner: str | None = None
    tags: list[str] = []
    metadata: dict = {}

class ApplicationResponse(BaseModel):
    id: str
    registry_id: str
    name: str
    display_name: str | None
    description: str | None
    app_type: AppType
    team: str | None
    owner: str | None
    tags: list[str]
    metadata: dict
    discovery_origin: DiscoveryOrigin
    is_auto_detected: bool
    created_at: datetime | None
    updated_at: datetime | None
    # Relations
    channels: list["AppChannelResponse"] = []

class AppChannelCreate(BaseModel):
    channel_id: str
    role: AppRole
    consumer_group: str | None = None
    description: str | None = None

class AppChannelResponse(BaseModel):
    id: str
    application_id: str
    channel_id: str
    channel_name: str | None = None      # denormalized for UI
    channel_address: str | None = None   # denormalized for UI
    role: AppRole
    consumer_group: str | None
    description: str | None
    is_auto_detected: bool
    discovery_origin: DiscoveryOrigin
    created_at: datetime | None
```

---

## 3. API endpoints

New router: `backend/app/api/applications.py`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/registries/{id}/applications` | List applications (filters: app_type, team, role) |
| POST | `/api/v1/registries/{id}/applications` | Create application |
| GET | `/api/v1/registries/{id}/applications/{app_id}` | Get application with channels |
| PUT | `/api/v1/registries/{id}/applications/{app_id}` | Update application |
| DELETE | `/api/v1/registries/{id}/applications/{app_id}` | Delete application |
| POST | `/api/v1/registries/{id}/applications/{app_id}/channels` | Bind application to channel |
| DELETE | `/api/v1/registries/{id}/applications/{app_id}/channels/{binding_id}` | Unbind |
| GET | `/api/v1/registries/{id}/lineage/{subject}` | Full lineage for a subject (producers → channels → schema → channels → consumers) |
| GET | `/api/v1/registries/{id}/lineage/graph` | Complete lineage graph (all applications, channels, schemas) |

---

## 4. Data sources (progressive)

### Source 1: Manual (Day 1)

User creates applications and binds them to channels via UI. Minimum viable, works with any broker.

### Source 2: AsyncAPI import (Day 1)

The existing AsyncAPI import service (`asyncapi_import_service.py`) already parses specs with servers, channels, and operations. Extend it to extract application metadata:

```yaml
# AsyncAPI spec → application extraction
info:
  title: billing-service        # → application.name
  x-team: billing               # → application.team

channels:
  invoices:
    publish:                     # → role: producer
      operationId: publishInvoice
    subscribe:                   # → role: consumer
      operationId: consumeInvoice
```

This is the key sensibilisation lever: "document your apps in AsyncAPI, event7 builds the lineage automatically."

### Source 3: Kafka Admin API (optional, future)

For Kafka-based brokers, poll consumer groups via AdminClient:

```python
# Optional broker connection
admin = AdminClient({"bootstrap.servers": bootstrap_servers})
groups = admin.list_consumer_groups()
# → auto-create applications with discovery_origin="kafka_admin"
```

Requires broker credentials (separate from SR credentials). Configured per registry, optional.

### Source 4: Confluent Cloud API (optional, future)

Confluent Cloud exposes consumer groups and connectors via REST API. Richer metadata than raw Kafka AdminClient.

---

## 5. Frontend

### 5.1 New page: `/applications`

Application list with filters (app_type, team, role). Each row shows:
- Name, type, team, owner
- Number of channels (producing / consuming)
- Discovery origin badge

Detail panel:
- Application metadata
- List of channels with role (producer/consumer)
- For each channel: linked schemas

### 5.2 Enriched existing views

**Schema Explorer** — new tab "Lineage" in schema detail:
- Channels using this schema (already available via reverse-lookup)
- For each channel: producing applications, consuming applications
- Visual: simple flow diagram (producers → channel → consumers)

**Channels page** — add "Applications" column in channel detail:
- List of applications bound to this channel with their role

**Catalog** — add optional columns:
- "Producers" count, "Consumers" count
- Filter: "schemas without documented producers/consumers" (governance gap indicator)

### 5.3 Lineage graph (extension of References Graph)

Extend the existing d3-force graph to support a lineage mode:

| Mode | Nodes | Edges | Current status |
|------|-------|-------|----------------|
| References (current) | Schemas | Schema references | Implemented |
| **Lineage (new)** | Applications + Channels + Schemas | app→channel, channel→schema | New |

Toggle between modes in the References page. Lineage mode shows the full flow with color-coded nodes (green=app, blue=channel, orange=schema) and directional edges (produce/consume).

---

## 6. Governance integration

### 6.1 New governance rules

| Rule | Severity | Description |
|------|----------|-------------|
| `no_producer` | warning | Schema/channel has no documented producer |
| `no_consumer` | warning | Schema/channel has no documented consumer |
| `orphan_app` | info | Application has no channel bindings |
| `restricted_flow` | error | Restricted-classified schema consumed by non-authorized application |

### 6.2 Scoring impact

Add an "Application coverage" axis to the governance score:
- Schema has producers AND consumers documented → +points
- Schema has channels but no applications → warning in catalog

---

## 7. AsyncAPI generation enhancement

Current AsyncAPI generation creates specs per subject. With applications, generate richer specs:

```yaml
info:
  title: billing-service                    # from application.name
  x-team: billing                           # from application.team

servers:
  production:
    url: pkc-xxx.europe-west1.gcp.confluent.cloud:9092
    protocol: kafka

channels:
  corp.billing.invoices.v1:
    publish:
      operationId: publishInvoice
      message:
        schemaFormat: application/vnd.apache.avro+json
        payload:
          $ref: '#/components/schemas/InvoiceCreated'
    subscribe:
      operationId: consumeInvoice

components:
  schemas:
    InvoiceCreated:
      # ... from schema registry
```

This closes the loop: schemas + channels + applications → complete AsyncAPI spec → EventCatalog with full lineage.

---

## 8. Roadmap

### Phase 1 — Application model (MVP)

**Goal:** Applications exist as first-class objects in event7.

| Task | Scope | Effort |
|------|-------|--------|
| SQL migration (applications + application_channels) | Backend | S |
| Pydantic models (application.py) | Backend | S |
| ApplicationService (CRUD + bindings) | Backend | M |
| API router (9 endpoints) | Backend | M |
| DB adapter methods (PostgreSQL + Supabase) | Backend | M |
| `/applications` page (list + detail) | Frontend | M |
| Tests (service + routes) | Backend | M |

### Phase 2 — Lineage views

**Goal:** Visualize the full chain schema → channel → application.

| Task | Scope | Effort |
|------|-------|--------|
| Lineage API endpoints (per-subject + full graph) | Backend | M |
| Schema detail "Lineage" tab (producers/consumers) | Frontend | M |
| Channel detail "Applications" section | Frontend | S |
| Catalog columns (producer/consumer count) | Frontend | S |
| Lineage mode in References Graph (d3-force) | Frontend | L |

### Phase 3 — AsyncAPI integration

**Goal:** Applications flow bidirectionally through AsyncAPI.

| Task | Scope | Effort |
|------|-------|--------|
| AsyncAPI import → extract applications | Backend | M |
| AsyncAPI generate → include application metadata | Backend | M |
| "Import AsyncAPI" creates applications + bindings | Backend | M |
| Batch generate with application context | Backend | S |

### Phase 4 — Discovery sources (optional)

**Goal:** Auto-populate applications from broker metadata.

| Task | Scope | Effort |
|------|-------|--------|
| Broker connection config per registry | Backend + Frontend | M |
| Kafka AdminClient consumer group discovery | Backend | M |
| Confluent Cloud API discovery | Backend | M |
| Auto-detect reconciliation (merge vs create) | Backend | M |

### Phase 5 — Governance

**Goal:** Governance rules and scoring include application coverage.

| Task | Scope | Effort |
|------|-------|--------|
| New governance rules (no_producer, no_consumer, etc.) | Backend | S |
| Scoring axis "application coverage" | Backend | S |
| Catalog filter "undocumented flows" | Frontend | S |
| Restricted flow enforcement | Backend | M |

---

## 9. Impact on existing code

### Backend changes

| File | Change |
|------|--------|
| `models/application.py` | New file |
| `services/application_service.py` | New file |
| `api/applications.py` | New file |
| `main.py` | Add applications router |
| `db/base.py` | Add 6-8 abstract methods (application CRUD + bindings) |
| `db/postgresql_client.py` | Implement methods |
| `db/supabase_client.py` | Implement methods |
| `services/asyncapi_service.py` | Extend generation with application context |
| `services/asyncapi_import_service.py` | Extract applications from specs |
| `migrations/` | New migration file |

### Frontend changes

| File | Change |
|------|--------|
| `app/(dashboard)/applications/page.tsx` | New page |
| `components/applications/` | New directory (list, detail, binding-form) |
| `components/schemas/schema-detail.tsx` | Add "Lineage" tab |
| `components/channels/channel-detail.tsx` | Add "Applications" section |
| `components/catalog/catalog-table.tsx` | Add producer/consumer columns |
| `components/references/references-graph.tsx` | Add lineage mode toggle |
| `lib/api/applications.ts` | New API client |
| `types/application.ts` | New types |

### No breaking changes

All additions are additive. Existing endpoints, models, and UI remain unchanged. Applications are optional — event7 without applications works exactly as before.

---

## 10. Decision log

| Decision | Rationale |
|----------|-----------|
| Application is an event7 object, not a broker object | Provider-agnostic, works without broker credentials |
| No runtime telemetry (lag, offsets) | event7 is governance, not monitoring. Keep scope clear |
| AsyncAPI as primary import/export format for applications | Aligns with the sensibilisation mission, standard format |
| Optional broker discovery (Phase 4) | Progressive adoption, not a prerequisite |
| N:N application-channel with role | Same application can produce on one channel and consume another |
| consumer_group field on binding, not on application | A service can use different consumer groups per topic |

---

*Design document for event7 Application Model & Full Lineage. Extends the Channel Model (v1.1.0) and AsyncAPI Dual Mode (v1.0.0) designs.*
