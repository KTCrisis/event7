"""
event7 - AsyncAPI Models
Modèles pour la génération, le stockage et l'import des specs AsyncAPI.

Placement: backend/app/models/asyncapi.py

Changelog:
- v2: Added Kafka binding params (topic_name, partitions, replication_factor)
      Added include_key_schema flag for key/value separation
- v3: Added AsyncAPI import models (preview, request, result)
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ════════════════════════════════════════════════════════════════════
# GENERATE
# ════════════════════════════════════════════════════════════════════


class AsyncAPIGenerateRequest(BaseModel):
    """Paramètres pour la génération d'une spec AsyncAPI."""

    # --- Existing params ---
    title: str | None = None
    description: str | None = None
    server_url: str | None = None
    include_examples: bool = True

    # --- Kafka binding params ---
    topic_name: str | None = None
    partitions: int | None = None
    replication_factor: int | None = None
    include_key_schema: bool = True

    # --- Confluent-specific params ---
    include_confluent_bindings: bool = True


class AsyncAPISpec(BaseModel):
    """Spec AsyncAPI stockée."""

    subject: str
    spec_content: dict
    is_auto_generated: bool = True
    updated_at: datetime | None = None


class AsyncAPIYamlExport(BaseModel):
    """YAML export wrapper."""

    content: str


# ════════════════════════════════════════════════════════════════════
# IMPORT — Preview & Apply
# ════════════════════════════════════════════════════════════════════


class AsyncAPIImportRequest(BaseModel):
    """Payload for import preview and apply."""

    spec_content: dict  # parsed AsyncAPI spec (JSON/dict, not YAML string)
    register_schemas: bool = False  # If true, push unknown schemas to SR


class ImportedChannel(BaseModel):
    """A channel extracted from the AsyncAPI spec."""

    address: str
    name: str
    broker_type: str = "kafka"
    resource_kind: str = "topic"
    messaging_pattern: str = "topic_log"
    data_layer: str | None = None
    description: str | None = None
    broker_config: dict = Field(default_factory=dict)


class ImportedBinding(BaseModel):
    """A subject binding extracted from a channel's messages."""

    channel_address: str
    subject_name: str
    schema_role: str = "value"
    binding_strategy: str = "channel_bound"
    binding_origin: str = "manual"
    binding_selector: str | None = None
    found_in_registry: bool = False  # True if subject exists in SR


class ImportedEnrichment(BaseModel):
    """Enrichment data extracted from the spec's info/extensions."""

    subject: str
    description: str | None = None
    owner_team: str | None = None
    tags: list[str] = Field(default_factory=list)
    data_layer: str | None = None


class ImportedSchema(BaseModel):
    """A schema found in the spec that is NOT in the SR."""

    subject_name: str
    schema_content: dict
    format: str = "JSON"  # AsyncAPI uses JSON Schema natively


class AsyncAPIImportPreview(BaseModel):
    """Dry-run result — what WOULD be created, nothing persisted yet."""

    # Spec metadata
    spec_title: str | None = None
    spec_version: str | None = None
    asyncapi_version: str | None = None

    # Extracted entities
    channels: list[ImportedChannel] = Field(default_factory=list)
    bindings: list[ImportedBinding] = Field(default_factory=list)
    enrichments: list[ImportedEnrichment] = Field(default_factory=list)
    unknown_schemas: list[ImportedSchema] = Field(default_factory=list)

    # Counts
    total_channels: int = 0
    total_bindings: int = 0
    total_enrichments: int = 0
    schemas_found: int = 0      # already in SR
    schemas_missing: int = 0    # not in SR

    # Warnings (non-blocking)
    warnings: list[str] = Field(default_factory=list)


class ImportEntityResult(BaseModel):
    """Result for a single entity creation."""

    entity_type: str  # "channel", "binding", "enrichment", "schema", "spec"
    name: str
    status: str  # "created", "updated", "skipped", "failed"
    detail: str | None = None


class AsyncAPIImportResult(BaseModel):
    """Result after applying the import."""

    # Counts
    channels_created: int = 0
    bindings_created: int = 0
    enrichments_updated: int = 0
    schemas_registered: int = 0
    spec_stored: bool = False

    # Detail log
    results: list[ImportEntityResult] = Field(default_factory=list)

    # Warnings
    warnings: list[str] = Field(default_factory=list)