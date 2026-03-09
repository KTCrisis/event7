"""
event7 - Governance API Routes
Catalogue événements, enrichissements business, export.
"""

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_schema_service
from app.models.governance import CatalogEntry, Enrichment, EnrichmentUpdate
from app.services.schema_service import SchemaService

router = APIRouter(prefix="/api/v1/registries/{registry_id}", tags=["governance"])


# === Catalog ===


@router.get("/catalog", response_model=list[CatalogEntry])
async def get_catalog(
    service: SchemaService = Depends(get_schema_service),
):
    """Catalogue événements enrichi (vue business)"""
    return await service.get_catalog()


@router.get("/catalog/export")
async def export_catalog(
    format: str = Query("csv", description="csv or json"),
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
        "description", "owner_team", "tags", "classification", "reference_count",
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
            entry.classification.value,
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
    service: SchemaService = Depends(get_schema_service),
):
    """Récupère l'enrichissement d'un subject"""
    return service.get_enrichment(subject)


@router.put("/subjects/{subject}/enrichment", response_model=Enrichment)
async def update_enrichment(
    subject: str,
    payload: EnrichmentUpdate,
    service: SchemaService = Depends(get_schema_service),
):
    """Met à jour l'enrichissement business d'un subject"""
    return service.update_enrichment(subject, payload)