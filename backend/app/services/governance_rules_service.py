"""
event7 - Governance Rules Service
Logique métier pour les governance rules, policies, templates, et scoring.

Placement: backend/app/services/governance_rules_service.py

Flow: Route → Service → DB (DatabaseProvider) + Cache (Redis)
Pas de provider SR en V1 — les rules sont stockées dans event7 DB uniquement.
Le sync provider (import/push) sera ajouté en V2.

v2: Custom templates support (create, update, delete, clone, is_builtin).
"""

from uuid import UUID

from loguru import logger

from app.cache.redis_cache import RedisCache
from app.db.base import DatabaseProvider
from app.models.governance_rules import (
    ApplyTemplateResponse,
    EnforcementStatus,
    EnrichmentScoreBreakdown,
    EvaluationSource,
    GovernanceRuleCreate,
    GovernanceRuleListResponse,
    GovernanceRuleResponse,
    GovernanceRuleUpdate,
    GovernanceScore,
    GovernanceTemplateClone,
    GovernanceTemplateCreate,
    GovernanceTemplateResponse,
    GovernanceTemplateRule,
    GovernanceTemplateUpdate,
    RuleKind,
    RuleScope,
    RuleScoreBreakdown,
    RuleScopeCount,
    ScoreBreakdown,
    ScoreConfidence,
    SchemaQualityBreakdown,
)


class GovernanceRulesService:
    """
    Couche métier pour les governance rules & policies.
    DB-only en V1 — pas de sync provider.
    """

    CACHE_TTL = 300  # 5 min

    def __init__(
        self,
        cache: RedisCache,
        db: DatabaseProvider,
        registry_id: str,
    ):
        self.cache = cache
        self.db = db
        self.registry_id = registry_id

    def _cache_key(self, *parts: str) -> str:
        return self.cache.cache_key(self.registry_id, "governance", *parts)

    async def _invalidate_cache(self, subject: str | None = None) -> None:
        """Invalidate governance cache for this registry."""
        await self.cache.delete_pattern(
            self._cache_key("*")
        )

    # ================================================================
    # CRUD — Rules & Policies
    # ================================================================

    def list_rules(
        self,
        subject: str | None = None,
        scope: str | None = None,
        kind: str | None = None,
        category: str | None = None,
        severity: str | None = None,
        enforcement_status: str | None = None,
        source: str | None = None,
    ) -> GovernanceRuleListResponse:
        """List governance rules with optional filters."""
        rows = self.db.list_governance_rules(
            registry_id=self.registry_id,
            subject=subject,
            scope=scope,
            kind=kind,
            category=category,
            severity=severity,
            enforcement_status=enforcement_status,
            source=source,
        )

        rules = [GovernanceRuleResponse(**r) for r in rows]

        # Aggregate counts
        by_kind: dict[str, int] = {}
        by_scope: dict[str, int] = {}
        by_enforcement: dict[str, int] = {}
        global_count = 0
        subject_count = 0

        for r in rules:
            by_kind[r.rule_kind.value] = by_kind.get(r.rule_kind.value, 0) + 1
            by_scope[r.rule_scope.value] = by_scope.get(r.rule_scope.value, 0) + 1
            by_enforcement[r.enforcement_status.value] = (
                by_enforcement.get(r.enforcement_status.value, 0) + 1
            )
            if r.subject is None:
                global_count += 1
            else:
                subject_count += 1

        return GovernanceRuleListResponse(
            rules=rules,
            total=len(rules),
            by_kind=by_kind,
            by_scope=by_scope,
            by_enforcement=by_enforcement,
            global_rules=global_count,
            subject_rules=subject_count,
        )

    def get_rule(self, rule_id: str) -> GovernanceRuleResponse | None:
        """Get a single rule by ID."""
        row = self.db.get_governance_rule(rule_id)
        if not row:
            return None
        return GovernanceRuleResponse(**row)

    async def create_rule(
        self,
        payload: GovernanceRuleCreate,
        user_id: str = "",
    ) -> GovernanceRuleResponse:
        """Create a new governance rule with validation."""
        # Validate scope × kind coherence
        self._validate_coherence(payload.rule_scope, payload.rule_kind, payload.enforcement_status)

        data = {
            "registry_id": self.registry_id,
            "subject": payload.subject,
            "rule_name": payload.rule_name,
            "description": payload.description,
            "rule_scope": payload.rule_scope.value,
            "rule_category": payload.rule_category.value,
            "rule_kind": payload.rule_kind.value,
            "rule_type": payload.rule_type,
            "rule_mode": payload.rule_mode.value,
            "expression": payload.expression,
            "params": payload.params,
            "tags": payload.tags,
            "on_success": payload.on_success,
            "on_failure": payload.on_failure,
            "severity": payload.severity.value,
            "enforcement_status": payload.enforcement_status.value,
            "evaluation_source": payload.evaluation_source.value,
            "target_type": payload.target_type.value,
            "target_ref": payload.target_ref,
            "source": "manual",
            "created_by": user_id if user_id else None,
        }

        # Remove None values to let DB defaults kick in
        data = {k: v for k, v in data.items() if v is not None}

        row = self.db.create_governance_rule(data)
        if not row:
            raise ValueError("Failed to create governance rule")

        await self._invalidate_cache(payload.subject)

        logger.info(
            f"Governance rule created: {payload.rule_name} "
            f"[{payload.rule_scope.value}/{payload.rule_kind.value}] "
            f"on registry={self.registry_id}"
        )

        # Audit
        self.db.log_audit(
            user_id=user_id,
            registry_id=self.registry_id,
            action="governance_rule_create",
            details={
                "rule_name": payload.rule_name,
                "rule_scope": payload.rule_scope.value,
                "rule_kind": payload.rule_kind.value,
                "subject": payload.subject,
            },
        )

        return GovernanceRuleResponse(**row)

    async def update_rule(
        self,
        rule_id: str,
        payload: GovernanceRuleUpdate,
        user_id: str = "",
    ) -> GovernanceRuleResponse | None:
        """Update a governance rule."""
        existing = self.db.get_governance_rule(rule_id)
        if not existing:
            return None

        # Build update data (only non-None fields)
        data: dict = {}
        for field_name, value in payload.model_dump(exclude_none=True).items():
            if hasattr(value, "value"):
                data[field_name] = value.value  # Enum → string
            else:
                data[field_name] = value

        if not data:
            return GovernanceRuleResponse(**existing)

        # Validate coherence with merged state
        new_scope = data.get("rule_scope", existing["rule_scope"])
        new_kind = data.get("rule_kind", existing["rule_kind"])
        new_enforcement = data.get("enforcement_status", existing["enforcement_status"])
        self._validate_coherence(new_scope, new_kind, new_enforcement)

        row = self.db.update_governance_rule(rule_id, data)
        if not row:
            return None

        await self._invalidate_cache(existing.get("subject"))

        logger.info(f"Governance rule updated: {rule_id}")

        self.db.log_audit(
            user_id=user_id,
            registry_id=self.registry_id,
            action="governance_rule_update",
            details={"rule_id": rule_id, "fields_updated": list(data.keys())},
        )

        return GovernanceRuleResponse(**row)

    async def delete_rule(self, rule_id: str, user_id: str = "") -> bool:
        """Delete a governance rule."""
        existing = self.db.get_governance_rule(rule_id)
        if not existing:
            return False

        deleted = self.db.delete_governance_rule(rule_id)
        if deleted:
            await self._invalidate_cache(existing.get("subject"))
            logger.info(f"Governance rule deleted: {rule_id}")

            self.db.log_audit(
                user_id=user_id,
                registry_id=self.registry_id,
                action="governance_rule_delete",
                details={
                    "rule_id": rule_id,
                    "rule_name": existing.get("rule_name"),
                },
            )

        return deleted

    # ================================================================
    # TEMPLATES — Read + Apply
    # ================================================================

    def list_templates(self) -> list[GovernanceTemplateResponse]:
        """List all governance rule templates (builtin + custom)."""
        rows = self.db.list_governance_templates()
        return [self._row_to_template(r) for r in rows]

    def get_template(self, template_id: str) -> GovernanceTemplateResponse | None:
        """Get a single template."""
        r = self.db.get_governance_template(template_id)
        return self._row_to_template(r) if r else None

    async def apply_template(
        self,
        template_id: str,
        subject: str | None,
        overwrite: bool = False,
        user_id: str = "",
    ) -> ApplyTemplateResponse:
        """Apply a template: create governance_rules from template definitions."""
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")

        created = 0
        skipped = 0
        updated = 0
        rule_ids: list[UUID] = []

        for rule_def in template.rules:
            # Check if rule already exists
            existing_rules = self.db.list_governance_rules(
                registry_id=self.registry_id,
                subject=subject,
            )
            existing_names = {r["rule_name"] for r in existing_rules if r.get("subject") == subject}

            if rule_def.rule_name in existing_names:
                if overwrite:
                    # Find and update existing
                    match = next(
                        (r for r in existing_rules
                         if r["rule_name"] == rule_def.rule_name and r.get("subject") == subject),
                        None,
                    )
                    if match:
                        update_data = self._template_rule_to_dict(rule_def, template)
                        row = self.db.update_governance_rule(match["id"], update_data)
                        if row:
                            rule_ids.append(UUID(row["id"]))
                            updated += 1
                else:
                    skipped += 1
                continue

            # Create new rule from template
            data = self._template_rule_to_dict(rule_def, template)
            data.update({
                "registry_id": self.registry_id,
                "subject": subject,
                "rule_name": rule_def.rule_name,
                "source": "template",
                "origin_template_id": str(template.id),
                "created_by": user_id if user_id else None,
            })

            # Remove None values
            data = {k: v for k, v in data.items() if v is not None}

            row = self.db.create_governance_rule(data)
            if row:
                rule_ids.append(UUID(row["id"]))
                created += 1

        await self._invalidate_cache(subject)

        logger.info(
            f"Template '{template.template_name}' applied: "
            f"{created} created, {skipped} skipped, {updated} updated"
        )

        self.db.log_audit(
            user_id=user_id,
            registry_id=self.registry_id,
            action="governance_template_apply",
            details={
                "template_name": template.template_name,
                "subject": subject,
                "created": created,
                "skipped": skipped,
                "updated": updated,
            },
        )

        return ApplyTemplateResponse(
            template_name=template.template_name,
            rules_created=created,
            rules_skipped=skipped,
            rules_updated=updated,
            rule_ids=rule_ids,
        )

    # ================================================================
    # TEMPLATES — Custom CRUD
    # ================================================================

    def create_template(
        self,
        payload: GovernanceTemplateCreate,
    ) -> GovernanceTemplateResponse:
        """Create a custom governance template."""
        rules_data = [rule.model_dump() for rule in payload.rules]

        data = {
            "template_name": payload.template_name,
            "display_name": payload.display_name,
            "description": payload.description,
            "layer": payload.layer,
            "is_builtin": False,
            "rules": rules_data,
        }
        data = {k: v for k, v in data.items() if v is not None}

        try:
            row = self.db.create_governance_template(data)
        except Exception as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValueError(f"Template name '{payload.template_name}' already exists")
            raise

        if not row:
            raise ValueError("Failed to create template")

        logger.info(f"Custom template created: {payload.template_name}")
        return self._row_to_template(row)

    def update_template(
        self,
        template_id: str,
        payload: GovernanceTemplateUpdate,
    ) -> GovernanceTemplateResponse | None:
        """Update a governance template.
        Builtin templates: only description and rules can be modified.
        Custom templates: all fields can be modified.
        """
        existing = self.db.get_governance_template(template_id)
        if not existing:
            return None

        is_builtin = existing.get("is_builtin", False)

        data: dict = {}
        if payload.display_name is not None:
            if is_builtin:
                raise ValueError("Cannot rename a builtin template")
            data["display_name"] = payload.display_name
        if payload.description is not None:
            data["description"] = payload.description
        if payload.layer is not None:
            if is_builtin:
                raise ValueError("Cannot change layer of a builtin template")
            data["layer"] = payload.layer
        if payload.rules is not None:
            data["rules"] = [rule.model_dump() for rule in payload.rules]

        if not data:
            return self._row_to_template(existing)

        row = self.db.update_governance_template(template_id, data)
        if not row:
            return None

        logger.info(f"Template updated: {template_id}")
        return self._row_to_template(row)

    def delete_template(self, template_id: str) -> bool:
        """Delete a custom template. Builtin templates cannot be deleted."""
        existing = self.db.get_governance_template(template_id)
        if not existing:
            return False

        if existing.get("is_builtin", False):
            raise ValueError("Cannot delete a builtin template")

        deleted = self.db.delete_governance_template(template_id)
        if deleted:
            logger.info(f"Custom template deleted: {template_id}")
        return deleted

    def clone_template(
        self,
        template_id: str,
        payload: GovernanceTemplateClone,
    ) -> GovernanceTemplateResponse:
        """Clone a template (builtin or custom) with a new name."""
        source = self.db.get_governance_template(template_id)
        if not source:
            raise ValueError(f"Source template {template_id} not found")

        rules_data = source.get("rules", [])

        data = {
            "template_name": payload.template_name,
            "display_name": payload.display_name,
            "description": payload.description or source.get("description"),
            "layer": payload.layer or source.get("layer"),
            "is_builtin": False,
            "rules": rules_data,
        }
        data = {k: v for k, v in data.items() if v is not None}
        try:
            row = self.db.create_governance_template(data)
        except Exception as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValueError(f"Template name '{payload.template_name}' already exists")
            raise

        if not row:
            raise ValueError("Failed to clone template — name may already exist")

        return self._row_to_template(row)

    # ================================================================
    # TEMPLATES — Helpers
    # ================================================================

    def _row_to_template(self, r: dict) -> GovernanceTemplateResponse:
        """Convert a DB row to GovernanceTemplateResponse."""
        raw_rules = r.get("rules", [])
        typed_rules = [GovernanceTemplateRule(**rule) for rule in raw_rules]
        return GovernanceTemplateResponse(
            id=r["id"],
            template_name=r["template_name"],
            display_name=r["display_name"],
            description=r.get("description"),
            layer=r.get("layer"),
            is_builtin=r.get("is_builtin", False),
            rules=typed_rules,
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )

    # ================================================================
    # SCORING
    # ================================================================

    async def compute_score(self, subject: str | None = None) -> GovernanceScore:
        """
        Compute governance score for a subject or the whole registry.
        Calculated on the fly (never stored).
        Three axes: Enrichments (20pts) + Rules (50pts) + Schema Quality (30pts).
        """
        # --- Axis 1: Enrichments (20 pts) ---
        enrichment_breakdown = self._score_enrichments(subject)

        # --- Axis 2: Rules & Policies (50 pts) ---
        rule_breakdown = self._score_rules(subject)

        # --- Axis 3: Schema Quality (30 pts) ---
        quality_breakdown = self._score_schema_quality(subject)

        # --- Total ---
        total = (
            enrichment_breakdown.points
            + rule_breakdown.points
            + quality_breakdown.points
        )
        total = max(0, min(100, total))

        grade = self._compute_grade(total)
        confidence = self._compute_confidence(rule_breakdown)

        return GovernanceScore(
            registry_id=UUID(self.registry_id),
            subject=subject,
            score=total,
            max_score=100,
            grade=grade,
            confidence=confidence,
            breakdown=ScoreBreakdown(
                enrichments=enrichment_breakdown,
                rules=rule_breakdown,
                schema_quality=quality_breakdown,
            ),
        )

    # ================================================================
    # SCORING — Private Helpers
    # ================================================================

    def _score_enrichments(self, subject: str | None) -> EnrichmentScoreBreakdown:
        """Score enrichment metadata (20 pts max)."""
        if subject is None:
            enrichments = self.db.get_enrichments_for_registry(self.registry_id)
            if not enrichments:
                return EnrichmentScoreBreakdown()

            total_pts = 0
            for e in enrichments:
                total_pts += self._enrichment_points(e)
            avg = round(total_pts / len(enrichments))

            return EnrichmentScoreBreakdown(
                has_description=any(e.get("description") for e in enrichments),
                has_owner=any(e.get("owner_team") for e in enrichments),
                has_tags=any(e.get("tags") for e in enrichments),
                has_classification=any(
                    e.get("classification", "internal") != "internal" for e in enrichments
                ),
                points=avg,
                max_points=20,
            )

        enrichment = self.db.get_enrichment(self.registry_id, subject)
        if not enrichment:
            return EnrichmentScoreBreakdown()

        has_desc = bool(enrichment.get("description"))
        has_owner = bool(enrichment.get("owner_team"))
        has_tags = bool(enrichment.get("tags") and len(enrichment["tags"]) > 0)
        has_class = enrichment.get("classification", "internal") != "internal"

        pts = self._enrichment_points(enrichment)

        return EnrichmentScoreBreakdown(
            has_description=has_desc,
            has_owner=has_owner,
            has_tags=has_tags,
            has_classification=has_class,
            points=pts,
            max_points=20,
        )

    @staticmethod
    def _enrichment_points(enrichment: dict) -> int:
        """Calculate enrichment points for a single entry."""
        pts = 0
        if enrichment.get("description"):
            pts += 5
        if enrichment.get("owner_team"):
            pts += 5
        if enrichment.get("tags") and len(enrichment["tags"]) > 0:
            pts += 5
        if enrichment.get("classification", "internal") != "internal":
            pts += 5
        return pts

    def _score_rules(self, subject: str | None) -> RuleScoreBreakdown:
        """Score rules & policies (50 pts max)."""
        rows = self.db.list_governance_rules(
            registry_id=self.registry_id,
            subject=subject,
        )

        if not rows:
            return RuleScoreBreakdown()

        POINTS = {
            ("verifiable", "critical"): 15,
            ("verifiable", "error"): 10,
            ("verifiable", "warning"): 5,
            ("verifiable", "info"): 2,
            ("declarative", "critical"): 10,
            ("declarative", "error"): 7,
            ("declarative", "warning"): 3,
            ("declarative", "info"): 1,
        }

        total_points = 0
        max_points = 0
        total_rules = 0
        total_policies = 0
        by_scope: dict[str, RuleScopeCount] = {}
        by_eval_source: dict[str, int] = {}
        severity_met = {"critical": 0, "error": 0, "warning": 0}
        severity_total = {"critical": 0, "error": 0, "warning": 0}

        for r in rows:
            enforcement = r.get("enforcement_status", "declared")

            if enforcement == "declared":
                continue

            scope = r.get("rule_scope", "declarative")
            kind = r.get("rule_kind", "POLICY")
            severity = r.get("severity", "warning")
            eval_source = r.get("evaluation_source", "declared_only")

            if kind == "POLICY":
                total_policies += 1
            else:
                total_rules += 1

            if scope not in by_scope:
                by_scope[scope] = RuleScopeCount()
            by_scope[scope].total += 1

            by_eval_source[eval_source] = by_eval_source.get(eval_source, 0) + 1

            is_verifiable = eval_source in ("provider_config", "schema_content")
            weight_group = "verifiable" if is_verifiable else "declarative"

            rule_max = POINTS.get((weight_group, severity), 1)
            max_points += rule_max

            if severity in severity_total:
                severity_total[severity] += 1

            is_met = self._is_rule_met(r)

            if is_met:
                total_points += rule_max
                by_scope[scope].met += 1
                if severity in severity_met:
                    severity_met[severity] += 1
            else:
                if severity != "info":
                    total_points -= rule_max

        if max_points > 0:
            normalized = round((total_points / max_points) * 50)
            normalized = max(0, min(50, normalized))
        else:
            normalized = 0

        return RuleScoreBreakdown(
            total_rules=total_rules,
            total_policies=total_policies,
            by_scope=by_scope,
            by_evaluation_source=by_eval_source,
            critical_met=severity_met["critical"],
            critical_total=severity_total["critical"],
            error_met=severity_met["error"],
            error_total=severity_total["error"],
            warning_met=severity_met["warning"],
            warning_total=severity_total["warning"],
            points=normalized,
            max_points=50,
        )

    @staticmethod
    def _is_rule_met(rule: dict) -> bool:
        """Determine if a rule is considered 'met' based on scope and enforcement."""
        scope = rule.get("rule_scope", "declarative")
        enforcement = rule.get("enforcement_status", "declared")
        eval_source = rule.get("evaluation_source", "declared_only")

        if scope in ("runtime", "control_plane"):
            return enforcement in ("synced", "verified")

        if scope in ("declarative", "audit"):
            if eval_source == "declared_only":
                return enforcement == "expected"
            return enforcement == "expected"

        return False

    def _score_schema_quality(self, subject: str | None) -> SchemaQualityBreakdown:
        """
        Score schema quality (30 pts max).
        V1: basic heuristics from what we can check in DB.
        """
        rules = self.db.list_governance_rules(
            registry_id=self.registry_id,
            subject=subject,
        )

        has_compat_rule = any(
            r.get("rule_type") == "COMPATIBILITY"
            and r.get("enforcement_status") in ("synced", "verified", "expected")
            for r in rules
        )

        has_doc_rule = any(
            "doc" in (r.get("rule_name", "") + r.get("description", "")).lower()
            and r.get("enforcement_status") in ("expected", "synced", "verified")
            for r in rules
        )

        has_ref_rule = any(
            "reference" in (r.get("rule_name", "") + r.get("description", "")).lower()
            and r.get("enforcement_status") in ("expected", "synced", "verified")
            for r in rules
        )

        pts = 0
        if has_compat_rule:
            pts += 10
        if has_doc_rule:
            pts += 5
        if has_ref_rule:
            pts += 5
        pts += 5  # baseline for having any governance rules at all
        pts = min(30, pts)

        return SchemaQualityBreakdown(
            has_doc=has_doc_rule,
            has_references=has_ref_rule,
            version_count=0,
            compatibility_set=has_compat_rule,
            points=pts,
            max_points=30,
        )

    @staticmethod
    def _compute_grade(score: int) -> str:
        """Convert numeric score to letter grade."""
        if score >= 90:
            return "A"
        elif score >= 75:
            return "B"
        elif score >= 60:
            return "C"
        elif score >= 40:
            return "D"
        else:
            return "F"

    @staticmethod
    def _compute_confidence(rule_breakdown: RuleScoreBreakdown) -> ScoreConfidence:
        """Compute confidence based on evaluation source distribution."""
        total = sum(rule_breakdown.by_evaluation_source.values())
        if total == 0:
            return ScoreConfidence.LOW

        verifiable = (
            rule_breakdown.by_evaluation_source.get("provider_config", 0)
            + rule_breakdown.by_evaluation_source.get("schema_content", 0)
        )

        ratio = verifiable / total
        if ratio >= 0.7:
            return ScoreConfidence.HIGH
        elif ratio >= 0.4:
            return ScoreConfidence.MEDIUM
        else:
            return ScoreConfidence.LOW

    # ================================================================
    # VALIDATION — Coherence Checks
    # ================================================================

    @staticmethod
    def _validate_coherence(
        scope: str | RuleScope,
        kind: str | RuleKind,
        enforcement: str | EnforcementStatus,
    ) -> None:
        """
        Validate scope × kind × enforcement coherence.
        Mirrors the SQL CHECK constraints — fail fast before hitting DB.
        """
        scope_val = scope.value if hasattr(scope, "value") else scope
        kind_val = kind.value if hasattr(kind, "value") else kind
        enforcement_val = enforcement.value if hasattr(enforcement, "value") else enforcement

        if enforcement_val in ("synced", "verified", "drifted"):
            if scope_val not in ("runtime", "control_plane"):
                raise ValueError(
                    f"enforcement_status '{enforcement_val}' requires scope "
                    f"'runtime' or 'control_plane', got '{scope_val}'"
                )

        if kind_val == "POLICY" and enforcement_val in ("synced", "verified", "drifted"):
            raise ValueError(
                f"POLICY rules cannot have enforcement_status '{enforcement_val}'"
            )

        valid = False
        if kind_val in ("CONDITION", "TRANSFORM") and scope_val == "runtime":
            valid = True
        elif kind_val == "VALIDATION" and scope_val == "control_plane":
            valid = True
        elif kind_val == "POLICY":
            valid = True
        elif kind_val == "CONDITION" and scope_val == "audit":
            valid = True

        if not valid:
            raise ValueError(
                f"Incoherent kind × scope: {kind_val} cannot be {scope_val}"
            )

    # ================================================================
    # HELPERS
    # ================================================================

    @staticmethod
    def _template_rule_to_dict(
        rule_def: GovernanceTemplateRule,
        template: GovernanceTemplateResponse,
    ) -> dict:
        """Convert a template rule definition to a dict for DB insert/update."""
        data = {
            "description": rule_def.description,
            "rule_scope": rule_def.rule_scope.value,
            "rule_category": rule_def.rule_category.value,
            "rule_kind": rule_def.rule_kind.value,
            "rule_type": rule_def.rule_type,
            "rule_mode": rule_def.rule_mode.value,
            "expression": rule_def.expression,
            "params": rule_def.params,
            "on_success": rule_def.on_success,
            "on_failure": rule_def.on_failure,
            "severity": rule_def.severity.value,
            "enforcement_status": rule_def.default_enforcement.value,
            "evaluation_source": rule_def.evaluation_source.value,
        }
        return {k: v for k, v in data.items() if v is not None}