"""
event7 - Channel Service
Orchestre les channels (DB) et les bindings (DB).
Pas de dépendance au SchemaRegistryProvider en Phase A — 
l'auto-detect (Phase B) ajoutera le provider plus tard.

Placement: backend/app/services/channel_service.py
Design doc: CHANNEL_MODEL_DESIGN.md v1.1.0
"""

from loguru import logger

from app.cache.redis_cache import RedisCache
from app.db.base import DatabaseProvider
from app.models.channel import (
    ChannelCreate,
    ChannelUpdate,
    ChannelResponse,
    ChannelSummary,
    ChannelSubjectCreate,
    ChannelSubjectResponse,
    ChannelMapEntry,
    ChannelMapResponse,
)


class ChannelService:
    """
    Couche métier pour le Channel Model.
    Flow: Route → Service → DB (+ Cache pour les vues agrégées)
    """

    CACHE_TTL = 300  # 5 min

    def __init__(
        self,
        cache: RedisCache,
        db: DatabaseProvider,
        registry_id: str,
    ):
        self.cache = cache
        self.db = db
        self.registry_id = registry_id

    def _key(self, *parts: str) -> str:
        return self.cache.cache_key(self.registry_id, "channels", *parts)

    def _invalidate(self) -> None:
        """Invalidate all channel cache for this registry."""
        try:
            import asyncio
            loop = asyncio.get_running_loop()
            loop.create_task(self.cache.delete_pattern(self._key("*")))
        except RuntimeError:
            pass  # No running loop (e.g. tests) — cache will expire via TTL

    # ================================================================
    # CHANNELS CRUD
    # ================================================================

    def list_channels(
        self,
        broker_type: str | None = None,
        data_layer: str | None = None,
        search: str | None = None,
    ) -> list[ChannelSummary]:
        """List all channels for this registry with optional filters."""
        rows = self.db.get_channels(self.registry_id)

        # Apply filters in Python (simple enough for MVP, DB filters in Phase 2)
        if broker_type:
            rows = [r for r in rows if r.get("broker_type") == broker_type]
        if data_layer:
            rows = [r for r in rows if r.get("data_layer") == data_layer]
        if search:
            q = search.lower()
            rows = [
                r for r in rows
                if q in r.get("name", "").lower()
                or q in r.get("address", "").lower()
            ]

        summaries = []
        for row in rows:
            bindings = self.db.get_bindings_for_channel(row["id"])
            has_key = any(b.get("schema_role") == "key" for b in bindings)
            has_value = any(b.get("schema_role") == "value" for b in bindings)

            # Compute binding health
            statuses = [b.get("binding_status", "unverified") for b in bindings]
            if not statuses:
                health = "unknown"
            elif all(s == "active" for s in statuses):
                health = "healthy"
            elif any(s == "missing_subject" for s in statuses):
                health = "degraded"
            else:
                health = "unknown"

            summaries.append(ChannelSummary(
                id=str(row["id"]),
                name=row["name"],
                address=row["address"],
                broker_type=row["broker_type"],
                resource_kind=row["resource_kind"],
                messaging_pattern=row["messaging_pattern"],
                data_layer=row.get("data_layer"),
                subject_count=row.get("subject_count", len(bindings)),
                has_key_schema=has_key,
                has_value_schema=has_value,
                binding_health=health,
            ))

        return summaries

    def get_channel(self, channel_id: str) -> ChannelResponse | None:
        """Get a single channel with its bindings."""
        row = self.db.get_channel_by_id(channel_id)
        if not row:
            return None
        if str(row.get("registry_id")) != self.registry_id:
            return None  # Scope guard

        bindings = self.db.get_bindings_for_channel(channel_id)
        binding_models = [ChannelSubjectResponse(**b) for b in bindings]

        return ChannelResponse(
            id=str(row["id"]),
            registry_id=str(row["registry_id"]),
            name=row["name"],
            address=row["address"],
            broker_type=row["broker_type"],
            resource_kind=row["resource_kind"],
            messaging_pattern=row["messaging_pattern"],
            broker_config=row.get("broker_config", {}),
            data_layer=row.get("data_layer"),
            description=row.get("description"),
            owner=row.get("owner"),
            tags=row.get("tags", []),
            is_auto_detected=row.get("is_auto_detected", False),
            auto_detect_source=row.get("auto_detect_source"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
            subjects=binding_models,
        )

    def create_channel(self, payload: ChannelCreate) -> tuple[ChannelResponse | None, list[str]]:
        """Create a channel. Returns (channel, warnings)."""
        warnings = []

        channel_data = {
            "registry_id": self.registry_id,
            **payload.model_dump(exclude_none=True),
        }

        row = self.db.create_channel(channel_data)
        if not row:
            return None, ["Failed to create channel in database"]

        self._invalidate()
        logger.info(f"Channel created: {payload.address} [{payload.broker_type}]")

        channel = self.get_channel(str(row["id"]))
        return channel, warnings

    def update_channel(self, channel_id: str, payload: ChannelUpdate) -> ChannelResponse | None:
        """Update a channel."""
        # Scope guard
        existing = self.db.get_channel_by_id(channel_id)
        if not existing or str(existing.get("registry_id")) != self.registry_id:
            return None

        updates = payload.model_dump(exclude_none=True)
        if not updates:
            return self.get_channel(channel_id)

        row = self.db.update_channel(channel_id, updates)
        if not row:
            return None

        self._invalidate()
        logger.info(f"Channel updated: {channel_id}")
        return self.get_channel(channel_id)

    def delete_channel(self, channel_id: str) -> bool:
        """Delete a channel (cascades bindings)."""
        existing = self.db.get_channel_by_id(channel_id)
        if not existing or str(existing.get("registry_id")) != self.registry_id:
            return False

        result = self.db.delete_channel(channel_id)
        if result:
            self._invalidate()
            logger.info(f"Channel deleted: {channel_id}")
        return result

    # ================================================================
    # BINDINGS CRUD
    # ================================================================

    def list_bindings(self, channel_id: str) -> list[ChannelSubjectResponse]:
        """List all bindings for a channel."""
        # Scope guard
        channel = self.db.get_channel_by_id(channel_id)
        if not channel or str(channel.get("registry_id")) != self.registry_id:
            return []

        rows = self.db.get_bindings_for_channel(channel_id)
        return [ChannelSubjectResponse(**r) for r in rows]

    def get_channels_for_subject(self, subject_name: str) -> list[dict]:
        """Reverse lookup: all channels bound to a subject."""
        return self.db.get_channels_for_subject(self.registry_id, subject_name)

    def create_binding(
        self, channel_id: str, payload: ChannelSubjectCreate
    ) -> tuple[ChannelSubjectResponse | None, list[str]]:
        """Create a binding. Returns (binding, warnings)."""
        warnings = self._check_binding_coherence(channel_id, payload)

        binding_data = {
            "channel_id": channel_id,
            **payload.model_dump(exclude_none=True),
        }

        row = self.db.create_binding(binding_data)
        if not row:
            return None, ["Failed to create binding in database"]

        self._invalidate()
        logger.info(
            f"Binding created: {payload.subject_name} → channel {channel_id} "
            f"[{payload.binding_strategy}/{payload.schema_role}]"
        )
        return ChannelSubjectResponse(**row), warnings

    def delete_binding(self, binding_id: str) -> bool:
        """Delete a binding."""
        result = self.db.delete_binding(binding_id)
        if result:
            self._invalidate()
            logger.info(f"Binding deleted: {binding_id}")
        return result

    # ================================================================
    # CHANNEL MAP (aggregated view)
    # ================================================================

    def get_channel_map(self) -> ChannelMapResponse:
        """Build the full channel-map view for the frontend."""
        channels = self.db.get_channels(self.registry_id)
        all_bindings = []
        entries = []

        for ch in channels:
            bindings = self.db.get_bindings_for_channel(ch["id"])
            all_bindings.extend(bindings)

            has_key = any(b.get("schema_role") == "key" for b in bindings)
            has_value = any(b.get("schema_role") == "value" for b in bindings)
            statuses = [b.get("binding_status", "unverified") for b in bindings]

            if not statuses:
                health = "unknown"
            elif all(s == "active" for s in statuses):
                health = "healthy"
            elif any(s == "missing_subject" for s in statuses):
                health = "degraded"
            else:
                health = "unknown"

            summary = ChannelSummary(
                id=str(ch["id"]),
                name=ch["name"],
                address=ch["address"],
                broker_type=ch["broker_type"],
                resource_kind=ch["resource_kind"],
                messaging_pattern=ch["messaging_pattern"],
                data_layer=ch.get("data_layer"),
                subject_count=len(bindings),
                has_key_schema=has_key,
                has_value_schema=has_value,
                binding_health=health,
            )

            binding_models = [ChannelSubjectResponse(**b) for b in bindings]
            entries.append(ChannelMapEntry(channel=summary, bindings=binding_models))

        # Compute bound subjects
        bound_subjects = set(b.get("subject_name") for b in all_bindings)

        # Warnings
        warnings = self._compute_map_warnings(entries)

        return ChannelMapResponse(
            channels=entries,
            total_channels=len(entries),
            total_bindings=len(all_bindings),
            bound_subjects=len(bound_subjects),
            # unbound_subjects computed in Phase B (needs provider.list_subjects)
            unbound_subjects=[],
            warnings=warnings,
        )

    # ================================================================
    # COHERENCE WARNINGS
    # ================================================================

    def _check_binding_coherence(
        self, channel_id: str, payload: ChannelSubjectCreate
    ) -> list[str]:
        """Check for suspect binding configurations. Returns warnings (non-blocking)."""
        warnings = []

        # Warning: channel_bound subject linked to many channels
        if payload.binding_strategy == "channel_bound":
            existing = self.db.get_channels_for_subject(
                self.registry_id, payload.subject_name
            )
            if len(existing) >= 4:
                warnings.append(
                    f"Subject '{payload.subject_name}' is channel_bound but already linked "
                    f"to {len(existing)} channels. Consider domain_bound."
                )

        # Warning: raw layer with domain_bound
        channel = self.db.get_channel_by_id(channel_id)
        if channel:
            ch_layer = channel.get("data_layer")
            if ch_layer == "raw" and payload.binding_strategy == "domain_bound":
                warnings.append(
                    "RAW layer channels are typically channel_bound, not domain_bound."
                )

            # Warning: app_bound without app prefix in subject
            if payload.binding_strategy == "app_bound":
                name = payload.subject_name
                # Simple heuristic: app_bound subjects usually have 3+ dot-separated parts
                # with first part being an app name, not a domain namespace
                parts = name.split(".")
                if len(parts) < 3:
                    warnings.append(
                        f"Subject '{name}' is app_bound but doesn't follow "
                        "the expected <app>.<domain>.<entity> convention."
                    )

        return warnings

    def _compute_map_warnings(self, entries: list[ChannelMapEntry]) -> list[str]:
        """Compute warnings for the channel-map view."""
        warnings = []

        # Missing subjects
        missing_count = sum(
            1 for entry in entries
            for b in entry.bindings
            if b.binding_status == "missing_subject"
        )
        if missing_count > 0:
            warnings.append(
                f"{missing_count} binding(s) reference subjects not found in the registry."
            )

        # Channels without bindings
        empty_channels = [e for e in entries if not e.bindings]
        if empty_channels:
            names = ", ".join(e.channel.name for e in empty_channels[:3])
            suffix = f" and {len(empty_channels) - 3} more" if len(empty_channels) > 3 else ""
            warnings.append(
                f"{len(empty_channels)} channel(s) have no subject bindings: {names}{suffix}"
            )

        return warnings