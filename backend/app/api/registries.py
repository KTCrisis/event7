"""
Registry CRUD routes.

Placement: backend/app/api/registries.py
Modifications:
  - P0-AUTH: Depends(get_current_user) remplace le user_id hardcodé
  - P0-DELETE: gère le cas où delete_registry retourne False (404)
  - Audit log avec le vrai user_id
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.config import get_settings
from app.db.supabase_client import SupabaseClient
from app.models.auth import UserContext
from app.models.registry import RegistryCreate, RegistryResponse, RegistryHealth
from app.providers.factory import create_provider
from app.utils.auth import get_current_user
from app.utils.encryption import encrypt_credentials

# Global instance (initialized in main.py lifespan)
from app.main import supabase_client

router = APIRouter(prefix="/api/v1/registries", tags=["registries"])


@router.post("", response_model=RegistryResponse, status_code=status.HTTP_201_CREATED)
async def create_registry(
    payload: RegistryCreate,
    user: UserContext = Depends(get_current_user),  # P0-AUTH
):
    """Connect a new schema registry.

    1. Test connectivity with provided credentials
    2. Encrypt credentials
    3. Store in Supabase (scoped to user)
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database not available")

    # --- Test connectivity first ---
    provider = None
    try:
        provider = create_provider(
            provider_type=payload.provider_type,
            base_url=payload.base_url,
            credentials_plain={"api_key": payload.api_key, "api_secret": payload.api_secret},
        )
        healthy = await provider.health_check()
        if not healthy:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not connect to schema registry",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registry connectivity test failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection failed: {str(e)}",
        )
    finally:
        if provider:
            await provider.close()  # P0-LIFECYCLE

    # --- Encrypt credentials ---
    creds_encrypted = encrypt_credentials(
        {"api_key": payload.api_key, "api_secret": payload.api_secret}
    )
    if isinstance(creds_encrypted, bytes):
        creds_encrypted = creds_encrypted.decode("utf-8")
    # --- Store in Supabase ---
    registry_data = {
        "user_id": str(user.user_id),  # P0-AUTH: real user_id
        "name": payload.name,
        "provider_type": payload.provider_type.value,
        "base_url": payload.base_url,
        "credentials_encrypted": creds_encrypted,
        "environment": payload.environment or "DEV",
        "is_active": True,
    }

    result = supabase_client.create_registry(registry_data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store registry",
        )

    # --- Audit ---
    supabase_client.log_audit(
        user_id=str(user.user_id),
        registry_id=result["id"],
        action="registry.created",
        details={"name": payload.name, "provider_type": payload.provider_type},
    )

    logger.info(f"Registry '{payload.name}' created by user {user.user_id}")
    return RegistryResponse(**result)


@router.get("", response_model=list[RegistryResponse])
async def list_registries(
    user: UserContext = Depends(get_current_user),  # P0-AUTH
):
    """List all active registries for the authenticated user."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database not available")

    registries = supabase_client.get_registries(user_id=str(user.user_id))
    return [RegistryResponse(**r) for r in registries]


@router.get("/{registry_id}/health", response_model=RegistryHealth)
async def check_health(
    registry_id: UUID,
    user: UserContext = Depends(get_current_user),  # P0-AUTH
):
    """Health check a registry connection."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database not available")

    registry = supabase_client.get_registry_by_id(
        registry_id=str(registry_id),
        user_id=str(user.user_id),  # P0-AUTH: scoped to user
    )
    if not registry:
        raise HTTPException(status_code=404, detail="Registry not found")

    provider = None
    try:
        provider = create_provider(
            provider_type=registry["provider_type"],
            base_url=registry["base_url"],
            credentials_encrypted=registry.get("credentials_encrypted"),
        )
        healthy = await provider.health_check()
        return RegistryHealth(
            registry_id=str(registry_id),
            healthy=healthy,
            provider_type=registry["provider_type"],
        )
    except Exception as e:
        logger.warning(f"Health check failed for registry {registry_id}: {e}")
        return RegistryHealth(
            registry_id=str(registry_id),
            healthy=False,
            provider_type=registry["provider_type"],
            error=str(e),
        )
    finally:
        if provider:
            await provider.close()  # P0-LIFECYCLE


@router.delete("/{registry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_registry(
    registry_id: UUID,
    user: UserContext = Depends(get_current_user),  # P0-AUTH
):
    """Soft-delete (deactivate) a registry."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Database not available")

    # P0-DELETE: delete_registry now returns False if no row was affected
    deleted = supabase_client.delete_registry(
        registry_id=str(registry_id),
        user_id=str(user.user_id),  # P0-AUTH: scoped to user
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registry {registry_id} not found or not owned by you",
        )

    # --- Audit ---
    supabase_client.log_audit(
        user_id=str(user.user_id),
        registry_id=str(registry_id),
        action="registry.deleted",
    )

    logger.info(f"Registry {registry_id} deactivated by user {user.user_id}")
    # 204 No Content — pas de body