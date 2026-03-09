"""
event7 - Schemas API Routes
CRUD schemas, diff, versions, références.
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_schema_service
from app.models.schema import SubjectInfo, SchemaDetail, SchemaVersion, SchemaDiff, SchemaReference
from app.services.schema_service import SchemaService

router = APIRouter(prefix="/api/v1/registries/{registry_id}", tags=["schemas"])


# === Subjects ===


@router.get("/subjects", response_model=list[SubjectInfo])
async def list_subjects(
    enriched: bool = Query(True, description="Include enrichments from DB"),
    service: SchemaService = Depends(get_schema_service),
):
    """Liste tous les subjects d'un registry"""
    return await service.list_subjects(enriched=enriched)


# === Schema Detail ===


@router.get("/subjects/{subject}/versions/{version}", response_model=SchemaDetail)
async def get_schema(
    subject: str,
    version: int | str = "latest",
    service: SchemaService = Depends(get_schema_service),
):
    """Récupère le détail d'un schema à une version donnée"""
    try:
        return await service.get_schema(subject, version)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Schema not found: {e}")


@router.get("/subjects/{subject}", response_model=SchemaDetail)
async def get_schema_latest(
    subject: str,
    service: SchemaService = Depends(get_schema_service),
):
    """Récupère la dernière version d'un schema"""
    try:
        return await service.get_schema(subject, "latest")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Schema not found: {e}")


# === Versions ===


@router.get("/subjects/{subject}/versions", response_model=list[int])
async def list_versions(
    subject: str,
    service: SchemaService = Depends(get_schema_service),
):
    """Liste les numéros de version d'un subject"""
    try:
        return await service.get_versions(subject)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Subject not found: {e}")


@router.get("/subjects/{subject}/versions-detail", response_model=list[SchemaVersion])
async def list_versions_detail(
    subject: str,
    service: SchemaService = Depends(get_schema_service),
):
    """Liste toutes les versions avec leur contenu complet"""
    try:
        return await service.get_versions_detail(subject)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Subject not found: {e}")


# === Create / Delete ===


@router.post("/subjects/{subject}", response_model=SchemaDetail, status_code=201)
async def create_schema(
    subject: str,
    payload: dict,
    schema_type: str = Query("AVRO", description="AVRO or JSON"),
    service: SchemaService = Depends(get_schema_service),
):
    """Enregistre un nouveau schema"""
    try:
        return await service.create_schema(subject, payload, schema_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to register schema: {e}")


@router.delete("/subjects/{subject}", status_code=204)
async def delete_subject(
    subject: str,
    permanent: bool = Query(False, description="Hard delete (irreversible)"),
    service: SchemaService = Depends(get_schema_service),
):
    """Supprime un subject"""
    success = await service.delete_subject(subject, permanent=permanent)
    if not success:
        raise HTTPException(status_code=404, detail="Subject not found")


# === Diff ===


@router.get("/subjects/{subject}/diff", response_model=SchemaDiff)
async def diff_versions(
    subject: str,
    v1: int = Query(..., description="Version source"),
    v2: int = Query(..., description="Version cible"),
    service: SchemaService = Depends(get_schema_service),
):
    """Diff field-level entre deux versions"""
    try:
        return await service.diff_versions(subject, v1, v2)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Diff failed: {e}")


# === References ===


@router.get("/subjects/{subject}/references", response_model=list[SchemaReference])
async def get_references(
    subject: str,
    service: SchemaService = Depends(get_schema_service),
):
    """Références sortantes : ce schema référence quoi"""
    return await service.get_references(subject)


@router.get("/subjects/{subject}/dependents", response_model=list[SchemaReference])
async def get_dependents(
    subject: str,
    service: SchemaService = Depends(get_schema_service),
):
    """Références entrantes : qui référence ce schema (impact analysis)"""
    return await service.get_dependents(subject)


# === Compatibility ===


@router.get("/subjects/{subject}/compatibility")
async def get_compatibility(
    subject: str,
    service: SchemaService = Depends(get_schema_service),
):
    """Mode de compatibilité du subject"""
    mode = await service.get_compatibility(subject)
    return {"subject": subject, "compatibility": mode.value}


@router.post("/subjects/{subject}/compatibility/check")
async def check_compatibility(
    subject: str,
    payload: dict,
    service: SchemaService = Depends(get_schema_service),
):
    """Vérifie la compatibilité d'un schema"""
    result = await service.check_compatibility(subject, payload)
    return result