"""
event7 - FastAPI Dependencies
Injection de dépendances pour résoudre registry → provider → service.
"""

from fastapi import Depends, HTTPException, Path

from app.config import get_settings
from app.main import redis_cache, supabase_client
from app.models.registry import ProviderType
from app.providers.factory import create_provider
from app.services.schema_service import SchemaService
from app.utils.encryption import decrypt_credentials


async def get_schema_service(
    registry_id: str = Path(..., description="Registry UUID"),
) -> SchemaService:
    """
    Résout un registry_id en SchemaService prêt à l'emploi.
    Flow: registry_id → DB lookup → decrypt credentials → create provider → wrap in service
    """
    # 1. Fetch registry from Supabase
    if not supabase_client.client:
        raise HTTPException(status_code=503, detail="Database not available")

    response = (
        supabase_client.client.table("registries")
        .select("*")
        .eq("id", registry_id)
        .eq("is_active", True)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail=f"Registry {registry_id} not found")

    registry = response.data[0]

    # 2. Create provider
    try:
        provider = create_provider(
            provider_type=ProviderType(registry["provider_type"]),
            base_url=registry["base_url"],
            credentials_encrypted=registry["credentials_encrypted"].encode()
            if isinstance(registry["credentials_encrypted"], str)
            else registry["credentials_encrypted"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create provider: {e}")

    # 3. Wrap in service
    return SchemaService(
        provider=provider,
        cache=redis_cache,
        db=supabase_client,
        registry_id=registry_id,
    )


async def get_schema_service_direct(
    registry_id: str,
    base_url: str,
    provider_type: ProviderType,
    api_key: str | None = None,
    api_secret: str | None = None,
) -> SchemaService:
    """
    Crée un SchemaService directement sans DB lookup.
    Utile pour le health check et les tests.
    """
    provider = create_provider(
        provider_type=provider_type,
        base_url=base_url,
        credentials_plain={"api_key": api_key, "api_secret": api_secret},
    )
    return SchemaService(
        provider=provider,
        cache=redis_cache,
        db=supabase_client,
        registry_id=registry_id,
    )