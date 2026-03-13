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
    # GOVERNANCE RULES
    # ================================================================
 
    @abstractmethod
    def list_governance_rules(
        self,
        registry_id: str,
        subject: str | None = None,
        scope: str | None = None,
        kind: str | None = None,
        category: str | None = None,
        severity: str | None = None,
        enforcement_status: str | None = None,
        source: str | None = None,
    ) -> list[dict]:
        """List governance rules for a registry, with optional filters.
        When subject is provided, also returns global rules (subject IS NULL).
        """
        ...
 
    @abstractmethod
    def get_governance_rule(self, rule_id: str) -> dict | None:
        """Get a single governance rule by ID."""
        ...
 
    @abstractmethod
    def create_governance_rule(self, data: dict) -> dict | None:
        """Insert a new governance rule."""
        ...
 
    @abstractmethod
    def update_governance_rule(self, rule_id: str, data: dict) -> dict | None:
        """Update a governance rule. data contains only fields to update."""
        ...
 
    @abstractmethod
    def delete_governance_rule(self, rule_id: str) -> bool:
        """Delete a governance rule. Returns True if deleted."""
        ...
 
    @abstractmethod
    def count_governance_rules(self, registry_id: str, subject: str | None = None) -> dict:
        """Count rules by kind, scope, and enforcement status.
        Returns: {"total": N, "by_kind": {...}, "by_scope": {...}, "by_enforcement": {...}, "global_rules": N, "subject_rules": N}
        """
        ...
 
    # ================================================================
    # GOVERNANCE RULE TEMPLATES
    # ================================================================
 
    @abstractmethod
    def list_governance_templates(self) -> list[dict]:
        """List all governance rule templates."""
        ...
 
    @abstractmethod
    def get_governance_template(self, template_id: str) -> dict | None:
        """Get a single governance rule template by ID."""
        ...


   # ================================================================
    # CHANNELS
    # ================================================================
 
    @abstractmethod
    def get_channels(self, registry_id: str) -> list[dict]:
        """List all channels for a registry."""
        ...
 
    @abstractmethod
    def get_channel_by_id(self, channel_id: str) -> dict | None:
        """Fetch a single channel by ID."""
        ...
 
    @abstractmethod
    def create_channel(self, channel_data: dict) -> dict | None:
        """Insert a new channel. channel_data must include registry_id."""
        ...
 
    @abstractmethod
    def update_channel(self, channel_id: str, updates: dict) -> dict | None:
        """Update a channel. Returns updated row or None."""
        ...
 
    @abstractmethod
    def delete_channel(self, channel_id: str) -> bool:
        """Delete a channel (cascades to channel_subjects). Returns True if deleted."""
        ...
 
    # ================================================================
    # CHANNEL-SUBJECT BINDINGS
    # ================================================================
 
    @abstractmethod
    def get_bindings_for_channel(self, channel_id: str) -> list[dict]:
        """List all subject bindings for a channel."""
        ...
 
    @abstractmethod
    def get_channels_for_subject(self, registry_id: str, subject_name: str) -> list[dict]:
        """List all channels bound to a subject (reverse lookup)."""
        ...
 
    @abstractmethod
    def create_binding(self, binding_data: dict) -> dict | None:
        """Create a channel-subject binding. binding_data must include channel_id."""
        ...
 
    @abstractmethod
    def delete_binding(self, binding_id: str) -> bool:
        """Delete a channel-subject binding. Returns True if deleted."""
        ...
 
    @abstractmethod
    def update_binding_status(
        self, binding_id: str, status: str, verified_at: str | None = None
    ) -> dict | None:
        """Update binding_status and last_verified_at. Returns updated row."""
        ...

    # ================================================================
    # CATALOG HELPERS
    # ================================================================

    @abstractmethod
    def get_subject_channel_map(self, registry_id: str) -> dict[str, list[str]]:
        """Return {subject_name: [distinct broker_types]} for all bound subjects in a registry."""
        ...

        
    # ================================================================
    # SCHEMA SNAPSHOTS
    # ================================================================

    @abstractmethod
    def save_snapshot(self, snapshot_data: dict) -> dict | None:
        """Save a schema snapshot for historical diff."""
        ...