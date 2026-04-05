# event7 — Schema Validator — Design Document

**Version:** 1.0.0
**Date:** 13 mars 2026
**Authors:** Marc / Claude
**Status:** Implemented (Phase 1 + 2 + partial 3)
**Last updated:** 5 avril 2026

---

## Implementation status

| Component | Status | Notes |
|-----------|:------:|-------|
| Pydantic models (Request, Response, sub-models) | **Done** | `models/validator.py` |
| Validator service (orchestrate 3 checks) | **Done** | `services/validator_service.py` |
| Rules evaluator (NAMING, REQUIRED_FIELDS, REGEX, doc) | **Done** | `services/rules_evaluator.py` — 6 evaluators |
| Contextual severity on violations | **Done** | `services/rules_context_resolver.py` — see [CONTEXTUAL_SEVERITY.md](CONTEXTUAL_SEVERITY.md) |
| API endpoint `POST /schemas/validate` | **Done** | `api/schemas.py` |
| Tests | **Done** | `tests/test_validator.py` |
| Frontend `/validate` page | **Done** | Full split layout (form + report) |
| Verdict badge (PASS/WARN/FAIL) | **Done** | |
| Explorer integration (Validate button) | Planned | |
| Catalog integration (Validate action) | Planned | |
| AI Agent `/validate` command | Planned | |
| Impact analysis (dependents) | Planned | v1.2 |
| CI/CD GitHub Action | Planned | v1.3 |
| Batch validation | Planned | v1.4 |

---

## 1. Context & motivation

### The problem

No tool lets a developer validate a schema **before publication** combining both SR compatibility and governance rules:

| Tool | Compat check | Governance | Diff preview | Pre-publish |
|------|:---:|:---:|:---:|:---:|
| Confluent UI | yes | no | no | no |
| Apicurio UI | yes | no | no | no |
| Conduktor | browse only | no | no | no |
| Lenses | runtime | runtime | no | no |
| **event7 Validator** | yes | yes | yes | **yes** |

### The solution

A **Schema Validator** that combines in a single call:

1. **Compatibility check** — proxy to SR API (compatible with current version?)
2. **Governance rules evaluation** — event7 rules (naming, required fields, doc)
3. **Diff preview** — field-level diff against current version
4. **Unified verdict** — PASS / WARN / FAIL

### Principles

1. **Dry-run only**: read-only, never publishes
2. **Provider-agnostic**: uses `check_compatibility()` on Confluent + Apicurio
3. **Combines SR + event7**: the value is the cross-validation
4. **Community tier**: free, fundamental dev tool
5. **Not an editor**: dev pastes JSON/Avro, event7 validates

---

## 2. Provider compatibility APIs

### Confluent SR / Karapace / Redpanda

```
POST /compatibility/subjects/{subject}/versions/{version}
→ {"is_compatible": bool, "messages": [...]}
```

### Apicurio Registry v3

Uses ccompat path (`/api/ccompat/v7/...`) — identical to Confluent. Native v3 dry-run (`X-Registry-DryRun: true`) planned for v1.1.

### Providers without dry-run (AWS Glue, Azure)

Return event7-only results (governance + diff) without compatibility section. `compatibility.provider_checked = false`.

---

## 3. Data model

### Request

```python
class SchemaValidateRequest(BaseModel):
    subject: str                           # Target subject
    schema_content: str                    # Schema to validate (JSON string)
    schema_type: SchemaFormat = "AVRO"     # AVRO | JSON | PROTOBUF
    references: list[dict] = []            # Avro $ref references
    compare_version: str = "latest"        # Version to compare against
```

### Response

```python
class SchemaValidateResponse(BaseModel):
    subject: str
    schema_type: SchemaFormat
    compare_version: int | None
    timestamp: datetime

    compatibility: CompatibilityResult     # SR check
    governance: GovernanceResult           # event7 rules + contextual severity
    diff: DiffResult                       # Field-level diff
    verdict: Verdict                       # PASS | WARN | FAIL
```

### Sub-models

**CompatibilityResult**: `is_compatible`, `mode`, `messages[]`, `provider_checked`

**GovernanceResult**: `score` (0-100), `violations[]`, `skipped[]`, `passed`, `failed`, `total`, `context` (enrichment context for severity)

**RuleViolation**: `rule_id`, `rule_name`, `rule_scope`, `severity` (effective, after context adjustment), `base_severity` (original, if adjusted), `context_applied`, `message`, `category`

**RuleSkipped**: `rule_id`, `rule_name`, `rule_scope`, `reason` (why not evaluated)

**DiffResult**: `has_changes`, `fields_added[]`, `fields_removed[]`, `fields_modified[]`, `is_breaking`, `total_changes`

### Verdict logic

```python
if not compatible:                           → FAIL
if governance violations severity=error:     → FAIL
if is_breaking and mode in _STRICT_MODES:    → FAIL
if is_breaking:                              → WARN
if governance violations severity=warning:   → WARN
else:                                        → PASS
```

Verdict only promotes (WARN→FAIL, PASS→WARN), never demotes. Contextual severity (from `rules_context_resolver.py`) can escalate violations, indirectly promoting the verdict.

---

## 4. API endpoint

### POST /api/v1/registries/{registry_id}/schemas/validate

**Auth:** JWT required

**Flow:**

```
Route → get provider (from registry_id) → get db + cache
  → SchemaValidatorService.validate(request)
      ├── 1. provider.check_compatibility()        [async, ~100-300ms]
      ├── 2. rules_evaluator.evaluate_rules()      [sync, <10ms]
      └── 3. diff_service.compute_diff()            [sync, <10ms]
  → assemble + compute verdict
  → return SchemaValidateResponse
```

**Error cases:**

| Situation | HTTP | Behavior |
|-----------|:----:|----------|
| Subject doesn't exist in SR | 404 | No version to compare |
| Syntactically invalid schema | 422 | JSON doesn't parse |
| Provider doesn't support check_compatibility | 200 | `provider_checked = false`, governance + diff only |
| No governance rules for subject | 200 | `total = 0`, section empty but present |
| New subject (not in SR yet) | 200 | `is_compatible = true`, diff empty, rules evaluated |

---

## 5. Service layer

### ValidatorService (`services/validator_service.py`)

Orchestrates the 3 checks. Stateless — no DB writes.

### Rules Evaluator (`services/rules_evaluator.py`)

Evaluates governance rules against candidate schema content:

| Evaluator | Rule types matched | What it checks |
|-----------|-------------------|----------------|
| `_eval_require_doc_fields` | require-doc, doc-fields, LINT | Fields have doc/description |
| `_eval_require_fields` | require-source, required-fields | Specific fields exist |
| `_eval_naming_convention` | naming-convention, naming, NAMING | Record name/namespace/subject matches regex |
| `_eval_max_fields` | max-fields, field-limit | Field count <= max |
| `_eval_field_regex` | field-regex, field-pattern, REGEX | Field names match pattern |

Rules that can't be evaluated in dry-run (CEL, ENCRYPT, runtime, provider_config, declared_only) are returned as `skipped` with explicit reason.

### Contextual severity (`services/rules_context_resolver.py`)

When a violation is detected, severity is adjusted based on enrichment context. See [CONTEXTUAL_SEVERITY.md](CONTEXTUAL_SEVERITY.md).

---

## 6. Frontend

### Page layout: split view

**Left panel — Input form:**
- Subject dropdown (autocomplete from SR subject list)
- Format selector (AVRO / JSON / PROTOBUF)
- Compare version (latest or specific)
- Schema textarea (monospace) or file upload (.avsc/.json)
- Validate button

**Right panel — Report:**

```
+---------------------------------------------+
|  Verdict: PASS / WARN / FAIL                |
+---------------------------------------------+
|  1. Compatibility                     [ok]  |
|  Mode: BACKWARD_TRANSITIVE                  |
|  Result: Compatible                          |
+---------------------------------------------+
|  2. Governance Rules           5/7 passed   |
|  Score: 72/100                               |
|                                              |
|  x naming-convention  (error)               |
|    "Field 'zip' should be..."               |
|  ! required-doc       (warning)             |
|    "Missing doc on field 'role'"            |
|  - cel-validation     (skipped)             |
|    "Runtime rule — not evaluated"           |
+---------------------------------------------+
|  3. Diff Preview                             |
|  + loyalty_tier (string, optional)          |
|  ~ email (type changed)                     |
|  - old_field (removed)                      |
|  Breaking: No                                |
+---------------------------------------------+
```

### UX patterns

- **Local JSON validation** before API call (avoid round-trip for syntax errors)
- **Loading state**: spinner on button + skeleton on report (~300ms)
- **Persistent results**: report stays after validation, dev can edit and re-validate
- **Paste or upload**: textarea OR file input

---

## 7. Access from Explorer and Catalog

- **Explorer**: "Validate New Version" button on subject detail → drawer with pre-filled form
- **Catalog**: "Validate" action in context menu → drawer with pre-filled subject
- **AI Agent**: `/validate` command handler (planned)

---

## 8. Existing components reused

| Component | Reuse |
|-----------|-------|
| `provider.check_compatibility()` | Direct call — Confluent + Apicurio |
| `provider.get_compatibility()` | Get subject compatibility mode |
| `provider.get_schema()` | Load current version for diff |
| `diff_service.compute_schema_diff()` | Field-level diff |
| DB rules queries | Load applicable rules |
| Governance scoring logic | Score calculation in report |
| Subject list cache | Frontend autocomplete |

---

## 9. Future extensions

### v1.1 — Apicurio native dry-run

Use `X-Registry-DryRun: true` on Apicurio v3 API to test all artifact rules. Add "Provider Rules" section to report.

### v1.2 — Impact Analysis

Show dependents from Reference Graph and estimate downstream impact:

```json
{
  "impact": {
    "dependents": [
      {"subject": "com.event7.Customer", "fields_using_changed": ["address.zip"], "risk": "low"}
    ],
    "total_dependents": 3
  }
}
```

### v1.3 — CI/CD integration

REST endpoint already CI-friendly. Add GitHub Action wrapper:

```yaml
- name: Validate schema
  run: |
    RESULT=$(curl -s -X POST .../validate -d '...')
    VERDICT=$(echo $RESULT | jq -r '.verdict')
    [ "$VERDICT" = "fail" ] && exit 1
```

### v1.4 — Batch validation

Validate multiple schemas in one call (monorepo use case).

### v1.5 — Validation history

Store validation results in DB for audit trail.
