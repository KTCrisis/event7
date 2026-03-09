"""
event7 - Registries API Routes
CRUD pour les connexions aux Schema Registries.
"""

from fastapi import APIRouter, HTTPException

from app.main import supabase_client
from app.models.registry import RegistryCreate, RegistryResponse, RegistryHealth, ProviderType
from app.providers.factory import create_provider
from app.utils.encryption import encrypt_credentials

router = APIRouter(prefix="/api/v1/registries", tags=["registries"])


@router.post("", response_model=RegistryResponse, status_code=201)
async def connect_registry(payload: RegistryCreate):
    """Connecte un nouveau Schema Registry"""
    # 1. Test connectivity first
    try:
        provider = create_provider(
            provider_type=payload.provider_type,
            base_url=payload.base_url,
            credentials_plain={
                "api_key": payload.api_key,
                "api_secret": payload.api_secret,
                "username": payload.username,
                "password": payload.password,
                "token": payload.token,
            },
        )
        healthy = await provider.health_check()
        if not healthy:
            raise HTTPException(status_code=400, detail="Cannot connect to registry - check URL and credentials")
        await provider.close() if hasattr(provider, "close") else None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection test failed: {e}")

    # 2. Encrypt credentials
    creds = {}
    if payload.api_key:
        creds["api_key"] = payload.api_key
    if payload.api_secret:
        creds["api_secret"] = payload.api_secret
    if payload.username:
        creds["username"] = payload.username
    if payload.password:
        creds["password"] = payload.password
    if payload.token:
        creds["token"] = payload.token

    encrypted = encrypt_credentials(creds) if creds else None

    # 3. Store in Supabase
    # TODO: get user_id from Supabase Auth JWT
    # For now, use a placeholder
    data = {
        "user_id": "00000000-0000-0000-0000-000000000000",
        "name": payload.name,
        "provider_type": payload.provider_type.value,
        "base_url": payload.base_url,
        "credentials_encrypted": encrypted.decode() if encrypted else None,
        "environment": payload.environment,
    }

    result = supabase_client.create_registry(data)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to store registry")

    return RegistryResponse(
        id=result["id"],
        name=result["name"],
        provider_type=ProviderType(result["provider_type"]),
        base_url=result["base_url"],
        environment=result["environment"],
        is_active=result["is_active"],
        created_at=result.get("created_at"),
        is_connected=True,
    )


@router.get("", response_model=list[RegistryResponse])
async def list_registries():
    """Liste les registries de l'utilisateur"""
    # TODO: get user_id from auth
    user_id = "00000000-0000-0000-0000-000000000000"
    registries = supabase_client.get_registries(user_id)

    return [
        RegistryResponse(
            id=r["id"],
            name=r["name"],
            provider_type=ProviderType(r["provider_type"]),
            base_url=r["base_url"],
            environment=r["environment"],
            is_active=r["is_active"],
            created_at=r.get("created_at"),
        )
        for r in registries
    ]


@router.get("/{registry_id}/health", response_model=RegistryHealth)
async def check_registry_health(registry_id: str):
    """Vérifie la connectivité d'un registry"""
    import time

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
        raise HTTPException(status_code=404, detail="Registry not found")

    registry = response.data[0]

    try:
        from app.utils.encryption import decrypt_credentials

        creds = {}
        if registry.get("credentials_encrypted"):
            raw = registry["credentials_encrypted"]
            creds = decrypt_credentials(raw.encode() if isinstance(raw, str) else raw)

        provider = create_provider(
            provider_type=ProviderType(registry["provider_type"]),
            base_url=registry["base_url"],
            credentials_plain=creds,
        )

        start = time.monotonic()
        healthy = await provider.health_check()
        elapsed = (time.monotonic() - start) * 1000
        await provider.close() if hasattr(provider, "close") else None

        return RegistryHealth(
            registry_id=registry_id,
            is_healthy=healthy,
            response_time_ms=round(elapsed, 1),
        )
    except Exception as e:
        return RegistryHealth(
            registry_id=registry_id,
            is_healthy=False,
            error=str(e),
        )


@router.delete("/{registry_id}", status_code=204)
async def delete_registry(registry_id: str):
    """Supprime (désactive) un registry"""
    # TODO: get user_id from auth
    user_id = "00000000-0000-0000-0000-000000000000"
    success = supabase_client.delete_registry(registry_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Registry not found")