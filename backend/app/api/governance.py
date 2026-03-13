"""
event7 - Governance API Routes
Catalogue événements, enrichissements business, export.

Placement: backend/app/api/governance.py

P1: Ajout Depends(get_current_user) sur toutes les routes.
    user_id propagé sur update_enrichment pour audit.
"""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_schema_service
from app.models.auth import UserContext
from app.models.governance import CatalogEntry, Enrichment, EnrichmentUpdate
from app.services.schema_service import SchemaService
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/registries/{registry_id}", tags=["governance"])


# === Catalog ===


@router.get("/catalog", response_model=list[CatalogEntry])
async def get_catalog(
    user: UserContext = Depends(get_current_user),
    service: SchemaService = Depends(get_schema_service),
):
    """Catalogue événements enrichi (vue business)"""
    return await service.get_catalog()


@router.get("/catalog/export")
async def export_catalog(
    format: str = Query("csv", description="csv or json"),
    user: UserContext = Depends(get_current_user),
    service: SchemaService = Depends(get_schema_service),
):
    """Export du catalogue en CSV ou JSON"""
    catalog = await service.get_catalog()

    if format == "json":
        return [entry.model_dump() for entry in catalog]

    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "subject", "format", "latest_version", "version_count",
        "description", "owner_team", "tags", "classification",
        "data_layer", "reference_count",
    ])
    for entry in catalog:
        writer.writerow([
            entry.subject,
            entry.format,
            entry.latest_version,
            entry.version_count,
            entry.description or "",
            entry.owner_team or "",
            ";".join(entry.tags),
            entry.classification.value if hasattr(entry.classification, 'value') else entry.classification,
            entry.data_layer.value if entry.data_layer else "",
            entry.reference_count,
        ])
 
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=catalog.csv"},
    )


# === Enrichments ===


@router.get("/subjects/{subject}/enrichment", response_model=Enrichment | None)
async def get_enrichment(
    subject: str,
    user: UserContext = Depends(get_current_user),
    service: SchemaService = Depends(get_schema_service),
):
    """Récupère l'enrichissement d'un subject"""
    return service.get_enrichment(subject)


@router.put("/subjects/{subject}/enrichment", response_model=Enrichment)
async def update_enrichment(
    subject: str,
    payload: EnrichmentUpdate,
    user: UserContext = Depends(get_current_user),
    service: SchemaService = Depends(get_schema_service),
):
    """Met à jour l'enrichissement business d'un subject"""
    return service.update_enrichment(subject, payload)