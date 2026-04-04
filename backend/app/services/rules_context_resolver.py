"""
event7 - Rules Context Resolver
Adjusts rule severity based on schema enrichment context.

Uses sensible defaults: classification, data_layer, and binding_count
drive severity escalation/de-escalation without any configuration.

Placement: backend/app/services/rules_context_resolver.py
"""

from dataclasses import dataclass, asdict


SEVERITY_LEVELS = ["info", "warning", "error", "critical"]


@dataclass
class SchemaContext:
    """Enrichment context for a schema subject."""

    classification: str = "internal"  # public, internal, confidential, restricted
    data_layer: str | None = None  # raw, core, refined, application
    binding_count: int = 0
    tags: list[str] | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def build_schema_context(
    enrichment: dict | None,
    bindings: list[dict],
) -> SchemaContext:
    """Build a SchemaContext from DB enrichment row and binding list."""
    if enrichment is None:
        return SchemaContext(binding_count=len(bindings))

    return SchemaContext(
        classification=enrichment.get("classification", "internal") or "internal",
        data_layer=enrichment.get("data_layer"),
        binding_count=len(bindings),
        tags=enrichment.get("tags"),
    )


def _shift_severity(base: str, delta: int) -> str:
    """Shift severity by delta levels, clamped to [info, critical]."""
    try:
        idx = SEVERITY_LEVELS.index(base)
    except ValueError:
        return base
    new_idx = max(0, min(len(SEVERITY_LEVELS) - 1, idx + delta))
    return SEVERITY_LEVELS[new_idx]


def resolve_severity(base_severity: str, context: SchemaContext) -> str:
    """
    Resolve effective severity based on enrichment context.

    Default escalation rules:
    1. Classification: restricted → +1, confidential → +1 for error+
    2. Binding count: >=5 → +1, >=10 → +2
    3. Data layer: RAW → -1 (lenient), APPLICATION → +1 (consumer-facing)

    Escalations stack, capped at "critical", floored at "info".
    """
    delta = 0

    # 1. Classification escalation
    classification = context.classification.lower()
    if classification == "restricted":
        delta += 1
    elif classification == "confidential":
        base_idx = SEVERITY_LEVELS.index(base_severity) if base_severity in SEVERITY_LEVELS else 1
        if base_idx >= 2:  # error or above
            delta += 1

    # 2. Binding count escalation
    if context.binding_count >= 10:
        delta += 2
    elif context.binding_count >= 5:
        delta += 1

    # 3. Data layer modulation
    if context.data_layer:
        layer = context.data_layer.lower()
        if layer == "raw":
            delta -= 1
        elif layer == "application":
            delta += 1

    if delta == 0:
        return base_severity

    return _shift_severity(base_severity, delta)
