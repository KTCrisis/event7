# event7 — Severity Scoring — Design Document

**Version:** 1.0.0
**Date:** March 15, 2026
**Authors:** Marc / Claude
**Status:** Partially implemented — Phase 1 shipped, Phases 2-5 planned

---

## Table of contents

1. [Context & motivation](#1-context--motivation)
2. [The flat WARN problem](#2-the-flat-warn-problem)
3. [Available context sources](#3-available-context-sources)
4. [Scoring model](#4-scoring-model)
5. [Exposure Score](#5-exposure-score)
6. [Semantic Risk Detector](#6-semantic-risk-detector)
7. [Enriched verdict](#7-enriched-verdict)
8. [API changes](#8-api-changes)
9. [Frontend impact](#9-frontend-impact)
10. [AI Agent impact](#10-ai-agent-impact)
11. [Implementation backlog](#11-implementation-backlog)
12. [Future extensions](#12-future-extensions)

---

## Implementation status

| Phase | Description | Status |
|:-----:|-------------|--------|
| **0** | Contextual severity on rule violations (delta-based) | **Shipped** (`83f34ca`) — see [CONTEXTUAL_SEVERITY.md](CONTEXTUAL_SEVERITY.md) |
| **1** | Exposure Score (weighted multi-factor, 0-100) | Planned |
| **2** | Semantic Risk Detector (field rename, enum narrowing...) | Planned |
| **3** | Verdict adjustment matrix (exposure x diff x semantic) | Planned |
| **4** | Dashboard & Catalog integration (badges, KPIs) | Planned |
| **5** | Configurable weights (Pro tier) | Planned |

**Phase 0** is the simplified version currently in production. It adjusts individual rule violation severities using 3 enrichment factors (classification, binding count, data layer). The design below describes the full vision that builds on top of Phase 0.

---

## 1. Context & motivation

### Current state

The Schema Validator produces a PASS/WARN/FAIL verdict by crossing 3 axes:

1. **Compatibility check** — proxy to the SR (compatible or not?)
2. **Governance rules** — evaluation of event7 rules (violations with error/warning?)
3. **Diff engine** — independent breaking change detection (`_STRICT_MODES`)

The verdict is **structural**:

```python
if not compatible:                           → FAIL
if governance violations severity=error:     → FAIL
if is_breaking and mode in (NONE, UNKNOWN):  → FAIL
if is_breaking:                              → WARN
if governance violations severity=warning:   → WARN
else:                                        → PASS
```

### The gap

A field removal on a `restricted` / `CORE` schema with 8 consumers produces the **same WARN** as a field removal on an `internal` / `RAW` schema with 0 consumers. Structurally correct, operationally useless.

Additionally, some changes are technically compatible (SR says OK) but **semantically dangerous**: field renames, enum narrowing, type widening, optional wrapping. The SR doesn't flag these as incompatible, but downstream consumers can break.

### What nobody does

No tool on the market crosses structural diff with business context to score risk:

| Tool | SR Compat | Visual Diff | Governance | Business Context | Severity Scoring |
|------|:---------:|:-----------:|:----------:|:----------------:|:----------------:|
| Confluent UI | yes | no | no | no | no |
| Apicurio UI | yes | no | no | no | no |
| Conduktor | yes | yes | no | no | no |
| Lenses | yes | no | yes (runtime) | no | no |
| **event7 v1.0** | yes | yes | yes | **partial** (Phase 0) | **partial** |
| **event7 + full scoring** | yes | yes | yes | **yes** | **yes** |

### Design principles

1. **Enrichment-driven**: scoring uses data already in event7 (classification, data_layer, channels, AsyncAPI). No broker connection.
2. **Contract-based liveness**: AsyncAPI specs and channel bindings declare who consumes what. Design-time context, not runtime monitoring.
3. **Sensible defaults**: scoring works out-of-the-box with default weights. Per-organization configuration = Pro tier.
4. **Additive, not breaking**: the PASS/WARN/FAIL verdict remains. Severity scoring enriches WARN by adding a `risk_level` and can promote WARN to FAIL.
5. **Transparent**: every risk factor is visible in the report. No black box.

---

## 2. The flat WARN problem

| Change | SR says | Diff says | Verdict v1.0 | Real risk |
|--------|---------|-----------|:------------:|-----------|
| Remove `email` on restricted/CORE schema, 8 consumers | Incompatible | Breaking | FAIL | CRITICAL — correct |
| Add optional `phone` on restricted/CORE schema | Compatible | Non-breaking | PASS | LOW — correct |
| Remove `temp_flag` on internal/RAW, 0 consumers | Incompatible | Breaking | FAIL | LOW — over-escalated |
| Rename `user_id` → `customer_id` on public/CORE, 12 consumers | Compatible | Modified | **WARN** | **CRITICAL** — under-escalated |
| Narrow enum `OrderStatus` on public/REFINED, 6 consumers | Compatible | Modified | **WARN** | **HIGH** — under-escalated |
| Remove field, 0 enrichments, 0 channels, no AsyncAPI | Incompatible | Breaking | FAIL | **UNKNOWN** — no context |

---

## 3. Available context sources

All data already exists in event7. No new data model required.

### 3.1 Enrichments (`enrichments` table)

| Field | Values | Risk impact |
|-------|--------|-------------|
| `classification` | `public` / `internal` / `confidential` / `restricted` | public/restricted = high risk |
| `data_layer` | `raw` / `core` / `refined` / `application` | core/refined = high risk (reused) |
| `owner_team` | free text | Presence = better traceability |
| `tags` | JSONB array | Tags `pii`, `gdpr`, `critical-path` = high risk |

### 3.2 Channel bindings (`channels` + `channel_subjects`)

| Signal | Source | Impact |
|--------|--------|--------|
| Bound channel count | `COUNT(channel_subjects) WHERE subject_name = ?` | More channels = more exposure |
| Active channel count | `channel_subjects.binding_status = 'active'` | Active vs unverified = different confidence |
| Distinct broker types | `channels.broker_type` via join | Multi-broker = coordination risk |

### 3.3 AsyncAPI operations (contract-based liveness)

| Signal | Source | Impact |
|--------|--------|--------|
| `receive` operation count | AsyncAPI specs → operations.action = "receive" | Declared consumers = real exposure |
| `send` operation count | operations.action = "send" | Producers only = lower risk |
| Spec existence | `asyncapi_specs` table | Spec = documented schema → reliable context |

### 3.4 Reference graph (cross-schema dependencies)

| Signal | Source | Impact |
|--------|--------|--------|
| Dependent schemas | Schemas that `$ref` this subject | More dependents = breaking change cascade |
| Is referenced | `references` in schema content | Shared component = high risk |

### 3.5 Schema metadata

| Signal | Source | Impact |
|--------|--------|--------|
| Version count | `version_count` from subject | Many versions = mature, used schema |
| Compatibility mode | `get_compatibility()` | NONE = no SR protection |
| Governance score | `/governance/score` | Low score + breaking = double risk |

---

## 4. Scoring model

### Architecture

```
                    SchemaValidateRequest
                  (subject, schema_content)
                            |
                            v
               ValidatorService.validate()
                            |
    +-----------------------+-----------------------+
    |                       |                       |
    v                       v                       v
 Compatibility         Governance              Diff Engine
   Check                 Rules
    |                       |                       |
    v                       v                       v
 CompatResult      GovernanceResult            DiffResult
 (is_compatible)   (violations with            (is_breaking,
                    contextual severity         fields_added/
                    — Phase 0)                  removed/modified)
                            |                       |
                            +-------+-------+-------+
                                    |
                                    v
                            Context Scorer (NEW)
                            |
            +---------------+---------------+
            |                               |
            v                               v
      Exposure Score                Semantic Risk Detector
      (multi-factor 0-100)         (field rename, enum
                                    narrowing, type widening...)
            |                               |
            +---------------+---------------+
                            |
                            v
                     Risk Level Matrix
                     (exposure x diff x semantic)
                            |
                            v
                    Verdict Adjustment
                    (promote only, never demote)
```

### Two components

1. **Exposure Score** — measures schema exposure (who consumes it, where, at what sensitivity level). Calculated independently from the diff.

2. **Semantic Risk Detector** — analyzes the diff for semantically dangerous changes even when technically compatible.

Final verdict crosses both: `DiffResult x ExposureScore x SemanticRisks → risk_level → verdict adjustment`.

---

## 5. Exposure Score

### 5.1 Factors and weights

Each factor produces a partial score between 0 and its max weight. Total normalized to 100.

| Factor | Max weight | Calculation |
|--------|:----------:|-------------|
| **Classification** | 25 | `restricted`=25, `confidential`=20, `public`=15, `internal`=10 |
| **Data Layer** | 20 | `core`=20, `refined`=15, `application`=10, `raw`=5 |
| **Channel Binding Count** | 20 | `min(active_channels x 4, 20)` |
| **AsyncAPI Consumer Count** | 20 | `min(receive_operations x 5, 20)` |
| **Reference Dependents** | 10 | `min(dependent_schemas x 5, 10)` |
| **Version Maturity** | 5 | `versions >= 5` → 5, `>= 3` → 3, `>= 1` → 1 |

Note: `public` is 15, not 25 — external exposure is a different risk. In data platforms, `internal` is often more critical than `public`. `restricted` > `confidential` because restricted implies PCI/regulated data.

### 5.2 Exposure thresholds

| Score | Level | Meaning |
|:-----:|-------|---------|
| 0-20 | `low` | Low exposure, few consumers |
| 21-50 | `medium` | Moderate exposure |
| 51-75 | `high` | Critical schema, multiple consumers/channels |
| 76-100 | `critical` | Highly exposed, sensitive classification |

### 5.3 Unknown case

If a schema has **no enrichment** (no classification, no data_layer, no channels, no AsyncAPI), the exposure score is `unknown` (not 0). The report explicitly indicates insufficient context.

```python
if no_enrichment and no_channels and no_asyncapi:
    exposure = ExposureResult(score=0, level="unknown", confidence="none")
```

### 5.4 Confidence

| Condition | Confidence |
|-----------|:----------:|
| Classification + data_layer + >= 1 channel + AsyncAPI spec | `high` |
| Classification + data_layer (no channels/AsyncAPI) | `medium` |
| Only classification OR data_layer | `low` |
| No enrichment | `none` |

---

## 6. Semantic Risk Detector

### 6.1 Semantic vs structural risks

The diff engine detects **structural** changes: field added, removed, modified. The Semantic Risk Detector analyzes `MODIFIED` changes for dangerous patterns even when the SR says "compatible".

### 6.2 Detected patterns

| Pattern | Detection | Severity | Example |
|---------|-----------|:--------:|---------|
| **Field rename** | Field removed + field added (same type, same position +/- 1) | high | `user_id` → `customer_id` |
| **Enum narrowing** | Enum type modified, symbol count decreased | high | `[ACTIVE,INACTIVE,DELETED]` → `[ACTIVE,INACTIVE]` |
| **Type widening** | Type changed to broader type | medium | `int` → `long`, `string` → `bytes` |
| **Optional wrapping** | Non-union type → union `["null", type]` | medium | `"string"` → `["null", "string"]` |
| **Default value change** | Same field, same type, different default | medium | `default: "USD"` → `default: "EUR"` |
| **Doc removal** | Field had doc, now doesn't | low | `"doc": "User email"` → no doc |
| **Namespace change** | Record namespace modified | high | `com.acme.v1` → `com.acme.v2` |
| **Logical type change** | Same base type, different logicalType | high | `timestamp-millis` → `timestamp-micros` |

### 6.3 JSON Schema patterns

| Pattern | Detection |
|---------|-----------|
| **Property rename** | `additionalProperties` change + property removed + property added |
| **Required narrowing** | Property removed from `required` array |
| **Type broadening** | `type: "integer"` → `type: ["integer", "string"]` |
| **Pattern change** | `pattern` regex modified |
| **Enum narrowing** | `enum` array shrunk |

### 6.4 Detection algorithm (Avro)

```python
class SemanticRisk(BaseModel):
    pattern: str           # "field_rename", "enum_narrowing", etc.
    severity: str          # "low", "medium", "high"
    field_path: str        # "status", "address.zip"
    message: str           # Human-readable explanation
    details: dict = {}     # Pattern-specific details

def detect_semantic_risks(
    diff: DiffResult,
    schema_from: dict,
    schema_to: dict,
    schema_format: SchemaFormat,
) -> list[SemanticRisk]:
    risks = []

    # Field rename: removed + added with same type = probable rename
    if diff.fields_removed and diff.fields_added:
        for removed in diff.fields_removed:
            removed_type = _get_field_type(schema_from, removed)
            for added in diff.fields_added:
                added_type = _get_field_type(schema_to, added)
                if removed_type and removed_type == added_type:
                    risks.append(SemanticRisk(
                        pattern="field_rename",
                        severity="high",
                        field_path=removed,
                        message=f"Possible rename: '{removed}' -> '{added}' (same type: {removed_type})",
                    ))

    # Enum narrowing, type widening, etc. — same pattern
    ...

    return risks
```

---

## 7. Enriched verdict

### 7.1 Risk level matrix

|  | Exposure: low | medium | high | critical | unknown |
|--|:---:|:---:|:---:|:---:|:---:|
| **No changes** | none | none | none | none | none |
| **Non-breaking** | low | low | low | medium | low |
| **Semantic risk (high)** | low | medium | high | critical | medium |
| **Breaking** | medium | high | critical | critical | high |

### 7.2 Verdict adjustment

The risk level can **promote** a verdict but never **demote** it:

```python
def adjust_verdict(base_verdict, risk_level):
    if base_verdict == PASS and risk_level in ("critical", "high"):
        return WARN    # contextual alert

    if base_verdict == WARN and risk_level == "critical":
        return FAIL    # promotion

    return base_verdict  # unchanged, never demoted
```

### 7.3 Concrete examples

| Scenario | Base verdict | Exposure | Semantic risks | Risk level | Final |
|----------|:---:|---|---|:---:|:---:|
| Remove `email` on restricted/CORE, 8 consumers | WARN | critical (85) | field_rename | **critical** | **FAIL** |
| Remove `temp_flag` on internal/RAW, 0 consumers | WARN | low (10) | — | **low** | WARN |
| Rename `user_id` → `customer_id` on public/CORE, 12 consumers | WARN | critical (78) | field_rename | **critical** | **FAIL** |
| Add optional field on restricted/CORE, 8 consumers | PASS | critical (85) | — | **medium** | PASS |
| Type widening int→long on confidential/REFINED, 4 consumers | PASS | high (60) | type_widening | **high** | **WARN** |
| Any change, 0 enrichments | WARN | unknown | — | **unknown** | WARN + "insufficient context" |

---

## 8. API changes

### 8.1 New response models

```python
class RiskLevel(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    UNKNOWN = "unknown"

class SemanticRisk(BaseModel):
    pattern: str
    severity: str
    field_path: str
    message: str
    details: dict = Field(default_factory=dict)

class ExposureResult(BaseModel):
    score: int = 0                          # 0-100
    level: str = "unknown"                  # low/medium/high/critical/unknown
    confidence: str = "none"                # none/low/medium/high
    factors: dict = Field(default_factory=dict)

class SeverityContext(BaseModel):
    risk_level: RiskLevel = RiskLevel.UNKNOWN
    exposure: ExposureResult = Field(default_factory=ExposureResult)
    semantic_risks: list[SemanticRisk] = Field(default_factory=list)
    verdict_adjusted: bool = False
    verdict_reason: str | None = None

class SchemaValidateResponse(BaseModel):
    # ... existing fields ...
    severity: SeverityContext               # NEW
    verdict: Verdict
```

### 8.2 Example response

```json
{
  "subject": "com.acme.Order",
  "schema_type": "AVRO",
  "severity": {
    "risk_level": "critical",
    "exposure": {
      "score": 78,
      "level": "critical",
      "confidence": "high",
      "factors": {
        "classification": {"value": "restricted", "points": 25, "max": 25},
        "data_layer": {"value": "core", "points": 20, "max": 20},
        "channel_bindings": {"count": 5, "active": 4, "points": 16, "max": 20},
        "asyncapi_consumers": {"receive_ops": 3, "points": 15, "max": 20},
        "reference_dependents": {"count": 1, "points": 5, "max": 10},
        "version_maturity": {"versions": 3, "points": 3, "max": 5}
      }
    },
    "semantic_risks": [
      {
        "pattern": "field_rename",
        "severity": "high",
        "field_path": "user_id",
        "message": "Possible rename: 'user_id' -> 'customer_id' (same type: string)"
      }
    ],
    "verdict_adjusted": true,
    "verdict_reason": "WARN -> FAIL: critical exposure (78) + breaking change + semantic risk (field_rename)"
  },
  "verdict": "FAIL"
}
```

### 8.3 Backward compatibility

The `severity` field is additive. Clients that don't read it continue working with `verdict` alone.

---

## 9. Frontend impact

### 9.1 Validator report — 4th section

```
+----------------------------------------------------+
|  Severity Context                                   |
|                                                     |
|  Exposure: 78/100 (critical) ########--             |
|  Confidence: high                                   |
|                                                     |
|  Factors:                                           |
|   Classification: restricted         25/25          |
|   Data Layer: core                   20/20          |
|   Channel Bindings: 4 active         16/20          |
|   AsyncAPI Consumers: 3 receive ops  15/20          |
|   Reference Dependents: 1             5/10          |
|   Version Maturity: 3 versions        3/5           |
|                                                     |
|  Semantic Risks:                                    |
|   ! FIELD_RENAME (high)                             |
|     user_id -> customer_id (same type: string)      |
|                                                     |
|  Verdict adjusted: WARN -> FAIL                     |
+----------------------------------------------------+
```

### 9.2 Exposure badge in Explorer and Catalog

| Badge | Color | Condition |
|-------|-------|-----------|
| `CRITICAL` | Red | exposure.level = "critical" |
| `HIGH` | Orange | exposure.level = "high" |
| `MEDIUM` | Yellow | exposure.level = "medium" |
| `LOW` | Green | exposure.level = "low" |
| `?` | Gray | exposure.level = "unknown" |

The badge is calculable without running the Validator (exposure score is diff-independent). Can be pre-cached in the Catalog.

### 9.3 Dashboard KPI — exposure distribution

```
Exposure Distribution
  CRITICAL  ####------  12 subjects (15%)
  HIGH      ######----  18 subjects (23%)
  MEDIUM    ########--  28 subjects (35%)
  LOW       ##########  22 subjects (27%)
  UNKNOWN   ----------   0 subjects  (0%)
```

---

## 10. AI Agent impact

The context fetcher can include exposure data for AI-powered triage:

> "You have 3 schemas with breaking changes. `com.acme.Order` has critical risk (exposure 78, restricted/CORE, 3 consumers). `internal.debug.Trace` has low risk (exposure 10, internal/RAW, 0 consumers). I recommend reviewing `com.acme.Order` first."

---

## 11. Implementation backlog

### Phase 1 — Exposure Score (Community)

| Task | File | Effort |
|------|------|:------:|
| Models: `ExposureResult`, `SeverityContext`, `RiskLevel` | `models/validator.py` | S |
| Exposure scorer service | `services/exposure_scorer.py` (new) | M |
| Integrate in `validator_service.validate()` | `services/validator_service.py` | S |
| Tests | `tests/test_exposure_scorer.py` (new) | M |
| TypeScript types | `frontend/src/types/validator.ts` | S |
| Severity context UI component | `frontend/src/components/validator/SeverityContext.tsx` (new) | M |
| Integrate in validator report | `ValidateReport.tsx` | S |

### Phase 2 — Semantic Risk Detector (Community)

| Task | File | Effort |
|------|------|:------:|
| `SemanticRisk` model | `models/validator.py` | S |
| Detector service (Avro + JSON Schema) | `services/semantic_risk_detector.py` (new) | L |
| Integrate in validator | `services/validator_service.py` | S |
| Tests | `tests/test_semantic_risk_detector.py` (new) | L |
| Semantic risks UI component | `frontend/src/components/validator/SemanticRisks.tsx` (new) | M |

### Phase 3 — Verdict Adjustment (Community)

| Task | File | Effort |
|------|------|:------:|
| `adjust_verdict()` + risk level matrix | `services/validator_service.py` | S |
| Tests: verdict adjustment scenarios | `tests/test_validator.py` | M |
| Verdict promotion badge + reason | Frontend | S |

### Phase 4 — Dashboard & Catalog (Community)

| Task | File | Effort |
|------|------|:------:|
| Standalone exposure endpoint (no diff needed) | `api/exposure_routes.py` (new) | M |
| Exposure badge per subject in Catalog | Frontend | S |
| Exposure distribution KPI in Dashboard | Frontend | M |

### Phase 5 — Configurable Weights (Pro)

| Task | File | Effort |
|------|------|:------:|
| `severity_config` table — weights per factor, per org | Migration | M |
| CRUD API for severity config | Backend | M |
| Settings page for severity weights | Frontend | M |
| Custom semantic risk patterns (regex-based) | Backend | L |

**Estimated effort:** Phases 1-3 = ~3-4 days, Phase 4 = ~2 days, Phase 5 = ~3-4 days (Pro)

---

## 12. Future extensions

### 12.1 Runtime Metrics Integration (Pro)

Optional connection to Confluent Metrics API (`api.telemetry.confluent.cloud`) to enrich exposure score with runtime signals: active consumer groups, throughput, consumer lag. Complements contract-based scoring, doesn't replace it.

### 12.2 Cross-Registry Drift Detection (Pro)

When the same schema (same namespace + name) exists in two registries, detect drift between registries. Severity scoring applies per registry independently, aggregated report shows divergences.

### 12.3 Time-Windowed Scoring

Track exposure scores over time to detect trends. A schema with rapidly increasing exposure (new consumers, new channels) deserves attention even if its absolute score is moderate.

### 12.4 Team-Based Policies (Enterprise)

Per-team risk level thresholds for verdict adjustment. The "payments" team wants all WARN + high → FAIL. The "analytics" team accepts riskier changes.

### 12.5 CI/CD Integration

```yaml
- name: Validate schema
  run: |
    RESULT=$(curl -s -X POST .../validate -d '...')
    RISK=$(echo $RESULT | jq -r '.severity.risk_level')
    if [ "$RISK" = "critical" ]; then
      echo "::error::Schema change has CRITICAL risk level"
      exit 1
    fi
```

---

## Appendix A — Why not connect to brokers?

event7 is a **governance layer**, not an observability tool. Connecting to Kafka brokers for consumer groups would require:

1. New credential types (bootstrap servers + SASL, not just SR API)
2. New security scope (cluster-level access)
3. New maintenance domain (timeouts, reconnection, multi-cluster)
4. Scope creep (competing with Confluent Control Center, Conduktor, Lenses)

Contract-based liveness (AsyncAPI specs + Channel model) covers 80% of the need. The remaining 20% (runtime metrics) is an optional Pro tier addition via REST API, not direct broker connection.

---

## Appendix B — Detailed example

**Subject:** `com.acme.Order`
**Enrichments:** classification=`restricted`, data_layer=`core`, tags=`["pci", "gdpr"]`
**Channels:** 5 bindings, 4 active, 1 unverified
**AsyncAPI:** 1 spec with 3 `receive` operations on this subject
**References:** 1 dependent schema (`com.acme.OrderLine` uses `$ref`)
**Versions:** 3

**Exposure Score:**

| Factor | Calculation | Points |
|--------|-------------|:------:|
| Classification: restricted | 25 | 25/25 |
| Data Layer: core | 20 | 20/20 |
| Channels: 4 active x 4 = 16 | min(16, 20) | 16/20 |
| AsyncAPI: 3 receive x 5 = 15 | min(15, 20) | 15/20 |
| Dependents: 1 x 5 = 5 | min(5, 10) | 5/10 |
| Versions: 3 → 3 | 3 | 3/5 |
| **Total** | | **84/100** |

**Level:** `critical` (84 > 75)
**Confidence:** `high`

**Diff:** `user_id` removed, `customer_id` added (same type string)
**Semantic risk:** `field_rename` (high)
**Base verdict:** WARN
**Risk level:** critical (breaking x critical exposure)
**Adjusted verdict:** **FAIL**

---

## Appendix C — Relationship between Phase 0 and full scoring

Phase 0 (shipped) and the full scoring model serve different purposes:

| Aspect | Phase 0 (current) | Full scoring (planned) |
|--------|-------------------|----------------------|
| **Scope** | Individual rule violations | Entire validation report |
| **Input** | 3 factors (classification, bindings, data_layer) | 6+ factors including AsyncAPI, references, version maturity |
| **Output** | Adjusted severity on each violation | Exposure score (0-100) + semantic risks + risk level |
| **Verdict impact** | Indirect (escalated severity → verdict threshold) | Direct (risk level matrix → verdict adjustment) |
| **Semantic analysis** | No | Yes (field rename, enum narrowing, type widening...) |
| **Confidence indicator** | No | Yes (none/low/medium/high) |
| **Unknown handling** | No enrichment → no change | Explicit "unknown" level with warning |

Phase 0 remains active in the full model — rule violations continue to have contextual severity. The exposure score and semantic risks are additive layers on top.
