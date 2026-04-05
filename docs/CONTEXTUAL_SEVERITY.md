# Contextual Severity Scoring

**Status:** Implemented (v1.0)
**Since:** commit `83f34ca`
**Files:** `rules_context_resolver.py`, `rules_evaluator.py`, `validator_service.py`

---

## Problem

A governance rule violation on a `restricted` / `CORE` schema with 8 consumers produces the **same severity** as the same violation on an `internal` / `RAW` schema with 0 consumers. The base severity is defined on the rule — it knows nothing about the schema's real-world exposure.

## How it works

When a governance rule is violated during validation, event7 adjusts the rule's base severity using enrichment context. The adjustment is a **delta** (positive = escalate, negative = de-escalate) applied to the severity index.

### Severity levels

```
info (0) → warning (1) → error (2) → critical (3)
```

### Context factors

Three factors from enrichment metadata drive the adjustment:

| Factor | Condition | Delta | Rationale |
|--------|-----------|:-----:|-----------|
| **Classification** | `restricted` | +1 | PCI/regulated data — compliance consequences |
| **Classification** | `confidential` AND base severity >= error | +1 | Sensitive data, only escalates already-severe violations |
| **Classification** | `public` / `internal` | 0 | No adjustment |
| **Binding count** | >= 10 channels | +2 | High blast radius — many consumers |
| **Binding count** | >= 5 channels | +1 | Moderate blast radius |
| **Binding count** | < 5 channels | 0 | No adjustment |
| **Data layer** | `raw` | -1 | High churn expected, lenient |
| **Data layer** | `application` | +1 | Consumer-facing, strict |
| **Data layer** | `core` / `refined` / null | 0 | No adjustment |

### Calculation

1. Start with `delta = 0`
2. Apply classification factor
3. Apply binding count factor
4. Apply data layer factor
5. Deltas **stack** (they accumulate)
6. Shift base severity by total delta
7. Clamp result to `[info, critical]`

### Context source

| Field | Table | Query |
|-------|-------|-------|
| `classification` | `enrichments` | `WHERE registry_id = ? AND subject = ?` |
| `data_layer` | `enrichments` | same |
| `binding_count` | `channel_subjects` | `COUNT(*)` for subject |

If no enrichment exists, defaults are: `classification=internal`, `data_layer=null`, `binding_count=0` — resulting in delta 0 (no adjustment).

## Examples

### High exposure schema

```
Schema: com.payment.Transaction
Enrichment: restricted, application, 12 bindings
Rule violation: "require-doc-fields", base severity = warning

  delta = 0
  + restricted           → +1
  + 12 bindings (>= 10)  → +2
  + application           → +1
  = delta +4

  warning (idx=1) + 4 = idx 5 → clamped to critical (idx=3)

Result: warning → critical
```

### Low exposure schema

```
Schema: internal.debug.Trace
Enrichment: internal, raw, 0 bindings
Rule violation: "require-doc-fields", base severity = warning

  delta = 0
  + internal              → 0
  + 0 bindings            → 0
  + raw                   → -1
  = delta -1

  warning (idx=1) - 1 = idx 0 = info

Result: warning → info
```

### No enrichment

```
Schema: com.acme.Order (no enrichment set)
Rule violation: "naming-convention", base severity = error

  delta = 0 (no context → no adjustment)

Result: error → error (unchanged)
```

## API response

When context adjusts the severity, the violation includes both values:

```json
{
  "rule_id": "rule-require-doc",
  "rule_name": "Require documentation on all fields",
  "severity": "critical",
  "base_severity": "warning",
  "context_applied": true,
  "message": "Fields missing 'doc': amount, timestamp"
}
```

The `GovernanceResult` also includes the full context:

```json
{
  "governance": {
    "score": 60,
    "violations": [...],
    "context": {
      "classification": "restricted",
      "data_layer": "application",
      "binding_count": 12,
      "tags": ["pci", "payment"]
    }
  }
}
```

- `severity` — effective severity after adjustment
- `base_severity` — original severity from the rule (only present if adjusted)
- `context_applied` — `true` if severity was changed
- `context` — full enrichment context used for the calculation

## Impact on verdict

The adjusted severity feeds into the existing verdict logic:

- Violation with `error` or `critical` severity → **FAIL**
- Violation with `warning` severity → **WARN**
- No violations → **PASS**

This means contextual escalation can **promote** a verdict (WARN → FAIL) but the mechanism is indirect: the rule severity changes, which changes which verdict threshold is hit.

## Impact on governance score

The `governance_rules_service.py` scoring also uses contextual severity for point weighting:

| Scope | Severity | Points |
|-------|----------|:------:|
| verifiable | critical | 15 |
| verifiable | error | 10 |
| verifiable | warning | 5 |
| verifiable | info | 2 |
| declarative | critical | 10 |
| declarative | error | 7 |
| declarative | warning | 3 |
| declarative | info | 1 |

A rule escalated from `warning` to `error` weighs 10 points instead of 5 — making the governance score more sensitive to violations on exposed schemas.

## Design decisions

- **Stacking, not max**: all deltas accumulate. A `restricted` + `application` + 10-binding schema gets +4, not +2. This ensures compound exposure is reflected.
- **Clamp, not overflow**: result stays within `[info, critical]`. No invented severity levels.
- **No config (v1)**: thresholds are hardcoded defaults. Configurable weights are planned for Pro tier.
- **Additive only to existing flow**: the system enriches existing rule violations — it does not create new ones or replace the SR compatibility check.
- **Confidential asymmetry**: `confidential` only escalates when base is already `error+`. Rationale: low-severity violations on confidential data are expected (documentation gaps, naming), but high-severity violations (missing required fields, breaking constraints) become more dangerous.
