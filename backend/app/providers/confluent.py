"""
event7 - Confluent Cloud Provider
Implémentation de SchemaRegistryProvider pour Confluent Schema Registry REST API.
"""

import time

import httpx
from loguru import logger

from app.models.schema import (
    SubjectInfo,
    SchemaDetail,
    SchemaVersion,
    SchemaDiff,
    SchemaReference,
    SchemaFormat,
)
from app.models.governance import CompatibilityResult, CompatibilityMode
from app.providers.base import SchemaRegistryProvider
from app.services.diff_service import compute_schema_diff


class ConfluentProvider(SchemaRegistryProvider):
    """
    Adapter pour Confluent Schema Registry (Cloud ou self-managed).
    Utilise l'API REST v1 : https://docs.confluent.io/platform/current/schema-registry/develop/api.html
    """

    def __init__(self, base_url: str, api_key: str | None = None, api_secret: str | None = None):
        self.base_url = base_url.rstrip("/")
        self._auth = (api_key, api_secret) if api_key and api_secret else None
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                auth=self._auth,
                headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
                timeout=30.0,
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs) -> dict | list:
        """Requête HTTP avec gestion d'erreur unifiée"""
        client = await self._get_client()
        try:
            response = await client.request(method, path, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            try:
                error_body = e.response.json() if e.response.content else {}
            except (ValueError, UnicodeDecodeError):
                error_body = {}
            error_code = error_body.get("error_code", e.response.status_code)
            error_msg = error_body.get("message", str(e))
            logger.error(f"Confluent API error [{error_code}]: {error_msg}")
            raise ConfluentAPIError(error_code, error_msg) from e
        except httpx.RequestError as e:
            logger.error(f"Confluent connection error: {e}")
            raise ConfluentAPIError(0, f"Connection failed: {e}") from e

    # === Health ===

    async def health_check(self) -> bool:
        try:
            start = time.monotonic()
            await self._request("GET", "/subjects")
            elapsed = (time.monotonic() - start) * 1000
            logger.debug(f"Confluent health OK ({elapsed:.0f}ms)")
            return True
        except Exception:
            return False

    # === Subjects ===

    async def list_subjects(self) -> list[SubjectInfo]:
        subjects = await self._request("GET", "/subjects")
        result = []
        for subject_name in subjects:
            try:
                # Fetch latest version metadata
                latest = await self._request("GET", f"/subjects/{subject_name}/versions/latest")
                versions = await self._request("GET", f"/subjects/{subject_name}/versions")
                result.append(SubjectInfo(
                    subject=subject_name,
                    format=self._parse_format(latest.get("schemaType", "AVRO")),
                    latest_version=latest.get("version", 1),
                    version_count=len(versions),
                    schema_id=latest.get("id"),
                ))
            except ConfluentAPIError:
                # Subject peut avoir été supprimé entre le list et le get
                result.append(SubjectInfo(subject=subject_name))
        return result

    async def get_subject_versions(self, subject: str) -> list[int]:
        return await self._request("GET", f"/subjects/{subject}/versions")

    # === Schemas ===

    async def get_schema(self, subject: str, version: int | str = "latest") -> SchemaDetail:
        data = await self._request("GET", f"/subjects/{subject}/versions/{version}")
        references = [
            SchemaReference(name=ref["name"], subject=ref["subject"], version=ref["version"])
            for ref in data.get("references", [])
        ]
        return SchemaDetail(
            subject=data["subject"],
            version=data["version"],
            schema_id=data["id"],
            format=self._parse_format(data.get("schemaType", "AVRO")),
            schema_content=self._parse_schema_content(data["schema"]),
            references=references,
            rule_set=data.get("ruleSet"),
            metadata=data.get("metadata"),
        )

    async def create_schema(
        self, subject: str, schema: dict, schema_type: str = "AVRO"
    ) -> SchemaDetail:
        import json

        payload = {
            "schema": json.dumps(schema) if isinstance(schema, dict) else schema,
            "schemaType": schema_type,
        }
        result = await self._request("POST", f"/subjects/{subject}/versions", json=payload)
        # L'API retourne juste {id: ...}, on re-fetch le détail complet
        return await self.get_schema(subject, "latest")

    async def delete_subject(self, subject: str, permanent: bool = False) -> bool:
        try:
            # Soft delete
            await self._request("DELETE", f"/subjects/{subject}")
            if permanent:
                # Hard delete (permanent=true)
                await self._request(
                    "DELETE", f"/subjects/{subject}", params={"permanent": "true"}
                )
            return True
        except ConfluentAPIError:
            return False

    # === Versions & Diff ===

    async def get_versions(self, subject: str) -> list[SchemaVersion]:
        version_numbers = await self._request("GET", f"/subjects/{subject}/versions")
        versions = []
        for v in version_numbers:
            data = await self._request("GET", f"/subjects/{subject}/versions/{v}")
            versions.append(SchemaVersion(
                version=data["version"],
                schema_id=data["id"],
                format=self._parse_format(data.get("schemaType", "AVRO")),
                schema_content=self._parse_schema_content(data["schema"]),
            ))
        return versions

    async def diff_versions(
        self, subject: str, version_from: int, version_to: int
    ) -> SchemaDiff:
        schema_from = await self.get_schema(subject, version_from)
        schema_to = await self.get_schema(subject, version_to)
        return compute_schema_diff(
            subject=subject,
            version_from=version_from,
            version_to=version_to,
            schema_from=schema_from.schema_content,
            schema_to=schema_to.schema_content,
            schema_format=schema_from.format,
        )

    # === References ===

    async def get_references(self, subject: str) -> list[SchemaReference]:
        """Références sortantes : ce schema référence quoi"""
        schema = await self.get_schema(subject, "latest")
        return schema.references

    async def get_dependents(self, subject: str) -> list[SchemaReference]:
        """Références entrantes : qui référence ce schema (impact analysis)"""
        try:
            # Confluent API: GET /subjects/{subject}/versions/{version}/referencedby
            latest = await self.get_schema(subject, "latest")
            referenced_by = await self._request(
                "GET", f"/subjects/{subject}/versions/{latest.version}/referencedby"
            )
            # L'API retourne une liste de schema IDs, on résout les subjects
            dependents = []
            for schema_id in referenced_by:
                try:
                    schema_data = await self._request("GET", f"/schemas/ids/{schema_id}")
                    # On a besoin du subject, fetch via les subjects qui utilisent ce schema
                    subjects = await self._request(
                        "GET", f"/schemas/ids/{schema_id}/subjects"
                    )
                    for dep_subject in subjects:
                        dependents.append(SchemaReference(
                            name=dep_subject,
                            subject=dep_subject,
                            version=0,  # version non dispo via cet endpoint
                        ))
                except ConfluentAPIError:
                    continue
            return dependents
        except ConfluentAPIError:
            return []

    # === Compatibility ===

    async def get_compatibility(self, subject: str) -> CompatibilityMode:
        try:
            result = await self._request("GET", f"/config/{subject}")
            level = result.get("compatibilityLevel", "BACKWARD")
            return CompatibilityMode(level)
        except ConfluentAPIError as e:
            if e.error_code in (40401, 40408): # Subject not found, use global
                result = await self._request("GET", "/config")
                level = result.get("compatibilityLevel", "BACKWARD")
                return CompatibilityMode(level)
            raise

    async def check_compatibility(
        self, subject: str, schema: dict, schema_type: str = "AVRO"
    ) -> CompatibilityResult:
        import json

        payload = {
            "schema": json.dumps(schema) if isinstance(schema, dict) else schema,
            "schemaType": schema_type,
        }
        try:
            result = await self._request(
                "POST",
                f"/compatibility/subjects/{subject}/versions/latest",
                json=payload,
            )
            return CompatibilityResult(
                is_compatible=result.get("is_compatible", False),
                messages=result.get("messages", []),
            )
        except ConfluentAPIError as e:
            return CompatibilityResult(
                is_compatible=False,
                messages=[str(e)],
            )

    # === Helpers ===

    @staticmethod
    def _parse_format(schema_type: str) -> SchemaFormat:
        mapping = {
            "AVRO": SchemaFormat.AVRO,
            "JSON": SchemaFormat.JSON_SCHEMA,
            "PROTOBUF": SchemaFormat.PROTOBUF,
        }
        return mapping.get(schema_type, SchemaFormat.AVRO)

    @staticmethod
    def _parse_schema_content(schema_str: str) -> dict:
        """Parse le schema string retourné par l'API en dict"""
        import json

        if isinstance(schema_str, dict):
            return schema_str
        try:
            return json.loads(schema_str)
        except (json.JSONDecodeError, TypeError):
            return {"raw": schema_str}


class ConfluentAPIError(Exception):
    """Erreur spécifique à l'API Confluent"""

    def __init__(self, error_code: int, message: str):
        self.error_code = error_code
        self.message = message
        super().__init__(f"[{error_code}] {message}")
