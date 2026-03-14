# @event7/generator-eventcatalog

> EventCatalog generator for [event7](https://github.com/KTCrisis/event7) — import governance data, enrichments, channels, and scores into your EventCatalog.

## What it does

This generator connects to your event7 instance and imports:

- **Schemas** as events (or commands) with full Avro/JSON Schema content
- **Enrichments** — description, tags, classification, data layer as badges
- **Governance scores** — 3-axis scoring (enrichment, rules, schema quality) in markdown
- **Rules summary** — conformity status per schema
- **Channels** — Kafka topics, RabbitMQ exchanges, etc. with subject bindings
- **Teams** — from owner_team assignments
- **AsyncAPI specs** — attached to events when available

This is the **first governance-aware generator** for EventCatalog.

## Quick Start

### 1. Install

```bash
cd my-eventcatalog
npm install @event7/generator-eventcatalog
```

### 2. Configure

```js
// eventcatalog.config.js
export default {
  generators: [
    [
      '@event7/generator-eventcatalog',
      {
        event7Url: process.env.EVENT7_URL || 'http://localhost:8000',
        event7Token: process.env.EVENT7_TOKEN,
        registryId: process.env.EVENT7_REGISTRY_ID,
        debug: true,
      }
    ]
  ]
};
```

### 3. Run

```bash
npm run generate
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `event7Url` | `string` | **required** | event7 backend URL |
| `event7Token` | `string` | — | JWT token (omit if `AUTH_ENABLED=false`) |
| `registryId` | `string` | **required** | Registry UUID in event7 |
| `domains` | `DomainConfig[]` | `[]` | Domain mapping rules (see below) |
| `defaultDomain` | `{id, name}` | — | Fallback domain for unmatched schemas |
| `messageType` | `'event' \| 'command' \| 'auto'` | `'event'` | How to create schemas in EC |
| `includeGovernance` | `boolean` | `true` | Add scores + rules to markdown |
| `includeChannels` | `boolean` | `true` | Create channels from event7 channel model |
| `includeAsyncAPI` | `boolean` | `true` | Attach AsyncAPI specs to events |
| `includeTeams` | `boolean` | `true` | Create teams from owner_team |
| `includeReferences` | `boolean` | `true` | Document references in markdown |
| `filter.prefix` | `string` | — | Only import subjects starting with this |
| `filter.excludePrefix` | `string[]` | `[]` | Skip subjects starting with these |
| `filter.excludeTags` | `string[]` | `[]` | Skip subjects with these tags |
| `debug` | `boolean` | `false` | Verbose logging |

### Domain mapping

Domains are DDD business concepts (Payments, Orders), **not** data layers. Map schemas to domains by subject prefix or tag:

```js
domains: [
  { id: 'payments', name: 'Payments', match: { prefix: 'com.acme.payments' } },
  { id: 'orders', name: 'Orders', match: { tag: 'domain:orders' } },
],
defaultDomain: { id: 'unassigned', name: 'Unassigned' },
```

First match wins. The `data_layer` (RAW, CORE, REFINED, APPLICATION) appears as a badge, not a domain.

## Environment Variables

```bash
EVENT7_URL=https://event7-production.up.railway.app
EVENT7_TOKEN=eyJhbGciOiJFUzI1NiIs...
EVENT7_REGISTRY_ID=550e8400-e29b-41d4-a716-446655440000
```

## Development

```bash
cd generator-eventcatalog
npm install
npm run build:watch    # rebuild on changes

# In another terminal, in your EventCatalog directory:
npm run generate
```

## License

Apache 2.0