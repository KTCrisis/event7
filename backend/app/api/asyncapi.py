"""
event7 - AsyncAPI API Routes
Génération, récupération et édition des specs AsyncAPI.
"""

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import JSONResponse

import yaml

from app.api.dependencies import get_schema_service
from app.models.asyncapi import AsyncAPISpec, AsyncAPIGenerateRequest
from app.services.schema_service import SchemaService
from app.services.asyncapi_service import AsyncAPIService

router = APIRouter(prefix="/api/v1/registries/{registry_id}", tags=["asyncapi"])


def _get_asyncapi_service(service: SchemaService = Depends(get_schema_service)) -> AsyncAPIService:
    """Construit un AsyncAPIService depuis le SchemaService injecté"""
    return AsyncAPIService(
        provider=service.provider,
        cache=service.cache,
        db=service.db,
        registry_id=service.registry_id,
    )


# === Generate ===


@router.post("/subjects/{subject}/asyncapi/generate", response_model=AsyncAPISpec)
async def generate_asyncapi(
    subject: str,
    params: AsyncAPIGenerateRequest | None = None,
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Génère une spec AsyncAPI depuis le schema + enrichments"""
    try:
        return await asyncapi_service.generate(subject, params)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AsyncAPI generation failed: {e}")


# === Get ===


@router.get("/subjects/{subject}/asyncapi", response_model=AsyncAPISpec)
async def get_asyncapi(
    subject: str,
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Récupère la spec AsyncAPI existante"""
    spec = asyncapi_service.get_spec(subject)
    if not spec:
        raise HTTPException(status_code=404, detail=f"No AsyncAPI spec found for {subject}")
    return spec


# === Update ===


@router.put("/subjects/{subject}/asyncapi", response_model=AsyncAPISpec)
async def update_asyncapi(
    subject: str,
    spec_content: dict,
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Met à jour manuellement une spec AsyncAPI"""
    try:
        return asyncapi_service.update_spec(subject, spec_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Update failed: {e}")


# === Export YAML ===


@router.get("/subjects/{subject}/asyncapi/yaml")
async def export_asyncapi_yaml(
    subject: str,
    asyncapi_service: AsyncAPIService = Depends(_get_asyncapi_service),
):
    """Exporte la spec AsyncAPI en YAML"""
    spec = asyncapi_service.get_spec(subject)
    if not spec:
        raise HTTPException(status_code=404, detail=f"No AsyncAPI spec found for {subject}")

    yaml_content = yaml.dump(spec.spec_content, default_flow_style=False, allow_unicode=True)

    return JSONResponse(
        content={"subject": subject, "format": "yaml", "content": yaml_content},
        media_type="application/json",
    )