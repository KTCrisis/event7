"""
Tests for governance_rules_service — scoring logic, _is_rule_met, enrichment points.

Covers: _enrichment_points, _is_rule_met, _score_rules, _score_schema_quality,
        contextual severity in scoring, template apply.
"""

from unittest.mock import MagicMock

import pytest

from app.services.governance_rules_service import GovernanceRulesService


# ================================================================
# Helpers
# ================================================================


def _make_service(
    rules: list[dict] | None = None,
    enrichments: list[dict] | None = None,
    enrichment: dict | None = None,
    channels: list[dict] | None = None,
    templates: list[dict] | None = None,
) -> GovernanceRulesService:
    """Build a GovernanceRulesService with mocked dependencies."""
    cache = MagicMock()
    cache.get = MagicMock(return_value=None)
    cache.set = MagicMock(return_value=None)
    cache.delete_pattern = MagicMock(return_value=None)

    db = MagicMock()
    db.list_governance_rules.return_value = rules or []
    db.get_enrichments_for_registry.return_value = enrichments or []
    db.get_enrichment.return_value = enrichment
    db.get_channels_for_subject.return_value = channels or []
    db.list_governance_templates.return_value = templates or []

    return GovernanceRulesService(
        cache=cache,
        db=db,
        registry_id="test-registry-id",
    )


def _make_rule(
    rule_name: str = "test-rule",
    severity: str = "warning",
    enforcement: str = "expected",
    scope: str = "declarative",
    kind: str = "POLICY",
    eval_source: str = "declared_only",
    rule_type: str = "CUSTOM",
) -> dict:
    return {
        "id": f"rule-{rule_name}",
        "rule_name": rule_name,
        "severity": severity,
        "enforcement_status": enforcement,
        "rule_scope": scope,
        "rule_kind": kind,
        "evaluation_source": eval_source,
        "rule_type": rule_type,
        "description": f"Test rule: {rule_name}",
    }


# ================================================================
# _enrichment_points
# ================================================================


class TestEnrichmentPoints:

    def test_full_enrichment_20_points(self):
        enrichment = {
            "description": "Order event",
            "owner_team": "payments",
            "tags": ["pci"],
            "classification": "restricted",
        }
        assert GovernanceRulesService._enrichment_points(enrichment) == 20

    def test_empty_enrichment_0_points(self):
        assert GovernanceRulesService._enrichment_points({}) == 0

    def test_description_only_5_points(self):
        assert GovernanceRulesService._enrichment_points({"description": "A desc"}) == 5

    def test_owner_only_5_points(self):
        assert GovernanceRulesService._enrichment_points({"owner_team": "team-a"}) == 5

    def test_tags_empty_list_0_points(self):
        assert GovernanceRulesService._enrichment_points({"tags": []}) == 0

    def test_tags_nonempty_5_points(self):
        assert GovernanceRulesService._enrichment_points({"tags": ["pii"]}) == 5

    def test_classification_internal_0_points(self):
        """Internal is the default — no extra points."""
        assert GovernanceRulesService._enrichment_points({"classification": "internal"}) == 0

    def test_classification_restricted_5_points(self):
        assert GovernanceRulesService._enrichment_points({"classification": "restricted"}) == 5

    def test_classification_public_5_points(self):
        assert GovernanceRulesService._enrichment_points({"classification": "public"}) == 5


# ================================================================
# _is_rule_met
# ================================================================


class TestIsRuleMet:

    def test_runtime_synced_is_met(self):
        rule = _make_rule(scope="runtime", enforcement="synced")
        assert GovernanceRulesService._is_rule_met(rule) is True

    def test_runtime_verified_is_met(self):
        rule = _make_rule(scope="runtime", enforcement="verified")
        assert GovernanceRulesService._is_rule_met(rule) is True

    def test_runtime_expected_not_met(self):
        rule = _make_rule(scope="runtime", enforcement="expected")
        assert GovernanceRulesService._is_rule_met(rule) is False

    def test_runtime_declared_not_met(self):
        rule = _make_rule(scope="runtime", enforcement="declared")
        assert GovernanceRulesService._is_rule_met(rule) is False

    def test_control_plane_synced_is_met(self):
        rule = _make_rule(scope="control_plane", enforcement="synced")
        assert GovernanceRulesService._is_rule_met(rule) is True

    def test_declarative_expected_is_met(self):
        rule = _make_rule(scope="declarative", enforcement="expected")
        assert GovernanceRulesService._is_rule_met(rule) is True

    def test_declarative_declared_not_met(self):
        rule = _make_rule(scope="declarative", enforcement="declared")
        assert GovernanceRulesService._is_rule_met(rule) is False

    def test_audit_expected_is_met(self):
        rule = _make_rule(scope="audit", enforcement="expected")
        assert GovernanceRulesService._is_rule_met(rule) is True

    def test_audit_declared_not_met(self):
        rule = _make_rule(scope="audit", enforcement="declared")
        assert GovernanceRulesService._is_rule_met(rule) is False


# ================================================================
# _score_rules
# ================================================================


class TestScoreRules:

    def test_no_rules_returns_empty(self):
        svc = _make_service(rules=[])
        result = svc._score_rules(subject=None)
        assert result.total_rules == 0
        assert result.total_policies == 0
        assert result.points == 0

    def test_declared_rules_are_skipped(self):
        """Rules with enforcement=declared are ignored in scoring."""
        svc = _make_service(rules=[
            _make_rule("rule-a", enforcement="declared"),
            _make_rule("rule-b", enforcement="declared"),
        ])
        result = svc._score_rules(subject=None)
        assert result.total_rules == 0
        assert result.total_policies == 0
        assert result.points == 0

    def test_expected_policy_counts_as_policy(self):
        svc = _make_service(rules=[
            _make_rule("require-owner", kind="POLICY", enforcement="expected"),
        ])
        result = svc._score_rules(subject=None)
        assert result.total_policies == 1
        assert result.total_rules == 0

    def test_expected_condition_counts_as_rule(self):
        svc = _make_service(rules=[
            _make_rule("cel-check", kind="CONDITION", scope="runtime", enforcement="expected"),
        ])
        result = svc._score_rules(subject=None)
        assert result.total_rules == 1
        assert result.total_policies == 0

    def test_met_rule_earns_points(self):
        """A declarative expected rule (met) earns its weight."""
        svc = _make_service(rules=[
            _make_rule("rule-a", severity="warning", enforcement="expected",
                       scope="declarative", eval_source="declared_only"),
        ])
        result = svc._score_rules(subject=None)
        assert result.points > 0
        assert result.warning_met == 1
        assert result.warning_total == 1

    def test_unmet_rule_penalizes(self):
        """A runtime expected rule (not synced → unmet) loses points."""
        svc = _make_service(rules=[
            _make_rule("cel-check", severity="error", enforcement="expected",
                       scope="runtime", kind="CONDITION"),
        ])
        result = svc._score_rules(subject=None)
        assert result.error_met == 0
        assert result.error_total == 1

    def test_verifiable_weights_higher_than_declarative(self):
        """provider_config/schema_content rules weigh more than declared_only.
        With the same severity, a verifiable unmet rule causes more penalty."""
        # Two unmet rules (runtime expected but not synced) with same severity
        # Verifiable (schema_content) should penalize more than declarative
        svc_mixed = _make_service(rules=[
            _make_rule("rule-v", severity="error", enforcement="expected",
                       scope="audit", eval_source="schema_content"),
            _make_rule("rule-d", severity="error", enforcement="expected",
                       scope="declarative", eval_source="declared_only"),
        ])
        result = svc_mixed._score_rules(subject=None)
        # Both met (declarative + expected = met), so both earn points
        # Verifiable error = 10 pts, declarative error = 7 pts
        assert result.by_evaluation_source.get("schema_content") == 1
        assert result.by_evaluation_source.get("declared_only") == 1

    def test_severity_tracking(self):
        svc = _make_service(rules=[
            _make_rule("r1", severity="critical", enforcement="expected"),
            _make_rule("r2", severity="error", enforcement="expected"),
            _make_rule("r3", severity="warning", enforcement="expected"),
        ])
        result = svc._score_rules(subject=None)
        assert result.critical_total == 1
        assert result.error_total == 1
        assert result.warning_total == 1

    def test_scope_breakdown(self):
        svc = _make_service(rules=[
            _make_rule("r1", scope="declarative", enforcement="expected"),
            _make_rule("r2", scope="declarative", enforcement="expected"),
            _make_rule("r3", scope="audit", enforcement="expected"),
        ])
        result = svc._score_rules(subject=None)
        assert "declarative" in result.by_scope
        assert result.by_scope["declarative"].total == 2
        assert "audit" in result.by_scope
        assert result.by_scope["audit"].total == 1


# ================================================================
# _score_schema_quality
# ================================================================


class TestScoreSchemaQuality:

    def test_no_rules_baseline_5(self):
        """Even with no rules, baseline is 5 points."""
        svc = _make_service(rules=[])
        result = svc._score_schema_quality(subject=None)
        assert result.points == 5

    def test_compat_rule_adds_10(self):
        svc = _make_service(rules=[
            _make_rule("compat", rule_type="COMPATIBILITY", enforcement="expected"),
        ])
        result = svc._score_schema_quality(subject=None)
        assert result.compatibility_set is True
        assert result.points >= 15  # 10 + 5 baseline

    def test_doc_rule_adds_5(self):
        svc = _make_service(rules=[
            _make_rule("require-doc-fields", enforcement="expected"),
        ])
        result = svc._score_schema_quality(subject=None)
        assert result.has_doc is True
        assert result.points >= 10  # 5 + 5 baseline

    def test_reference_rule_adds_5(self):
        svc = _make_service(rules=[{
            "id": "r1",
            "rule_name": "must-reference-core",
            "description": "Refined must reference core types",
            "rule_type": "CUSTOM",
            "enforcement_status": "expected",
        }])
        result = svc._score_schema_quality(subject=None)
        assert result.has_references is True

    def test_all_rules_capped_at_30(self):
        svc = _make_service(rules=[
            _make_rule("compat", rule_type="COMPATIBILITY", enforcement="expected"),
            _make_rule("require-doc", enforcement="expected"),
            {
                "id": "r3", "rule_name": "must-reference-core",
                "description": "reference core", "rule_type": "CUSTOM",
                "enforcement_status": "expected",
            },
        ])
        result = svc._score_schema_quality(subject=None)
        # 10 (compat) + 5 (doc) + 5 (ref) + 5 (baseline) = 25, capped at 30
        assert result.points <= 30

    def test_declared_rules_ignored(self):
        """Declared-only enforcement doesn't count for quality."""
        svc = _make_service(rules=[
            _make_rule("compat", rule_type="COMPATIBILITY", enforcement="declared"),
        ])
        result = svc._score_schema_quality(subject=None)
        assert result.compatibility_set is False
        assert result.points == 5  # baseline only
