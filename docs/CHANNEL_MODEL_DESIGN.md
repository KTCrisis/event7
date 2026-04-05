# event7 — Channel Model — Design Document

**Version:** 1.1.0
**Date:** 13 mars 2026
**Authors:** Marc / Claude
**Status:** Implemented (Phase 1 Community)
**Last updated:** 5 avril 2026

**Changelog:**
- v1.1.0: Cross review. Added `resource_kind` on channels. Added `binding_selector` and `binding_status` on channel_subjects. `confluent_strategy` → `binding_origin` (generic). Clarified data_layer semantics (primary = subject, channel = hint). Formalized RabbitMQ scope ("producer-facing ingress, not full topology"). Auto-detect RNS: 4 visual statuses. Fix Pydantic `Field(default_factory=...)`.
- v1.0.0: Initial design — Channel abstraction, 3 messaging patterns, generalized Binding Strategy, data model, layer mapping RAW→APPLICATION, TNS auto-detect, multi-broker roadmap.

---

## Implementation status

| Component | Status | Notes |
|-----------|:------:|-------|
| DB tables `channels` + `channel_subjects` | **Done** | `bootstrap_postgresql.sql`, `bootstrap_supabase.sql` |
| Pydantic models + enums | **Done** | `models/channel.py` |
| `ChannelService` (CRUD + bindings) | **Done** | `services/channel_service.py` |
| API endpoints (CRUD + bindings + channel-map + reverse) | **Done** | `api/channels.py` |
| Auto-detect TNS heuristic | **Done** | `channel_service.py` |
| Frontend `/channels` page + detail | **Done** | `app/(dashboard)/channels/page.tsx`, `components/channels/channel-detail.tsx` |
| `data_layer` on enrichments | **Done** | Migration + Catalog UI |
| AsyncAPI multi-protocol bindings | **Done** | See [ASYNCAPI_GENERATOR_V2_DESIGN.md](ASYNCAPI_GENERATOR_V2_DESIGN.md) |
| 22 broker types (Tier 1+2+3) | **Done** | Extended beyond original 10 |
| Docs page | **Done** | `app/docs/channels/page.tsx` |
| Auto-detect Kafka API (Pro) | Planned | Requires Kafka REST Proxy credentials |
| Channel Map graphic (d3-force) | Planned | Extension of References Graph |
| Channel-level governance rules (Enterprise) | Planned | |
| Channel lineage DAG (Enterprise) | Planned | |

---

## 1. Context & motivation

### The problem

event7 was initially **Kafka-centric** in its channel vision:

- `topic_schema_mapper.py` detects TopicNameStrategy / RecordNameStrategy / TopicRecordNameStrategy — 100% Confluent concepts
- `asyncapi_service.py` generated specs with hardcoded `bindings.kafka`
- Frontend displayed "topics" everywhere, excluding RabbitMQ, Pulsar, NATS, Google Pub/Sub users
- The subject ↔ topic mapping was implicit (by naming convention) instead of an explicit data object

### The solution

A **Channel** model that:

1. **Abstracts transport** — a Channel can be a Kafka topic, RabbitMQ exchange, NATS subject, Pub/Sub topic, etc.
2. **Makes bindings explicit** — the subject ↔ channel link is a data object with strategy, role, selector
3. **Auto-detects when possible** — Kafka TNS is automatic, others are declarative (UI)
4. **Enriches AsyncAPI** — generated specs use real broker bindings
5. **Supports data layers** — each subject can be tagged with its layer (raw/core/refined/application)

### Design principles

1. **Schema Registry remains the source of truth for schemas.** The Channel Model doesn't change that.
2. **Channel is an event7 object**, stored in DB. Not read from a broker (except optional Kafka auto-detect).
3. **Subject ↔ channel binding is N:N.** A domain schema (CORE) can be linked to multiple channels.
4. **Provider-agnostic.** Works with Confluent, Apicurio, Glue, and even without a broker.
5. **Progressive.** Users can start without channels, then add manually or via auto-detect.

---

## 2. Core concepts

| Concept | Definition | Examples |
|---------|-----------|----------|
| **Channel** | A named message exchange point, linked to a broker and messaging pattern. Models the producer-facing ingress, not the full broker topology. | Kafka topic, RabbitMQ exchange, NATS subject |
| **Resource Kind** | Physical nature of the broker resource behind a Channel. | `topic`, `exchange`, `subject`, `queue`, `stream` |
| **Subject** | A schema registered in a Schema Registry. | `orders-value`, `com.acme.billing.InvoiceCreated.v1` |
| **Binding** | Explicit relationship between a Channel and a Subject, with strategy, role, and optional selector. | `orders` (channel) ↔ `orders-value` (subject) |
| **Binding Strategy** | Conceptual logic linking subject to channel. Generalization of TNS/RNS. | `channel_bound`, `domain_bound`, `app_bound` |
| **Binding Origin** | Concrete mode by which the binding was established. | `tns`, `trs`, `rns_heuristic`, `manual`, `routing_key` |
| **Binding Selector** | Optional filter specifying which sub-channel subset is covered. | `billing.invoice.*` (routing key), `eventType=InvoiceCreated` |
| **Binding Status** | Health state — does the referenced subject still exist? | `active`, `missing_subject`, `stale`, `unverified` |
| **Data Layer** | Data maturity/function. Primary layer lives on the subject (via enrichments). Channel layer is a UX hint. | `raw`, `core`, `refined`, `application` |

### Relationships

```
Registry (1) ------- (N) Channel
                          |
                          | N:N (via channel_subjects)
                          |
Registry (1) ------- (N) Subject (= schema in SR)
```

---

## 3. Messaging patterns

### `topic_log` — Ordered persistent log

**Brokers:** Kafka, Redpanda, Pulsar (persistent topics), Redis Streams

Ordered messages, configurable retention, N producers, N consumer groups, offset-based replay.

### `pubsub` — Fan-out / Event notification

**Brokers:** Google Pub/Sub, AWS SNS, NATS (core), Azure Event Grid

Fan-out: 1 message → N subscribers. Subscriber-side filtering.

### `queue` — Point-to-point / Work distribution

**Brokers:** RabbitMQ, AWS SQS, Azure Service Bus, ActiveMQ

One consumer per message (competing consumers). Complex routing (exchange types, routing keys).

> **Scope v1:** event7 models **producer-facing ingress channels**, not the full broker topology. For RabbitMQ, the Channel is the exchange, not the queue.

### Broker → pattern mapping

| Broker Type | Default Pattern | Possible Patterns |
|-------------|:--------------:|-------------------|
| `kafka` | `topic_log` | `topic_log` only |
| `redpanda` | `topic_log` | `topic_log` only |
| `pulsar` | `topic_log` | `topic_log`, `queue` |
| `redis_streams` | `topic_log` | `topic_log` only |
| `rabbitmq` | `queue` | `queue`, `pubsub` |
| `google_pubsub` | `pubsub` | `pubsub` only |
| `aws_sns_sqs` | `pubsub`/`queue` | `pubsub`, `queue` |
| `azure_servicebus` | `queue` | `queue`, `pubsub` |
| `nats` | `pubsub` | `pubsub`, `topic_log` (JetStream) |

---

## 4. Binding Strategy — TNS/RNS generalization

### The 3 universal strategies

#### `channel_bound` (= TopicNameStrategy)

Schema **coupled** to channel. Subject name derives from channel name. 1:1 relationship. Layer: **RAW**.

#### `domain_bound` (= RecordNameStrategy)

Schema represents a **business event**, independent of channel. N:N relationship. Layers: **CORE**, **REFINED**.

#### `app_bound` (RecordNameStrategy scoped to app)

Schema is an **application-specific view** of a business event. Layer: **APPLICATION**.

### Mapping

| Confluent Strategy | event7 Binding Strategy | Binding Origin | Auto-detect |
|-------------------|------------------------|:--------------:|:-----------:|
| TopicNameStrategy | `channel_bound` | `tns` | yes |
| RecordNameStrategy | `domain_bound` or `app_bound` | `rns_heuristic` / `manual` | partial |
| TopicRecordNameStrategy | `channel_bound` (variant) | `trs` | yes |

---

## 5. Data Layers

> **Semantic rule:** Primary layer lives on the **subject** (via `enrichments.data_layer`). Channel layer is a **UX hint**. In case of conflict, subject layer takes precedence.

| Layer | Binding Strategy | Subject Convention | Channel Coupling | Compatibility |
|-------|:---------------:|-------------------|:----------------:|:-------------:|
| `raw` | `channel_bound` | `<channel>-value/key` | 1:1 | BACKWARD_TRANSITIVE |
| `core` | `domain_bound` | `<domain>.<entity>.<v>` | N:N | FULL_TRANSITIVE |
| `refined` | `domain_bound` | `<domain>.<entity>.agg.*` | N:N | FULL_TRANSITIVE |
| `application` | `app_bound` | `<app>.<domain>.<entity>.<v>` | ~1:1 | BACKWARD/FORWARD |

---

## 6. Data model

### Tables

**`channels`**: id, registry_id, name, address, broker_type, resource_kind, messaging_pattern, broker_config (JSONB), data_layer, description, owner, tags, is_auto_detected, auto_detect_source, timestamps. Unique on (registry_id, address, broker_type).

**`channel_subjects`**: id, channel_id, subject_name, binding_strategy, schema_role, binding_origin, binding_selector, binding_status, last_verified_at, is_auto_detected, created_at. Unique on (channel_id, subject_name, schema_role).

### Enums

- **BrokerType**: 22 types across 3 tiers (see [ASYNCAPI_GENERATOR_V2_DESIGN.md](ASYNCAPI_GENERATOR_V2_DESIGN.md))
- **ResourceKind**: topic, exchange, subject, queue, stream
- **MessagingPattern**: topic_log, pubsub, queue
- **BindingStrategy**: channel_bound, domain_bound, app_bound
- **BindingOrigin**: tns, trs, rns_heuristic, kafka_api, routing_key, attribute_filter, manual
- **BindingStatus**: active, missing_subject, stale, unverified
- **DataLayer**: raw, core, refined, application
- **SchemaRole**: value, key, header, envelope

### broker_config examples

**Kafka:** `{ "partitions": 6, "replication_factor": 3, "retention_ms": 604800000, "cleanup_policy": "delete" }`

**RabbitMQ:** `{ "exchange_type": "topic", "routing_key_pattern": "billing.invoice.*", "durable": true }`

**Google Pub/Sub:** `{ "message_retention_duration": "604800s", "schema_settings": { "encoding": "JSON" } }`

**NATS:** `{ "jetstream": true, "stream_name": "BILLING", "max_msgs": 1000000 }`

---

## 7. API endpoints

### Channels CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/registries/{id}/channels` | List channels (with subject_count) |
| GET | `/registries/{id}/channels/{channel_id}` | Channel detail with bindings |
| POST | `/registries/{id}/channels` | Create channel |
| PUT | `/registries/{id}/channels/{channel_id}` | Update channel |
| DELETE | `/registries/{id}/channels/{channel_id}` | Delete channel (cascades) |

### Bindings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/registries/{id}/channels/{channel_id}/subjects` | List bindings for channel |
| POST | `/registries/{id}/channels/{channel_id}/subjects` | Create binding |
| DELETE | `/registries/{id}/channels/{channel_id}/subjects/{binding_id}` | Delete binding |
| GET | `/registries/{id}/subjects/{subject}/channels` | Reverse lookup |

### Auto-detect & aggregation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/registries/{id}/channels/auto-detect` | Run TNS heuristic detection |
| GET | `/registries/{id}/channel-map` | Full view: channels + subjects + bindings + layers |

---

## 8. Auto-detection

### TNS heuristic (Community — implemented)

1. List all subjects
2. Subjects ending `-value`/`-key` → **TNS**: create channel, bind as `channel_bound`
3. Subjects matching `{topic}-{namespace.Record}` → **TRS**: create channel, bind with `binding_selector`
4. Subjects matching `word.word.word+` → **RNS candidate**: flag as `candidate_domain`, no channel created
5. Rest → `unbound`

**Key rule:** auto-detect never creates `domain_bound` bindings automatically — it suggests, user confirms.

### Kafka API (Pro — planned)

Uses Kafka REST Proxy / Admin API to list real topics with metadata (partitions, replication, retention).

### Re-detection

- Auto-detected channels are upserted (on registry_id + address + broker_type)
- Manual channels/bindings are never touched

---

## 9. Frontend

### `/channels` page

List with filters (broker_type, data_layer, messaging_pattern). Each channel shows: name, address, broker icon, pattern badge, subject count. Click → detail with binding list.

### Catalog enrichment

- Data layer badge (from `enrichments.data_layer`)
- Associated channels with broker icon + binding_status indicator
- Binding strategy badge
- Classification status for unbound subjects

### Dashboard metrics

- Channels by broker type (donut)
- Channels by data layer (bar)
- Orphan subjects (no channel)
- Coverage: % subjects with >= 1 binding
- Binding health: % active vs missing/stale

---

## 10. Roadmap

### Phase 1 — Community (done)

Channel model core: DB, service, API, frontend, TNS auto-detect, AsyncAPI multi-protocol, data_layer on enrichments, 22 broker types.

### Phase 2 — Pro (planned)

Kafka API auto-detect, RabbitMQ exchange/routing_key bindings, Cloud broker configs, Channel Map visualization, multi-broker AsyncAPI.

### Phase 3 — Enterprise (planned)

Channel-level governance rules, channel lineage DAG, channel health monitoring, cross-registry mapping.

---

## 11. Known limitations (v1)

1. **No real broker connection in Community.** Channels are declarative. TNS auto-detect is purely heuristic.
2. **Producer-facing ingress only.** No full broker topology (exchange → queue → consumer).
3. **Subject layer != channel layer.** Subject layer (enrichments) takes precedence. Channel layer is a UX hint.
4. **Layer heuristic limited.** Auto-detect can't guess RNS data layers. Must be assigned manually.
5. **RNS auto-detect doesn't create bindings.** Flags as `candidate_domain`, user confirms.
6. **Binding status checked on demand.** Not real-time. Can be stale between verifications.

### Service warnings (non-blocking)

| Case | Warning |
|------|---------|
| `channel_bound` subject linked to 5+ channels | "Consider domain_bound" |
| `raw` subject marked `domain_bound` | "RAW subjects are typically channel_bound" |
| `app_bound` subject without app name in subject | "App-bound subjects typically contain an application name prefix" |
| Active binding pointing to missing subject | Status automatically set to `missing_subject` |

### Future extensions

Channel Templates, Naming Convention Engine, Channel Lineage, AsyncAPI Import (done — see [ASYNCAPI_GENERATOR_V2_DESIGN.md](ASYNCAPI_GENERATOR_V2_DESIGN.md)), CloudEvents envelope support, binding health cron, full broker topology (Enterprise).
