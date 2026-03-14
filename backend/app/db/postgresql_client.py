"""
PostgreSQL database provider (psycopg2).

Placement: backend/app/db/postgresql_client.py

Direct PostgreSQL implementation of DatabaseProvider for GKE / on-prem.
Uses psycopg2 (sync driver) — matches the sync interface of SupabaseClient.
Same SQL schema as Supabase (bootstrap.sql).

Dependencies: pip install psycopg2-binary
"""

import json
from datetime import datetime
from typing import Any
from uuid import uuid4

import psycopg2
import psycopg2.extras
from loguru import logger

from app.db.base import DatabaseProvider


class PostgreSQLDatabase(DatabaseProvider):
    """PostgreSQL implementation of DatabaseProvider using psycopg2."""

    def __init__(self, dsn: str):
        self._dsn = dsn
        self._conn = None

    # ================================================================
    # LIFECYCLE
    # ================================================================

    async def connect(self) -> None:
        """Open PostgreSQL connection."""
        self._conn = psycopg2.connect(self._dsn)
        self._conn.autocommit = True
        logger.info("PostgreSQL connected (psycopg2)")

    async def disconnect(self) -> None:
        """Close connection."""
        if self._conn and not self._conn.closed:
            self._conn.close()
            logger.info("PostgreSQL connection closed")

    def ping(self) -> bool:
        """Check connectivity."""
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT 1")
                return True
        except Exception:
            return False

    # ================================================================
    # HELPERS
    # ================================================================

    def _fetchone(self, query: str, params: tuple = ()) -> dict | None:
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            row = cur.fetchone()
            return self._clean(dict(row)) if row else None

    def _fetchall(self, query: str, params: tuple = ()) -> list[dict]:
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            return [self._clean(dict(r)) for r in cur.fetchall()]

    def _execute(self, query: str, params: tuple = ()) -> int:
        """Execute and return rowcount."""
        with self._conn.cursor() as cur:
            cur.execute(query, params)
            return cur.rowcount

    @staticmethod
    def _clean(d: dict) -> dict:
        """Make dict JSON-safe (datetime → isoformat)."""
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        return d

    # ================================================================
    # REGISTRIES
    # ================================================================

    def get_registries(self, user_id: str) -> list[dict]:
        return self._fetchall(
            """SELECT * FROM registries
               WHERE user_id = %s AND is_active = true
               ORDER BY created_at DESC""",
            (user_id,),
        )

    def get_registry_by_id(self, registry_id: str, user_id: str) -> dict | None:
        return self._fetchone(
            "SELECT * FROM registries WHERE id = %s::uuid AND user_id = %s",
            (registry_id, user_id),
        )

    def create_registry(self, registry_data: dict) -> dict | None:
        return self._fetchone(
            """INSERT INTO registries (id, user_id, name, provider_type, base_url,
                                       credentials_encrypted, environment, is_active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING *""",
            (
                str(uuid4()),
                registry_data["user_id"],
                registry_data["name"],
                registry_data["provider_type"],
                registry_data["base_url"],
                registry_data.get("credentials_encrypted"),
                registry_data.get("environment", "DEV"),
                registry_data.get("is_active", True),
            ),
        )

    def delete_registry(self, registry_id: str, user_id: str) -> bool:
        affected = self._execute(
            """UPDATE registries SET is_active = false, updated_at = now()
               WHERE id = %s::uuid AND user_id = %s AND is_active = true""",
            (registry_id, user_id),
        )
        if affected == 0:
            logger.warning(f"delete_registry: no row affected for {registry_id}")
        return affected > 0

    # ================================================================
    # ENRICHMENTS
    # ================================================================

    def get_enrichment(self, registry_id: str, subject: str) -> dict | None:
        return self._fetchone(
            "SELECT * FROM enrichments WHERE registry_id = %s::uuid AND subject = %s",
            (registry_id, subject),
        )

    def get_enrichments_for_registry(self, registry_id: str) -> list[dict]:
        return self._fetchall(
            "SELECT * FROM enrichments WHERE registry_id = %s::uuid",
            (registry_id,),
        )

    def upsert_enrichment(self, enrichment_data: dict) -> dict | None:
        return self._fetchone(
            """INSERT INTO enrichments (registry_id, subject, description,
                                        owner_team, tags, classification, data_layer)
               VALUES (%s::uuid, %s, %s, %s, %s::jsonb, %s, %s)
               ON CONFLICT (registry_id, subject)
               DO UPDATE SET
                   description = EXCLUDED.description,
                   owner_team = EXCLUDED.owner_team,
                   tags = EXCLUDED.tags,
                   classification = EXCLUDED.classification,
                   data_layer = EXCLUDED.data_layer,
                   updated_at = now()
               RETURNING *""",
            (
                enrichment_data["registry_id"],
                enrichment_data["subject"],
                enrichment_data.get("description"),
                enrichment_data.get("owner_team"),
                json.dumps(enrichment_data.get("tags", [])),
                enrichment_data.get("classification", "internal"),
                enrichment_data.get("data_layer"),
            ),
        )

    # ================================================================
    # ASYNCAPI SPECS
    # ================================================================

    def get_asyncapi_spec(self, registry_id: str, subject: str) -> dict | None:
        return self._fetchone(
            "SELECT * FROM asyncapi_specs WHERE registry_id = %s::uuid AND subject = %s",
            (registry_id, subject),
        )

    def delete_asyncapi_spec(self, registry_id: str, subject: str, user_id: str) -> bool:
        affected = self._execute(
            "DELETE FROM asyncapi_specs WHERE registry_id = %s::uuid AND subject = %s",
            (registry_id, subject),
        )
        if affected > 0:
            self.log_audit(
                user_id=user_id,
                registry_id=registry_id,
                action="asyncapi_delete",
                details={"subject": subject},
            )
        return affected > 0
        
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
        result = self._fetchone(
            """INSERT INTO asyncapi_specs (
                   registry_id, subject, spec_content, is_auto_generated,
                   spec_version, source_schema_hash, source_schema_version
               ) VALUES (%s::uuid, %s, %s::jsonb, %s, 1, %s, %s)
               ON CONFLICT (registry_id, subject)
               DO UPDATE SET
                   spec_content = EXCLUDED.spec_content,
                   is_auto_generated = EXCLUDED.is_auto_generated,
                   spec_version = asyncapi_specs.spec_version + 1,
                   source_schema_hash = EXCLUDED.source_schema_hash,
                   source_schema_version = EXCLUDED.source_schema_version,
                   updated_at = NOW()
               RETURNING *""",
            (registry_id, subject, json.dumps(spec_content), is_auto_generated,
             source_schema_hash, source_schema_version),
        )
        if result and user_id:
            self.log_audit(
                user_id=user_id,
                registry_id=registry_id,
                action="asyncapi_upsert",
                details={"subject": subject, "is_auto_generated": is_auto_generated},
            )
        return result
 
 
    def get_asyncapi_specs_for_registry(self, registry_id: str) -> list[dict]:
        return self._fetchall(
            """SELECT subject, spec_content, is_auto_generated,
                      source_schema_hash, source_schema_version,
                      spec_version, updated_at
               FROM asyncapi_specs
               WHERE registry_id = %s::uuid
               ORDER BY subject""",
            (registry_id,),
        )
        
    def get_bound_subjects_for_registry(self, registry_id: str) -> set[str]:
        rows = self._fetchall(
            """SELECT DISTINCT cs.subject_name
               FROM channel_subjects cs
               JOIN channels c ON c.id = cs.channel_id
               WHERE c.registry_id = %s::uuid""",
            (registry_id,),
        )
        return {r["subject_name"] for r in rows}
             
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
        try:
            self._execute(
                """INSERT INTO audit_logs (user_id, registry_id, action, details)
                   VALUES (%s, %s::uuid, %s, %s::jsonb)""",
                (user_id, registry_id, action, json.dumps(details or {})),
            )
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
        """List governance rules with optional filters."""
        conditions = ["registry_id = %s::uuid"]
        params: list = [registry_id]
 
        if subject is not None:
            # Subject-specific + global rules
            conditions.append("(subject = %s OR subject IS NULL)")
            params.append(subject)
 
        if scope:
            conditions.append("rule_scope = %s::rule_scope")
            params.append(scope)
        if kind:
            conditions.append("rule_kind = %s::rule_kind")
            params.append(kind)
        if category:
            conditions.append("rule_category = %s::rule_category")
            params.append(category)
        if severity:
            conditions.append("severity = %s::rule_severity")
            params.append(severity)
        if enforcement_status:
            conditions.append("enforcement_status = %s::enforcement_status")
            params.append(enforcement_status)
        if source:
            conditions.append("source = %s")
            params.append(source)
 
        where = " AND ".join(conditions)
        return self._fetchall(
            f"SELECT * FROM governance_rules WHERE {where} ORDER BY created_at",
            tuple(params),
        )
 
    def get_governance_rule(self, rule_id: str) -> dict | None:
        """Get a single governance rule by ID."""
        return self._fetchone(
            "SELECT * FROM governance_rules WHERE id = %s::uuid",
            (rule_id,),
        )
 
    def create_governance_rule(self, data: dict) -> dict | None:
        """Insert a new governance rule."""
        import json
 
        columns = []
        placeholders = []
        values = []
 
        # Map of column → (placeholder_suffix, needs_json)
        col_config = {
            "registry_id": ("::uuid", False),
            "subject": ("", False),
            "rule_name": ("", False),
            "description": ("", False),
            "rule_scope": ("::rule_scope", False),
            "rule_category": ("::rule_category", False),
            "rule_kind": ("::rule_kind", False),
            "rule_type": ("", False),
            "rule_mode": ("::rule_mode", False),
            "expression": ("", False),
            "params": ("::jsonb", True),
            "tags": ("::jsonb", True),
            "on_success": ("", False),
            "on_failure": ("", False),
            "severity": ("::rule_severity", False),
            "enforcement_status": ("::enforcement_status", False),
            "evaluation_source": ("", False),
            "target_type": ("", False),
            "target_ref": ("", False),
            "provider_rule_ref": ("::jsonb", True),
            "source": ("", False),
            "origin_template_id": ("::uuid", False),
            "applies_to_version": ("", False),
            "created_by": ("::uuid", False),
        }
 
        for col, (suffix, is_json) in col_config.items():
            if col in data and data[col] is not None:
                columns.append(col)
                placeholders.append(f"%s{suffix}")
                values.append(json.dumps(data[col]) if is_json else data[col])
 
        cols_str = ", ".join(columns)
        phs_str = ", ".join(placeholders)
 
        return self._fetchone(
            f"INSERT INTO governance_rules ({cols_str}) VALUES ({phs_str}) RETURNING *",
            tuple(values),
        )
 
    def update_governance_rule(self, rule_id: str, data: dict) -> dict | None:
        """Update a governance rule. data contains only fields to update."""
        import json
 
        set_parts = []
        values = []
 
        col_config = {
            "description": ("", False),
            "rule_scope": ("::rule_scope", False),
            "rule_category": ("::rule_category", False),
            "rule_kind": ("::rule_kind", False),
            "rule_type": ("", False),
            "rule_mode": ("::rule_mode", False),
            "expression": ("", False),
            "params": ("::jsonb", True),
            "tags": ("::jsonb", True),
            "on_success": ("", False),
            "on_failure": ("", False),
            "severity": ("::rule_severity", False),
            "enforcement_status": ("::enforcement_status", False),
            "evaluation_source": ("", False),
            "target_type": ("", False),
            "target_ref": ("", False),
            "provider_rule_ref": ("::jsonb", True),
            "source": ("", False),
            "applies_to_version": ("", False),
        }
 
        for col, (suffix, is_json) in col_config.items():
            if col in data:
                val = data[col]
                set_parts.append(f"{col} = %s{suffix}")
                values.append(json.dumps(val) if (is_json and val is not None) else val)
 
        if not set_parts:
            return self.get_governance_rule(rule_id)
 
        values.append(rule_id)
        set_str = ", ".join(set_parts)
 
        return self._fetchone(
            f"UPDATE governance_rules SET {set_str} WHERE id = %s::uuid RETURNING *",
            tuple(values),
        )
 
    def delete_governance_rule(self, rule_id: str) -> bool:
        """Delete a governance rule."""
        affected = self._execute(
            "DELETE FROM governance_rules WHERE id = %s::uuid",
            (rule_id,),
        )
        return affected > 0
 
    def count_governance_rules(self, registry_id: str, subject: str | None = None) -> dict:
        """Count rules grouped by kind, scope, enforcement."""
        if subject is not None:
            rows = self._fetchall(
                """SELECT rule_kind, rule_scope, enforcement_status, subject
                   FROM governance_rules
                   WHERE registry_id = %s::uuid AND (subject = %s OR subject IS NULL)""",
                (registry_id, subject),
            )
        else:
            rows = self._fetchall(
                """SELECT rule_kind, rule_scope, enforcement_status, subject
                   FROM governance_rules
                   WHERE registry_id = %s::uuid""",
                (registry_id,),
            )
 
        by_kind: dict[str, int] = {}
        by_scope: dict[str, int] = {}
        by_enforcement: dict[str, int] = {}
        global_count = 0
        subject_count = 0
 
        for r in rows:
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
            "total": len(rows),
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
        return self._fetchall(
            "SELECT * FROM governance_rule_templates ORDER BY layer",
        )
 
    def get_governance_template(self, template_id: str) -> dict | None:
        """Get a single template by ID."""
        return self._fetchone(
            "SELECT * FROM governance_rule_templates WHERE id = %s::uuid",
            (template_id,),
        )

    # ================================================================
    # CHANNELS
    # ================================================================
 
    def get_channels(self, registry_id: str) -> list[dict]:
        return self._fetchall(
            """SELECT c.*,
                      (SELECT COUNT(*) FROM channel_subjects cs WHERE cs.channel_id = c.id) AS subject_count
               FROM channels c
               WHERE c.registry_id = %s::uuid
               ORDER BY c.created_at DESC""",
            (registry_id,),
        )
 
    def get_channel_by_id(self, channel_id: str) -> dict | None:
        return self._fetchone(
            "SELECT * FROM channels WHERE id = %s::uuid",
            (channel_id,),
        )
 
    def create_channel(self, channel_data: dict) -> dict | None:
        return self._fetchone(
            """INSERT INTO channels (
                   id, registry_id, name, address,
                   broker_type, resource_kind, messaging_pattern,
                   broker_config, data_layer,
                   description, owner, tags,
                   is_auto_detected, auto_detect_source
               ) VALUES (
                   %s, %s::uuid, %s, %s,
                   %s, %s, %s,
                   %s::jsonb, %s,
                   %s, %s, %s::text[],
                   %s, %s
               )
               RETURNING *""",
            (
                str(uuid4()),
                channel_data["registry_id"],
                channel_data["name"],
                channel_data["address"],
                channel_data["broker_type"],
                channel_data["resource_kind"],
                channel_data["messaging_pattern"],
                json.dumps(channel_data.get("broker_config", {})),
                channel_data.get("data_layer"),
                channel_data.get("description"),
                channel_data.get("owner"),
                channel_data.get("tags", []),
                channel_data.get("is_auto_detected", False),
                channel_data.get("auto_detect_source"),
            ),
        )
 
    def update_channel(self, channel_id: str, updates: dict) -> dict | None:
        # Build SET clause dynamically from non-None updates
        allowed = {
            "name", "address", "broker_type", "resource_kind",
            "messaging_pattern", "data_layer", "description",
            "owner", "tags", "broker_config",
        }
        sets = []
        params = []
        for key, value in updates.items():
            if key not in allowed:
                continue
            if key == "broker_config":
                sets.append(f"{key} = %s::jsonb")
                params.append(json.dumps(value))
            elif key == "tags":
                sets.append(f"{key} = %s::text[]")
                params.append(value)
            else:
                sets.append(f"{key} = %s")
                params.append(value)
 
        if not sets:
            return self.get_channel_by_id(channel_id)
 
        params.append(channel_id)
        return self._fetchone(
            f"""UPDATE channels SET {', '.join(sets)}
                WHERE id = %s::uuid
                RETURNING *""",
            tuple(params),
        )
 
    def delete_channel(self, channel_id: str) -> bool:
        return self._execute(
            "DELETE FROM channels WHERE id = %s::uuid",
            (channel_id,),
        ) > 0
 
    # ================================================================
    # CHANNEL-SUBJECT BINDINGS
    # ================================================================
 
    def get_bindings_for_channel(self, channel_id: str) -> list[dict]:
        return self._fetchall(
            """SELECT * FROM channel_subjects
               WHERE channel_id = %s::uuid
               ORDER BY subject_name""",
            (channel_id,),
        )
 
    def get_channels_for_subject(self, registry_id: str, subject_name: str) -> list[dict]:
        return self._fetchall(
            """SELECT c.*, cs.binding_strategy, cs.schema_role,
                      cs.binding_origin, cs.binding_selector,
                      cs.binding_status, cs.last_verified_at,
                      cs.id AS binding_id
               FROM channel_subjects cs
               JOIN channels c ON c.id = cs.channel_id
               WHERE c.registry_id = %s::uuid
                 AND cs.subject_name = %s
               ORDER BY c.name""",
            (registry_id, subject_name),
        )
 
    def create_binding(self, binding_data: dict) -> dict | None:
        return self._fetchone(
            """INSERT INTO channel_subjects (
                   id, channel_id, subject_name,
                   binding_strategy, schema_role,
                   binding_origin, binding_selector,
                   binding_status, is_auto_detected
               ) VALUES (
                   %s, %s::uuid, %s,
                   %s, %s,
                   %s, %s,
                   %s, %s
               )
               RETURNING *""",
            (
                str(uuid4()),
                binding_data["channel_id"],
                binding_data["subject_name"],
                binding_data["binding_strategy"],
                binding_data.get("schema_role", "value"),
                binding_data.get("binding_origin", "manual"),
                binding_data.get("binding_selector"),
                binding_data.get("binding_status", "unverified"),
                binding_data.get("is_auto_detected", False),
            ),
        )
 
    def delete_binding(self, binding_id: str) -> bool:
        return self._execute(
            "DELETE FROM channel_subjects WHERE id = %s::uuid",
            (binding_id,),
        ) > 0
 
    def update_binding_status(
        self, binding_id: str, status: str, verified_at: str | None = None
    ) -> dict | None:
        if verified_at:
            return self._fetchone(
                """UPDATE channel_subjects
                   SET binding_status = %s, last_verified_at = %s::timestamptz
                   WHERE id = %s::uuid
                   RETURNING *""",
                (status, verified_at, binding_id),
            )
        return self._fetchone(
            """UPDATE channel_subjects
               SET binding_status = %s
               WHERE id = %s::uuid
               RETURNING *""",
            (status, binding_id),
        )

    # ================================================================
    # CATALOG HELPERS
    # ================================================================

    def get_subject_channel_map(self, registry_id: str) -> dict[str, list[str]]:
        """Return {subject_name: [broker_types]} via single JOIN query."""
        rows = self._fetchall(
            """SELECT cs.subject_name,
                      array_agg(DISTINCT c.broker_type) AS broker_types,
                      count(*) AS channel_count
               FROM channel_subjects cs
               JOIN channels c ON cs.channel_id = c.id
               WHERE c.registry_id = %s::uuid
               GROUP BY cs.subject_name""",
            (registry_id,),
        )
        return {
            r["subject_name"]: r["broker_types"]
            for r in rows
        }

        
    # ================================================================
    # SCHEMA SNAPSHOTS
    # ================================================================

    def save_snapshot(self, snapshot_data: dict) -> dict | None:
        return self._fetchone(
            """INSERT INTO schema_snapshots (registry_id, subject, version,
                                              format, schema_content, metadata)
               VALUES (%s::uuid, %s, %s, %s, %s::jsonb, %s::jsonb)
               ON CONFLICT (registry_id, subject, version)
               DO UPDATE SET
                   schema_content = EXCLUDED.schema_content,
                   metadata = EXCLUDED.metadata,
                   captured_at = now()
               RETURNING *""",
            (
                snapshot_data["registry_id"],
                snapshot_data["subject"],
                snapshot_data["version"],
                snapshot_data.get("schema_type", "AVRO"),
                json.dumps(snapshot_data.get("schema_content", {})),
                json.dumps(snapshot_data.get("metadata", {})),
            ),
        )