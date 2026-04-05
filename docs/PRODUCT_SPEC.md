# event7 — Product Specification

> Universal Schema Registry Governance
>
> **Version:** 1.1 — Mars 2026
> **Status:** Foundation document — strategic reference
> **Last updated:** 5 avril 2026

---

## 1. Executive Summary

event7 is a provider-agnostic Schema Registry governance platform. It provides a unified interface to explore, validate, and govern event schemas regardless of the registry used (Confluent, Apicurio, AWS Glue, Pulsar, etc.).

In addition to overlay governance, event7 will offer a Hosted Registry tier based on Apicurio (Apache 2.0) for users without Schema Registry infrastructure — targeting RabbitMQ, ActiveMQ, and JMS users who have no native schema management solution.

---

## 2. Vision

### Problem

- No unified visibility when multiple registries coexist
- AsyncAPI documentation inexistent or manually maintained, always outdated
- Governance (compatibility, tags, ownership) fragmented and not centralized
- Breaking changes detected too late in the development cycle
- RabbitMQ/ActiveMQ/JMS users have zero schema management tooling

### Solution

A single platform that connects to any Schema Registry and exposes a consolidated view with event catalog, visual diff, AsyncAPI generation, and business enrichments. For users without a registry, event7 provides one for free.

### Personas

| Persona | Primary need | Key pages |
|---------|-------------|-----------|
| Developer | Track schema evolution, diffs, references | Schema Explorer, Diff, References |
| Business / Domain | Event catalog, ownership, data classification | Catalog, AsyncAPI, Governance |
| Ops / Platform | Registry without infra, quick onboarding, monitoring | Settings, Dashboard, Hosted Registry |

---

## 3. Schema Registry Landscape

### External registries (REST API standalone)

| Registry | Creator | License | Confluent API | Storage |
|----------|---------|---------|:-------------:|---------|
| Confluent SR | Confluent | BSL 1.1 | Native | Kafka (internal) |
| Karapace | Aiven | Apache 2.0 | Drop-in | Kafka only |
| Apicurio | Red Hat | Apache 2.0 | Yes (/ccompat) | PostgreSQL, Kafka, mem |
| AxonOps SR | AxonOps | Apache 2.0 | Yes | PostgreSQL, Cassandra |
| AWS Glue SR | AWS | Proprietary | No | AWS managed |
| Azure SR | Microsoft | Proprietary | No | Azure managed |

### Broker-integrated registries

| Technology | API | Formats | Notes |
|------------|-----|---------|-------|
| Pulsar | REST admin | Avro, JSON, Protobuf | Stored in BookKeeper, coupled to broker |
| Redpanda | Confluent compat | Avro, JSON, Protobuf | Integrated, not standalone |
| Google Pub/Sub | GCP API | Avro, Protobuf | GCP managed, proprietary API |

### Technologies without native Schema Registry

| Technology | Typical approach |
|------------|-----------------|
| RabbitMQ | App-level validation or external registry (Apicurio) |
| ActiveMQ / JMS | Schemas in application code, no central registry |
| NATS | Client-side validation, no governance |
| ZeroMQ | Low-level protocol, no schema management |

### Three addressable market segments

1. **Governance overlay** — Users of Confluent, Apicurio, AWS Glue, Pulsar who have a registry but lack unified governance tooling. Core of the MVP.
2. **Hosted Registry** — Users of self-managed Kafka (Strimzi, MSK, Redpanda) without a Schema Registry or wanting an open-source alternative to Confluent.
3. **Registry-as-a-Service** — Users of RabbitMQ, ActiveMQ, JMS with no native solution, who could use event7 as a central data contract registry.

event7 is the only platform positioned to address all three segments simultaneously.

---

## 4. Pricing model

Freemium with two onboarding modes:

**Connect (BYOR):** user connects their existing registry. Free: 1 registry, 50 schemas.

**Hosted:** automatic provisioning of a hosted Apicurio. Free: 1 hosted registry, 50 schemas, zero configuration.

| Feature | Free | Starter | Enterprise |
|---------|------|---------|------------|
| Connect registry | 1 | 5 | Unlimited |
| Hosted registry | 1 (50 schemas) | 3 (500 schemas) | Dedicated per tenant |
| Formats | Avro, JSON Schema | + Protobuf | All |
| Enrichments | Description, owner | + tags, classification | + custom metadata |
| AsyncAPI | Auto generation | + manual editing | + CI/CD export |
| Auth | Email/password | + OAuth | + SSO SAML/OIDC |
| Support | Community | Email | SLA + dedicated |

---

## 5. Positioning

### 5-layer model

| Layer | Role | Examples |
|:-----:|------|---------|
| 1 | Infra / Broker | Kafka, RabbitMQ, Pulsar, NATS |
| 2 | Schema Registry | Confluent SR, Apicurio, AWS Glue |
| **3** | **Governance** | **event7** |
| 4 | Spec / Contract | AsyncAPI, CloudEvents, OpenAPI |
| 5 | Documentation | EventCatalog, Backstage |

### vs competitors

| Tool | L1 | L2 | L3 | L4 | L5 | Lock-in |
|------|:--:|:--:|:--:|:--:|:--:|---------|
| Confluent SG | Kafka | yes | yes | — | — | Confluent |
| Conduktor | Kafka | — | ~ | — | — | Kafka |
| Lenses.io | Kafka | — | ~ | — | — | Kafka |
| Solace Portal | Solace | yes | yes | yes | yes | Solace |
| Backstage | Plugin | — | — | — | yes | — |
| EventCatalog | — | — | — | Read | yes | — |
| **event7** | **9+ brokers** | **R/W** | **Core** | **R/W** | **yes** | **None** |

### Two missions, one platform

- **Explore** (devs): visual diff, breaking change detection, references graph, technical + functional validation
- **Govern** (business): enrichments, rules, scoring, channels, AsyncAPI, ownership, classification

### Bidirectional pipeline

```
Schema Registry  <->  event7  <->  AsyncAPI / CloudEvents  ->  EventCatalog / Backstage
```

---

## 6. Hosted Registry Tier (post-MVP)

### Why Apicurio

- **Apache 2.0 license** — commercial use without restriction
- **PostgreSQL storage** — compatible with existing infra (Supabase/PG)
- **Confluent-compatible API** — `/api/ccompat` lets existing clients connect unchanged
- **Multi-format** — Avro, JSON Schema, Protobuf, OpenAPI, AsyncAPI natively
- **Lightweight Docker image** — deployable in mem (demo), sql (production), or kafkasql

Karapace rejected (requires Kafka for storage — circular dependency). Redpanda registry not standalone.

### Multi-tenant architecture

**Strategy A — Shared Apicurio, groupId isolation (MVP of tier)**
- Single Apicurio instance with shared PostgreSQL
- Each tenant has dedicated groupId: `tenant-{user_id}`
- Logical isolation, minimal cost (~30-50 EUR/month)

**Strategy B — Dedicated Apicurio per tenant (Enterprise, future)**
- One Apicurio container per client, physical isolation
- Guaranteed SLA, dedicated backup, independent scaling
- Requires dynamic orchestration (Kubernetes)

### Onboarding UX

Dashboard empty state shows two cards:
- **Connect Registry** — "Bring your own URL and credentials"
- **Create Free Registry** — "No infrastructure? We host it for you. Ready in seconds."

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/registries/hosted` | Provision hosted Apicurio (create groupId, store in DB) |
| DELETE | `/api/v1/registries/hosted/{id}` | Deprovision (delete groupId + associated data) |

### Infrastructure targets

| Component | MVP SaaS | Hosted Beta | Scale |
|-----------|----------|-------------|-------|
| Frontend | Cloudflare Pages | Cloudflare Pages | Cloudflare Pages |
| Backend API | Railway | Railway | GKE / EKS |
| Database | Supabase Cloud | Supabase Cloud | Cloud SQL |
| Apicurio | N/A | GKE Autopilot | GKE multi-region |
| Infra cost | ~20 EUR/month | ~50-80 EUR/month | Variable |

---

## 7. Security

- Authentication: Supabase Auth (email/password + OAuth Google/GitHub)
- Authorization: RLS PostgreSQL, complete isolation by user_id
- Registry credentials: AES-256-GCM encryption (Fernet), key in env var
- Transport: HTTPS mandatory (TLS 1.3)
- API: rate limiting, strict Pydantic validation, configured CORS
- Audit: logging of all user actions
- Multi-tenant: user_id application filtering + Supabase RLS policies

---

## 8. Post-MVP Roadmap

### Additional providers

ApicurioProvider (done), AWS Glue SR, Pulsar SR, Karapace, Google Pub/Sub, Azure SR

### Technical features

- Protobuf format
- RBAC (team roles, granular permissions)
- Enterprise SSO (SAML / OIDC)
- Advanced multi-tenant (shared workspaces, invitations)
- CI/CD integrations (GitHub Actions, GitLab CI)
- Public REST API
- Notifications (breaking changes, undocumented schemas)
- CloudEvents support
- Provisioning (topic creation, ACLs)

---

## Changelog

**v1.1 — 11 Mars 2026**
- Added section: Schema Registry landscape (market cartography)
- Added section: Hosted Registry Tier (architecture, UX, pricing, infra)
- Updated pricing with Connect and Hosted modes
- Added Ops / Platform persona
- Added RabbitMQ/ActiveMQ/JMS problem statement
- Apicurio added to tech stack

**v1.0 — Mars 2026**
- Initial MVP specification
