"""
event7 - Governance Models
Modèles pour la compatibilité, les enrichissements et le catalogue.

Placement: backend/app/models/governance.py

Changelog:
- v0.4.0: Added data_layer field to Enrichment, EnrichmentUpdate, CatalogEntry
           (imports DataLayer from models/channel.py)
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.models.channel import DataLayer


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


# === Enrichments (stockés en DB) ===


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
    data_layer: DataLayer | None = None
    updated_at: datetime | None = None


class EnrichmentUpdate(BaseModel):
    """Payload pour mettre à jour un enrichissement"""

    description: str | None = None
    owner_team: str | None = None
    tags: list[str] | None = None
    classification: DataClassification | None = None
    data_layer: DataLayer | None = None


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
    data_layer: DataLayer | None = None

    # Calculé
    has_asyncapi: bool = False
    reference_count: int = 0

    # Channel binding info (from channel_subjects join)
    broker_types: list[str] = Field(default_factory=list)
    channel_count: int = 0
    updated_at: datetime | None = None