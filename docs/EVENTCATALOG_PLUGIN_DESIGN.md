# EventCatalog Plugin Design — `generator-event7`

> **Version**: 1.0.0
> **Date**: 14 Mars 2026
> **Authors**: Marc / Claude
> **Status**: Partially implemented — backend endpoint done, generator plugin not started
> **Last updated**: 5 avril 2026

---

## Implementation status

| Component | Status | Notes |
|-----------|:------:|-------|
| Backend endpoint `GET /export/eventcatalog` | **Done** | `backend/app/api/export.py` + `models/export.py` |
| Backend router registered | **Done** | `main.py` |
| Generator TypeScript package (`generator-event7/`) | Not started | |
| Event mapper (schema → writeEvent) | Not started | |
| Channel mapper | Not started | |
| Team mapper | Not started | |
| Domain mapping (prefix/tag) | Not started | |
| Markdown template (governance badges) | Not started | |
| Tests | Not started | |
| npm publication | Not started | |

---

## 1. Executive Summary

### Objective

Create an **EventCatalog generator** that imports event7 governance data into a local EventCatalog. The plugin is the first bridge between event7 (governance layer) and EventCatalog (documentation/discovery layer).

### Positioning

```
Schema Registry (Confluent, Apicurio, ...)
        |
        v
    event7  <-- governance layer (explore, validate, govern)
        |
        v
  generator-event7  <-- THIS PLUGIN
        |
        v
   EventCatalog  <-- documentation & discovery layer
```

### Value proposition

The official Confluent SR plugin for EventCatalog imports raw schemas. `generator-event7` brings **what no other plugin does**:

- Governance scores (3 axes: enrichment, rules, schema quality)
- Business enrichments (tags, owner, classification, data_layer)
- Channel model multi-broker (Kafka, RabbitMQ, Pulsar, NATS, cloud)
- Rules summary (compliance, drift)
- Attached AsyncAPI specs
- Provider-agnostic (same payload for Confluent, Apicurio, or any other SR)

---

## 2. Architecture

### 2.1 Overview

```
+-------------------------------------------------------------+
|  eventcatalog.config.js                                     |
|                                                             |
|  generators: [                                              |
|    ['@event7/generator-eventcatalog', { ... }]              |
|  ]                                                          |
+----------------------+--------------------------------------+
                       |  npm run generate
                       v
+--------------------------------------------------------------+
|  generator-event7 (TypeScript / CJS)                         |
|                                                              |
|  1. Fetch  ->  GET /api/v1/registries/{id}/export/eventcatalog
|  2. Map    ->  SDK calls (writeEvent, writeChannel, ...)     |
|  3. Enrich ->  Markdown templates (governance badges)        |
+----------------------+---------------------------------------+
                       |  HTTP (single request)
                       v
+--------------------------------------------------------------+
|  event7 Backend (FastAPI)                                    |
|                                                              |
|  GET /export/eventcatalog                                    |
|  Aggregates: catalog + schema_content + channels + bindings  |
|              + governance_score + rules_summary + asyncapi   |
+--------------------------------------------------------------+
```

### 2.2 Dependencies

| Component | Version | Role |
|-----------|---------|------|
| `@eventcatalog/sdk` | latest | CRUD events, channels, domains, teams |
| `tsup` | ^8 | Build CJS (required by EventCatalog) |
| `vitest` | ^1 | Unit tests |
| `node-fetch` / `undici` | native | HTTP client to event7 API |

### 2.3 CJS constraint

EventCatalog loads generators via `require()`. The build must produce **CommonJS**. Source code is TypeScript ESM, transpiled by tsup.

---

## 3. Backend — Export endpoint

### 3.1 Route

```
GET /api/v1/registries/{registry_id}/export/eventcatalog
```

- **Auth**: JWT required (like all `/api/v1` routes)
- **Cache**: no dedicated cache (occasional call, not real-time)
- **Tier**: Community (open-source)

### 3.2 Response schema

```json
{
  "registry": {
    "id": "uuid",
    "name": "Production Confluent",
    "provider_type": "confluent_cloud",
    "base_url": "https://psrc-xxxxx.region.confluent.cloud"
  },
  "schemas": [
    {
      "subject": "com.acme.payments.BillingEvent-value",
      "format": "AVRO",
      "latest_version": 3,
      "version_count": 3,
      "schema_content": "{ \"type\": \"record\", ... }",
      "enrichment": {
        "description": "Raised when invoice is generated",
        "owner_team": "payments-team",
        "tags": ["pci", "gdpr", "domain:payments"],
        "classification": "PII",
        "data_layer": "CORE"
      },
      "references": [
        { "subject": "com.acme.common.MoneyType", "version": 1 }
      ],
      "governance_score": {
        "score": 85,
        "grade": "B",
        "confidence": "high",
        "breakdown": {
          "enrichments": { "points": 18, "max_points": 20 },
          "rules": { "points": 42, "max_points": 50 },
          "schema_quality": { "points": 25, "max_points": 30 }
        }
      },
      "rules_summary": [
        {
          "rule_name": "Naming convention",
          "status": "PASS",
          "severity": "error",
          "category": "schema_validation"
        }
      ],
      "asyncapi_yaml": "asyncapi: '3.0.0'\ninfo:\n  ..."
    }
  ],
  "channels": [
    {
      "id": "uuid",
      "name": "billing-events",
      "address": "prod.payments.billing.v1",
      "broker_type": "kafka",
      "resource_kind": "topic",
      "data_layer": "CORE",
      "bindings": [
        {
          "subject": "com.acme.payments.BillingEvent-value",
          "schema_role": "value",
          "binding_status": "active"
        }
      ]
    }
  ],
  "teams": ["payments-team", "orders-team", "platform-team"]
}
```

### 3.3 Aggregation logic

The endpoint orchestrates existing services — **no code duplication**:

```
1. service.get_catalog()              -> schema list + enrichments
2. For each subject:
   a. provider.get_schema(subject)    -> schema_content (latest)
   b. governance.compute_score(subject) -> 3-axis score
   c. db.list_governance_rules(subject) -> rules for summary
   d. db.get_asyncapi_spec(subject)     -> asyncapi_yaml (nullable)
   e. provider.get_references(subject)  -> outgoing references
3. db.get_channels(registry_id)       -> channels with bindings
4. owner_team deduplication           -> teams[]
```

### 3.4 Error handling per schema

An inaccessible schema (provider timeout, deleted between calls) must **not** block the full export:

- `schema_content`: `null` on error (logged, warning)
- `governance_score`: `null` on error
- `asyncapi_yaml`: `null` if not generated
- `rules_summary`: `[]` if no rules

The generator client handles `null` values gracefully.

### 3.5 Performance

For a registry with 200 schemas, the endpoint makes ~200 `get_schema()` calls. Mitigation:

- Existing Redis cache (TTL 5min) absorbs calls if the catalog was recently viewed
- The endpoint is designed for occasional calls (CI/CD, `npm run generate`), not real-time
- V2: batch fetch if the provider supports it (Confluent yes, Apicurio v3 yes)

---

## 4. Generator — Configuration

### 4.1 Installation

```bash
cd my-eventcatalog
npm install @event7/generator-eventcatalog
```

### 4.2 Full config

```js
// eventcatalog.config.js
export default {
  generators: [
    [
      '@event7/generator-eventcatalog',
      {
        // Connection
        event7Url: process.env.EVENT7_URL || 'http://localhost:8000',
        event7Token: process.env.EVENT7_TOKEN,
        registryId: process.env.EVENT7_REGISTRY_ID,

        // Domain mapping (optional)
        // data_layer is NOT a domain — it stays as a badge.
        // Domains are business (DDD), mapped by prefix or tag.
        domains: [
          {
            id: 'payments',
            name: 'Payments',
            version: '1.0.0',
            match: { prefix: 'com.acme.payments' }
          },
          {
            id: 'orders',
            name: 'Orders',
            version: '1.0.0',
            match: { tag: 'domain:orders' }
          },
        ],
        defaultDomain: { id: 'unassigned', name: 'Unassigned' },

        // Message type
        // 'event'   -> all schemas -> writeEvent()
        // 'command' -> all schemas -> writeCommand()
        // 'auto'    -> heuristic: -key suffix -> skip, -value -> event
        messageType: 'event',

        // Feature flags
        includeGovernance: true,
        includeChannels: true,
        includeAsyncAPI: true,
        includeTeams: true,
        includeReferences: true,

        // Filters
        filter: {
          prefix: null,
          excludePrefix: [],
          excludeTags: ['internal'],
        },

        debug: false,
      }
    ]
  ]
};
```

---

## 5. Generator — Execution logic

### 5.1 Pipeline

```
Phase 0: Fetch
  GET /export/eventcatalog -> JSON payload
  Apply filters (prefix, excludeTags)

Phase 1: Teams
  For each unique owner_team:
    -> writeTeam({ id: slug, name: original })

Phase 2: Domains
  For each domain in config:
    -> writeDomain({ id, name, version })
  + defaultDomain if configured

Phase 3: Events (or Commands)
  For each filtered schema:
    1. Resolve domain (prefix match -> tag match -> default)
    2. writeEvent({ id, name, version, summary, owners, badges, schemaPath, markdown })
    3. addSchemaToEvent(subject, schema_content, format)
    4. addEventToDomain(domain.id, subject)
    5. If asyncapi_yaml -> addFileToEvent('asyncapi.yaml')

Phase 4: Channels
  For each channel:
    1. writeChannel({ id, name, address, protocols })
    2. For each binding:
       -> addEventToChannel(channel.address, binding.subject)

Phase 5: References
  Documented in markdown (SDK doesn't support first-class inter-event links in V1)
```

### 5.2 Domain resolution

Resolved in priority order:

1. **PREFIX match**: subject starts with `domain.match.prefix`
2. **TAG match**: enrichment.tags contains `domain.match.tag`
3. **DEFAULT**: `defaultDomain` (if configured)
4. **SKIP**: no domain assigned

First match wins — order in the `domains[]` array matters.

### 5.3 Message type heuristic (mode `auto`)

```
subject ends with "-key"     -> SKIP (key schemas are not events)
subject ends with "-value"   -> writeEvent (stripped suffix in name)
subject without suffix       -> writeEvent (name as-is)
```

### 5.4 Versioning strategy

The generator uses an **upsert** strategy:

- Event exists with same version → **overwrite** (update markdown, badges, etc.)
- Event exists with lower version → **version** the old one, create the new one
- Event doesn't exist → **create**

This allows repeated `npm run generate` without duplication.

---

## 6. Markdown template

Each event in EventCatalog receives enriched markdown:

```markdown
{enrichment.description || 'No description provided.'}

## Governance

| Metric | Score |
|--------|-------|
| Overall | [green] 85/100 (B) |
| Enrichment | 18/20 |
| Rules | 42/50 |
| Schema Quality | 25/30 |

**Confidence**: high

## Rules

| Rule | Severity | Status |
|------|----------|--------|
| Naming convention | error | PASS |
| Description required | warning | WARN |

## Metadata

| Key | Value |
|-----|-------|
| Data Layer | `CORE` |
| Classification | `PII` |
| Format | AVRO |
| Versions | 3 |
| Provider | confluent_cloud |
| Registry | Production Confluent |

## References

| Schema | Version |
|--------|---------|
| com.acme.common.MoneyType | 1 |

---
*Synced from event7 — {timestamp}*
```

Score emoji: `>= 75` green, `>= 50` yellow, `< 50` red.

---

## 7. File structure

### 7.1 Backend (done)

```
backend/app/
  api/export.py           # Route GET /export/eventcatalog
  models/export.py        # Pydantic models
  main.py                 # +1 router include
```

### 7.2 Generator (planned)

```
generator-event7/
  src/
    index.ts              # Entry point (module.exports)
    event7-client.ts      # HTTP fetch /export/eventcatalog
    types.ts              # TS interfaces mirroring payload
    mappers/
      events.ts           # schema -> writeEvent + addSchema
      channels.ts         # channel -> writeChannel + addEvent
      teams.ts            # owner -> writeTeam
      domains.ts          # config matching -> writeDomain
    templates/
      event-markdown.ts   # Enriched markdown generation
  tests/
    mappers/
      events.test.ts
      channels.test.ts
      domains.test.ts
    fixtures/
      export-payload.json # Example payload for tests
  package.json
  tsconfig.json
  tsup.config.ts          # Build CJS
  vitest.config.ts
  LICENSE                 # Apache 2.0
  README.md
```

---

## 8. Architecture decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **data_layer != domain** | `data_layer` is a badge, not an EventCatalog domain | Grouping 200 schemas in a "RAW" domain loses business meaning. Domains = DDD concepts. |
| **1 endpoint vs N calls** | Single `GET /export/eventcatalog` | One HTTP call instead of `2 + N*5`. Simpler, faster, less timeout risk. |
| **CJS build** | tsup CJS output from ESM TypeScript source | EventCatalog uses `require()` for generators. Documented constraint. |
| **Upsert strategy** | Overwrite same version, version if changed | Allows repeated `npm run generate` without duplication. event7 is source of truth. |
| **owner_team -> team** | Mapped to EventCatalog teams, not services | event7 has no "service" concept. Services can be added manually or by another plugin. |
| **References in markdown** | Documented in markdown, not via SDK links | EventCatalog SDK doesn't support first-class inter-event links in V1. |

---

## 9. Licensing & distribution

| Aspect | Choice |
|--------|--------|
| Plugin license | Apache 2.0 (Community) |
| Publication | npm: `@event7/generator-eventcatalog` |
| Backend endpoint | Community tier (open-source) |

---

## 10. Roadmap

### V1 (MVP)

- [x] Backend endpoint `/export/eventcatalog`
- [ ] Generator: fetch + events + teams + channels + enriched markdown
- [ ] Domain mapping by prefix/tag
- [ ] Unit tests (mappers + templates)
- [ ] README with getting started

### V2

- [ ] Auto-detection `-key`/`-value` suffix (mode `auto`)
- [ ] Batch fetch schema_content (performance)
- [ ] Persist user markdown (merge instead of overwrite)
- [ ] Multi-registry support (loop over N registries)
- [ ] npm publication

### V3

- [ ] MCP server event7 for EventCatalog Chat
- [ ] Bidirectional sync (EventCatalog -> event7 enrichments)
- [ ] EventCatalog Studio integration
- [ ] Webhook/CI trigger (auto-generate on schema change)

---

## 11. Outreach

This plugin is a vector for contact with **David Boyne** (EventCatalog creator):

- Propose `generator-event7` as an official integration in `event-catalog/generators`
- Complementary positioning: EC = documentation, event7 = governance
- The plugin is open-source (Apache 2.0), no conflict with EC's commercial model
- Angle: "first governance-aware generator" — no other plugin brings scores, rules, and multi-broker support
