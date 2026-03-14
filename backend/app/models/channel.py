"""
event7 - Channel Model
Modèles pour l'abstraction Channel (multi-broker, multi-protocol).

Placement: backend/app/models/channel.py

Design doc: CHANNEL_MODEL_DESIGN.md v1.1.0
- 7 enums (BrokerType, ResourceKind, MessagingPattern, BindingStrategy,
           BindingOrigin, BindingStatus, DataLayer, SchemaRole)
- 6 Pydantic models (ChannelCreate, ChannelResponse, ChannelSubjectCreate,
                      ChannelSubjectResponse, ChannelSummary, ChannelMapResponse)
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# ====================================================================
# ENUMS
# ====================================================================


class BrokerType(str, Enum):
    """Type de broker / système de messaging."""
    # Tier 1 — Core
    KAFKA = "kafka"
    REDPANDA = "redpanda"
    RABBITMQ = "rabbitmq"
    PULSAR = "pulsar"
    NATS = "nats"
    GOOGLE_PUBSUB = "google_pubsub"
    AWS_SNS_SQS = "aws_sns_sqs"
    AZURE_SERVICEBUS = "azure_servicebus"
    REDIS_STREAMS = "redis_streams"
    # Tier 2 — Enterprise & IoT
    SOLACE = "solace"
    IBMMQ = "ibmmq"
    ACTIVEMQ_ARTEMIS = "activemq_artemis"
    MQTT = "mqtt"
    MQTT_SECURE = "mqtt_secure"
    WEBSOCKET = "websocket"
    WEBSOCKET_SECURE = "websocket_secure"
    ANYPOINT_MQ = "anypoint_mq"
    MERCURE = "mercure"
    STOMP = "stomp"
    # Tier 3 — Serverless
    AMAZON_KINESIS = "amazon_kinesis"
    AMAZON_EVENTBRIDGE = "amazon_eventbridge"
    CUSTOM = "custom"


class ResourceKind(str, Enum):
    """Nature physique de la ressource broker derrière un Channel."""
    TOPIC = "topic"
    EXCHANGE = "exchange"
    SUBJECT = "subject"
    QUEUE = "queue"
    STREAM = "stream"
    CHANNEL = "channel"
    DESTINATION = "destination"
    EVENT_BUS = "event_bus"

class MessagingPattern(str, Enum):
    """Pattern de messaging du channel."""
    TOPIC_LOG = "topic_log"     # Kafka, Pulsar, Redis Streams
    PUBSUB = "pubsub"           # Pub/Sub, SNS, NATS
    QUEUE = "queue"             # RabbitMQ, SQS, Azure SB


class BindingStrategy(str, Enum):
    """Stratégie conceptuelle de liaison subject ↔ channel.
    Décrit la logique métier du lien, pas son mode de détection."""
    CHANNEL_BOUND = "channel_bound"   # ≈ TNS — schema couplé au channel
    DOMAIN_BOUND = "domain_bound"     # ≈ RNS — schema modèle métier
    APP_BOUND = "app_bound"           # ≈ RNS scopé app


class BindingOrigin(str, Enum):
    """Mode concret par lequel le binding a été établi.
    Distinct de la strategy (conceptuelle). Permet la traçabilité."""
    TNS = "tns"
    TRS = "trs"
    RNS_HEURISTIC = "rns_heuristic"
    KAFKA_API = "kafka_api"
    ROUTING_KEY = "routing_key"
    ATTRIBUTE_FILTER = "attribute_filter"
    MANUAL = "manual"


class BindingStatus(str, Enum):
    """État de santé du binding — le subject référencé existe-t-il encore ?"""
    ACTIVE = "active"
    MISSING_SUBJECT = "missing_subject"
    STALE = "stale"
    UNVERIFIED = "unverified"


class DataLayer(str, Enum):
    """Layer de maturité de la donnée.
    Layer primaire = sur le subject/enrichment (sémantique de donnée).
    Layer sur le channel = hint UX dérivé (layer dominant attendu du flux)."""
    RAW = "raw"
    CORE = "core"
    REFINED = "refined"
    APPLICATION = "application"


class SchemaRole(str, Enum):
    """Rôle du schema dans le channel."""
    VALUE = "value"
    KEY = "key"
    HEADER = "header"
    ENVELOPE = "envelope"


# ====================================================================
# PYDANTIC MODELS — Channels
# ====================================================================


class ChannelCreate(BaseModel):
    """Payload pour créer un channel."""
    name: str = Field(..., min_length=1, max_length=500, examples=["Billing Events"])
    address: str = Field(..., min_length=1, max_length=1000, examples=["corp.billing.events.v1"])
    broker_type: BrokerType
    resource_kind: ResourceKind
    messaging_pattern: MessagingPattern
    broker_config: dict = Field(default_factory=dict)
    data_layer: DataLayer | None = None
    description: str | None = None
    owner: str | None = Field(default=None, max_length=200)
    tags: list[str] = Field(default_factory=list)


class ChannelUpdate(BaseModel):
    """Payload pour mettre à jour un channel (partiel)."""
    name: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=1000)
    broker_type: BrokerType | None = None
    resource_kind: ResourceKind | None = None
    messaging_pattern: MessagingPattern | None = None
    broker_config: dict | None = None
    data_layer: DataLayer | None = None
    description: str | None = None
    owner: str | None = None
    tags: list[str] | None = None


class ChannelResponse(BaseModel):
    """Channel retourné par l'API."""
    id: str
    registry_id: str
    name: str
    address: str
    broker_type: BrokerType
    resource_kind: ResourceKind
    messaging_pattern: MessagingPattern
    broker_config: dict = Field(default_factory=dict)
    data_layer: DataLayer | None = None
    description: str | None = None
    owner: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_auto_detected: bool = False
    auto_detect_source: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Relations (peuplé par le service)
    subjects: list["ChannelSubjectResponse"] = Field(default_factory=list)


class ChannelSummary(BaseModel):
    """Vue légère pour les listings."""
    id: str
    name: str
    address: str
    broker_type: BrokerType
    resource_kind: ResourceKind
    messaging_pattern: MessagingPattern
    data_layer: DataLayer | None = None
    subject_count: int = 0
    has_key_schema: bool = False
    has_value_schema: bool = False
    binding_health: str = "unknown"


# ====================================================================
# PYDANTIC MODELS — Channel-Subject Bindings
# ====================================================================


class ChannelSubjectCreate(BaseModel):
    """Payload pour lier un subject à un channel."""
    subject_name: str = Field(..., min_length=1, max_length=500)
    binding_strategy: BindingStrategy
    schema_role: SchemaRole = SchemaRole.VALUE
    binding_origin: BindingOrigin = BindingOrigin.MANUAL
    binding_selector: str | None = Field(
        default=None,
        max_length=500,
        description="Routing key pattern, attribute filter, record name, etc.",
        examples=["billing.invoice.*", "eventType=InvoiceCreated"],
    )


class ChannelSubjectResponse(BaseModel):
    """Binding retourné par l'API."""
    id: str
    channel_id: str
    subject_name: str
    binding_strategy: BindingStrategy
    schema_role: SchemaRole
    binding_origin: BindingOrigin
    binding_selector: str | None = None
    binding_status: BindingStatus = BindingStatus.UNVERIFIED
    last_verified_at: datetime | None = None
    is_auto_detected: bool = False
    created_at: datetime | None = None


# ====================================================================
# PYDANTIC MODELS — Aggregated views
# ====================================================================


class ChannelMapEntry(BaseModel):
    """Une entrée dans la vue channel-map (channel + ses bindings)."""
    channel: ChannelSummary
    bindings: list[ChannelSubjectResponse] = Field(default_factory=list)


class ChannelMapResponse(BaseModel):
    """Vue complète channel-map pour le frontend."""
    channels: list[ChannelMapEntry] = Field(default_factory=list)
    total_channels: int = 0
    total_bindings: int = 0
    bound_subjects: int = 0
    unbound_subjects: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)