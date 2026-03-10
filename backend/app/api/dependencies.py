"""
FastAPI dependency injection.

Placement: backend/app/api/dependencies.py
Modifications:
  - P0-AUTH: injection du UserContext via get_current_user
  - P0-LIFECYCLE: get_schema_service est maintenant un async generator (yield)
    qui ferme le provider après la réponse

Usage dans les routes:
    @router.get("/{registry_id}/subjects")
    async def list_subjects(
        service: SchemaService = Depends(get_schema_service),
        user: UserContext = Depends(get_current_user),  # si besoin direct du user
    ):
        ...
"""

from uuid import UUID
from typing import AsyncGenerator

from fastapi import Depends, HTTPException, Path, status
from loguru import logger

from app.config import get_settings
from app.models.auth import UserContext
from app.providers.factory import create_provider
from app.services.schema_service import SchemaService
from app.utils.auth import get_current_user

# --- Global instances (initialisées dans main.py lifespan) ---
# Ces imports seront résolus au runtime après le startup de l'app
from app.main import redis_cache, supabase_client


async def get_schema_service(
    registry_id: UUID = Path(..., description="Registry UUID"),
    user: UserContext = Depends(get_current_user),
) -> AsyncGenerator[SchemaService, None]:
    """Build a SchemaService for the given registry, then clean up.

    Flow:
    1. Fetch registry from Supabase (filtered by user_id)
    2. Decrypt credentials
    3. Create provider (httpx client)
    4. Wrap in SchemaService
    5. yield → route handler executes
    6. finally → close provider (release HTTP connections)
    """
    settings = get_settings()

    # --- Fetch registry (scoped to user) ---
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available",
        )

    registry = supabase_client.get_registry_by_id(
        registry_id=str(registry_id),
        user_id=str(user.user_id),
    )

    if not registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registry {registry_id} not found",
        )

    if not registry.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"Registry {registry_id} is deactivated",
        )

    # --- Create provider ---
    provider = None
    try:
        provider = create_provider(
            provider_type=registry["provider_type"],
            base_url=registry["base_url"],
            credentials_encrypted=registry.get("credentials_encrypted"),
        )

        service = SchemaService(
            provider=provider,
            cache=redis_cache,
            db=supabase_client,
            registry_id=str(registry_id),
        )

        yield service  # P0-LIFECYCLE: route handler runs here

    except HTTPException:
        raise  # Re-raise FastAPI exceptions as-is
    except Exception as e:
        logger.error(f"Error creating service for registry {registry_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to connect to schema registry",
        )
    finally:
        # P0-LIFECYCLE: always close the provider's HTTP client
        if provider is not None:
            try:
                await provider.close()
                logger.debug(f"Provider closed for registry {registry_id}")
            except Exception as e:
                logger.warning(f"Error closing provider for registry {registry_id}: {e}")