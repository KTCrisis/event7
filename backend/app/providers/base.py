"""
event7 - Abstract Schema Registry Provider
Interface que chaque provider (Confluent, Apicurio, etc.) doit implémenter.
C'est le cœur de l'abstraction multi-registry.
"""

from abc import ABC, abstractmethod

from app.models.schema import (
    SubjectInfo,
    SchemaDetail,
    SchemaVersion,
    SchemaDiff,
    SchemaReference,
)
from app.models.governance import CompatibilityResult, CompatibilityMode


class SchemaRegistryProvider(ABC):
    """
    Interface abstraite pour tout Schema Registry.
    Chaque provider traduit ces méthodes vers son API spécifique.
    """

    @abstractmethod
    async def health_check(self) -> bool:
        """Vérifie la connectivité au registry"""
        ...

    # === Subjects ===

    @abstractmethod
    async def list_subjects(self) -> list[SubjectInfo]:
        """Liste tous les subjects avec metadata de base"""
        ...

    @abstractmethod
    async def get_subject_versions(self, subject: str) -> list[int]:
        """Liste les numéros de version d'un subject"""
        ...

    # === Schemas ===

    @abstractmethod
    async def get_schema(self, subject: str, version: int | str = "latest") -> SchemaDetail:
        """Récupère le détail d'un schema à une version donnée"""
        ...

    @abstractmethod
    async def create_schema(self, subject: str, schema: dict, schema_type: str = "AVRO") -> SchemaDetail:
        """Enregistre un nouveau schema"""
        ...

    @abstractmethod
    async def delete_subject(self, subject: str, permanent: bool = False) -> bool:
        """Supprime un subject (soft ou hard delete)"""
        ...

    # === Versions & Diff ===

    @abstractmethod
    async def get_versions(self, subject: str) -> list[SchemaVersion]:
        """Récupère toutes les versions avec leur contenu"""
        ...

    @abstractmethod
    async def diff_versions(self, subject: str, version_from: int, version_to: int) -> SchemaDiff:
        """Compare deux versions d'un schema (diff field-level)"""
        ...

    # === References ===

    @abstractmethod
    async def get_references(self, subject: str) -> list[SchemaReference]:
        """Récupère les références d'un schema vers d'autres schemas"""
        ...

    @abstractmethod
    async def get_dependents(self, subject: str) -> list[SchemaReference]:
        """Récupère les schemas qui référencent ce schema (impact analysis)"""
        ...

    # === Compatibility ===

    @abstractmethod
    async def get_compatibility(self, subject: str) -> CompatibilityMode:
        """Récupère le mode de compatibilité d'un subject"""
        ...

    @abstractmethod
    async def check_compatibility(self, subject: str, schema: dict) -> CompatibilityResult:
        """Vérifie la compatibilité d'un schema avec les versions précédentes"""
        ...
