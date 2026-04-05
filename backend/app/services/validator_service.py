"""
event7 - Schema Validator Service
Orchestre la validation d'un schema candidat en combinant 3 checks :
  1. Compatibility check (proxy SR via provider)
  2. Governance rules evaluation (event7 DB)
  3. Diff preview (field-level contre la version actuelle)

Placement: backend/app/services/validator_service.py
Design doc: SCHEMA_VALIDATOR_DESIGN.md v1.0.0

Le Validator est stateless — il ne stocke rien, ne modifie rien.
"""

import json
from datetime import datetime, timezone

from loguru import logger

from app.cache.redis_cache import RedisCache
from app.db.base import DatabaseProvider
from app.models.schema import DiffChangeType, SchemaFormat
from app.models.validator import (
    CompatibilityResult,
    DiffResult,
    GovernanceResult,
    RuleSkipped,
    RuleViolation,
    SchemaValidateRequest,
    SchemaValidateResponse,
    Verdict,
)
from app.providers.base import SchemaRegistryProvider
from app.services.diff_service import compute_schema_diff
from app.services.rules_context_resolver import build_schema_context
from app.services.rules_evaluator import evaluate_rules_for_schema


class SchemaValidatorService:
    """
    Orchestre la validation d'un schema candidat.
    Flow: Route → ValidatorService.validate() → 3 checks → rapport unifié

    Réutilise :
      - provider.check_compatibility()  (Confluent + Apicurio)
      - provider.get_compatibility()    (mode du subject)
      - provider.get_schema()           (version actuelle pour le diff)
      - diff_service.compute_schema_diff()
      - rules_evaluator.evaluate_rules_for_schema()  (nouveau)
    """

    def __init__(
        self,
        provider: SchemaRegistryProvider,
        cache: RedisCache,
        db: DatabaseProvider,
        registry_id: str,
    ):
        self.provider = provider
        self.cache = cache
        self.db = db
        self.registry_id = registry_id

    async def validate(self, request: SchemaValidateRequest) -> SchemaValidateResponse:
        """
        Point d'entrée principal.
        Exécute les 3 checks et assemble le rapport.
        """
        # Parse le schema candidat
        try:
            schema_dict = json.loads(request.schema_content)
        except (json.JSONDecodeError, TypeError) as e:
            raise ValueError(f"Invalid JSON in schema_content: {e}")

        # Détecte si le subject existe déjà dans le SR
        is_new_subject = False
        current_schema = None
        compare_version_int = None

        try:
            current_schema = await self.provider.get_schema(request.subject)
            compare_version_int = current_schema.version
        except Exception:
            # Subject n'existe pas encore → premier schema
            is_new_subject = True
            logger.info(f"Validator: subject '{request.subject}' is new (not in SR)")

        # ── 1. Compatibility check (async — appel SR) ──
        compatibility = await self._check_compatibility(
            request.subject, schema_dict, is_new_subject
        )

        # ── 2. Governance rules evaluation (sync — event7 DB) ──
        governance = self._evaluate_governance(request.subject, schema_dict)

        # ── 3. Diff preview (sync — comparaison locale) ──
        diff = self._compute_diff(
            request.subject,
            schema_dict,
            current_schema,
            request.schema_type,
            is_new_subject,
        )

        # ── Verdict ──
        verdict = self._compute_verdict(compatibility, governance, diff)

        return SchemaValidateResponse(
            subject=request.subject,
            schema_type=request.schema_type,
            compare_version=compare_version_int,
            timestamp=datetime.now(timezone.utc),
            compatibility=compatibility,
            governance=governance,
            diff=diff,
            verdict=verdict,
        )

    # ================================================================
    # 1. Compatibility Check
    # ================================================================

    async def _check_compatibility(
        self,
        subject: str,
        schema_dict: dict,
        is_new_subject: bool,
    ) -> CompatibilityResult:
        """Proxy vers provider.check_compatibility()."""
        if is_new_subject:
            return CompatibilityResult(
                is_compatible=True,
                mode="NONE",
                messages=["New subject — no previous version to compare against"],
                provider_checked=False,
            )

        try:
            # Get compatibility mode
            mode = await self.provider.get_compatibility(subject)
            mode_str = mode.value if hasattr(mode, "value") else str(mode)

            # Check compatibility
            result = await self.provider.check_compatibility(subject, schema_dict)

            # Provider may return a Pydantic model or a dict
            if hasattr(result, "is_compatible"):
                is_compat = result.is_compatible
                messages = result.messages if hasattr(result, "messages") else []
            else:
                is_compat = result.get("is_compatible", False)
                messages = result.get("messages", [])

            return CompatibilityResult(
                is_compatible=is_compat,
                mode=mode_str,
                messages=messages,
                provider_checked=True,
            )
        except Exception as e:
            logger.warning(f"Validator: compatibility check failed for {subject}: {e}")
            return CompatibilityResult(
                is_compatible=False,
                mode="UNKNOWN",
                messages=[f"Compatibility check error: {str(e)}"],
                provider_checked=False,
            )

    # ================================================================
    # 2. Governance Rules Evaluation
    # ================================================================

    def _evaluate_governance(self, subject: str, schema_dict: dict) -> GovernanceResult:
        """Évalue les governance rules event7 sur le schema candidat."""
        try:
            # Charge les rules applicables (globales + subject-specific)
            rules_rows = self.db.list_governance_rules(
                registry_id=self.registry_id,
                subject=subject,
            )

            if not rules_rows:
                return GovernanceResult(
                    score=100,
                    passed=0,
                    failed=0,
                    total=0,
                )

            # Load enrichment context for severity resolution
            enrichment = self.db.get_enrichment(self.registry_id, subject)
            bindings = self.db.get_channels_for_subject(self.registry_id, subject)
            schema_context = build_schema_context(enrichment, bindings)

            # Délègue l'évaluation au rules_evaluator
            violations, skipped, passed = evaluate_rules_for_schema(
                rules=rules_rows,
                schema_content=schema_dict,
                subject=subject,
                schema_context=schema_context,
            )

            total = passed + len(violations) + len(skipped)
            evaluable_total = passed + len(violations)

            # Score : % de rules évaluables passées (même logique que le scoring existant)
            if evaluable_total > 0:
                score = int((passed / evaluable_total) * 100)
            else:
                score = 100  # Aucune rule évaluable → score max

            return GovernanceResult(
                score=score,
                violations=violations,
                skipped=skipped,
                passed=passed,
                failed=len(violations),
                total=total,
                context=schema_context.to_dict(),
            )
        except Exception as e:
            logger.warning(f"Validator: governance evaluation failed for {subject}: {e}")
            return GovernanceResult(
                score=0,
                violations=[
                    RuleViolation(
                        rule_id="error",
                        rule_name="evaluation_error",
                        rule_scope="audit",
                        severity="warning",
                        message=f"Governance evaluation error: {str(e)}",
                        category="custom",
                    )
                ],
                failed=1,
                total=1,
            )

    # ================================================================
    # 3. Diff Preview
    # ================================================================

    def _compute_diff(
        self,
        subject: str,
        schema_dict: dict,
        current_schema,
        schema_type: SchemaFormat,
        is_new_subject: bool,
    ) -> DiffResult:
        """Diff field-level contre la version actuelle."""
        if is_new_subject or current_schema is None:
            return DiffResult(
                has_changes=False,
                is_new_subject=True,
            )

        try:
            diff = compute_schema_diff(
                subject=subject,
                version_from=current_schema.version,
                version_to=current_schema.version + 1,  # Candidat = version suivante
                schema_from=current_schema.schema_content,
                schema_to=schema_dict,
                schema_format=schema_type,
            )

            fields_added = [
                c.field_path for c in diff.changes
                if c.change_type == DiffChangeType.ADDED
            ]
            fields_removed = [
                c.field_path for c in diff.changes
                if c.change_type == DiffChangeType.REMOVED
            ]
            fields_modified = [
                c.field_path for c in diff.changes
                if c.change_type == DiffChangeType.MODIFIED
            ]

            return DiffResult(
                has_changes=len(diff.changes) > 0,
                fields_added=fields_added,
                fields_removed=fields_removed,
                fields_modified=fields_modified,
                is_breaking=diff.is_breaking,
                total_changes=len(diff.changes),
                is_new_subject=False,
            )
        except Exception as e:
            logger.warning(f"Validator: diff failed for {subject}: {e}")
            return DiffResult(
                has_changes=False,
                is_new_subject=False,
            )

    # ================================================================
    # Verdict
    # ================================================================

    # Modes where breaking changes should NOT pass — defense in depth
    # If SR says compatible but diff says breaking, event7 overrides to FAIL
    _STRICT_MODES = {
        "BACKWARD", "BACKWARD_TRANSITIVE",
        "FORWARD", "FORWARD_TRANSITIVE",
        "FULL", "FULL_TRANSITIVE",
    }

    @staticmethod
    def _compute_verdict(
        compatibility: CompatibilityResult,
        governance: GovernanceResult,
        diff: DiffResult,
    ) -> Verdict:
        """
        Verdict logic:
          FAIL  = non compatible OU violations error/critical
                  OU breaking changes with strict mode (defense in depth)
                  OU breaking changes with NONE mode (SR not protecting)
          WARN  = compatible + violations warning/info
                  OU breaking changes detected (non-strict mode)
          PASS  = compatible + no violations + no breaking changes
        """
        # Non compatible → FAIL
        if compatibility.provider_checked and not compatibility.is_compatible:
            return Verdict.FAIL

        # Violations error/critical → FAIL
        severe = [
            v for v in governance.violations
            if v.severity in ("error", "critical")
        ]
        if severe:
            return Verdict.FAIL

        # Breaking changes + strict mode → FAIL (SR bug or misconfiguration)
        if diff.is_breaking and compatibility.mode in SchemaValidatorService._STRICT_MODES:
            return Verdict.FAIL

        # Breaking changes with NONE mode → FAIL (SR is not protecting you)
        if diff.is_breaking and compatibility.mode in ("NONE", "UNKNOWN"):
            return Verdict.FAIL

        # Breaking changes detected → WARN (SR accepted but diff shows risk)
        if diff.is_breaking:
            return Verdict.WARN

        # Violations warning/info → WARN
        if governance.violations:
            return Verdict.WARN

        return Verdict.PASS