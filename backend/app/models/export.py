"""
event7 - EventCatalog Export Models
Modèles Pydantic pour l'endpoint GET /export/eventcatalog.

Placement: backend/app/models/export.py

Payload agrégé : registry info + schemas enrichis + channels + teams.
Conçu pour être consommé par le generator-event7 (plugin EventCatalog).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ============================================================
# Sub-models
# ============================================================


class ExportRegistryInfo(BaseModel):
    """Metadata du registry source."""

    id: str
    name: str
    provider_type: str
    base_url: str


class ExportEnrichment(BaseModel):
    """Enrichment business d'un schema (provider-agnostic)."""

    description: str | None = None
    owner_team: str | None = None
    tags: list[str] = Field(default_factory=list)
    classification: str = "internal"
    data_layer: str | None = None


class ExportReference(BaseModel):
    """Référence sortante vers un autre schema."""

    subject: str
    version: int


class ExportScoreBreakdown(BaseModel):
    """Breakdown simplifié du score de gouvernance."""

    enrichments: int = 0
    enrichments_max: int = 20
    rules: int = 0
    rules_max: int = 50
    schema_quality: int = 0
    schema_quality_max: int = 30


class ExportGovernanceScore(BaseModel):
    """Score de gouvernance d'un schema."""

    score: int = 0
    grade: str = "F"
    confidence: str = "low"
    breakdown: ExportScoreBreakdown = Field(default_factory=ExportScoreBreakdown)


class ExportRuleSummary(BaseModel):
    """Résumé compact d'une règle évaluée."""

    rule_name: str
    status: str  # PASS, WARN, FAIL
    severity: str  # info, warning, error, critical
    category: str  # data_quality, schema_validation, ...


class ExportSchema(BaseModel):
    """Un schema enrichi pour l'export EventCatalog."""

    subject: str
    format: str  # AVRO, JSON, PROTOBUF
    latest_version: int
    version_count: int
    schema_content: dict | None = None  # null si inaccessible
    enrichment: ExportEnrichment = Field(default_factory=ExportEnrichment)
    references: list[ExportReference] = Field(default_factory=list)
    governance_score: ExportGovernanceScore | None = None
    rules_summary: list[ExportRuleSummary] = Field(default_factory=list)
    asyncapi_yaml: str | None = None  # null si pas généré


class ExportChannelBinding(BaseModel):
    """Binding subject ↔ channel."""

    subject: str
    schema_role: str  # value, key, header, envelope
    binding_status: str = "unverified"


class ExportChannel(BaseModel):
    """Un channel messaging pour l'export."""

    id: str
    name: str
    address: str
    broker_type: str  # kafka, rabbitmq, pulsar, ...
    resource_kind: str  # topic, exchange, queue, ...
    data_layer: str | None = None
    bindings: list[ExportChannelBinding] = Field(default_factory=list)


# ============================================================
# Top-level response
# ============================================================


class EventCatalogExport(BaseModel):
    """Payload complet pour le generator-event7.

    Un seul appel HTTP, toutes les données agrégées.
    """

    registry: ExportRegistryInfo
    schemas: list[ExportSchema] = Field(default_factory=list)
    channels: list[ExportChannel] = Field(default_factory=list)
    teams: list[str] = Field(default_factory=list)