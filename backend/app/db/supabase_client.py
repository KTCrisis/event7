"""
Supabase database provider.

Placement: backend/app/db/supabase_client.py

Refactored from SupabaseClient to SupabaseDatabase(DatabaseProvider).
Internal logic is identical — only the class hierarchy changed.

Backward compat: SupabaseClient alias kept for existing imports.
"""

from typing import Any

from loguru import logger
from supabase import create_client, Client

from app.db.base import DatabaseProvider


class SupabaseDatabase(DatabaseProvider):
    """Supabase implementation of DatabaseProvider."""

    def __init__(self, url: str, key: str):
        """
        Args:
            url: Supabase project URL
            key: service_role_key (dev) or anon_key (prod with JWT forwarding)
        """
        self._url = url
        self._key = key
        self.client: Client | None = None

    # ================================================================
    # LIFECYCLE
    # ================================================================

    async def connect(self) -> None:
        """Initialize Supabase client."""
        self.client = create_client(self._url, self._key)
        logger.info("Supabase client initialized")

    async def disconnect(self) -> None:
        """Supabase-py has no explicit close — no-op."""
        logger.info("Supabase client disconnected (no-op)")

    def ping(self) -> bool:
        """Check Supabase connectivity."""
        try:
            self.client.table("registries").select("id").limit(1).execute()
            return True
        except Exception:
            return False
    # ================================================================
    # REGISTRIES
    # ================================================================

    def get_registries(self, user_id: str) -> list[dict]:
        """List all active registries for a user."""
        response = (
            self.client.table("registries")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        return response.data or []

    def get_registry_by_id(self, registry_id: str, user_id: str) -> dict | None:
        """Fetch a single registry, scoped to the user."""
        response = (
            self.client.table("registries")
            .select("*")
            .eq("id", registry_id)
            .eq("user_id", user_id)
            .execute()
        )
        data = response.data
        if not data:
            return None
        return data[0]

    def create_registry(self, registry_data: dict) -> dict | None:
        """Insert a new registry. registry_data must include user_id."""
        response = (
            self.client.table("registries")
            .insert(registry_data)
            .execute()
        )
        if not response.data:
            logger.error("Failed to create registry: no data returned")
            return None
        return response.data[0]

    def delete_registry(self, registry_id: str, user_id: str) -> bool:
        """Soft-delete a registry (set is_active=False)."""
        response = (
            self.client.table("registries")
            .update({"is_active": False})
            .eq("id", registry_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not response.data:
            logger.warning(
                f"delete_registry: no row affected for registry={registry_id}, user={user_id}"
            )
            return False
        logger.info(f"Registry {registry_id} deactivated by user {user_id}")
        return True

    # ================================================================
    # ENRICHMENTS
    # ================================================================

    def get_enrichment(self, registry_id: str, subject: str) -> dict | None:
        """Get enrichment metadata for a subject."""
        response = (
            self.client.table("enrichments")
            .select("*")
            .eq("registry_id", registry_id)
            .eq("subject", subject)
            .execute()
        )
        data = response.data
        if not data:
            return None
        return data[0]

    def get_enrichments_for_registry(self, registry_id: str) -> list[dict]:
        """Get all enrichments for a registry."""
        response = (
            self.client.table("enrichments")
            .select("*")
            .eq("registry_id", registry_id)
            .execute()
        )
        return response.data or []

    def upsert_enrichment(self, enrichment_data: dict) -> dict | None:
        """Create or update an enrichment."""
        response = (
            self.client.table("enrichments")
            .upsert(
                enrichment_data,
                on_conflict="registry_id,subject",
            )
            .execute()
        )
        if not response.data:
            logger.error("Failed to upsert enrichment: no data returned")
            return None
        return response.data[0]

    # ================================================================
    # ASYNCAPI SPECS
    # ================================================================

    def get_asyncapi_spec(self, registry_id: str, subject: str) -> dict | None:
        """Retrieve an AsyncAPI spec."""
        response = (
            self.client.table("asyncapi_specs")
            .select("*")
            .eq("registry_id", registry_id)
            .eq("subject", subject)
            .execute()
        )
        data = response.data
        if not data:
            return None
        return data[0]

    def delete_asyncapi_spec(
        self, registry_id: str, subject: str, user_id: str
    ) -> bool:
        """Delete an AsyncAPI spec."""
        if not self.client:
            return False

        try:
            response = (
                self.client.table("asyncapi_specs")
                .delete()
                .eq("registry_id", registry_id)
                .eq("subject", subject)
                .execute()
            )
            deleted = bool(response.data)
            if deleted:
                self.log_audit(
                    user_id=user_id,
                    registry_id=registry_id,
                    action="asyncapi_delete",
                    details={"subject": subject},
                )
            return deleted
        except Exception as e:
            logger.error(f"Failed to delete AsyncAPI spec: {e}")
            return False

    # ================================================================
    # AUDIT LOG
    # ================================================================

    def log_audit(
        self,
        user_id: str,
        registry_id: str,
        action: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Write an audit log entry. Fire-and-forget, never raises."""
        try:
            self.client.table("audit_logs").insert({
                "user_id": user_id,
                "registry_id": registry_id,
                "action": action,
                "details": details or {},
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to write audit log: {e}")

    # ================================================================
    # SCHEMA SNAPSHOTS
    # ================================================================

    def save_snapshot(self, snapshot_data: dict) -> dict | None:
        """Save a schema snapshot for historical diff."""
        response = (
            self.client.table("schema_snapshots")
            .upsert(
                snapshot_data,
                on_conflict="registry_id,subject,version",
            )
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]


# Backward compatibility alias
SupabaseClient = SupabaseDatabase