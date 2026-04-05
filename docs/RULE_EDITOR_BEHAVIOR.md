# Rule Editor — Behavior Reference

> How the governance rule editor adapts its form based on the selected scope.
>
> **Component:** `frontend/src/components/rules/rule-editor.tsx`
> **Status:** Implemented
> **Last updated:** 5 avril 2026

---

## Principle

The rule editor is a **scope-driven adaptive form**. When the user selects a scope (Runtime, Control Plane, Declarative, Audit), the form reconfigures itself to show only the fields that make sense for that scope. Technical fields that don't apply are hidden — not disabled — and their values are set automatically.

---

## Field Visibility Matrix

| Field | Runtime | Control Plane | Declarative | Audit |
|-------|:-------:|:-------------:|:-----------:|:-----:|
| Scope selector | yes | yes | yes | yes |
| Rule Name | yes | yes | yes | yes |
| Subject | yes | yes | yes | yes |
| Description | yes | yes | yes (emphasized) | yes |
| Category | yes | yes | yes | yes |
| Rule Type | yes (dropdown) | yes (dropdown) | hidden (auto: CUSTOM) | yes (dropdown) |
| Expression | yes (textarea) | hidden | hidden | yes (optional) |
| Compat dropdown | hidden | yes (replaces expression) | hidden | hidden |
| Mode | yes (dropdown) | hidden (auto: REGISTER) | hidden (auto: REGISTER) | hidden (auto: REGISTER) |
| On Success/Failure | yes (only if TRANSFORM) | hidden | hidden | hidden |
| Severity | yes | yes | yes | yes |
| Enforcement | yes | yes | yes | yes |
| Evaluation Source | hidden (auto: provider_config) | hidden (auto: provider_config) | yes (user picks) | yes (user picks) |
| Scope hint | yes | yes | yes | yes |

---

## Auto-Defaults When Scope Changes (create mode only)

| Setting | Runtime | Control Plane | Declarative | Audit |
|---------|---------|---------------|-------------|-------|
| `rule_kind` | CONDITION | VALIDATION | POLICY | POLICY |
| `rule_type` | CEL | COMPATIBILITY | CUSTOM | CUSTOM |
| `rule_mode` | WRITE | REGISTER | REGISTER | REGISTER |
| `expression` | (cleared) | (cleared) | (cleared) | (cleared) |
| `evaluation_source` | provider_config | provider_config | declared_only | schema_content |

Not applied in edit mode — existing values preserved.

---

## Available Options Per Scope

### Rule Type

| Runtime | Control Plane | Declarative | Audit |
|---------|---------------|-------------|-------|
| CEL | COMPATIBILITY | CUSTOM (fixed) | CUSTOM |
| CEL_FIELD | VALIDITY | | REGEX |
| JSONATA | INTEGRITY | | REQUIRED_FIELDS |
| ENCRYPT | BREAKING_CHECK | | NAMING |
| DECRYPT | LINT | | |
| SS_TYPE | | | |

### Mode (Runtime only)

WRITE (produce), READ (consume), READWRITE (both), UPGRADE (migration up), DOWNGRADE (migration down), UPDOWN (both migrations).

### On Success / On Failure (Runtime TRANSFORM only)

- On Success: None, NONE, ENCRYPT, DECRYPT, DLQ, ERROR
- On Failure: None, NONE, ERROR, DLQ

### Compatibility Levels (Control Plane only)

BACKWARD, BACKWARD_TRANSITIVE, FORWARD, FORWARD_TRANSITIVE, FULL, FULL_TRANSITIVE, NONE

### Evaluation Source (Declarative + Audit only)

| Value | Label | Description |
|-------|-------|-------------|
| enrichment_metadata | Check enrichments | Verify via owner, tags, description, classification |
| schema_content | Inspect schema | Check field names, doc attributes, references |
| provider_config | Query provider API | Read the setting from registry directly |
| declared_only | Trust — no auto-check | Convention on trust, not verifiable |

`not_evaluable` not shown in UI (available via API for edge cases).

---

## Placeholder Examples Per Scope

### Rule Name

| Scope | Placeholder |
|-------|-------------|
| Runtime | `encrypt-pii-fields` |
| Control Plane | `enforce-backward-compat` |
| Declarative | `require-owner-team` |
| Audit | `naming-convention-check` |

### Description

| Scope | Placeholder |
|-------|-------------|
| Runtime | "Encrypt all fields tagged PII using CSFLE before producing to Kafka" |
| Control Plane | "Enforce BACKWARD_TRANSITIVE compatibility to protect all downstream consumers" |
| Declarative | "Every schema in this registry must have an owner_team defined in enrichments" |
| Audit | "Subject names must follow the convention com.{domain}.{entity}-value" |

### Expression

| Scope | Placeholder |
|-------|-------------|
| Runtime | `has(value.customer_id) && has(value.timestamp)` |
| Audit | `^com\.[a-z]+\.[a-z]+\.[A-Z][a-zA-Z]+-value$` |

Subject placeholder (all scopes): `com.event7.orders.OrderPlaced-value`. Empty = global rule.

---

## Severity Selector

2x2 grid of cards with descriptions:

| Value | Description | Color |
|-------|-------------|-------|
| info | No penalty if not met | zinc |
| warning | Moderate impact on score | yellow |
| error | Significant impact on score | orange |
| critical | Blocks compliance — major impact | red |

---

## Enforcement Selector

2 cards side by side:

| Value | Description | Color |
|-------|-------------|-------|
| declared | Documented for reference — no effect on score | zinc |
| expected | Required by governance — impacts the score | yellow |

States `synced`, `verified`, `drifted` are system-managed (provider sync), read-only badges in rule list.

---

## Scope Hints

| Scope | Hint |
|-------|------|
| Runtime | "Runtime rule. Executed by the Kafka serializer/deserializer. Can be synced to Confluent ruleSet." |
| Control Plane | "Control plane rule. Controls schema registration. Can be synced to Confluent or Apicurio." |
| Declarative | "Organizational policy. Not enforced automatically — contributes to governance score when marked Expected." |
| Audit | "Audit check. Evaluated against schema content or enrichments for scoring. Add a regex or description." |

---

## Edit Mode vs Create Mode

| Behavior | Create | Edit |
|----------|--------|------|
| Rule Name | editable | read-only (header) |
| Subject | editable | disabled |
| Scope change → auto-defaults | applied | not applied |
| Save button | "Create" | "Update" |
| API call | `POST /rules` | `PUT /rules/{id}` |

---

## Declarative Scope — Special Treatment

When scope is Declarative, description gets extra emphasis: "Description — this is the main content for policies". A Declarative policy has no expression, no rule type selector, no mode — the description IS the rule.

---

## Technical Notes

Visibility driven by a `SCOPE_VISIBILITY` record mapping each scope to boolean flags: `ruleType`, `mode`, `expression`, `compatDropdown`, `onSuccessFailure`, `evalSource`.

Hidden fields send auto-default values to the API — the backend always receives a complete payload regardless of scope.
