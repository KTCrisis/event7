"""
event7 - Governance Rules API Routes
CRUD rules & policies, templates, scoring.

Placement: backend/app/api/rules.py

Lighter dependency than schema routes — no provider needed (DB-only in V1).
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
    GovernanceTemplateResponse,
)
from app.services.governance_rules_service import GovernanceRulesService
from app.utils.auth import get_current_user

# --- Global instances (resolved at runtime after startup) ---
from app.main import redis_cache, db_client

router = APIRouter(tags=["governance-rules"])


# ================================================================
# Dependency — GovernanceRulesService
# ================================================================


def _get_governance_service(
    registry_id: UUID = Path(..., description="Registry UUID"),
    user: UserContext = Depends(get_current_user),
) -> GovernanceRulesService:
    """Build a GovernanceRulesService for the given registry.
    No provider needed — DB-only in V1.
    """
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available",
        )

    # Verify registry exists and belongs to user
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
# Templates
# ================================================================


@router.get(
    "/api/v1/governance/templates",
    response_model=list[GovernanceTemplateResponse],
)
async def list_templates(
    user: UserContext = Depends(get_current_user),
    # No registry_id needed — templates are global
):
    """List all governance rule templates."""
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available",
        )

    service = GovernanceRulesService(
        cache=redis_cache,
        db=db_client,
        registry_id="",  # Not used for template listing
    )
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
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available",
        )

    service = GovernanceRulesService(
        cache=redis_cache,
        db=db_client,
        registry_id="",
    )
    template = service.get_template(str(template_id))
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    return template


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