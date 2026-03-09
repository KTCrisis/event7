"""
event7 - Governance Models
Modèles pour la compatibilité, les enrichissements et le catalogue.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# === Compatibility ===


class CompatibilityMode(str, Enum):
    NONE = "NONE"
    BACKWARD = "BACKWARD"
    BACKWARD_TRANSITIVE = "BACKWARD_TRANSITIVE"
    FORWARD = "FORWARD"
    FORWARD_TRANSITIVE = "FORWARD_TRANSITIVE"
    FULL = "FULL"
    FULL_TRANSITIVE = "FULL_TRANSITIVE"


class CompatibilityResult(BaseModel):
    is_compatible: bool
    messages: list[str] = Field(default_factory=list)


# === Enrichments (stockés en Supabase) ===


class DataClassification(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class Enrichment(BaseModel):
    """Enrichissement business ajouté par-dessus le registry"""

    subject: str
    description: str | None = None
    owner_team: str | None = None
    tags: list[str] = Field(default_factory=list)
    classification: DataClassification = DataClassification.INTERNAL
    updated_at: datetime | None = None


class EnrichmentUpdate(BaseModel):
    """Payload pour mettre à jour un enrichissement"""

    description: str | None = None
    owner_team: str | None = None
    tags: list[str] | None = None
    classification: DataClassification | None = None


# === Catalogue (vue combinée registry + enrichments) ===


class CatalogEntry(BaseModel):
    """Entrée du catalogue événements (vue business)"""

    subject: str
    format: str
    latest_version: int
    version_count: int

    # Enrichissement
    description: str | None = None
    owner_team: str | None = None
    tags: list[str] = Field(default_factory=list)
    classification: DataClassification = DataClassification.INTERNAL

    # Calculé
    has_asyncapi: bool = False
    reference_count: int = 0
