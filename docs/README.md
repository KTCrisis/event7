# event7 — Documentation Index

## Product & Strategy

- [PRODUCT_SPEC.md](PRODUCT_SPEC.md) — Vision, pricing, personas, hosted registry tier, security
- [GO_TO_MARKET.md](GO_TO_MARKET.md) — Competitive landscape, GTM phases, distribution channels, metrics

## Architecture

- [ARCHITECTURE.md](ARCHITECTURE.md) — Project structure, layers, dual-mode (SaaS/self-hosted), conventions
- [SCHEMA_REGISTRY_PROVIDERS.md](SCHEMA_REGISTRY_PROVIDERS.md) — Confluent vs Redpanda vs Karapace vs Apicurio, API compat, gotchas

## Features — Design Documents

- [GOVERNANCE_RULES_ENGINE.md](GOVERNANCE_RULES_ENGINE.md) — Rules, policies, templates, scoring, session history
- [RULE_EDITOR_BEHAVIOR.md](RULE_EDITOR_BEHAVIOR.md) — Scope-adaptive form (visibility matrix, auto-defaults, placeholders)
- [CONTEXTUAL_SEVERITY.md](CONTEXTUAL_SEVERITY.md) — How severity adjustment works today (delta-based, 3 factors)
- [SEVERITY_SCORING_DESIGN.md](SEVERITY_SCORING_DESIGN.md) — Full scoring vision (exposure score, semantic risk detector, verdict matrix)
- [SCHEMA_VALIDATOR_DESIGN.md](SCHEMA_VALIDATOR_DESIGN.md) — Validation pipeline (compatibility + rules + diff → verdict)
- [CHANNEL_MODEL_DESIGN.md](CHANNEL_MODEL_DESIGN.md) — Channel abstraction, 22 brokers, binding strategy, data layers
- [ASYNCAPI_GENERATOR_V2_DESIGN.md](ASYNCAPI_GENERATOR_V2_DESIGN.md) — Protocol-aware generation, 22 brokers, round-trip fidelity
- [ASYNCAPI_DUAL_MODE_DESIGN.md](ASYNCAPI_DUAL_MODE_DESIGN.md) — Overview tab, import/generate modes, drift detection
- [SCHEMA_EVOLUTION_DESIGN.md](SCHEMA_EVOLUTION_DESIGN.md) — Version timeline in Schema Explorer
- [REFERENCES_GRAPH_V2_DESIGN.md](REFERENCES_GRAPH_V2_DESIGN.md) — Transitive chain, enriched panel, layout modes, export
- [EVENTCATALOG_PLUGIN_DESIGN.md](EVENTCATALOG_PLUGIN_DESIGN.md) — Generator plugin for EventCatalog
- [AI_AGENT.md](AI_AGENT.md) — AI architecture (SSE streaming, context injection, tools, frontend)

## Operations

- [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) — Backend deployment (Railway + Supabase + Redis)
- [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) — Frontend deployment (Cloudflare Pages + OpenNext)
- [TESTING.md](TESTING.md) — Test structure, commands, coverage gaps
