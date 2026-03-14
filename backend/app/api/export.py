"""
event7 - EventCatalog Export Route
Endpoint dédié pour le generator-event7 (plugin EventCatalog).

Placement: backend/app/api/export.py

Agrège en un seul appel :
  - Catalog (schemas + enrichments)
  - Schema content (latest version par subject)
  - Governance score (par subject)
  - Rules summary (par subject)
  - AsyncAPI specs (si générées)
  - Channels + bindings
  - Teams (owner_team dédupliqués)

Design doc: EVENTCATALOG_PLUGIN_DESIGN.md
"""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.api.dependencies import get_schema_service
from app.models.auth import UserContext
from app.models.export import (
    EventCatalogExport,
    ExportChannel,
    ExportChannelBinding,
    ExportEnrichment,
    ExportGovernanceScore,
    ExportReference,
    ExportRegistryInfo,
    ExportRuleSummary,
    ExportSchema,
    ExportScoreBreakdown,
)
from app.services.schema_service import SchemaService
from app.services.governance_rules_service import GovernanceRulesService
from app.utils.auth import get_current_user

# --- Global instances (resolved at runtime after startup) ---
from app.main import redis_cache, db_client

router = APIRouter(prefix="/api/v1/registries/{registry_id}", tags=["export"])


# ================================================================
# Helper — build GovernanceRulesService for scoring
# ================================================================


def _get_governance_service(registry_id: str) -> GovernanceRulesService:
    """Build a GovernanceRulesService (DB-only, no provider needed)."""
    return GovernanceRulesService(
        cache=redis_cache,
        db=db_client,
        registry_id=registry_id,
    )


# ================================================================
# Helper — compute rules summary for a subject
# ================================================================


def _build_rules_summary(
    registry_id: str,
    subject: str | None,
) -> list[ExportRuleSummary]:
    """Build compact rules summary from DB rules.

    Status logic:
      - enforcement_status in (synced, verified) → PASS
      - enforcement_status == expected            → WARN (not yet verified)
      - enforcement_status in (declared, drifted) → FAIL
    """
    rules = db_client.list_governance_rules(
        registry_id=registry_id,
        subject=subject,
    )

    summaries = []
    for r in rules:
        enforcement = r.get("enforcement_status", "declared")
        if enforcement in ("synced", "verified"):
            rule_status = "PASS"
        elif enforcement == "expected":
            rule_status = "WARN"
        else:
            rule_status = "FAIL"

        summaries.append(ExportRuleSummary(
            rule_name=r.get("rule_name", "Unknown"),
            status=rule_status,
            severity=r.get("severity", "info"),
            category=r.get("rule_category", "custom"),
        ))

    return summaries


# ================================================================
# Main export endpoint
# ================================================================


@router.get(
    "/export/eventcatalog",
    response_model=EventCatalogExport,
    summary="Export for EventCatalog generator",
    description=(
        "Aggregated export of schemas, enrichments, governance scores, "
        "channels, and teams — designed for the generator-event7 plugin."
    ),
)
async def export_eventcatalog(
    registry_id: UUID,
    user: UserContext = Depends(get_current_user),
    service: SchemaService = Depends(get_schema_service),
):
    """Export complet pour le generator-event7."""

    str_registry_id = str(registry_id)

    # ── 1. Registry info ──

    registry = db_client.get_registry_by_id(str_registry_id, str(user.user_id))
    if not registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registry {registry_id} not found",
        )

    registry_info = ExportRegistryInfo(
        id=str_registry_id,
        name=registry.get("name", ""),
        provider_type=registry.get("provider_type", "unknown"),
        base_url=registry.get("base_url", ""),
    )

    # ── 2. Catalog (schemas + enrichments) ──

    catalog = await service.get_catalog()
    governance_service = _get_governance_service(str_registry_id)

    # ── 3. Per-schema aggregation ──

    export_schemas: list[ExportSchema] = []
    teams_set: set[str] = set()

    for entry in catalog:
        # 3a. Schema content (latest) — graceful on error
        schema_content: dict | None = None
        try:
            detail = await service.get_schema(entry.subject, "latest")
            schema_content = detail.schema_content
        except Exception as e:
            logger.warning(
                f"Export: could not fetch schema content for {entry.subject}: {e}"
            )

        # 3b. Governance score — graceful on error
        export_score: ExportGovernanceScore | None = None
        try:
            score = await governance_service.compute_score(subject=entry.subject)
            export_score = ExportGovernanceScore(
                score=score.score,
                grade=score.grade,
                confidence=score.confidence.value
                if hasattr(score.confidence, "value")
                else str(score.confidence),
                breakdown=ExportScoreBreakdown(
                    enrichments=score.breakdown.enrichments.points,
                    enrichments_max=score.breakdown.enrichments.max_points,
                    rules=score.breakdown.rules.points,
                    rules_max=score.breakdown.rules.max_points,
                    schema_quality=score.breakdown.schema_quality.points,
                    schema_quality_max=score.breakdown.schema_quality.max_points,
                ),
            )
        except Exception as e:
            logger.warning(
                f"Export: could not compute score for {entry.subject}: {e}"
            )

        # 3c. Rules summary
        rules_summary = _build_rules_summary(str_registry_id, entry.subject)

        # 3d. References
        refs: list[ExportReference] = []
        try:
            raw_refs = await service.get_references(entry.subject)
            refs = [
                ExportReference(subject=r.subject, version=r.version)
                for r in raw_refs
            ]
        except Exception as e:
            logger.warning(
                f"Export: could not fetch references for {entry.subject}: {e}"
            )

        # 3e. AsyncAPI spec (from DB, not generated)
        asyncapi_yaml: str | None = None
        try:
            spec_data = db_client.get_asyncapi_spec(str_registry_id, entry.subject)
            if spec_data and spec_data.get("spec_content"):
                content = spec_data["spec_content"]
                # spec_content can be dict or string
                if isinstance(content, dict):
                    import yaml

                    asyncapi_yaml = yaml.dump(content, default_flow_style=False)
                else:
                    asyncapi_yaml = str(content)
        except Exception as e:
            logger.warning(
                f"Export: could not fetch asyncapi for {entry.subject}: {e}"
            )

        # 3f. Enrichment
        enrichment = ExportEnrichment(
            description=entry.description,
            owner_team=entry.owner_team,
            tags=entry.tags,
            classification=(
                entry.classification.value
                if hasattr(entry.classification, "value")
                else str(entry.classification)
            ),
            data_layer=(
                entry.data_layer.value
                if entry.data_layer and hasattr(entry.data_layer, "value")
                else entry.data_layer
            ),
        )

        # Collect team
        if entry.owner_team:
            teams_set.add(entry.owner_team)

        export_schemas.append(
            ExportSchema(
                subject=entry.subject,
                format=entry.format,
                latest_version=entry.latest_version,
                version_count=entry.version_count,
                schema_content=schema_content,
                enrichment=enrichment,
                references=refs,
                governance_score=export_score,
                rules_summary=rules_summary,
                asyncapi_yaml=asyncapi_yaml,
            )
        )

    # ── 4. Channels + bindings ──

    export_channels: list[ExportChannel] = []
    try:
        raw_channels = db_client.get_channels(str_registry_id)
        for ch in raw_channels:
            raw_bindings = db_client.get_bindings_for_channel(ch["id"])
            bindings = [
                ExportChannelBinding(
                    subject=b.get("subject_name", ""),
                    schema_role=b.get("schema_role", "value"),
                    binding_status=b.get("binding_status", "unverified"),
                )
                for b in raw_bindings
            ]
            export_channels.append(
                ExportChannel(
                    id=str(ch["id"]),
                    name=ch.get("name", ""),
                    address=ch.get("address", ""),
                    broker_type=ch.get("broker_type", "kafka"),
                    resource_kind=ch.get("resource_kind", "topic"),
                    data_layer=ch.get("data_layer"),
                    bindings=bindings,
                )
            )
    except Exception as e:
        logger.warning(f"Export: could not fetch channels: {e}")

    # ── 5. Teams (deduplicated) ──

    teams = sorted(teams_set)

    # ── 6. Build response ──

    logger.info(
        f"EventCatalog export: {len(export_schemas)} schemas, "
        f"{len(export_channels)} channels, {len(teams)} teams"
    )

    return EventCatalogExport(
        registry=registry_info,
        schemas=export_schemas,
        channels=export_channels,
        teams=teams,
    )