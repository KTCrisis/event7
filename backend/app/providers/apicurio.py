"""
Apicurio Registry v3 Provider.

Placement: backend/app/providers/apicurio.py

Implements SchemaRegistryProvider using Apicurio Registry v3 REST API.
All artifacts live under the 'default' group.
Uses /api/ccompat/v7 for compatibility checks (Confluent-compatible endpoint).
"""

import json
import time
from typing import Any

import httpx
from loguru import logger

from app.models.schema import (
    SchemaDetail,
    SchemaDiff,
    SchemaReference,
    SchemaVersion,
    SubjectInfo,
    SchemaFormat,
)
from app.models.governance import CompatibilityMode
from app.providers.base import SchemaRegistryProvider
from app.services.diff_service import compute_schema_diff


# ── Constants ──

BASE_PATH = "/apis/registry/v3"
GROUP_ID = "default"
CCOMPAT_PATH = "/api/ccompat/v7"


class ApicurioError(Exception):
    """Raised when an Apicurio API call fails."""

    def __init__(self, status_code: int, message: str, detail: str = ""):
        self.status_code = status_code
        self.message = message
        self.detail = detail
        super().__init__(f"Apicurio {status_code}: {message}")


class ApicurioProvider(SchemaRegistryProvider):
    """
    Adapter for Apicurio Registry v3 REST API.

    Mapping:
        event7 subject  →  Apicurio artifactId (under group 'default')
        event7 version  →  Apicurio version expression (integer or 'latest')

    Auth modes:
        - No auth (local / hosted mode)
        - Basic auth (username + password)
        - Bearer token
    """

    def __init__(
        self,
        base_url: str,
        username: str | None = None,
        password: str | None = None,
        token: str | None = None,
    ):
        self.base_url = base_url.rstrip("/")

        # Build auth
        auth = None
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        elif username and password:
            auth = httpx.BasicAuth(username, password)

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            auth=auth,
            headers={**headers, "Accept": "application/json"},
            timeout=30.0,
        )

    async def close(self) -> None:
        await self.client.aclose()

    # ── Internal helpers ──

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        """Execute HTTP request and handle errors."""
        resp = await self.client.request(method, path, **kwargs)

        if resp.status_code == 404:
            raise ApicurioError(404, "Not found", path)
        if resp.status_code >= 400:
            detail = ""
            try:
                body = resp.json()
                detail = body.get("detail", body.get("message", ""))
            except Exception:
                detail = resp.text[:200]
            raise ApicurioError(resp.status_code, f"API error: {detail}", path)

        if resp.status_code == 204:
            return None

        # Some endpoints return raw content (not JSON)
        content_type = resp.headers.get("content-type", "")
        if "application/json" in content_type:
            return resp.json()
        return resp.text

    async def _get(self, path: str, **kwargs) -> Any:
        return await self._request("GET", path, **kwargs)

    async def _post(self, path: str, **kwargs) -> Any:
        return await self._request("POST", path, **kwargs)

    async def _delete(self, path: str, **kwargs) -> Any:
        return await self._request("DELETE", path, **kwargs)

    def _artifact_path(self, artifact_id: str) -> str:
        """Build path to an artifact under the default group."""
        return f"{BASE_PATH}/groups/{GROUP_ID}/artifacts/{artifact_id}"

    def _version_path(self, artifact_id: str, version: int | str) -> str:
        """Build path to a specific version."""
        return f"{self._artifact_path(artifact_id)}/versions/{version}"

    @staticmethod
    def _parse_format(artifact_type: str | None) -> SchemaFormat:
        mapping = {
            "AVRO": SchemaFormat.AVRO,
            "JSON": SchemaFormat.JSON_SCHEMA,
            "JSONSCHEMA": SchemaFormat.JSON_SCHEMA,
            "PROTOBUF": SchemaFormat.PROTOBUF,
            "OPENAPI": SchemaFormat.JSON_SCHEMA,
            "ASYNCAPI": SchemaFormat.JSON_SCHEMA,
        }
        if not artifact_type:
            return SchemaFormat.AVRO
        return mapping.get(artifact_type.upper(), SchemaFormat.AVRO)
        if not artifact_type:
            return SchemaFormat.AVRO
        return mapping.get(artifact_type.upper(), SchemaFormat.AVRO)

    @staticmethod
    def _parse_schema_content(raw: str | dict) -> dict:
        """Ensure schema content is a dict."""
        if isinstance(raw, dict):
            return raw
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {"raw": raw}

    # ══════════════════════════════════════════════════════════════
    # SchemaRegistryProvider implementation
    # ══════════════════════════════════════════════════════════════

    # ── Health ──

    async def health_check(self) -> bool:
        try:
            result = await self._get(f"{BASE_PATH}/system/info")
            return result is not None
        except Exception as e:
            logger.warning(f"Apicurio health check failed: {e}")
            return False

    # ── Subjects / Schemas ──

    async def list_subjects(self) -> list[SubjectInfo]:
        """List all artifacts in the default group as subjects."""
        results = await self._get(
            f"{BASE_PATH}/search/artifacts",
            params={"groupId": GROUP_ID, "limit": 500, "order": "asc", "orderby": "name"},
        )

        artifacts = results.get("artifacts", [])
        subjects = []

        for art in artifacts:
            artifact_id = art.get("artifactId", "")
            artifact_type = art.get("artifactType", "AVRO")

            # Get version count
            version_count = 1
            try:
                versions_resp = await self._get(
                    f"{self._artifact_path(artifact_id)}/versions",
                    params={"limit": 1},
                )
                version_count = versions_resp.get("count", 1)
            except Exception:
                pass

            subjects.append(SubjectInfo(
                subject=artifact_id,
                format=self._parse_format(artifact_type),
                version_count=version_count,
                last_modified=art.get("modifiedOn"),
            ))

        return subjects

    async def get_schema(
        self, subject: str, version: int | str = "latest"
    ) -> SchemaDetail:
        """Fetch a specific version of an artifact."""
        # Get version metadata
        v_expr = "branch=latest" if version == "latest" else str(version)
        meta_path = self._version_path(subject, v_expr)
        meta = await self._get(meta_path)

        # Get content
        content_raw = await self._get(f"{meta_path}/content")
        content = self._parse_schema_content(content_raw)

        # Get references for this version
        refs = []
        try:
            refs_raw = await self._get(f"{meta_path}/references")
            refs = [
                SchemaReference(
                    name=r.get("name", ""),
                    subject=r.get("artifactId", ""),
                    version=int(r.get("version", 1)),
                )
                for r in (refs_raw or [])
            ]
        except Exception:
            pass

        return SchemaDetail(
            subject=subject,
            version=int(meta.get("version", meta.get("versionOrder", 1))),
            schema_id=meta.get("globalId", 0),
            format=self._parse_format(meta.get("artifactType")),
            schema_content=content,
            references=refs,
        )

    async def create_schema(self, subject: str, schema: dict) -> SchemaDetail:
        """Create an artifact (or new version) in the default group."""
        schema_str = json.dumps(schema) if isinstance(schema, dict) else schema

        # Detect format
        artifact_type = "AVRO"
        if isinstance(schema, dict):
            if "$schema" in schema or "properties" in schema:
                artifact_type = "JSON"
            elif "syntax" in schema:
                artifact_type = "PROTOBUF"

        # Try creating artifact with first version
        payload = {
            "artifactId": subject,
            "artifactType": artifact_type,
            "firstVersion": {
                "version": "1",
                "content": {
                    "content": schema_str,
                    "contentType": "application/json",
                },
            },
        }

        try:
            result = await self._post(
                f"{BASE_PATH}/groups/{GROUP_ID}/artifacts",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        except ApicurioError as e:
            if e.status_code == 409:
                # Artifact exists — create new version
                result = await self._post(
                    f"{self._artifact_path(subject)}/versions",
                    json={
                        "content": {
                            "content": schema_str,
                            "contentType": "application/json",
                        }
                    },
                    headers={"Content-Type": "application/json"},
                )
            else:
                raise

        return await self.get_schema(subject, "latest")

    async def delete_subject(self, subject: str) -> bool:
        try:
            await self._delete(self._artifact_path(subject))
            return True
        except ApicurioError as e:
            if e.status_code == 404:
                return False
            raise

    # ── Versions ──

    async def get_versions(self, subject: str) -> list[SchemaVersion]:
        result = await self._get(
            f"{self._artifact_path(subject)}/versions",
            params={"limit": 500},
        )

        versions = []
        for v in result.get("versions", []):
            versions.append(SchemaVersion(
                subject=subject,
                version=int(v.get("version", v.get("versionOrder", 1))),
                schema_id=v.get("globalId", 0),
                created_at=v.get("createdOn"),
            ))

        return sorted(versions, key=lambda v: v.version)


    async def get_subject_versions(self, subject: str) -> list[int]:
        """Return just version numbers (used by SchemaService.get_versions)."""
        result = await self._get(
            f"{self._artifact_path(subject)}/versions",
            params={"limit": 500},
        )
        return sorted([
            int(v.get("version", v.get("versionOrder", 1)))
            for v in result.get("versions", [])
        ])

    # ── Diff ──

    async def diff_versions(self, subject: str, v1: int, v2: int) -> SchemaDiff:
        schema1 = await self.get_schema(subject, v1)
        schema2 = await self.get_schema(subject, v2)
        return compute_schema_diff(
            subject=subject,
            version_from=v1,
            version_to=v2,
            schema_from=schema1.schema_content,
            schema_to=schema2.schema_content,
            schema_format=schema1.format,
        )
    # ── References ──

    async def get_references(self, subject: str) -> list[SchemaReference]:
        """Get outgoing references from latest version."""
        try:
            meta_path = self._version_path(subject, "branch=latest")
            refs_raw = await self._get(f"{meta_path}/references")
            return [
                SchemaReference(
                    name=r.get("name", ""),
                    subject=r.get("artifactId", ""),
                    version=int(r.get("version", 1)),
                )
                for r in (refs_raw or [])
            ]
        except ApicurioError as e:
            if e.status_code == 404:
                return []
            raise

    async def get_dependents(self, subject: str) -> list[SchemaReference]:
        """
        Find artifacts that reference this subject.
        Apicurio v3 doesn't have a direct 'dependents' endpoint,
        so we search all artifacts and check their references.
        This is expensive — results should be cached.
        """
        dependents = []
        try:
            all_subjects = await self.list_subjects()
            for s in all_subjects:
                if s.subject == subject:
                    continue
                try:
                    refs = await self.get_references(s.subject)
                    for r in refs:
                        if r.subject == subject:
                            dependents.append(SchemaReference(
                                name=s.subject,
                                subject=s.subject,
                                version=r.version,
                            ))
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Error computing dependents for {subject}: {e}")

        return dependents

    # ── Compatibility ──

    async def get_compatibility(self, subject: str) -> CompatibilityMode:
        """Get compatibility rule for an artifact."""
        try:
            rule = await self._get(
                f"{self._artifact_path(subject)}/rules/COMPATIBILITY"
            )
            config = rule.get("config", "BACKWARD")
            return CompatibilityMode(config)
        except ApicurioError as e:
            if e.status_code == 404:
                # No artifact-level rule, try group-level
                try:
                    rule = await self._get(
                        f"{BASE_PATH}/groups/{GROUP_ID}/rules/COMPATIBILITY"
                    )
                    config = rule.get("config", "BACKWARD")
                    return CompatibilityMode(config)
                except ApicurioError:
                    # No group-level rule, try global
                    try:
                        rule = await self._get(f"{BASE_PATH}/admin/rules/COMPATIBILITY")
                        config = rule.get("config", "BACKWARD")
                        return CompatibilityMode(config)
                    except ApicurioError:
                        return CompatibilityMode("NONE")
            raise

    async def check_compatibility(self, subject: str, schema: dict) -> dict:
        """
        Check compatibility using the Confluent-compatible endpoint.
        Apicurio exposes /api/ccompat/v7 for this.
        """
        schema_str = json.dumps(schema) if isinstance(schema, dict) else schema
        try:
            result = await self._post(
                f"{CCOMPAT_PATH}/compatibility/subjects/{subject}/versions/latest",
                json={"schema": schema_str, "schemaType": "AVRO"},
            )
            return {
                "is_compatible": result.get("is_compatible", False),
                "messages": result.get("messages", []),
            }
        except ApicurioError as e:
            if e.status_code == 404:
                # No existing schema to compare against — compatible by default
                return {"is_compatible": True, "messages": []}
            return {
                "is_compatible": False,
                "messages": [str(e)],
            }