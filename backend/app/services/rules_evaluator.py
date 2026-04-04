"""
event7 - Rules Evaluator
Évalue les governance rules event7 sur un schema candidat (dry-run).

Placement: backend/app/services/rules_evaluator.py
Design doc: SCHEMA_VALIDATOR_DESIGN.md v1.0.0

Évalue uniquement les rules dont evaluation_source = "schema_content".
Les rules runtime (CEL, ENCRYPT), provider_config (COMPATIBILITY),
declared_only, et not_evaluable sont retournées comme "skipped".

Supporte Avro et JSON Schema. Extensible via le dict EVALUATORS.
"""

import re
from typing import Any

from loguru import logger

from app.models.validator import RuleSkipped, RuleViolation
from app.services.rules_context_resolver import SchemaContext, resolve_severity


# ============================================================
# Helpers — Schema introspection
# ============================================================


def _get_avro_fields(schema: dict) -> list[dict]:
    """Extract field list from an Avro record schema."""
    if schema.get("type") == "record":
        return schema.get("fields", [])
    return []


def _get_json_schema_properties(schema: dict) -> dict[str, dict]:
    """Extract properties from a JSON Schema."""
    return schema.get("properties", {})


def _get_field_names(schema: dict) -> list[str]:
    """Get field/property names regardless of format."""
    # Avro
    if schema.get("type") == "record":
        return [f["name"] for f in schema.get("fields", [])]
    # JSON Schema
    if "properties" in schema:
        return list(schema["properties"].keys())
    return []


def _get_record_name(schema: dict) -> str | None:
    """Get the record/schema name."""
    return schema.get("name") or schema.get("title")


def _get_namespace(schema: dict) -> str | None:
    """Get the namespace (Avro) or $id (JSON Schema)."""
    return schema.get("namespace") or schema.get("$id")


# ============================================================
# Individual rule evaluators
# ============================================================


def _eval_require_doc_fields(
    schema: dict, rule: dict, **_kwargs
) -> str | None:
    """Check that all fields have a doc/description attribute.
    Returns error message if violated, None if passed."""
    fields = _get_avro_fields(schema)
    if fields:
        missing = [f["name"] for f in fields if not f.get("doc")]
        if missing:
            return f"Fields missing 'doc': {', '.join(missing[:5])}" + (
                f" (and {len(missing) - 5} more)" if len(missing) > 5 else ""
            )
        return None

    # JSON Schema
    props = _get_json_schema_properties(schema)
    if props:
        missing = [name for name, spec in props.items() if not spec.get("description")]
        if missing:
            return f"Properties missing 'description': {', '.join(missing[:5])}" + (
                f" (and {len(missing) - 5} more)" if len(missing) > 5 else ""
            )
        return None

    return None  # No fields to check → pass


def _eval_require_fields(
    schema: dict, rule: dict, **_kwargs
) -> str | None:
    """Check that specific required fields exist in the schema.
    Uses rule description to infer required field names, or params.required_fields."""
    field_names = set(_get_field_names(schema))
    if not field_names:
        return None

    # Try params.required_fields first
    params = rule.get("params") or {}
    required = params.get("required_fields", [])

    # Fallback: parse field names from description heuristic
    if not required:
        desc = (rule.get("description") or "").lower()
        # Match patterns like "must contain source_system and ingestion_timestamp"
        candidates = re.findall(r'[a-z][a-z0-9_]+(?:_[a-z0-9]+)+', desc)
        required = [c for c in candidates if len(c) > 3]

    if not required:
        return None  # No fields to check → pass

    missing = [f for f in required if f not in field_names]
    if missing:
        return f"Required fields missing: {', '.join(missing)}"
    return None


def _eval_naming_convention(
    schema: dict, rule: dict, subject: str = "", **_kwargs
) -> str | None:
    """Check naming convention via regex on record name, namespace, or subject."""
    params = rule.get("params") or {}
    expression = rule.get("rule_expression") or rule.get("expression")

    # Pattern from params or expression
    pattern = params.get("pattern") or expression
    if not pattern:
        return None  # No pattern defined → pass

    try:
        regex = re.compile(pattern)
    except re.error:
        return f"Invalid regex pattern: {pattern}"

    # Check target: params.target or default to record name
    target = params.get("target", "name")

    if target == "subject":
        value = subject
    elif target == "namespace":
        value = _get_namespace(schema) or ""
    elif target == "name":
        value = _get_record_name(schema) or ""
    else:
        value = _get_record_name(schema) or subject

    if value and not regex.match(value):
        return f"'{value}' does not match naming pattern: {pattern}"
    return None


def _eval_max_fields(
    schema: dict, rule: dict, **_kwargs
) -> str | None:
    """Check that the schema doesn't exceed a max field count."""
    params = rule.get("params") or {}
    max_fields = params.get("max_fields", 30)

    field_names = _get_field_names(schema)
    if len(field_names) > max_fields:
        return f"Schema has {len(field_names)} fields (max: {max_fields})"
    return None


def _eval_field_regex(
    schema: dict, rule: dict, **_kwargs
) -> str | None:
    """Check field names against a regex pattern."""
    params = rule.get("params") or {}
    expression = rule.get("rule_expression") or rule.get("expression")

    pattern = params.get("field_pattern") or expression
    if not pattern:
        return None

    try:
        regex = re.compile(pattern)
    except re.error:
        return f"Invalid regex pattern: {pattern}"

    field_names = _get_field_names(schema)
    violations = [f for f in field_names if not regex.match(f)]
    if violations:
        return f"Fields violating naming pattern '{pattern}': {', '.join(violations[:5])}" + (
            f" (and {len(violations) - 5} more)" if len(violations) > 5 else ""
        )
    return None


# ============================================================
# Evaluator registry
# ============================================================

# Maps (rule_name_pattern OR rule_type) → evaluator function.
# The evaluator receives (schema, rule, subject=...) and returns
# an error message string (violation) or None (passed).

# Matched in order: first by rule_name keyword, then by rule_type.
_NAME_EVALUATORS: dict[str, Any] = {
    "require-doc": _eval_require_doc_fields,
    "doc-fields": _eval_require_doc_fields,
    "require-source": _eval_require_fields,
    "required-fields": _eval_require_fields,
    "require-field": _eval_require_fields,
    "naming-convention": _eval_naming_convention,
    "naming": _eval_naming_convention,
    "max-fields": _eval_max_fields,
    "field-limit": _eval_max_fields,
    "field-regex": _eval_field_regex,
    "field-pattern": _eval_field_regex,
}

_TYPE_EVALUATORS: dict[str, Any] = {
    "NAMING": _eval_naming_convention,
    "REQUIRED_FIELDS": _eval_require_fields,
    "REGEX": _eval_field_regex,
    "LINT": _eval_require_doc_fields,
}

# Rule types / scopes that are never evaluable in dry-run
_SKIP_RULE_TYPES = {"CEL", "CEL_FIELD", "JSONATA", "ENCRYPT", "DECRYPT", "SS_TYPE"}
_SKIP_EVAL_SOURCES = {"provider_config", "declared_only", "not_evaluable"}


# ============================================================
# Main entry point
# ============================================================


def evaluate_rules_for_schema(
    rules: list[dict],
    schema_content: dict,
    subject: str = "",
    schema_context: SchemaContext | None = None,
) -> tuple[list[RuleViolation], list[RuleSkipped], int]:
    """
    Evaluate governance rules against a candidate schema.

    Args:
        rules: list of rule rows from DB (list_governance_rules result)
        schema_content: parsed schema dict (Avro or JSON Schema)
        subject: subject name (for naming convention checks)
        schema_context: optional enrichment context for severity resolution

    Returns:
        (violations, skipped, passed_count)
    """
    violations: list[RuleViolation] = []
    skipped: list[RuleSkipped] = []
    passed = 0

    for rule in rules:
        rule_id = str(rule.get("id", ""))
        rule_name = rule.get("rule_name", "")
        rule_type = rule.get("rule_type", "")
        rule_scope = rule.get("rule_scope", "")
        severity = rule.get("severity", "info")
        category = rule.get("rule_category", "custom")
        eval_source = rule.get("evaluation_source", "declared_only")
        enforcement = rule.get("enforcement_status", "declared")

        # ── Skip: declared-only rules (no score impact) ──
        if enforcement == "declared":
            skipped.append(RuleSkipped(
                rule_id=rule_id,
                rule_name=rule_name,
                rule_scope=rule_scope,
                reason="Declared only — no enforcement expected",
            ))
            continue

        # ── Skip: non-evaluable sources ──
        if eval_source in _SKIP_EVAL_SOURCES:
            reason = {
                "provider_config": "Evaluated by SR compatibility check (section ①)",
                "declared_only": "Organizational standard — not automatically evaluated",
                "not_evaluable": "Runtime rule — cannot be evaluated in dry-run",
            }.get(eval_source, f"Evaluation source '{eval_source}' not supported")

            skipped.append(RuleSkipped(
                rule_id=rule_id,
                rule_name=rule_name,
                rule_scope=rule_scope,
                reason=reason,
            ))
            continue

        # ── Skip: runtime rule types (CEL, ENCRYPT...) ──
        if rule_type in _SKIP_RULE_TYPES:
            skipped.append(RuleSkipped(
                rule_id=rule_id,
                rule_name=rule_name,
                rule_scope=rule_scope,
                reason=f"Runtime rule type '{rule_type}' — not evaluated in dry-run",
            ))
            continue

        # ── Find evaluator ──
        evaluator = _find_evaluator(rule_name, rule_type)

        if evaluator is None:
            # No evaluator found → skip with explanation
            skipped.append(RuleSkipped(
                rule_id=rule_id,
                rule_name=rule_name,
                rule_scope=rule_scope,
                reason=f"No evaluator for rule '{rule_name}' (type: {rule_type})",
            ))
            continue

        # ── Evaluate ──
        try:
            error_msg = evaluator(schema_content, rule, subject=subject)

            if error_msg is None:
                passed += 1
            else:
                effective_severity = severity
                context_applied = False
                if schema_context is not None:
                    effective_severity = resolve_severity(severity, schema_context)
                    context_applied = effective_severity != severity

                violations.append(RuleViolation(
                    rule_id=rule_id,
                    rule_name=rule_name,
                    rule_scope=rule_scope,
                    severity=effective_severity,
                    message=error_msg,
                    category=category,
                    base_severity=severity if context_applied else None,
                    context_applied=context_applied,
                ))
        except Exception as e:
            logger.warning(f"Rules evaluator: error evaluating rule '{rule_name}': {e}")
            violations.append(RuleViolation(
                rule_id=rule_id,
                rule_name=rule_name,
                rule_scope=rule_scope,
                severity="warning",
                message=f"Evaluation error: {str(e)}",
                category=category,
            ))

    return violations, skipped, passed


def _find_evaluator(rule_name: str, rule_type: str):
    """Find the best evaluator for a rule by name pattern, then by type."""
    name_lower = rule_name.lower()

    # Match by name keyword
    for keyword, evaluator in _NAME_EVALUATORS.items():
        if keyword in name_lower:
            return evaluator

    # Match by rule_type
    if rule_type in _TYPE_EVALUATORS:
        return _TYPE_EVALUATORS[rule_type]

    return None