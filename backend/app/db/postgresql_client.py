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
                                        owner_team, tags, classification)
               VALUES (%s::uuid, %s, %s, %s, %s::jsonb, %s)
               ON CONFLICT (registry_id, subject)
               DO UPDATE SET
                   description = EXCLUDED.description,
                   owner_team = EXCLUDED.owner_team,
                   tags = EXCLUDED.tags,
                   classification = EXCLUDED.classification,
                   updated_at = now()
               RETURNING *""",
            (
                enrichment_data["registry_id"],
                enrichment_data["subject"],
                enrichment_data.get("description"),
                enrichment_data.get("owner_team"),
                json.dumps(enrichment_data.get("tags", [])),
                enrichment_data.get("classification", "internal"),
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
    ) -> dict | None:
        """Create or update an AsyncAPI spec."""
        import json
        try:
            with self._conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO asyncapi_specs (registry_id, subject, spec_content, is_auto_generated)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (registry_id, subject)
                    DO UPDATE SET spec_content = EXCLUDED.spec_content,
                                is_auto_generated = EXCLUDED.is_auto_generated,
                                updated_at = NOW()
                    RETURNING *
                """, (registry_id, subject, json.dumps(spec_content), is_auto_generated))
                self._conn.commit()
                row = cur.fetchone()
                if not row:
                    return None
                cols = [desc[0] for desc in cur.description]
                result = dict(zip(cols, row))
                # Parse spec_content back if it's a string
                if isinstance(result.get("spec_content"), str):
                    result["spec_content"] = json.loads(result["spec_content"])
                self.log_audit(
                    user_id=user_id,
                    registry_id=registry_id,
                    action="asyncapi_generate" if is_auto_generated else "asyncapi_update",
                    details={"subject": subject},
                )
                return result
        except Exception as e:
            logger.error(f"Failed to upsert AsyncAPI spec: {e}")
            self._conn.rollback()
            return None
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