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
            

    def upsert_asyncapi_spec(
        self,
        registry_id: str,
        subject: str,
        spec_content: dict,
        is_auto_generated: bool = True,
        user_id: str = "",
        source_schema_hash: str | None = None,
        source_schema_version: int | None = None,
    ) -> dict | None:
        """Create or update an AsyncAPI spec. Auto-increments spec_version on update."""
        existing = self.get_asyncapi_spec(registry_id, subject)
 
        if existing:
            new_version = (existing.get("spec_version") or 0) + 1
            update_data = {
                "spec_content": spec_content,
                "is_auto_generated": is_auto_generated,
                "spec_version": new_version,
            }
            if source_schema_hash is not None:
                update_data["source_schema_hash"] = source_schema_hash
            if source_schema_version is not None:
                update_data["source_schema_version"] = source_schema_version
 
            result = (
                self.client.table("asyncapi_specs")
                .update(update_data)
                .eq("registry_id", registry_id)
                .eq("subject", subject)
                .execute()
            )
        else:
            insert_data = {
                "registry_id": registry_id,
                "subject": subject,
                "spec_content": spec_content,
                "is_auto_generated": is_auto_generated,
                "spec_version": 1,
            }
            if source_schema_hash is not None:
                insert_data["source_schema_hash"] = source_schema_hash
            if source_schema_version is not None:
                insert_data["source_schema_version"] = source_schema_version
 
            result = (
                self.client.table("asyncapi_specs")
                .insert(insert_data)
                .execute()
            )
 
        row = (result.data or [None])[0]
        if row and user_id:
            self.log_audit(
                user_id=user_id,
                registry_id=registry_id,
                action="asyncapi_upsert",
                details={"subject": subject, "is_auto_generated": is_auto_generated},
            )
        return row

    def get_asyncapi_specs_for_registry(self, registry_id: str) -> list[dict]:
        result = (
            self.client.table("asyncapi_specs")
            .select("subject, spec_content, is_auto_generated, source_schema_hash, source_schema_version, spec_version, updated_at")
            .eq("registry_id", registry_id)
            .order("subject")
            .execute()
        )
        return result.data or []
 
    def get_bound_subjects_for_registry(self, registry_id: str) -> set[str]:
        # Supabase doesn't support JOINs via PostgREST natively.
        # Two-step: get channel IDs for registry, then get distinct subjects.
        channels_result = (
            self.client.table("channels")
            .select("id")
            .eq("registry_id", registry_id)
            .execute()
        )
        channel_ids = [c["id"] for c in (channels_result.data or [])]
        if not channel_ids:
            return set()
 
        bindings_result = (
            self.client.table("channel_subjects")
            .select("subject_name")
            .in_("channel_id", channel_ids)
            .execute()
        )
        return {r["subject_name"] for r in (bindings_result.data or [])}
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
    # GOVERNANCE RULES
    # ================================================================
 
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
        """List governance rules with optional filters.
        When subject is provided, returns subject-specific + global rules.
        """
        query = self.client.table("governance_rules").select("*")
        
        if subject is not None:
            # Subject-specific rules + global rules (subject IS NULL)
            query = query.eq("registry_id", registry_id).or_(
                f"subject.eq.{subject},subject.is.null"
            )
        else:
            query = query.eq("registry_id", registry_id)
        
        if scope:
            query = query.eq("rule_scope", scope)
        if kind:
            query = query.eq("rule_kind", kind)
        if category:
            query = query.eq("rule_category", category)
        if severity:
            query = query.eq("severity", severity)
        if enforcement_status:
            query = query.eq("enforcement_status", enforcement_status)
        if source:
            query = query.eq("source", source)
        
        query = query.order("created_at", desc=False)
        response = query.execute()
        return response.data or []
 
    def get_governance_rule(self, rule_id: str) -> dict | None:
        """Get a single governance rule by ID."""
        response = (
            self.client.table("governance_rules")
            .select("*")
            .eq("id", rule_id)
            .execute()
        )
        data = response.data
        return data[0] if data else None
 
    def create_governance_rule(self, data: dict) -> dict | None:
        """Insert a new governance rule."""
        response = (
            self.client.table("governance_rules")
            .insert(data)
            .execute()
        )
        if not response.data:
            logger.error("Failed to create governance rule: no data returned")
            return None
        return response.data[0]
 
    def update_governance_rule(self, rule_id: str, data: dict) -> dict | None:
        """Update a governance rule. data contains only fields to update."""
        response = (
            self.client.table("governance_rules")
            .update(data)
            .eq("id", rule_id)
            .execute()
        )
        if not response.data:
            logger.warning(f"update_governance_rule: no row affected for {rule_id}")
            return None
        return response.data[0]
 
    def delete_governance_rule(self, rule_id: str) -> bool:
        """Delete a governance rule."""
        try:
            response = (
                self.client.table("governance_rules")
                .delete()
                .eq("id", rule_id)
                .execute()
            )
            return bool(response.data)
        except Exception as e:
            logger.error(f"Failed to delete governance rule {rule_id}: {e}")
            return False
 
    def count_governance_rules(self, registry_id: str, subject: str | None = None) -> dict:
        """Count rules grouped by kind, scope, enforcement."""
        rules = self.list_governance_rules(registry_id, subject=subject)
        
        by_kind: dict[str, int] = {}
        by_scope: dict[str, int] = {}
        by_enforcement: dict[str, int] = {}
        global_count = 0
        subject_count = 0
        
        for r in rules:
            k = r.get("rule_kind", "POLICY")
            by_kind[k] = by_kind.get(k, 0) + 1
            
            s = r.get("rule_scope", "declarative")
            by_scope[s] = by_scope.get(s, 0) + 1
            
            e = r.get("enforcement_status", "declared")
            by_enforcement[e] = by_enforcement.get(e, 0) + 1
            
            if r.get("subject") is None:
                global_count += 1
            else:
                subject_count += 1
        
        return {
            "total": len(rules),
            "by_kind": by_kind,
            "by_scope": by_scope,
            "by_enforcement": by_enforcement,
            "global_rules": global_count,
            "subject_rules": subject_count,
        }
 
    # ================================================================
    # GOVERNANCE RULE TEMPLATES
    # ================================================================
 
    def list_governance_templates(self) -> list[dict]:
        """List all governance rule templates."""
        response = (
            self.client.table("governance_rule_templates")
            .select("*")
            .order("layer", desc=False)
            .execute()
        )
        return response.data or []
 
    def get_governance_template(self, template_id: str) -> dict | None:
        """Get a single template by ID."""
        response = (
            self.client.table("governance_rule_templates")
            .select("*")
            .eq("id", template_id)
            .execute()
        )
        data = response.data
        return data[0] if data else None

    # ================================================================
    # CHANNELS
    # ================================================================
 
    def get_channels(self, registry_id: str) -> list[dict]:
        """List all channels for a registry."""
        response = (
            self.client.table("channels")
            .select("*")
            .eq("registry_id", registry_id)
            .order("created_at", desc=True)
            .execute()
        )
        channels = response.data or []
        # Add subject_count per channel
        for ch in channels:
            count_resp = (
                self.client.table("channel_subjects")
                .select("id", count="exact")
                .eq("channel_id", ch["id"])
                .execute()
            )
            ch["subject_count"] = count_resp.count if count_resp.count is not None else 0
        return channels
 
    def get_channel_by_id(self, channel_id: str) -> dict | None:
        """Fetch a single channel by ID."""
        response = (
            self.client.table("channels")
            .select("*")
            .eq("id", channel_id)
            .execute()
        )
        data = response.data
        if not data:
            return None
        return data[0]
 
    def create_channel(self, channel_data: dict) -> dict | None:
        """Insert a new channel."""
        response = (
            self.client.table("channels")
            .insert(channel_data)
            .execute()
        )
        if not response.data:
            logger.error("Failed to create channel: no data returned")
            return None
        return response.data[0]
 
    def update_channel(self, channel_id: str, updates: dict) -> dict | None:
        """Update a channel. Returns updated row or None."""
        allowed = {
            "name", "address", "broker_type", "resource_kind",
            "messaging_pattern", "data_layer", "description",
            "owner", "tags", "broker_config",
        }
        filtered = {k: v for k, v in updates.items() if k in allowed}
        if not filtered:
            return self.get_channel_by_id(channel_id)
 
        response = (
            self.client.table("channels")
            .update(filtered)
            .eq("id", channel_id)
            .execute()
        )
        if not response.data:
            logger.warning(f"update_channel: no row affected for {channel_id}")
            return None
        return response.data[0]
 
    def delete_channel(self, channel_id: str) -> bool:
        """Delete a channel (cascades to channel_subjects)."""
        response = (
            self.client.table("channels")
            .delete()
            .eq("id", channel_id)
            .execute()
        )
        return bool(response.data)
 
    # ================================================================
    # CHANNEL-SUBJECT BINDINGS
    # ================================================================
 
    def get_bindings_for_channel(self, channel_id: str) -> list[dict]:
        """List all subject bindings for a channel."""
        response = (
            self.client.table("channel_subjects")
            .select("*")
            .eq("channel_id", channel_id)
            .order("subject_name")
            .execute()
        )
        return response.data or []
 
    def get_channels_for_subject(self, registry_id: str, subject_name: str) -> list[dict]:
        """List all channels bound to a subject (reverse lookup via join)."""
        # Supabase supports foreign key joins with select syntax
        response = (
            self.client.table("channel_subjects")
            .select("*, channels!inner(*)")
            .eq("channels.registry_id", registry_id)
            .eq("subject_name", subject_name)
            .execute()
        )
        if not response.data:
            return []
 
        # Flatten: merge channel data into each binding row
        results = []
        for row in response.data:
            channel = row.pop("channels", {})
            merged = {**channel, **row, "binding_id": row["id"]}
            results.append(merged)
        return results
 
    def create_binding(self, binding_data: dict) -> dict | None:
        """Create a channel-subject binding."""
        response = (
            self.client.table("channel_subjects")
            .insert(binding_data)
            .execute()
        )
        if not response.data:
            logger.error("Failed to create binding: no data returned")
            return None
        return response.data[0]
 
    def delete_binding(self, binding_id: str) -> bool:
        """Delete a channel-subject binding."""
        response = (
            self.client.table("channel_subjects")
            .delete()
            .eq("id", binding_id)
            .execute()
        )
        return bool(response.data)
 
    def update_binding_status(
        self, binding_id: str, status: str, verified_at: str | None = None
    ) -> dict | None:
        """Update binding_status and last_verified_at."""
        update_data: dict = {"binding_status": status}
        if verified_at:
            update_data["last_verified_at"] = verified_at
 
        response = (
            self.client.table("channel_subjects")
            .update(update_data)
            .eq("id", binding_id)
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]

    # ================================================================
    # CATALOG HELPERS
    # ================================================================

    def get_subject_channel_map(self, registry_id: str) -> dict[str, list[str]]:
        """Return {subject_name: [broker_types]} for bound subjects."""
        try:
            # Fetch all bindings for this registry's channels
            channels_resp = (
                self._client.table("channels")
                .select("id, broker_type")
                .eq("registry_id", registry_id)
                .execute()
            )
            if not channels_resp.data:
                return {}

            channel_map = {
                ch["id"]: ch["broker_type"] for ch in channels_resp.data
            }
            channel_ids = list(channel_map.keys())

            bindings_resp = (
                self._client.table("channel_subjects")
                .select("channel_id, subject_name")
                .in_("channel_id", channel_ids)
                .execute()
            )
            if not bindings_resp.data:
                return {}

            # Aggregate: subject_name → set of broker_types
            result: dict[str, set[str]] = {}
            for b in bindings_resp.data:
                subject = b["subject_name"]
                broker = channel_map.get(b["channel_id"], "unknown")
                result.setdefault(subject, set()).add(broker)

            return {k: list(v) for k, v in result.items()}
        except Exception as e:
            logger.warning(f"get_subject_channel_map failed: {e}")
            return {}  

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