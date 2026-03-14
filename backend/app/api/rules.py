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