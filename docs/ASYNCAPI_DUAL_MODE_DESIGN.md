# AsyncAPI Page Redesign — Dual Mode Flow

> **Version**: 1.0.0
> **Date**: 14 Mars 2026
> **Authors**: Marc / Claude
> **Status**: Partially implemented
> **Last updated**: 5 avril 2026

---

## Implementation status

| Component | Status | Notes |
|-----------|:------:|-------|
| Overview service (`get_overview()`) | **Done** | `asyncapi_service.py` — dual-mode overview with drift detection |
| Overview endpoint (`GET /asyncapi/overview`) | **Done** | `api/asyncapi.py` |
| Overview Pydantic models | **Done** | `models/asyncapi_overview.py` |
| Frontend Overview tab | Planned | No frontend component yet |
| Frontend Batch Generate tab | Planned | |
| `POST /asyncapi/generate-all` endpoint | Planned | |
| `asyncapi_origin` in export payload | Planned | |
| Dashboard KPI "AsyncAPI coverage" | Planned | |

---

## 1. Problem

The current AsyncAPI page has 2 tabs (Generate / Import) but doesn't show the **global status** of specs per subject. In a real org, 3 cases coexist:

- **Team A (legacy)**: pushes schemas to SR, no AsyncAPI, no documentation
- **Team B (modern)**: writes AsyncAPI spec, imports into event7
- **Team C (mix)**: some schemas documented, others not

The architect has no unified view of "who has a spec, who doesn't, what's the origin".

---

## 2. Concept: 4 modes per subject

Mode detected **per subject**, not per registry. event7 uses `is_auto_generated` on `asyncapi_specs` table.

```
Has AsyncAPI spec imported (is_auto_generated = false)?
  YES → IMPORTED (spec-first, AsyncAPI is source of truth)
  NO  → Has spec generated (is_auto_generated = true)?
    YES → GENERATED (schema-first, event7 is source of truth)
    NO  → Has enrichments (description, channels)?
      YES → READY (enriched, no spec yet)
      NO  → RAW (undocumented)
```

| Mode | Badge | Meaning |
|------|-------|---------|
| imported | purple | Spec-first. AsyncAPI is source of truth. |
| generated | emerald | Schema-first. event7 generated from schema + enrichments. |
| ready | amber | Enriched but no spec yet. Ready for generation. |
| raw | slate | No spec, no enrichment. Needs enrichment first. |

---

## 3. Two main flows

### Mode A: Spec-first (AsyncAPI → event7)

```
Team writes AsyncAPI spec
  → Import tab: paste/upload YAML
  → Preview (dry-run): channels, bindings, enrichments, schemas
  → Apply: creates channels + bindings + enrichments
  → Subject marked "imported"
  → Export to EventCatalog with business names from spec
```

### Mode B: Schema-first (SR → event7 → AsyncAPI)

```
Team pushes schemas to SR
  → event7 discovers via provider
  → Architect enriches: description, owner, channels, tags, rules
  → Generate tab: creates spec from schema + enrichments + channels
  → Subject marked "generated"
  → Export to EventCatalog with enrichment descriptions
```

---

## 4. Page redesign — 4 tabs

### Tab 1: Overview (new)

Table of all subjects with status:

| Subject | Origin | Spec Status | Score | Actions |
|---------|--------|-------------|-------|---------|
| com.event7.Order | imported | v3.0.0 | 85/B | View Edit |
| com.event7.Address | generated | v3.0.0 | 72/C | View Regen |
| com.event7.Customer | ready | — | 55/C | Generate |
| com.event7.Payment | raw | — | 5/F | Enrich |

**KPIs**: total subjects, with spec, without spec, coverage %, distribution by origin.

**Filters**: by origin, data_layer, owner_team, search.

### Tab 2: Generate (existing, enhanced)

Dropdown pre-filtered to "ready" or "generated" subjects (not "imported"). Regenerate button for outdated specs.

### Tab 3: Import (existing, unchanged)

Paste/upload → preview → apply. Marks subjects as "imported".

### Tab 4: Batch Generate (new)

Generate specs for all enriched subjects that don't have one yet.

Options: include Kafka bindings, include key schemas, regenerate existing (overwrite).

Never overwrites imported specs.

---

## 5. Backend endpoints

### `GET /asyncapi/overview` (done)

Returns AsyncAPI status for all subjects with KPIs, coverage, drift detection.

```json
{
  "kpis": {
    "total_subjects": 80,
    "with_spec": 53,
    "imported": 8,
    "generated": 45,
    "ready": 12,
    "raw": 15,
    "coverage_pct": 66.25
  },
  "subjects": [
    {
      "subject": "com.event7.Order",
      "origin": "imported",
      "asyncapi_version": "3.0.0",
      "spec_title": "Order Events",
      "governance_score": 85,
      "has_enrichment": true,
      "has_channels": true,
      "updated_at": "2026-03-14T10:30:00Z"
    }
  ]
}
```

### `POST /asyncapi/generate-all` (planned)

```json
// Request
{
  "include_generated": false,
  "include_key_schema": true,
  "skip_imported": true
}

// Response
{
  "generated": 12,
  "skipped_imported": 8,
  "skipped_raw": 15,
  "errors": [],
  "subjects": ["com.event7.Customer", ...]
}
```

### Export payload update (planned)

Add `asyncapi_origin` to `ExportSchema`:

```python
asyncapi_origin: str | None = None  # "imported" | "generated" | null
```

Source: `is_auto_generated` on `asyncapi_specs` table.

---

## 6. Impact on EventCatalog export

The generator-event7 adapts naming by origin:

| Origin | Name source | Example |
|--------|-------------|---------|
| imported | AsyncAPI spec `info.title` | "Order Confirmed" |
| generated | `enrichment.description` | "Order placed by a user" |
| null | Subject technical name | "com.event7.Order-value" |

---

## 7. UX — Origin badges

```
imported   — bg-purple-500/10 text-purple-400 border-purple-500/20
generated  — bg-emerald-500/10 text-emerald-400 border-emerald-500/20
ready      — bg-amber-500/10 text-amber-400 border-amber-500/20
raw        — bg-slate-500/10 text-slate-400 border-slate-500/20
```

Badges appear in: AsyncAPI Overview, Catalog (tooltip), Dashboard KPI, EventCatalog (event badge).

---

## 8. Priority

| Step | Work | Priority |
|:----:|------|:--------:|
| 1 | `asyncapi_origin` in export payload | High |
| 2 | Frontend Overview tab (uses existing endpoint) | High |
| 3 | Generator V2: adaptive naming by origin | High |
| 4 | `POST /asyncapi/generate-all` endpoint | Medium |
| 5 | Frontend Batch Generate tab | Medium |
| 6 | Dashboard KPI "AsyncAPI coverage" | Low |
