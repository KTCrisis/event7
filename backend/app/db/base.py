"""
Abstract Database Provider.

Placement: backend/app/db/base.py

Contract that all database implementations must follow.
Methods mirror the existing SupabaseClient API — zero changes needed
in routes, services, or dependencies.
"""

from abc import ABC, abstractmethod
from typing import Any


class DatabaseProvider(ABC):
    """Abstract base for database access layer."""

    @abstractmethod
    def ping(self) -> bool:
        """Quick connectivity check. Returns True if DB is reachable."""
        ...

    # ================================================================
    # LIFECYCLE
    # ================================================================

    @abstractmethod
    async def connect(self) -> None:
        """Initialize connection pool / client. Called once at startup."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection pool / client. Called once at shutdown."""
        ...

    # ================================================================
    # REGISTRIES
    # ================================================================

    @abstractmethod
    def get_registries(self, user_id: str) -> list[dict]:
        """List all active registries for a user."""
        ...

    @abstractmethod
    def get_registry_by_id(self, registry_id: str, user_id: str) -> dict | None:
        """Fetch a single registry, scoped to the user."""
        ...

    @abstractmethod
    def create_registry(self, registry_data: dict) -> dict | None:
        """Insert a new registry. registry_data must include user_id."""
        ...

    @abstractmethod
    def delete_registry(self, registry_id: str, user_id: str) -> bool:
        """Soft-delete (deactivate) a registry. Returns True if a row was affected."""
        ...

    # ================================================================
    # ENRICHMENTS
    # ================================================================

    @abstractmethod
    def get_enrichment(self, registry_id: str, subject: str) -> dict | None:
        """Get enrichment metadata for a subject."""
        ...

    @abstractmethod
    def get_enrichments_for_registry(self, registry_id: str) -> list[dict]:
        """Get all enrichments for a registry."""
        ...

    @abstractmethod
    def upsert_enrichment(self, enrichment_data: dict) -> dict | None:
        """Create or update an enrichment."""
        ...

    # ================================================================
    # ASYNCAPI SPECS
    # ================================================================

    @abstractmethod
    def get_asyncapi_spec(self, registry_id: str, subject: str) -> dict | None:
        """Retrieve an AsyncAPI spec."""
        ...

    @abstractmethod
    def delete_asyncapi_spec(
        self, registry_id: str, subject: str, user_id: str
    ) -> bool:
        """Delete an AsyncAPI spec. Returns True if deleted."""
        
        ...
    @abstractmethod
    def upsert_asyncapi_spec(
        self,
        registry_id: str,
        subject: str,
        spec_content: dict,
        is_auto_generated: bool = True,
        user_id: str = "",
    ) -> dict | None:
        """Create or update an AsyncAPI spec."""
        ...
    # ================================================================
    # AUDIT LOG
    # ================================================================

    @abstractmethod
    def log_audit(
        self,
        user_id: str,
        registry_id: str,
        action: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Write an audit log entry. Fire-and-forget, never raises."""
        ...

    # ================================================================
    # SCHEMA SNAPSHOTS
    # ================================================================

    @abstractmethod
    def save_snapshot(self, snapshot_data: dict) -> dict | None:
        """Save a schema snapshot for historical diff."""
        ...