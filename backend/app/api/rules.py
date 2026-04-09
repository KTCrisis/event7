"""
event7 - Governance Rules API Routes
CRUD rules & policies, templates (builtin + custom), scoring.

Placement: backend/app/api/rules.py

v2: Custom template CRUD (create, update, delete, clone) + is_builtin protection.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger

from app.models.auth import UserContext
from app.models.governance_rules import (
    ApplyTemplateRequest,
    ApplyTemplateResponse,
    GovernanceRuleCreate,
    GovernanceRuleListResponse,
    GovernanceRuleResponse,
    GovernanceRuleUpdate,
    GovernanceScore,
    GovernanceTemplateClone,
    GovernanceTemplateCreate,
    GovernanceTemplateResponse,
    GovernanceTemplateUpdate,
)
from app.services.governance_rules_service import GovernanceRulesService
from app.utils.auth import get_current_user

# --- Global instances (resolved at runtime after startup) ---
from app.main import redis_cache, db_client

router = APIRouter(tags=["governance-rules"])


# ================================================================
# Dependencies
# ================================================================


def _get_governance_service(
    registry_id: UUID = Path(..., description="Registry UUID"),
    user: UserContext = Depends(get_current_user),
) -> GovernanceRulesService:
    """Build a GovernanceRulesService for the given registry."""
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available",
        )

    registry = db_client.get_registry_by_id(
        registry_id=str(registry_id),
        user_id=str(user.user_id),
    )

    if not registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registry {registry_id} not found",
        )

    return GovernanceRulesService(
        cache=redis_cache,
        db=db_client,
        registry_id=str(registry_id),
    )


def _get_template_service() -> GovernanceRulesService:
    """Build a GovernanceRulesService for template operations (global, no registry)."""
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available",
        )
    return GovernanceRulesService(
        cache=redis_cache,
        db=db_client,
        registry_id="",
    )


# ================================================================
# CRUD — Rules & Policies
# ================================================================


@router.get(
    "/api/v1/registries/{registry_id}/rules",
    response_model=GovernanceRuleListResponse,
)
async def list_rules(
    subject: str | None = Query(None, description="Filter by subject (also returns global rules)"),
    scope: str | None = Query(None, description="Filter by rule_scope"),
    kind: str | None = Query(None, description="Filter by rule_kind"),
    category: str | None = Query(None, description="Filter by rule_category"),
    severity: str | None = Query(None, description="Filter by severity"),
    enforcement_status: str | None = Query(None, description="Filter by enforcement_status"),
    source: str | None = Query(None, description="Filter by source"),
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """List governance rules & policies for a registry."""
    return service.list_rules(
        subject=subject,
        scope=scope,
        kind=kind,
        category=category,
        severity=severity,
        enforcement_status=enforcement_status,
        source=source,
    )


@router.get(
    "/api/v1/registries/{registry_id}/rules/{rule_id}",
    response_model=GovernanceRuleResponse,
)
async def get_rule(
    rule_id: UUID,
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Get a single governance rule by ID."""
    rule = service.get_rule(str(rule_id))
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule {rule_id} not found",
        )
    return rule


@router.post(
    "/api/v1/registries/{registry_id}/rules",
    response_model=GovernanceRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    payload: GovernanceRuleCreate,
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Create a new governance rule or policy."""
    try:
        return await service.create_rule(payload, user_id=str(user.user_id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.put(
    "/api/v1/registries/{registry_id}/rules/{rule_id}",
    response_model=GovernanceRuleResponse,
)
async def update_rule(
    rule_id: UUID,
    payload: GovernanceRuleUpdate,
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Update a governance rule or policy."""
    try:
        result = await service.update_rule(
            str(rule_id), payload, user_id=str(user.user_id)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule {rule_id} not found",
        )
    return result


@router.delete(
    "/api/v1/registries/{registry_id}/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_rule(
    rule_id: UUID,
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Delete a governance rule or policy."""
    deleted = await service.delete_rule(str(rule_id), user_id=str(user.user_id))
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule {rule_id} not found",
        )


# ================================================================
# Provider Sync — Import Confluent ruleSet
# ================================================================


@router.post(
    "/api/v1/registries/{registry_id}/rules/import-provider",
)
async def import_provider_rules(
    registry_id: UUID = Path(..., description="Registry UUID"),
    subject: str = Query(..., description="Subject to import rules for"),
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Import governance rules from the schema registry provider.

    Fetches ruleSet + metadata from the provider (Confluent) for the given
    subject, maps them to event7 GovernanceRules, and stores them in the DB.

    Only works with Confluent Schema Registry (requires Data Contracts).
    Rules are created with source='imported_provider'.
    """
    from app.api.dependencies import get_schema_service

    # We need a provider to fetch the schema with ruleSet
    # Re-use the schema service dependency
    schema_service_gen = get_schema_service(registry_id, user)
    schema_service = await schema_service_gen.__anext__()

    try:
        schema = await schema_service.provider.get_schema(subject)

        if not schema.rule_set:
            return {
                "subject": subject,
                "imported": 0,
                "skipped": 0,
                "rules": [],
                "pii_fields": [],
                "message": "No ruleSet found on this subject (requires Confluent Data Contracts)",
            }

        result = await service.import_provider_rules(
            subject=subject,
            rule_set=schema.rule_set,
            metadata=schema.metadata,
            user_id=str(user.user_id),
        )

        return {
            "subject": subject,
            **result,
            "message": f"Imported {result['imported']} rules ({result['skipped']} skipped)",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to import rules: {e}",
        )
    finally:
        try:
            await schema_service_gen.aclose()
        except Exception:
            pass


@router.post(
    "/api/v1/registries/{registry_id}/rules/import-provider-all",
)
async def import_provider_rules_all(
    registry_id: UUID = Path(..., description="Registry UUID"),
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Import governance rules from ALL subjects that have a ruleSet.

    Scans every subject in the registry, imports ruleSet + metadata where present.
    """
    from app.api.dependencies import get_schema_service

    schema_service_gen = get_schema_service(registry_id, user)
    schema_service = await schema_service_gen.__anext__()

    try:
        subjects = await schema_service.provider.list_subjects()
        total_imported = 0
        total_skipped = 0
        subjects_with_rules = 0
        all_pii_fields = []

        for subj in subjects:
            try:
                schema = await schema_service.provider.get_schema(subj.subject)
                if not schema.rule_set:
                    continue

                subjects_with_rules += 1
                result = await service.import_provider_rules(
                    subject=subj.subject,
                    rule_set=schema.rule_set,
                    metadata=schema.metadata,
                    user_id=str(user.user_id),
                )
                total_imported += result["imported"]
                total_skipped += result["skipped"]
                if result.get("pii_fields"):
                    all_pii_fields.extend(
                        {"subject": subj.subject, **pf}
                        for pf in result["pii_fields"]
                    )
            except Exception as e:
                logger.warning(f"Failed to import rules for {subj.subject}: {e}")

        return {
            "subjects_scanned": len(subjects),
            "subjects_with_rules": subjects_with_rules,
            "imported": total_imported,
            "skipped": total_skipped,
            "pii_fields": all_pii_fields,
            "message": f"Imported {total_imported} rules from {subjects_with_rules} subjects",
        }
    finally:
        try:
            await schema_service_gen.aclose()
        except Exception:
            pass


# ================================================================
# Provider Sync — Push event7 rules to Confluent
# ================================================================


@router.post(
    "/api/v1/registries/{registry_id}/rules/push-provider",
)
async def push_provider_rules(
    registry_id: UUID = Path(..., description="Registry UUID"),
    subject: str = Query(..., description="Subject to push rules for"),
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Push event7 governance rules to the schema registry provider as a ruleSet.

    Converts event7 GovernanceRules to a Confluent ruleSet (domainRules + migrationRules)
    and re-registers the current schema with the ruleSet attached.

    Only works with Confluent Schema Registry (requires Data Contracts / Enterprise license
    or Advanced Stream Governance on Cloud).
    """
    from app.api.dependencies import get_schema_service
    from app.services.confluent_rules_mapper import export_ruleset

    # Get rules for this subject
    rules_data = service.list_rules(subject=subject)
    subject_rules = [r for r in rules_data.rules if r.subject == subject]

    if not subject_rules:
        return {
            "subject": subject,
            "pushed": 0,
            "message": "No rules found for this subject",
        }

    # Build Confluent ruleSet
    rule_set = export_ruleset(subject_rules)
    if not rule_set:
        return {
            "subject": subject,
            "pushed": 0,
            "message": "No Confluent-compatible rules to push (only CEL/CEL_FIELD/JSONATA rules can be exported)",
        }

    # Build metadata from PII policy rules
    metadata = None
    for rule in subject_rules:
        if rule.params and rule.params.get("pii_fields"):
            pii_fields = rule.params["pii_fields"]
            metadata = {
                "tags": {field: ["PII"] for field in pii_fields},
            }
            break

    # Push to provider
    schema_service_gen = get_schema_service(registry_id, user)
    schema_service = await schema_service_gen.__anext__()

    try:
        result = await schema_service.provider.push_rule_set(
            subject=subject,
            rule_set=rule_set,
            metadata=metadata,
        )

        total_rules = len(rule_set.get("domainRules", [])) + len(rule_set.get("migrationRules", []))

        logger.info(
            f"Pushed {total_rules} rules to {subject} on registry {registry_id}"
        )

        return {
            "subject": subject,
            "pushed": total_rules,
            "schema_id": result.get("schema_id"),
            "rule_set": rule_set,
            "metadata": metadata,
            "message": f"Pushed {total_rules} rules to Confluent",
        }
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This provider does not support Data Contracts. Push is only available for Confluent Schema Registry.",
        )
    except Exception as e:
        error_msg = str(e)
        detail = f"Failed to push rules: {error_msg}"
        if "401" in error_msg or "403" in error_msg:
            detail += " — Check that Data Contracts are enabled (Enterprise license or Advanced Stream Governance)."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )
    finally:
        try:
            await schema_service_gen.aclose()
        except Exception:
            pass


# ================================================================
# Templates — Read
# ================================================================


@router.get(
    "/api/v1/governance/templates",
    response_model=list[GovernanceTemplateResponse],
)
async def list_templates(
    user: UserContext = Depends(get_current_user),
):
    """List all governance rule templates (builtin + custom)."""
    service = _get_template_service()
    return service.list_templates()


@router.get(
    "/api/v1/governance/templates/{template_id}",
    response_model=GovernanceTemplateResponse,
)
async def get_template(
    template_id: UUID,
    user: UserContext = Depends(get_current_user),
):
    """Get a single governance rule template."""
    service = _get_template_service()
    template = service.get_template(str(template_id))
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    return template


# ================================================================
# Templates — Custom CRUD
# ================================================================


@router.post(
    "/api/v1/governance/templates",
    response_model=GovernanceTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    payload: GovernanceTemplateCreate,
    user: UserContext = Depends(get_current_user),
):
    """Create a custom governance template."""
    service = _get_template_service()
    try:
        return service.create_template(payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.put(
    "/api/v1/governance/templates/{template_id}",
    response_model=GovernanceTemplateResponse,
)
async def update_template(
    template_id: UUID,
    payload: GovernanceTemplateUpdate,
    user: UserContext = Depends(get_current_user),
):
    """Update a governance template. Builtin templates have limited editability."""
    service = _get_template_service()
    try:
        result = service.update_template(str(template_id), payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    return result


@router.delete(
    "/api/v1/governance/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_template(
    template_id: UUID,
    user: UserContext = Depends(get_current_user),
):
    """Delete a custom template. Builtin templates cannot be deleted (403)."""
    service = _get_template_service()
    try:
        deleted = service.delete_template(str(template_id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )


@router.post(
    "/api/v1/governance/templates/{template_id}/clone",
    response_model=GovernanceTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def clone_template(
    template_id: UUID,
    payload: GovernanceTemplateClone,
    user: UserContext = Depends(get_current_user),
):
    """Clone a template (builtin or custom) with a new name."""
    service = _get_template_service()
    try:
        return service.clone_template(str(template_id), payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


# ================================================================
# Templates — Apply
# ================================================================


@router.post(
    "/api/v1/registries/{registry_id}/rules/templates/{template_id}/apply",
    response_model=ApplyTemplateResponse,
)
async def apply_template(
    template_id: UUID,
    payload: ApplyTemplateRequest,
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Apply a governance template to a registry/subject."""
    try:
        return await service.apply_template(
            template_id=str(template_id),
            subject=payload.subject,
            overwrite=payload.overwrite,
            user_id=str(user.user_id),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ================================================================
# Scoring
# ================================================================


@router.get(
    "/api/v1/registries/{registry_id}/governance/score",
    response_model=GovernanceScore,
)
async def get_governance_score(
    subject: str | None = Query(None, description="Subject to score (null = registry-level)"),
    user: UserContext = Depends(get_current_user),
    service: GovernanceRulesService = Depends(_get_governance_service),
):
    """Compute governance score for a subject or the whole registry."""
    return await service.compute_score(subject=subject)