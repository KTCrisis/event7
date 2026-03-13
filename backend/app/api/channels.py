"""
event7 - Channels API Routes
CRUD channels, bindings, vue inverse, channel-map agrégée.

Placement: backend/app/api/channels.py
Design doc: CHANNEL_MODEL_DESIGN.md v1.1.0
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger

from app.models.auth import UserContext
from app.models.channel import (
    ChannelCreate,
    ChannelUpdate,
    ChannelResponse,
    ChannelSummary,
    ChannelSubjectCreate,
    ChannelSubjectResponse,
    ChannelMapResponse,
)
from app.services.channel_service import ChannelService
from app.utils.auth import get_current_user

# --- Dependency: build ChannelService for a registry ---
from app.main import redis_cache, db_client


def get_channel_service(
    registry_id: UUID = Path(..., description="Registry UUID"),
    user: UserContext = Depends(get_current_user),
) -> ChannelService:
    """Build a ChannelService scoped to the registry.

    Unlike SchemaService, no provider needed — channels are DB-only.
    No yield/cleanup needed (no HTTP client to close).
    """
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available",
        )

    # Verify the registry exists and belongs to the user
    registry = db_client.get_registry_by_id(
        registry_id=str(registry_id),
        user_id=str(user.user_id),
    )
    if not registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registry {registry_id} not found",
        )

    return ChannelService(
        cache=redis_cache,
        db=db_client,
        registry_id=str(registry_id),
    )


router = APIRouter(
    prefix="/api/v1/registries/{registry_id}",
    tags=["channels"],
)


# ================================================================
# CHANNELS CRUD
# ================================================================


@router.get("/channels", response_model=list[ChannelSummary])
async def list_channels(
    broker_type: str | None = Query(None, description="Filter by broker type"),
    data_layer: str | None = Query(None, description="Filter by data layer"),
    search: str | None = Query(None, description="Search in name or address"),
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """List all channels for a registry."""
    return service.list_channels(
        broker_type=broker_type,
        data_layer=data_layer,
        search=search,
    )


@router.get("/channels/{channel_id}", response_model=ChannelResponse)
async def get_channel(
    channel_id: UUID = Path(..., description="Channel UUID"),
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """Get a single channel with its bindings."""
    channel = service.get_channel(str(channel_id))
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Channel {channel_id} not found",
        )
    return channel


@router.post("/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    payload: ChannelCreate,
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """Create a new channel."""
    channel, warnings = service.create_channel(payload)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create channel",
        )
    # Attach warnings as response header (non-blocking)
    if warnings:
        logger.warning(f"Channel create warnings: {warnings}")
    return channel


@router.put("/channels/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    payload: ChannelUpdate,
    channel_id: UUID = Path(..., description="Channel UUID"),
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """Update a channel."""
    channel = service.update_channel(str(channel_id), payload)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Channel {channel_id} not found",
        )
    return channel


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: UUID = Path(..., description="Channel UUID"),
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """Delete a channel (cascades bindings)."""
    deleted = service.delete_channel(str(channel_id))
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Channel {channel_id} not found",
        )


# ================================================================
# CHANNEL-SUBJECT BINDINGS
# ================================================================


@router.get(
    "/channels/{channel_id}/subjects",
    response_model=list[ChannelSubjectResponse],
)
async def list_bindings(
    channel_id: UUID = Path(..., description="Channel UUID"),
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """List all subject bindings for a channel."""
    return service.list_bindings(str(channel_id))


@router.post(
    "/channels/{channel_id}/subjects",
    response_model=ChannelSubjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_binding(
    payload: ChannelSubjectCreate,
    channel_id: UUID = Path(..., description="Channel UUID"),
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """Bind a subject to a channel."""
    # Verify channel exists
    channel = service.get_channel(str(channel_id))
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Channel {channel_id} not found",
        )

    binding, warnings = service.create_binding(str(channel_id), payload)
    if not binding:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create binding",
        )
    if warnings:
        logger.warning(f"Binding create warnings: {warnings}")
    return binding


@router.delete(
    "/channels/{channel_id}/subjects/{binding_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_binding(
    channel_id: UUID = Path(..., description="Channel UUID"),
    binding_id: UUID = Path(..., description="Binding UUID"),
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """Remove a subject binding from a channel."""
    deleted = service.delete_binding(str(binding_id))
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Binding {binding_id} not found",
        )


# ================================================================
# REVERSE LOOKUP
# ================================================================


@router.get(
    "/subjects/{subject_name}/channels",
    response_model=list[dict],
)
async def get_channels_for_subject(
    subject_name: str = Path(..., description="Subject name"),
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """List all channels that transport a given subject (reverse lookup)."""
    return service.get_channels_for_subject(subject_name)


# ================================================================
# CHANNEL MAP (aggregated view)
# ================================================================


@router.get("/channel-map", response_model=ChannelMapResponse)
async def get_channel_map(
    user: UserContext = Depends(get_current_user),
    service: ChannelService = Depends(get_channel_service),
):
    """Full channel-map view: channels + subjects + bindings + metrics."""
    return service.get_channel_map()