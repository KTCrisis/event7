"""
Abstract base for Schema Registry providers.

Placement: backend/app/providers/base.py
Modification: ajout de close() — P0-LIFECYCLE

Ce fichier remplace l'existant. Le seul ajout est la méthode close().
"""

from abc import ABC, abstractmethod

from app.models.schema import (
    SchemaDetail,
    SchemaDiff,
    SchemaReference,
    SchemaVersion,
    SubjectInfo,
)
from app.models.governance import CompatibilityMode


class SchemaRegistryProvider(ABC):
    """Contract that every schema registry provider must implement."""

    # --- P0-LIFECYCLE: resource cleanup ---

    async def close(self) -> None:
        """Close underlying HTTP clients and release resources.

        Default implementation does nothing.
        Providers with HTTP clients (httpx, aiohttp) MUST override this.
        Called automatically by the dependency injection (yield pattern).
        """
        pass

    # --- Health ---

    @abstractmethod
    async def health_check(self) -> bool: ...

    # --- Subjects / Schemas ---

    @abstractmethod
    async def list_subjects(self) -> list[SubjectInfo]: ...

    @abstractmethod
    async def get_schema(self, subject: str, version: int | str = "latest") -> SchemaDetail: ...

    @abstractmethod
    async def create_schema(self, subject: str, schema: dict) -> SchemaDetail: ...

    @abstractmethod
    async def delete_subject(self, subject: str, permanent: bool = False) -> bool: ...

    # --- Versions ---

    @abstractmethod
    async def get_versions(self, subject: str) -> list[SchemaVersion]: ...

    # --- Diff ---

    @abstractmethod
    async def diff_versions(self, subject: str, v1: int, v2: int) -> SchemaDiff: ...

    # --- References ---

    @abstractmethod
    async def get_references(self, subject: str) -> list[SchemaReference]: ...

    @abstractmethod
    async def get_dependents(self, subject: str) -> list[SchemaReference]: ...

    # --- Compatibility ---

    @abstractmethod
    async def get_compatibility(self, subject: str) -> CompatibilityMode: ...

    @abstractmethod
    async def check_compatibility(
        self, subject: str, schema: dict, schema_type: str = "AVRO"
    ) -> dict: ...