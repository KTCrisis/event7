# event7 — Go-to-Market Strategy & Competitive Landscape

> Strategic document — Mars 2026
> **Status:** Living document — update after each phase
> **Last updated:** 5 avril 2026

---

## 1. Positioning

**One-liner:** _"The governance layer missing from every Schema Registry — free, open, multi-provider."_

**Value proposition:**
- Business enrichments (tags, ownership, description, classification) stored in event7 DB, not the SR — making the platform provider-independent
- What Confluent charges in Stream Governance, event7 offers for free in Community tier
- Compatible with the full ecosystem: Confluent, Redpanda, Karapace, Apicurio

---

## 2. Competitive Landscape

### 2.1 Schema Registry providers (event7 data sources)

| Provider | Governance native | event7 position |
|----------|------------------|-----------------|
| **Confluent SR** | Tags, metadata via Stream Governance (paid) | Free complement for SG features |
| **Redpanda SR** | None — no Catalog API | event7 fills 100% of the gap |
| **Karapace** (Aiven) | None | event7 fills 100% of the gap |
| **Apicurio v3** | Basic labels + rules | event7 adds business layer |
| **AWS Glue SR** | IAM tags, no schema catalog | event7 unifies with others |
| **Azure SR** | Minimal | event7 enriches |

### 2.2 Kafka platforms (operational layer)

| Actor | SR Governance | event7 position |
|-------|--------------|-----------------|
| **Conduktor** | SR = basic tab. No diff, no graph, no AsyncAPI. Data quality via Gateway proxy. | **Coexistence.** "Conduktor manages your clusters. event7 manages your schemas." |
| **Lenses.io** | Data Catalog oriented topics (not schemas). MCP + AI agents for topic governance. | **Coexistence.** Lenses covers breadth, event7 goes deep on schemas. |
| **AKHQ** (8.9K stars) | SR = subject list + versions. No enrichment, no diff, no graph. | **Complementary.** AKHQ users who want more on schemas = event7 persona. |
| **Kafka UI** (10K+ stars) | Same as AKHQ — basic SR. | **Complementary.** |
| **Redpanda Console** | Basic SR, no governance. | **Complementary.** |

### 2.3 EDA documentation & catalogs

| Actor | Link with event7 |
|-------|-------------------|
| **EventCatalog** (David Boyne) | **Natural partner.** EC documents macro architecture. event7 governs micro (schemas, live enrichments). Plugin `generator-event7` is the bridge. |
| **Backstage** (Spotify) | **Plugin possible.** Display event7 enrichments in the developer portal. Medium effort, high impact. |
| **DataHub** / **OpenMetadata** | **Long-term bridge.** event7 as active enrichment source feeding data catalogs. |

### 2.4 Specs & communities

| Actor | Link with event7 |
|-------|-------------------|
| **AsyncAPI** | **Priority ecosystem.** event7 generates AsyncAPI specs from any SR — unique feature. Tools listing, blog, Slack, conferences. |
| **CloudEvents** (CNCF) | Watch. Relevant if event7 expands beyond SR schemas. |
| **xRegistry** | Watch. David Boyne follows this project. |

---

## 3. Differentiation matrix

| Feature | Confluent SG | Conduktor | Lenses | EventCatalog | event7 |
|---------|:-----------:|:---------:|:------:|:------------:|:------:|
| Schema Explorer live | yes | Basic | Basic | Via plugin | Advanced |
| Visual Diff (field-level) | no | no | no | no | **yes** |
| Tags / Classification | yes (paid) | no | yes (topics) | yes (markdown) | **yes (free, live)** |
| Ownership | yes (paid) | no | no | yes (markdown) | **yes (free, live)** |
| Dashboard KPIs | no | no | no | no | **yes** |
| AsyncAPI generation from SR | CLI only | no | no | Via plugin | **yes (UI + API)** |
| References graph | no | no | no | yes | **yes** |
| AI Agent (schema governance) | no | no | MCP (topics) | MCP (architecture) | **yes** |
| Governance Rules agnostic | yes (paid) | yes (Gateway) | no | no | **yes (free)** |
| Multi-provider SR | no | yes (3) | yes (2) | yes (plugins) | **yes (4+)** |
| Open-source | no | no | Community | yes | **yes Apache 2.0** |

---

## 4. Target personas

### Primary — Kafka/Streaming team without Stream Governance

Uses Confluent, Redpanda, or Karapace. 50-500+ schemas. No SG license (too expensive) or no governance at all. event7 solves the problem in 5 minutes.

### Secondary — EDA architect / Data Governance lead

Responsible for data governance strategy. Needs unified view across multi-cluster/multi-provider. event7 as governance layer feeding existing tools (Backstage, DataHub, EventCatalog).

### Tertiary — Kafka consultant / integrator

Confluent partner, Kafka integrator, freelance. Deploys event7 at clients as mission accelerator. NexDigital is in this persona.

---

## 5. Go-to-Market phases

### Phase 1: Field validation (Now → +1 month)

| Action | Detail |
|--------|--------|
| Deploy on NexDigital mission | Install event7 Community on Confluent Cloud cluster |
| Internal NexDigital demo | Present to management, propose as mission tool |
| Clarify legal framework | Check NexDigital contract (IP clauses) |
| Collect feedback | 5+ qualitative feedbacks from colleagues and clients |

### Phase 2: Public launch (+1 month → +2 weeks)

| Action | Detail |
|--------|--------|
| GitHub repo public | README with screenshots/GIFs, badges, CONTRIBUTING.md, Apache 2.0 |
| Demo video 3-5 min | "event7 in 5 minutes: from zero to schema governance" |
| Show HN | "Show HN: event7 — Open-source schema registry governance for Kafka" |
| Reddit r/apachekafka | Technical post, show diff viewer + multi-provider matrix |
| Product Hunt | Coordinated launch day |
| Awesome Lists | Submit to 5+ lists (awesome-kafka, awesome-event-driven, awesome-asyncapi...) |

### Phase 3: Community infiltration (+1 month)

| Action | Detail |
|--------|--------|
| AsyncAPI tools listing | Submit to asyncapi.com/tools |
| AsyncAPI blog post | "Generating AsyncAPI specs from any Schema Registry with event7" |
| Contact David Boyne | Propose generator-event7 plugin |
| Apicurio GitHub discussion | "event7 — governance UI compatible with Apicurio v3" |
| Redpanda Slack + blog | Present event7 as tool filling their governance gap |
| AKHQ + Kafka UI GitHub | Open integration discussions |

### Phase 4: Content & SEO (Continuous)

Blog posts (SR comparison, architecture, value prop), LinkedIn 1 post/week, dedicated blog.

### Phase 5: Enterprise ecosystem (+2 months)

Confluent Community blog, Partner listing, SE contact, MCP Server, Backstage plugin.

### Phase 6: Meetups & conferences (Continuous)

Paris Kafka Meetup, AsyncAPI Conf 2026, Devoxx France, co-webinars with partners.

### Phase 7: Long term (6+ months)

DataHub/OpenMetadata connector, Buf BSR provider, bidirectional EventCatalog plugin, AWS Glue SR provider, Terraform Provider, GitHub Action.

---

## 6. Distribution channels — Priority

| Priority | Channel | Type |
|:--------:|---------|------|
| P0 | NexDigital mission | Direct |
| P1 | GitHub (public repo) | Organic |
| P1 | HN / Reddit / Product Hunt | Launch |
| P1 | AsyncAPI (tools + blog + Slack + conf) | Community |
| P2 | EventCatalog (plugin + co-marketing) | Partnership |
| P2 | LinkedIn + Medium/dev.to | Content |
| P3 | Confluent (blog + Hub + SE) | Enterprise |
| P3 | Apicurio / Redpanda / Karapace (GitHub) | Niche community |
| P4 | Backstage plugin + MCP Server | Integration |
| P5 | Terraform Provider + GitHub Action | DevOps |
| P5 | DataHub / OpenMetadata connector | Data catalog |

---

## 7. Success metrics

| Timeframe | Targets |
|-----------|---------|
| 0-2 months | 1 NexDigital case study, 50+ GitHub stars, demo video, README with screenshots |
| 2-4 months | 200+ stars, listed on asyncapi.com, 1+ external blog post, EventCatalog plugin |
| 4-6 months | 500+ stars, 1+ talk given, MCP Server published, first external user |
| 6-12 months | 1000+ stars, first Pro client, 3+ integrations, CFP accepted at major conference |

---

## 8. Risks

| Risk | Impact | Probability | Mitigation |
|------|:------:|:-----------:|------------|
| Confluent launches free SG tier | High | Low | Stay multi-provider. Confluent won't do free multi-provider. |
| Conduktor/Lenses add advanced SR features | Medium | Medium | Go deeper faster (diff, graph, AI, AsyncAPI). Stay specialized. |
| EventCatalog adds live SR connection | Medium | Low | Be the official plugin before they do it themselves. |
| IP issue with NexDigital | High | Low if transparent | Clarify now. Present event7 as asset for NexDigital. |
| Burnout (solo developer) | High | Medium | Prioritize severely. Community contributions after public launch. |
| No adoption after launch | High | Low if executed well | Have NexDigital case study BEFORE public launch. |

---

## 9. Key messages by audience

| Audience | Message |
|----------|---------|
| Confluent teams | "The free SR governance that Stream Governance charges you for." |
| Redpanda / Karapace teams | "The governance layer you're completely missing." |
| AsyncAPI community | "Generate AsyncAPI specs from any Schema Registry." |
| EventCatalog | "Feed your catalog with live SR metadata." |
| Conduktor / Lenses users | "Go deeper on your schemas — diff, graph, AI, governance." |
| AKHQ / Kafka UI users | "The next step after the basic Kafka UI." |
| Platform engineers (Backstage) | "Schema governance in your developer portal." |

---

## 10. Current progress

| Phase | Status | Notes |
|:-----:|:------:|-------|
| 1 — Field validation | Partial | Product built, no mission deployment yet |
| 2 — Public launch | Started | Reddit post done (1 thread r/apachekafka, 4 stars, 25 clones) |
| 3 — Community | Not started | |
| 4 — Content & SEO | Not started | |
| 5 — Enterprise | Not started | |
| 6 — Meetups | Not started | |
| 7 — Long term | Not started | |
