"""
Supabase database client.

Placement: backend/app/db/supabase_client.py
Modifications:
  - P0-AUTH: toutes les méthodes reçoivent user_id en paramètre (plus de hardcode)
  - P0-DELETE: les mutations vérifient le résultat réel (response.data non vide)
  - get_registry_by_id filtre par user_id pour isolation multi-tenant

Note: en dev (service_role_key), le RLS est bypassé mais le filtrage
user_id est quand même fait explicitement dans les queries.
"""

from typing import Any

from loguru import logger
from supabase import create_client, Client


class SupabaseClient:
    """Wrapper around supabase-py with explicit user scoping."""

    def __init__(self, url: str, key: str):
        """Initialize Supabase client.

        Args:
            url: Supabase project URL
            key: service_role_key (dev) or anon_key (prod with JWT forwarding)
        """
        self.client: Client = create_client(url, key)
        logger.info("Supabase client initialized")

    # ================================================================
    # REGISTRIES
    # ================================================================

    def get_registries(self, user_id: str) -> list[dict]:
        """List all registries for a user."""
        response = (
            self.client.table("registries")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        return response.data or []

    def get_registry_by_id(self, registry_id: str, user_id: str) -> dict | None:
        """Fetch a single registry, scoped to the user.

        Returns None if not found or not owned by user.
        """
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
            logger.error(f"Failed to create registry: no data returned")
            return None
        return response.data[0]

    def delete_registry(self, registry_id: str, user_id: str) -> bool:
        """Soft-delete a registry (set is_active=False).

        P0-DELETE: now verifies that a row was actually modified.
        Returns True only if a row belonging to user_id was updated.
        """
        response = (
            self.client.table("registries")
            .update({"is_active": False})
            .eq("id", registry_id)
            .eq("user_id", user_id)  # P0-AUTH: scope to user
            .execute()
        )

        # P0-DELETE: verify the mutation actually affected a row
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
        """Get all enrichments for a registry (used by catalog)."""
        response = (
            self.client.table("enrichments")
            .select("*")
            .eq("registry_id", registry_id)
            .execute()
        )
        return response.data or []

    def upsert_enrichment(self, enrichment_data: dict) -> dict | None:
        """Create or update an enrichment.

        P0-DELETE pattern: verify the mutation result.
        """
        response = (
            self.client.table("enrichments")
            .upsert(
                enrichment_data,
                on_conflict="registry_id,subject",
            )
            .execute()
        )
        if not response.data:
            logger.error(f"Failed to upsert enrichment: no data returned")
            return None
        return response.data[0]

    # ================================================================
    # ASYNCAPI SPECS
    # ================================================================

    def get_asyncapi_spec(self, registry_id: str, subject: str) -> dict | None:
        """Get stored AsyncAPI spec for a subject."""
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

    def upsert_asyncapi_spec(self, spec_data: dict) -> dict | None:
        """Create or update an AsyncAPI spec."""
        response = (
            self.client.table("asyncapi_specs")
            .upsert(
                spec_data,
                on_conflict="registry_id,subject",
            )
            .execute()
        )
        if not response.data:
            logger.error(f"Failed to upsert asyncapi spec: no data returned")
            return None
        return response.data[0]

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