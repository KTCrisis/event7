"""
Tests for rules_context_resolver — contextual severity adjustment.

Covers: build_schema_context, resolve_severity, _shift_severity,
        all classification/binding/layer branches, delta stacking, clamping.
"""

import pytest

from app.services.rules_context_resolver import (
    SchemaContext,
    build_schema_context,
    resolve_severity,
    _shift_severity,
)


# ================================================================
# build_schema_context
# ================================================================


class TestBuildSchemaContext:

    def test_no_enrichment_no_bindings(self):
        ctx = build_schema_context(None, [])
        assert ctx.classification == "internal"
        assert ctx.data_layer is None
        assert ctx.binding_count == 0
        assert ctx.tags is None

    def test_no_enrichment_with_bindings(self):
        bindings = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        ctx = build_schema_context(None, bindings)
        assert ctx.binding_count == 3
        assert ctx.classification == "internal"

    def test_full_enrichment(self):
        enrichment = {
            "classification": "restricted",
            "data_layer": "core",
            "tags": ["pci", "gdpr"],
        }
        bindings = [{"id": "1"}]
        ctx = build_schema_context(enrichment, bindings)
        assert ctx.classification == "restricted"
        assert ctx.data_layer == "core"
        assert ctx.binding_count == 1
        assert ctx.tags == ["pci", "gdpr"]

    def test_enrichment_missing_classification_defaults(self):
        ctx = build_schema_context({"classification": None}, [])
        assert ctx.classification == "internal"

    def test_enrichment_empty_classification_defaults(self):
        ctx = build_schema_context({"classification": ""}, [])
        assert ctx.classification == "internal"

    def test_to_dict(self):
        ctx = SchemaContext(classification="restricted", data_layer="core", binding_count=5)
        d = ctx.to_dict()
        assert d["classification"] == "restricted"
        assert d["data_layer"] == "core"
        assert d["binding_count"] == 5


# ================================================================
# _shift_severity
# ================================================================


class TestShiftSeverity:

    def test_shift_up_one(self):
        assert _shift_severity("info", 1) == "warning"
        assert _shift_severity("warning", 1) == "error"
        assert _shift_severity("error", 1) == "critical"

    def test_shift_down_one(self):
        assert _shift_severity("critical", -1) == "error"
        assert _shift_severity("error", -1) == "warning"
        assert _shift_severity("warning", -1) == "info"

    def test_clamp_at_critical(self):
        assert _shift_severity("critical", 1) == "critical"
        assert _shift_severity("error", 5) == "critical"

    def test_clamp_at_info(self):
        assert _shift_severity("info", -1) == "info"
        assert _shift_severity("warning", -5) == "info"

    def test_zero_delta(self):
        assert _shift_severity("warning", 0) == "warning"

    def test_unknown_severity_unchanged(self):
        assert _shift_severity("unknown_level", 1) == "unknown_level"

    def test_large_positive_delta(self):
        assert _shift_severity("info", 100) == "critical"

    def test_large_negative_delta(self):
        assert _shift_severity("critical", -100) == "info"


# ================================================================
# resolve_severity — Classification
# ================================================================


class TestResolveSeverityClassification:

    def test_restricted_escalates_by_one(self):
        ctx = SchemaContext(classification="restricted")
        assert resolve_severity("warning", ctx) == "error"
        assert resolve_severity("info", ctx) == "warning"
        assert resolve_severity("error", ctx) == "critical"

    def test_restricted_clamps_at_critical(self):
        ctx = SchemaContext(classification="restricted")
        assert resolve_severity("critical", ctx) == "critical"

    def test_confidential_escalates_only_error_plus(self):
        ctx = SchemaContext(classification="confidential")
        # error+ → escalate
        assert resolve_severity("error", ctx) == "critical"
        assert resolve_severity("critical", ctx) == "critical"
        # below error → no change
        assert resolve_severity("warning", ctx) == "warning"
        assert resolve_severity("info", ctx) == "info"

    def test_internal_no_change(self):
        ctx = SchemaContext(classification="internal")
        assert resolve_severity("warning", ctx) == "warning"

    def test_public_no_change(self):
        ctx = SchemaContext(classification="public")
        assert resolve_severity("error", ctx) == "error"

    def test_case_insensitive(self):
        ctx = SchemaContext(classification="RESTRICTED")
        assert resolve_severity("warning", ctx) == "error"


# ================================================================
# resolve_severity — Binding count
# ================================================================


class TestResolveSeverityBindings:

    def test_zero_bindings_no_change(self):
        ctx = SchemaContext(binding_count=0)
        assert resolve_severity("warning", ctx) == "warning"

    def test_four_bindings_no_change(self):
        ctx = SchemaContext(binding_count=4)
        assert resolve_severity("warning", ctx) == "warning"

    def test_five_bindings_plus_one(self):
        ctx = SchemaContext(binding_count=5)
        assert resolve_severity("warning", ctx) == "error"

    def test_nine_bindings_plus_one(self):
        ctx = SchemaContext(binding_count=9)
        assert resolve_severity("info", ctx) == "warning"

    def test_ten_bindings_plus_two(self):
        ctx = SchemaContext(binding_count=10)
        assert resolve_severity("warning", ctx) == "critical"

    def test_hundred_bindings_plus_two(self):
        ctx = SchemaContext(binding_count=100)
        assert resolve_severity("info", ctx) == "error"


# ================================================================
# resolve_severity — Data layer
# ================================================================


class TestResolveSeverityDataLayer:

    def test_raw_deescalates(self):
        ctx = SchemaContext(data_layer="raw")
        assert resolve_severity("warning", ctx) == "info"
        assert resolve_severity("error", ctx) == "warning"

    def test_raw_clamps_at_info(self):
        ctx = SchemaContext(data_layer="raw")
        assert resolve_severity("info", ctx) == "info"

    def test_application_escalates(self):
        ctx = SchemaContext(data_layer="application")
        assert resolve_severity("warning", ctx) == "error"

    def test_core_no_change(self):
        ctx = SchemaContext(data_layer="core")
        assert resolve_severity("warning", ctx) == "warning"

    def test_refined_no_change(self):
        ctx = SchemaContext(data_layer="refined")
        assert resolve_severity("warning", ctx) == "warning"

    def test_null_layer_no_change(self):
        ctx = SchemaContext(data_layer=None)
        assert resolve_severity("error", ctx) == "error"

    def test_case_insensitive(self):
        ctx = SchemaContext(data_layer="RAW")
        assert resolve_severity("warning", ctx) == "info"


# ================================================================
# resolve_severity — Delta stacking
# ================================================================


class TestResolveSeverityStacking:

    def test_restricted_plus_ten_bindings_plus_application(self):
        """restricted(+1) + 10 bindings(+2) + application(+1) = +4"""
        ctx = SchemaContext(
            classification="restricted",
            binding_count=10,
            data_layer="application",
        )
        # info(0) + 4 = critical(3) clamped
        assert resolve_severity("info", ctx) == "critical"

    def test_restricted_plus_five_bindings(self):
        """restricted(+1) + 5 bindings(+1) = +2"""
        ctx = SchemaContext(classification="restricted", binding_count=5)
        assert resolve_severity("warning", ctx) == "critical"

    def test_raw_minus_one_cancels_restricted_plus_one(self):
        """restricted(+1) + raw(-1) = 0"""
        ctx = SchemaContext(classification="restricted", data_layer="raw")
        assert resolve_severity("warning", ctx) == "warning"

    def test_raw_with_zero_bindings(self):
        """raw(-1) + 0 bindings(0) = -1"""
        ctx = SchemaContext(data_layer="raw", binding_count=0)
        assert resolve_severity("error", ctx) == "warning"

    def test_no_context_no_change(self):
        """Default context = internal, no layer, 0 bindings → delta 0"""
        ctx = SchemaContext()
        assert resolve_severity("warning", ctx) == "warning"
        assert resolve_severity("error", ctx) == "error"
        assert resolve_severity("info", ctx) == "info"
        assert resolve_severity("critical", ctx) == "critical"

    def test_high_exposure_schema(self):
        """Realistic: restricted + application + 12 bindings = +4"""
        ctx = SchemaContext(
            classification="restricted",
            data_layer="application",
            binding_count=12,
        )
        assert resolve_severity("warning", ctx) == "critical"
        assert resolve_severity("info", ctx) == "critical"

    def test_low_exposure_schema(self):
        """Realistic: internal + raw + 0 bindings = -1"""
        ctx = SchemaContext(
            classification="internal",
            data_layer="raw",
            binding_count=0,
        )
        assert resolve_severity("warning", ctx) == "info"
        assert resolve_severity("info", ctx) == "info"
