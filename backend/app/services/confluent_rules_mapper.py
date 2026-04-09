"""
event7 - Confluent Data Contract Mapper
Maps Confluent ruleSet + metadata to event7 GovernanceRule model.

Bidirectional:
  - import_ruleset(): Confluent ruleSet → list[GovernanceRuleCreate]
  - export_ruleset(): list[GovernanceRuleResponse] → Confluent ruleSet dict

Confluent ruleSet format:
  {
    "domainRules": [{"name", "kind", "type", "mode", "expr", "tags", "onSuccess", "onFailure", "params", "doc"}],
    "migrationRules": [{"name", "kind", "type", "mode", "expr"}]
  }

Confluent metadata format:
  {
    "properties": {"owner": "team-x", ...},
    "tags": {"User.email": ["PII", "SENSITIVE"], ...}
  }
"""

from app.models.governance_rules import (
    GovernanceRuleCreate,
    GovernanceRuleResponse,
    RuleCategory,
    RuleKind,
    RuleMode,
    RuleScope,
    RuleSeverity,
    EvaluationSource,
    EnforcementStatus,
    TargetType,
)

# ── Confluent → event7 mappings ──

_KIND_MAP = {
    "CONDITION": RuleKind.CONDITION,
    "TRANSFORM": RuleKind.TRANSFORM,
}

_MODE_MAP = {
    "WRITE": RuleMode.WRITE,
    "READ": RuleMode.READ,
    "WRITEREAD": RuleMode.READWRITE,
    "UPGRADE": RuleMode.UPGRADE,
    "DOWNGRADE": RuleMode.DOWNGRADE,
    "UPDOWN": RuleMode.UPDOWN,
}

# Reverse mappings for export
_KIND_REVERSE = {v: k for k, v in _KIND_MAP.items()}
_MODE_REVERSE = {
    RuleMode.WRITE: "WRITE",
    RuleMode.READ: "READ",
    RuleMode.READWRITE: "WRITEREAD",
    RuleMode.UPGRADE: "UPGRADE",
    RuleMode.DOWNGRADE: "DOWNGRADE",
    RuleMode.UPDOWN: "UPDOWN",
    RuleMode.REGISTER: "WRITE",  # fallback
}


def import_ruleset(
    subject: str,
    rule_set: dict,
    metadata: dict | None = None,
) -> list[GovernanceRuleCreate]:
    """Convert Confluent ruleSet + metadata to event7 GovernanceRuleCreate objects.

    Args:
        subject: Schema subject name
        rule_set: Confluent ruleSet dict with domainRules and/or migrationRules
        metadata: Optional Confluent metadata dict with properties and tags

    Returns:
        List of GovernanceRuleCreate ready to insert via governance_rules_service
    """
    rules: list[GovernanceRuleCreate] = []

    # ── Domain rules (CONDITION / TRANSFORM) ──
    for cr in rule_set.get("domainRules", []):
        rule = _map_confluent_rule(subject, cr, is_migration=False)
        if rule:
            rules.append(rule)

    # ── Migration rules (UPGRADE / DOWNGRADE / UPDOWN) ──
    for cr in rule_set.get("migrationRules", []):
        rule = _map_confluent_rule(subject, cr, is_migration=True)
        if rule:
            rules.append(rule)

    # ── PII tags from metadata → policy rules ──
    if metadata and metadata.get("tags"):
        pii_rules = _map_metadata_tags(subject, metadata["tags"])
        rules.extend(pii_rules)

    return rules


def export_ruleset(rules: list[GovernanceRuleResponse]) -> dict:
    """Convert event7 GovernanceRules back to Confluent ruleSet format.

    Only exports rules that have a Confluent-compatible structure
    (CONDITION/TRANSFORM with CEL/CEL_FIELD type).
    """
    domain_rules = []
    migration_rules = []

    for rule in rules:
        cr = _to_confluent_rule(rule)
        if not cr:
            continue

        if rule.rule_mode in (RuleMode.UPGRADE, RuleMode.DOWNGRADE, RuleMode.UPDOWN):
            migration_rules.append(cr)
        else:
            domain_rules.append(cr)

    result: dict = {}
    if domain_rules:
        result["domainRules"] = domain_rules
    if migration_rules:
        result["migrationRules"] = migration_rules

    return result


def extract_pii_fields(metadata: dict | None) -> list[dict]:
    """Extract PII field annotations from Confluent metadata.tags.

    Returns a list of {"field": "User.email", "tags": ["PII", "SENSITIVE"]} dicts.
    """
    if not metadata or not metadata.get("tags"):
        return []

    pii_fields = []
    for field_path, tags in metadata["tags"].items():
        if isinstance(tags, list) and tags:
            pii_fields.append({"field": field_path, "tags": tags})

    return pii_fields


# ── Internal mappers ──


def _map_confluent_rule(
    subject: str, cr: dict, is_migration: bool
) -> GovernanceRuleCreate | None:
    """Map a single Confluent rule to GovernanceRuleCreate."""
    name = cr.get("name")
    if not name:
        return None

    kind_str = cr.get("kind", "CONDITION")
    kind = _KIND_MAP.get(kind_str, RuleKind.CONDITION)

    mode_str = cr.get("mode", "WRITE")
    mode = _MODE_MAP.get(mode_str, RuleMode.WRITE)

    rule_type = cr.get("type", "CEL")

    # Determine category based on rule characteristics
    if is_migration:
        category = RuleCategory.MIGRATION
        scope = RuleScope.CONTROL_PLANE
    elif kind == RuleKind.TRANSFORM:
        category = RuleCategory.DATA_TRANSFORM
        scope = RuleScope.RUNTIME
    else:
        category = RuleCategory.DATA_QUALITY
        scope = RuleScope.RUNTIME

    # Map onFailure to severity hint
    on_failure = cr.get("onFailure", cr.get("onFailure"))
    severity = RuleSeverity.ERROR
    if on_failure == "DLQ":
        severity = RuleSeverity.WARNING
    elif on_failure == "ERROR":
        severity = RuleSeverity.ERROR
    elif on_failure == "NONE":
        severity = RuleSeverity.INFO

    tags = cr.get("tags", [])

    return GovernanceRuleCreate(
        subject=subject,
        rule_name=name,
        description=cr.get("doc"),
        rule_scope=scope,
        rule_category=category,
        rule_kind=kind,
        rule_type=rule_type,
        rule_mode=mode,
        expression=cr.get("expr"),
        params=cr.get("params", {}),
        tags=tags if isinstance(tags, list) else [],
        on_success=cr.get("onSuccess"),
        on_failure=on_failure,
        severity=severity,
        enforcement_status=EnforcementStatus.SYNCED,
        evaluation_source=EvaluationSource.PROVIDER_CONFIG,
        target_type=TargetType.SUBJECT,
        target_ref=subject,
    )


def _map_metadata_tags(subject: str, tags: dict) -> list[GovernanceRuleCreate]:
    """Convert Confluent metadata.tags (PII field annotations) to policy rules."""
    rules = []

    # Group by tag type
    pii_fields = []
    for field_path, tag_list in tags.items():
        if isinstance(tag_list, list):
            for tag in tag_list:
                if tag.upper() in ("PII", "SENSITIVE", "CONFIDENTIAL"):
                    pii_fields.append(field_path)
                    break

    if pii_fields:
        rules.append(GovernanceRuleCreate(
            subject=subject,
            rule_name=f"pii-fields-{subject.split('.')[-1].lower()}",
            description=f"PII fields detected from Confluent metadata: {', '.join(pii_fields)}",
            rule_scope=RuleScope.DECLARATIVE,
            rule_category=RuleCategory.DATA_QUALITY,
            rule_kind=RuleKind.POLICY,
            rule_type="CUSTOM",
            rule_mode=RuleMode.READWRITE,
            params={"pii_fields": pii_fields, "source": "confluent_metadata"},
            tags=["PII", "imported"],
            severity=RuleSeverity.WARNING,
            enforcement_status=EnforcementStatus.SYNCED,
            evaluation_source=EvaluationSource.PROVIDER_CONFIG,
            target_type=TargetType.SUBJECT,
            target_ref=subject,
        ))

    return rules


def _to_confluent_rule(rule: GovernanceRuleResponse) -> dict | None:
    """Convert an event7 rule back to Confluent ruleSet format.

    Only converts rules with CEL/CEL_FIELD/JSONATA types.
    """
    if rule.rule_type not in ("CEL", "CEL_FIELD", "JSONATA"):
        return None

    cr: dict = {"name": rule.rule_name}

    if rule.description:
        cr["doc"] = rule.description

    kind_str = _KIND_REVERSE.get(rule.rule_kind)
    if kind_str:
        cr["kind"] = kind_str
    else:
        return None  # VALIDATION/POLICY don't map to Confluent

    cr["type"] = rule.rule_type
    cr["mode"] = _MODE_REVERSE.get(rule.rule_mode, "WRITE")

    if rule.expression:
        cr["expr"] = rule.expression

    if rule.tags:
        cr["tags"] = rule.tags

    if rule.on_success:
        cr["onSuccess"] = rule.on_success
    if rule.on_failure:
        cr["onFailure"] = rule.on_failure

    if rule.params:
        cr["params"] = rule.params

    return cr
