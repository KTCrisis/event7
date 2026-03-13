"""
event7 - AsyncAPI API Routes
Génération, récupération, édition et import des specs AsyncAPI.

Placement: backend/app/api/asyncapi.py

Changelog:
- v1: Generate, get, update, delete, yaml export
- v2: Import preview + apply endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

import yaml

from app.api.dependencies import get_schema_service
from app.models.auth import UserContext
from app.models.asyncapi import (
    AsyncAPISpec,
    AsyncAPIGenerateRequest,
    AsyncAPIImportRequest,
    AsyncAPIImportPreview,
    AsyncAPIImportResult,
)
from app.services.schema_service import SchemaService
from app.services.asyncapi_service import AsyncAPIService
from app.services.asyncapi_import_service import AsyncAPIImportService
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/registries/{registry_id}", tags=["asyncapi"])


# ── Dependency: AsyncAPIService ──

def _get_asyncapi_service(
    service: SchemaService = Depends(get_schema_service),
) -> AsyncAPIService:
    """Construit un AsyncAPIService depuis le SchemaService injecté."""
    return AsyncAPIService(
        provider=service.provider,
        cache=service.cache,
        db=service.db,
        registry_id=service.registry_id,
        registry_url=getattr(service, "registry_url", ""),
    )


# ── Dependency: AsyncAPIImportService ──

def _get_import_service(
    service: SchemaService = Depends(get_schema_service),
) -> AsyncAPIImportService:
    """Construit un AsyncAPIImportService depuis le SchemaService injecté."""
    return AsyncAPIImportService(
        provider=service.provider,
        cache=service.cache,
        db=service.db,
        registry_id=service.registry_id,
    )


# ================================================================
# GENERATE
# ================================================================


@router.post("/subjects/{subject}/asyncapi/generate", response_model=AsyncAPISpec)
async def generate_asyncapi(
    subject: str,
    params: AsyncAPIGenerateRequest | None = None,
    user: UserContext = Depends(get_current_user),
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Génère une spec AsyncAPI depuis le schema + enrichments."""
    try:
        return await asyncapi_service.generate(subject, params, user_id=str(user.user_id))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AsyncAPI generation failed: {e}")


# ================================================================
# GET / UPDATE / DELETE
# ================================================================


@router.get("/subjects/{subject}/asyncapi", response_model=AsyncAPISpec)
async def get_asyncapi(
    subject: str,
    user: UserContext = Depends(get_current_user),
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Récupère la spec AsyncAPI existante."""
    spec = await asyncapi_service.get_spec(subject)
    if not spec:
        raise HTTPException(status_code=404, detail=f"No AsyncAPI spec found for {subject}")
    return spec


@router.put("/subjects/{subject}/asyncapi", response_model=AsyncAPISpec)
async def update_asyncapi(
    subject: str,
    spec_content: dict,
    user: UserContext = Depends(get_current_user),
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Met à jour manuellement une spec AsyncAPI."""
    try:
        return await asyncapi_service.update_spec(
            subject, spec_content, user_id=str(user.user_id)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Update failed: {e}")


@router.delete("/subjects/{subject}/asyncapi")
async def delete_asyncapi(
    subject: str,
    user: UserContext = Depends(get_current_user),
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Supprime une spec AsyncAPI."""
    deleted = asyncapi_service.db.delete_asyncapi_spec(
        asyncapi_service.registry_id, subject, user_id=str(user.user_id)
    )
    if not deleted:
        raise HTTPException(status_code=404, detail=f"No AsyncAPI spec found for {subject}")
    return {"ok": True}


# ================================================================
# YAML EXPORT
# ================================================================


@router.get("/subjects/{subject}/asyncapi/yaml")
async def export_asyncapi_yaml(
    subject: str,
    user: UserContext = Depends(get_current_user),
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Exporte la spec en YAML."""
    spec = await asyncapi_service.get_spec(subject)
    if not spec:
        raise HTTPException(status_code=404, detail=f"No AsyncAPI spec found for {subject}")

    yaml_content = yaml.dump(spec.spec_content, default_flow_style=False, allow_unicode=True)
    return {"content": yaml_content}


# ================================================================
# IMPORT — Preview (dry-run) & Apply (persist)
# ================================================================


@router.post("/asyncapi/import/preview", response_model=AsyncAPIImportPreview)
async def import_preview(
    payload: AsyncAPIImportRequest,
    user: UserContext = Depends(get_current_user),
    import_service: AsyncAPIImportService = Depends(_get_import_service),
):
    """Parse an AsyncAPI spec and preview what would be created.
    
    Nothing is persisted — this is a dry-run.
    Returns channels, bindings, enrichments, unknown schemas, and warnings.
    """
    try:
        return await import_service.preview(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import preview failed: {e}")


@router.post("/asyncapi/import/apply", response_model=AsyncAPIImportResult)
async def import_apply(
    payload: AsyncAPIImportRequest,
    user: UserContext = Depends(get_current_user),
    import_service: AsyncAPIImportService = Depends(_get_import_service),
):
    """Parse an AsyncAPI spec and persist all extracted entities.
    
    Creates channels, bindings, enrichments, and optionally registers
    unknown schemas in the Schema Registry.

    Set register_schemas=true to push schemas not found in the SR.
    """
    try:
        return await import_service.apply(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {e}")