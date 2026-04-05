# Schema Registry Providers — Comparative Study

> Reference document for multi-provider integration
> **Date:** 12 mars 2026
> **Scope:** Confluent SR, Redpanda SR, Karapace, Apicurio
> **Last updated:** 5 avril 2026

---

## 1. Overview

| Criteria | Confluent SR | Redpanda SR | Karapace | Apicurio v3 |
|----------|:-----------:|:-----------:|:--------:|:-----------:|
| **Creator** | Confluent | Redpanda Data | Aiven (OSS) | Red Hat (OSS) |
| **License** | Community License | BSL 1.1 / Proprietary | Apache 2.0 | Apache 2.0 |
| **Language** | Java (JVM) | C++ (embedded) | Python (async) | Java (Quarkus) |
| **Separate process** | Yes | No (in broker) | Yes | Yes |
| **Confluent API** | Native | Compatible 6.1.1+ | Compatible 6.1.1 | Via /apis/ccompat/v7 |
| **Formats** | Avro, Protobuf, JSON Schema | Avro, Protobuf, JSON Schema | Avro, Protobuf, JSON Schema | Avro, JSON, Protobuf, OpenAPI, AsyncAPI |
| **Storage** | Kafka topic `_schemas` | Kafka topic (embedded) | Kafka topic `_schemas` | PostgreSQL, Kafka, mem |
| **event7 status** | **Production** | **Via Confluent provider** | **Via Confluent provider** | **Production** (native provider) |

---

## 2. API Compatibility

### Core endpoints (all providers)

All four providers support the full core API: `GET /subjects`, `POST /subjects/{subject}/versions`, `GET /subjects/{subject}/versions/{version}`, `DELETE /subjects/{subject}`, `GET /schemas/ids/{id}`, compatibility check, config get/set.

Compatibility modes supported uniformly: BACKWARD, BACKWARD_TRANSITIVE, FORWARD, FORWARD_TRANSITIVE, FULL, FULL_TRANSITIVE, NONE.

### Key differences

| Feature | Confluent | Redpanda | Karapace | Apicurio |
|---------|:---------:|:--------:|:--------:|:--------:|
| Schema references (Avro/Protobuf) | yes | yes | yes | yes |
| JSON Schema `$ref`/`$defs` | yes | rejected if compat != NONE | yes | yes |
| Normalize `?normalize=true` (Avro) | yes | yes | no | partial |
| Mode API (`/mode` IMPORT/READONLY) | yes | yes | no | no (v3 has own import) |
| Catalog API (tags, metadata) | yes (paid SG) | no | no | labels + rules (basic) |
| Schema Linking / multi-DC | yes (Enterprise) | yes (Shadowing) | no | no |
| Broker-side wire format validation | yes | yes | no | N/A |
| Data contracts (migration/domain rules) | yes (Advanced) | no | no | artifact rules |

### Authentication

| Mechanism | Confluent | Redpanda | Karapace | Apicurio |
|-----------|:---------:|:--------:|:--------:|:--------:|
| HTTP Basic Auth | yes | yes | yes | yes |
| mTLS | yes | yes | yes | yes |
| OAuth2 / OIDC | yes (MDS) | no | yes | yes |
| API Keys | yes (Cloud) | yes (Cloud) | yes (Aiven) | N/A |

event7 stores credentials encrypted (AES-256 Fernet). Compatible with Basic Auth on all providers.

---

## 3. Governance gap — event7 value proposition

| Feature | Confluent SG | Redpanda | Karapace | Apicurio | event7 |
|---------|:----------:|:--------:|:--------:|:--------:|:------:|
| Tags / Classification | yes (paid) | **none** | **none** | labels | **yes (free)** |
| Ownership | yes (paid) | **none** | **none** | **none** | **yes (free)** |
| Business descriptions | yes (paid) | **none** | **none** | **none** | **yes (free)** |
| Governance rules | yes (paid) | **none** | **none** | basic | **yes (free)** |
| Visual diff | **none** | **none** | **none** | **none** | **yes** |
| AsyncAPI generation | CLI only | **none** | **none** | **none** | **yes** |
| References graph | **none** | **none** | **none** | **none** | **yes** |
| Dashboard KPIs | **none** | **none** | **none** | **none** | **yes** |

**Key message:** What Confluent charges in Stream Governance, event7 offers for free and works with all registries.

---

## 4. Provider integration strategy

### Implementation matrix

| event7 Provider | Implementation | Status |
|-----------------|---------------|:------:|
| Confluent SR (Cloud + Platform) | `ConfluentProvider` | **Done** |
| Apicurio v3 | `ApicurioProvider` (native + ccompat) | **Done** |
| Karapace (Aiven + self-hosted) | Reuses `ConfluentProvider` | **Done** (UI dropdown) |
| Redpanda SR (Cloud + self-managed) | Reuses `ConfluentProvider` | **Done** (UI dropdown) |
| AWS Glue SR | New provider needed | Planned (P2) |
| Azure SR (Event Hubs) | New provider needed | Planned (P3) |

### Provider-specific gotchas

| Provider | Gotcha |
|----------|--------|
| **Confluent** | Error 40408 = no subject-level config, fallback to global config |
| **Apicurio** | ccompat path is `/apis/ccompat/v7` (with 's'), NOT `/api/ccompat/v7` |
| **Apicurio** | Has TWO config systems: native v3 API + ccompat API — must configure both |
| **Apicurio** | References must be inside `content` block (silently ignored otherwise) |
| **Apicurio** | Health check: use `/apis/registry/v3/system/info`, not generic endpoint |
| **Karapace** | No Avro/JSON Schema normalization — identical schemas may get different IDs |
| **Karapace** | No IMPORT mode — migration must operate on `_schemas` topic directly |
| **Redpanda** | JSON Schema with `$ref`/`$defs` rejected unless compat = NONE |
| **Redpanda** | v25.3 breaking change: can't specify custom schema ID in READWRITE mode |

### All event7 features work with all providers

Schema Explorer, Diff Viewer, Catalog (enrichments), Dashboard, AsyncAPI generation, References graph, AI Agent, Governance Rules, Channels, Schema Validator — all provider-agnostic via event7 DB.

---

## 5. Performance (order of magnitude)

| Metric | Confluent | Redpanda | Karapace |
|--------|:---------:|:--------:|:--------:|
| Latency (50 conn, 50K req) | ~7ms | Similar (C++) | ~81ms |
| Latency (4 conn, 50K req) | ~5.7ms | Similar | ~6.5ms |
| RAM (1 consumer) | ~200MB | Embedded | ~47MB |
| Startup | Slow (JVM) | Fast (C++) | Fast (Python) |

Impact on event7: negligible. API calls (list subjects, get schemas) are infrequent and not latency-critical.

---

## 6. Managed offerings

| | Confluent Cloud | Redpanda Cloud | Aiven (Karapace) |
|--|:-:|:-:|:-:|
| SR setup | Integrated | Toggle on/off | Toggle on/off |
| Catalog/Governance | SG Essentials (some plans) + Advanced (paid) | None | None |
| Auth | API Keys | API Keys | CLI / Terraform |
| Multi-DC | Schema Linking (Enterprise) | Shadowing | Manual |

---

## 7. References

| Resource | URL |
|----------|-----|
| Confluent SR API | docs.confluent.io/platform/current/schema-registry/develop/api.html |
| Redpanda SR API | docs.redpanda.com/api/doc/schema-registry/ |
| Karapace GitHub | github.com/Aiven-Open/karapace |
| Apicurio Registry | apicur.io/registry/ |
