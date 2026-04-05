#!/usr/bin/env python3
"""
event7 — Schema Validator Test Suite
Placement: backend/tests/test_validator.py

Tests:
  - ValidatorService: full validate flow, new subject, incompatible, no rules
  - RulesEvaluator: doc fields, required fields, naming, max fields, skip logic

Usage:
  cd backend
  python -m pytest tests/test_validator.py -v
"""

import json
import sys
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock

import pytest

# ── Pre-patch app.main before any app import ──
_fake_main = ModuleType("app.main")
_fake_main.redis_cache = MagicMock()
_fake_main.db_client = MagicMock()
sys.modules.setdefault("app.main", _fake_main)

from app.models.schema import SchemaDetail, SchemaFormat
from app.models.validator import (
    SchemaValidateRequest,
    Verdict,
)
from app.services.rules_evaluator import evaluate_rules_for_schema
from app.services.validator_service import SchemaValidatorService


# ================================================================
# FIXTURES — Schemas
# ================================================================

AVRO_USER_V1 = {
    "type": "record",
    "name": "User",
    "namespace": "com.event7",
    "fields": [
        {"name": "id", "type": "string", "doc": "User ID"},
        {"name": "email", "type": "string", "doc": "Email address"},
        {"name": "name", "type": "string", "doc": "Full name"},
    ],
}

AVRO_USER_V2 = {
    "type": "record",
    "name": "User",
    "namespace": "com.event7",
    "fields": [
        {"name": "id", "type": "string", "doc": "User ID"},
        {"name": "email", "type": "string", "doc": "Email address"},
        {"name": "name", "type": "string", "doc": "Full name"},
        {"name": "role", "type": "string", "doc": "User role", "default": "USER"},
    ],
}

AVRO_NO_DOC = {
    "type": "record",
    "name": "BadSchema",
    "namespace": "com.event7",
    "fields": [
        {"name": "id", "type": "string"},
        {"name": "value", "type": "int"},
    ],
}

AVRO_MANY_FIELDS = {
    "type": "record",
    "name": "Wide",
    "namespace": "com.event7",
    "fields": [{"name": f"field_{i}", "type": "string"} for i in range(35)],
}


# ================================================================
# HELPERS
# ================================================================

def _make_schema_detail(schema: dict, version: int = 1) -> SchemaDetail:
    return SchemaDetail(
        subject="com.event7.User",
        version=version,
        schema_id=100,
        format=SchemaFormat.AVRO,
        schema_content=schema,
        references=[],
    )


def _make_service(
    provider=None,
    db_rules=None,
    existing_schema=None,
    is_compatible=True,
    compat_messages=None,
) -> SchemaValidatorService:
    """Build a ValidatorService with mocked dependencies."""
    mock_provider = provider or AsyncMock()

    # get_schema
    if existing_schema:
        mock_provider.get_schema.return_value = existing_schema
    else:
        mock_provider.get_schema.side_effect = Exception("Subject not found")

    # check_compatibility
    mock_provider.check_compatibility.return_value = {
        "is_compatible": is_compatible,
        "messages": compat_messages or [],
    }

    # get_compatibility
    mock_provider.get_compatibility.return_value = "BACKWARD"

    # DB
    mock_db = MagicMock()
    mock_db.list_governance_rules.return_value = db_rules or []

    # Cache
    mock_cache = AsyncMock()
    mock_cache.get.return_value = None
    mock_cache.set.return_value = None
    mock_cache.cache_key = lambda *parts: ":".join(parts)

    return SchemaValidatorService(
        provider=mock_provider,
        cache=mock_cache,
        db=mock_db,
        registry_id="test-registry-001",
    )


def _make_rule(
    rule_name: str,
    rule_type: str = "CUSTOM",
    rule_scope: str = "audit",
    severity: str = "warning",
    category: str = "data_quality",
    evaluation_source: str = "schema_content",
    enforcement_status: str = "expected",
    expression: str | None = None,
    params: dict | None = None,
    description: str = "",
) -> dict:
    """Build a governance rule row (as returned by DB)."""
    return {
        "id": f"rule-{rule_name}",
        "rule_name": rule_name,
        "rule_type": rule_type,
        "rule_scope": rule_scope,
        "rule_kind": "POLICY",
        "severity": severity,
        "rule_category": category,
        "evaluation_source": evaluation_source,
        "enforcement_status": enforcement_status,
        "rule_expression": expression,
        "expression": expression,
        "params": params,
        "description": description,
        "subject": None,
    }


# ================================================================
# TEST: ValidatorService — Full flow
# ================================================================


class TestValidatorService:
    """Tests for the orchestration layer."""

    @pytest.mark.asyncio
    async def test_validate_compatible_no_rules_pass(self):
        """Compatible schema, no rules → PASS."""
        svc = _make_service(
            existing_schema=_make_schema_detail(AVRO_USER_V1),
            is_compatible=True,
        )
        request = SchemaValidateRequest(
            subject="com.event7.User",
            schema_content=json.dumps(AVRO_USER_V2),
        )
        result = await svc.validate(request)

        assert result.verdict == Verdict.PASS
        assert result.compatibility.is_compatible is True
        assert result.compatibility.mode == "BACKWARD"
        assert result.governance.total == 0
        assert result.diff.has_changes is True
        assert "role" in result.diff.fields_added

    @pytest.mark.asyncio
    async def test_validate_new_subject_pass(self):
        """New subject (not in SR) → PASS, no diff."""
        svc = _make_service(existing_schema=None)
        request = SchemaValidateRequest(
            subject="com.event7.NewSchema",
            schema_content=json.dumps(AVRO_USER_V1),
        )
        result = await svc.validate(request)

        assert result.verdict == Verdict.PASS
        assert result.compatibility.is_compatible is True
        assert result.compatibility.provider_checked is False
        assert result.diff.is_new_subject is True
        assert result.diff.has_changes is False
        assert result.compare_version is None

    @pytest.mark.asyncio
    async def test_validate_incompatible_fail(self):
        """SR says incompatible → FAIL."""
        svc = _make_service(
            existing_schema=_make_schema_detail(AVRO_USER_V1),
            is_compatible=False,
            compat_messages=["READER_FIELD_MISSING_DEFAULT_VALUE"],
        )
        request = SchemaValidateRequest(
            subject="com.event7.User",
            schema_content=json.dumps(AVRO_USER_V2),
        )
        result = await svc.validate(request)

        assert result.verdict == Verdict.FAIL
        assert result.compatibility.is_compatible is False
        assert len(result.compatibility.messages) == 1

    @pytest.mark.asyncio
    async def test_validate_governance_error_fail(self):
        """Compatible but governance rule error → FAIL."""
        rules = [
            _make_rule("require-doc-fields", severity="error"),
        ]
        svc = _make_service(
            existing_schema=_make_schema_detail(AVRO_USER_V1),
            is_compatible=True,
            db_rules=rules,
        )
        request = SchemaValidateRequest(
            subject="com.event7.User",
            schema_content=json.dumps(AVRO_NO_DOC),
        )
        result = await svc.validate(request)

        assert result.verdict == Verdict.FAIL
        assert result.governance.failed >= 1
        assert any(v.severity == "error" for v in result.governance.violations)

    @pytest.mark.asyncio
    async def test_validate_governance_warning_warn(self):
        """Compatible, non-breaking diff, but governance warning → WARN."""
        # Schema that adds a field without doc (triggers require-doc warning)
        # but keeps all existing fields (non-breaking)
        candidate = {
            "type": "record",
            "name": "User",
            "namespace": "com.event7",
            "fields": [
                {"name": "id", "type": "string", "doc": "User ID"},
                {"name": "email", "type": "string", "doc": "Email address"},
                {"name": "name", "type": "string", "doc": "Full name"},
                {"name": "phone", "type": ["null", "string"], "default": None},
            ],
        }
        rules = [
            _make_rule("require-doc-fields", severity="warning"),
        ]
        svc = _make_service(
            existing_schema=_make_schema_detail(AVRO_USER_V1),
            is_compatible=True,
            db_rules=rules,
        )
        request = SchemaValidateRequest(
            subject="com.event7.User",
            schema_content=json.dumps(candidate),
        )
        result = await svc.validate(request)

        assert result.verdict == Verdict.WARN
        assert result.governance.failed >= 1
        assert result.governance.violations[0].severity == "warning"

    @pytest.mark.asyncio
    async def test_validate_invalid_json_raises(self):
        """Invalid JSON → ValueError."""
        svc = _make_service()
        request = SchemaValidateRequest(
            subject="com.event7.User",
            schema_content="not valid json {{{",
        )
        with pytest.raises(ValueError, match="Invalid JSON"):
            await svc.validate(request)

    @pytest.mark.asyncio
    async def test_validate_diff_fields(self):
        """Verify diff details: added field detected."""
        svc = _make_service(
            existing_schema=_make_schema_detail(AVRO_USER_V1),
            is_compatible=True,
        )
        request = SchemaValidateRequest(
            subject="com.event7.User",
            schema_content=json.dumps(AVRO_USER_V2),
        )
        result = await svc.validate(request)

        assert result.diff.has_changes is True
        assert result.diff.total_changes >= 1
        assert result.diff.is_breaking is False
        assert result.compare_version == 1

    @pytest.mark.asyncio
    async def test_validate_breaking_diff_mode_none_fail(self):
        """SR mode NONE + breaking changes → FAIL (SR not protecting)."""
        schema_missing_fields = {
            "type": "record",
            "name": "User",
            "namespace": "com.event7",
            "fields": [
                {"name": "id", "type": "string", "doc": "User ID"},
            ],
        }

        svc = _make_service(
            existing_schema=_make_schema_detail(AVRO_USER_V1),
            is_compatible=True,
        )
        # Override compatibility mode to NONE after _make_service
        svc.provider.get_compatibility.return_value = "NONE"

        request = SchemaValidateRequest(
            subject="com.event7.User",
            schema_content=json.dumps(schema_missing_fields),
        )
        result = await svc.validate(request)

        assert result.compatibility.is_compatible is True
        assert result.compatibility.mode == "NONE"
        assert result.diff.is_breaking is True
        assert result.verdict == Verdict.FAIL

    @pytest.mark.asyncio
    async def test_validate_breaking_diff_strict_mode_fail(self):
        """SR says compatible (bug) but mode FULL_TRANSITIVE + breaking → FAIL.
        event7 detects breaking changes independently of SR answer."""
        schema_missing_fields = {
            "type": "record",
            "name": "User",
            "namespace": "com.event7",
            "fields": [
                {"name": "id", "type": "string", "doc": "User ID"},
            ],
        }

        svc = _make_service(
            existing_schema=_make_schema_detail(AVRO_USER_V1),
            is_compatible=True,  # SR says compatible (wrong!)
        )
        svc.provider.get_compatibility.return_value = "FULL_TRANSITIVE"

        request = SchemaValidateRequest(
            subject="com.event7.User",
            schema_content=json.dumps(schema_missing_fields),
        )
        result = await svc.validate(request)

        assert result.compatibility.is_compatible is True  # SR is wrong
        assert result.compatibility.mode == "FULL_TRANSITIVE"
        assert result.diff.is_breaking is True
        assert result.verdict == Verdict.FAIL  # event7 catches it


# ================================================================
# TEST: RulesEvaluator — Individual evaluators
# ================================================================


class TestRulesEvaluator:
    """Tests for evaluate_rules_for_schema()."""

    def test_require_doc_pass(self):
        """All fields have doc → pass."""
        rules = [_make_rule("require-doc-fields")]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert passed == 1
        assert len(violations) == 0

    def test_require_doc_fail(self):
        """Fields without doc → violation."""
        rules = [_make_rule("require-doc-fields")]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_NO_DOC, "com.event7.User"
        )
        assert len(violations) == 1
        assert "id" in violations[0].message or "value" in violations[0].message

    def test_naming_convention_pass(self):
        """Record name matches pattern → pass."""
        rules = [
            _make_rule(
                "naming-convention",
                expression=r"^[A-Z][a-zA-Z]+$",
                params={"target": "name"},
            )
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert passed == 1

    def test_naming_convention_fail(self):
        """Record name doesn't match → violation."""
        rules = [
            _make_rule(
                "naming-convention",
                expression=r"^com\.[a-z]+\.[A-Z][a-zA-Z]+$",
                params={"target": "name"},
            )
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        # "User" does not match "com.xxx.Xxx"
        assert len(violations) == 1
        assert "does not match" in violations[0].message

    def test_naming_convention_subject(self):
        """Check naming against subject name."""
        rules = [
            _make_rule(
                "naming-convention",
                expression=r"^com\.event7\..+$",
                params={"target": "subject"},
            )
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert passed == 1

    def test_max_fields_pass(self):
        """Schema under limit → pass."""
        rules = [_make_rule("max-fields-limit", params={"max_fields": 30})]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert passed == 1

    def test_max_fields_fail(self):
        """Schema over limit → violation."""
        rules = [_make_rule("max-fields-limit", params={"max_fields": 30})]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_MANY_FIELDS, "com.event7.Wide"
        )
        assert len(violations) == 1
        assert "35" in violations[0].message

    def test_require_fields_from_params(self):
        """Required fields from params → check presence."""
        rules = [
            _make_rule(
                "required-fields",
                params={"required_fields": ["id", "email", "missing_field"]},
            )
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert len(violations) == 1
        assert "missing_field" in violations[0].message

    def test_require_fields_all_present(self):
        """All required fields present → pass."""
        rules = [
            _make_rule(
                "required-fields",
                params={"required_fields": ["id", "email", "name"]},
            )
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert passed == 1

    def test_skip_declared_only(self):
        """enforcement=declared → skipped."""
        rules = [
            _make_rule("some-rule", enforcement_status="declared"),
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert len(skipped) == 1
        assert passed == 0
        assert len(violations) == 0

    def test_skip_provider_config(self):
        """evaluation_source=provider_config → skipped (handled by SR check)."""
        rules = [
            _make_rule(
                "backward-compat",
                rule_type="COMPATIBILITY",
                evaluation_source="provider_config",
            ),
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert len(skipped) == 1
        assert "SR compatibility" in skipped[0].reason

    def test_skip_runtime_cel(self):
        """rule_type=CEL → skipped."""
        rules = [
            _make_rule("cel-check", rule_type="CEL", rule_scope="runtime"),
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert len(skipped) == 1
        assert "Runtime" in skipped[0].reason

    def test_no_rules_empty_result(self):
        """Empty rules list → 0 everything."""
        violations, skipped, passed = evaluate_rules_for_schema(
            [], AVRO_USER_V1, "com.event7.User"
        )
        assert passed == 0
        assert len(violations) == 0
        assert len(skipped) == 0

    def test_mixed_rules(self):
        """Mix of evaluable, skipped, pass, fail."""
        rules = [
            _make_rule("require-doc-fields", severity="warning"),         # → pass (AVRO_USER_V1 has doc)
            _make_rule("max-fields-limit", params={"max_fields": 2}),     # → fail (3 fields > 2)
            _make_rule("backward-compat", evaluation_source="provider_config"),  # → skipped
            _make_rule("no-transform", enforcement_status="declared"),     # → skipped
        ]
        violations, skipped, passed = evaluate_rules_for_schema(
            rules, AVRO_USER_V1, "com.event7.User"
        )
        assert passed == 1          # require-doc passed
        assert len(violations) == 1  # max-fields failed
        assert len(skipped) == 2     # compat + declared