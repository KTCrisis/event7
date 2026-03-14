// src/types/channel.ts
// Types matching backend Pydantic models (app/models/channel.py)
// Design doc: CHANNEL_MODEL_DESIGN.md v1.1.0

// === Enums ===

export type BrokerType =
  // Tier 1 — Core
  | "kafka"
  | "redpanda"
  | "rabbitmq"
  | "pulsar"
  | "nats"
  | "google_pubsub"
  | "aws_sns_sqs"
  | "azure_servicebus"
  | "redis_streams"
  // Tier 2 — Enterprise & IoT
  | "solace"
  | "ibmmq"
  | "activemq_artemis"
  | "mqtt"
  | "mqtt_secure"
  | "websocket"
  | "websocket_secure"
  | "anypoint_mq"
  | "mercure"
  | "stomp"
  // Tier 3 — Serverless
  | "amazon_kinesis"
  | "amazon_eventbridge"
  | "custom";

export type ResourceKind = "topic" | "exchange" | "subject" | "queue" | "stream" | "channel" | "destination" | "event_bus";

export type MessagingPattern = "topic_log" | "pubsub" | "queue" | "request_reply" | "broadcast" | "event_bus";

export type BindingStrategy = "channel_bound" | "domain_bound" | "app_bound";

export type BindingOrigin =
  | "tns"
  | "trs"
  | "rns_heuristic"
  | "kafka_api"
  | "routing_key"
  | "attribute_filter"
  | "manual";

export type BindingStatus = "active" | "missing_subject" | "stale" | "unverified";

export type SchemaRole = "value" | "key" | "header" | "envelope";

// Re-export from governance (canonical location)
export type { DataLayer } from "@/types/governance";

// === Channels ===

export interface ChannelCreate {
  name: string;
  address: string;
  broker_type: BrokerType;
  resource_kind: ResourceKind;
  messaging_pattern: MessagingPattern;
  broker_config?: Record<string, unknown>;
  data_layer?: string | null;
  description?: string | null;
  owner?: string | null;
  tags?: string[];
}

export interface ChannelUpdate {
  name?: string | null;
  address?: string | null;
  broker_type?: BrokerType | null;
  resource_kind?: ResourceKind | null;
  messaging_pattern?: MessagingPattern | null;
  broker_config?: Record<string, unknown> | null;
  data_layer?: string | null;
  description?: string | null;
  owner?: string | null;
  tags?: string[] | null;
}

export interface ChannelResponse {
  id: string;
  registry_id: string;
  name: string;
  address: string;
  broker_type: BrokerType;
  resource_kind: ResourceKind;
  messaging_pattern: MessagingPattern;
  broker_config: Record<string, unknown>;
  data_layer: string | null;
  description: string | null;
  owner: string | null;
  tags: string[];
  is_auto_detected: boolean;
  auto_detect_source: string | null;
  created_at: string | null;
  updated_at: string | null;
  subjects: ChannelSubjectResponse[];
}

export interface ChannelSummary {
  id: string;
  name: string;
  address: string;
  broker_type: BrokerType;
  resource_kind: ResourceKind;
  messaging_pattern: MessagingPattern;
  data_layer: string | null;
  subject_count: number;
  has_key_schema: boolean;
  has_value_schema: boolean;
  binding_health: string;
}

// === Bindings ===

export interface ChannelSubjectCreate {
  subject_name: string;
  binding_strategy: BindingStrategy;
  schema_role?: SchemaRole;
  binding_origin?: BindingOrigin;
  binding_selector?: string | null;
}

export interface ChannelSubjectResponse {
  id: string;
  channel_id: string;
  subject_name: string;
  binding_strategy: BindingStrategy;
  schema_role: SchemaRole;
  binding_origin: BindingOrigin;
  binding_selector: string | null;
  binding_status: BindingStatus;
  last_verified_at: string | null;
  is_auto_detected: boolean;
  created_at: string | null;
}

// === Aggregated views ===

export interface ChannelMapEntry {
  channel: ChannelSummary;
  bindings: ChannelSubjectResponse[];
}

export interface ChannelMapResponse {
  channels: ChannelMapEntry[];
  total_channels: number;
  total_bindings: number;
  bound_subjects: number;
  unbound_subjects: string[];
  warnings: string[];
}

// === Display helpers ===

export const BROKER_ICONS: Record<string, string> = {
  // Tier 1
  kafka: "🔶", redpanda: "🐼", rabbitmq: "🐰", pulsar: "⚡", nats: "🔷",
  google_pubsub: "☁️", aws_sns_sqs: "📦", azure_servicebus: "🔵",
  redis_streams: "🔴",
  // Tier 2
  solace: "🌊", ibmmq: "🏢", activemq_artemis: "🏹",
  mqtt: "📡", mqtt_secure: "🔐",
  websocket: "🌐", websocket_secure: "🔒",
  anypoint_mq: "🔀", mercure: "📢", stomp: "🦶",
  // Tier 3
  amazon_kinesis: "🌊", amazon_eventbridge: "🚌", custom: "⚙️",
};

export const BROKER_LABELS: Record<string, string> = {
  // Tier 1
  kafka: "Kafka", redpanda: "Redpanda", rabbitmq: "RabbitMQ",
  pulsar: "Pulsar", nats: "NATS",
  google_pubsub: "Google Pub/Sub", aws_sns_sqs: "AWS SNS/SQS",
  azure_servicebus: "Azure Service Bus", redis_streams: "Redis Streams",
  // Tier 2
  solace: "Solace PubSub+", ibmmq: "IBM MQ", activemq_artemis: "ActiveMQ Artemis",
  mqtt: "MQTT", mqtt_secure: "MQTT (TLS)",
  websocket: "WebSocket", websocket_secure: "WebSocket (TLS)",
  anypoint_mq: "Anypoint MQ", mercure: "Mercure (SSE)", stomp: "STOMP",
  // Tier 3
  amazon_kinesis: "Amazon Kinesis", amazon_eventbridge: "Amazon EventBridge",
  custom: "Custom",
};


export const PATTERN_LABELS: Record<string, string> = {
  topic_log: "Topic Log",
  pubsub: "Pub/Sub",
  queue: "Queue",
  request_reply: "Request/Reply",
  broadcast: "Broadcast",
  event_bus: "Event Bus",
};

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  topic: "Topic", exchange: "Exchange", subject: "Subject",
  queue: "Queue", stream: "Stream", channel: "Channel",
  destination: "Destination", event_bus: "Event Bus",
};

export const STRATEGY_LABELS: Record<BindingStrategy, string> = {
  channel_bound: "Channel-Bound",
  domain_bound: "Domain-Bound",
  app_bound: "App-Bound",
};

export const STATUS_CONFIG: Record<BindingStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-emerald-400", dot: "bg-emerald-400" },
  missing_subject: { label: "Missing", color: "text-red-400", dot: "bg-red-400" },
  stale: { label: "Stale", color: "text-amber-400", dot: "bg-amber-400" },
  unverified: { label: "Unverified", color: "text-slate-400", dot: "bg-slate-400" },
};

export const DEFAULT_RESOURCE: Record<BrokerType, ResourceKind> = {
  // Tier 1
  kafka: "topic", redpanda: "topic", rabbitmq: "exchange",
  pulsar: "topic", nats: "subject",
  google_pubsub: "topic", aws_sns_sqs: "queue",
  azure_servicebus: "queue", redis_streams: "stream",
  // Tier 2
  solace: "topic", ibmmq: "queue", activemq_artemis: "queue",
  mqtt: "topic", mqtt_secure: "topic",
  websocket: "channel", websocket_secure: "channel",
  anypoint_mq: "queue", mercure: "topic", stomp: "destination",
  // Tier 3
  amazon_kinesis: "stream", amazon_eventbridge: "event_bus", custom: "topic",
};

export const DEFAULT_PATTERN: Record<string, MessagingPattern> = {
    // Tier 1
    kafka: "topic_log", redpanda: "topic_log", rabbitmq: "pubsub",
    pulsar: "topic_log", nats: "pubsub",
    google_pubsub: "pubsub", aws_sns_sqs: "queue",
    azure_servicebus: "queue", redis_streams: "topic_log",
    // Tier 2
    solace: "pubsub", ibmmq: "queue", activemq_artemis: "queue",
    mqtt: "pubsub", mqtt_secure: "pubsub",
    websocket: "broadcast", websocket_secure: "broadcast",
    anypoint_mq: "queue", mercure: "broadcast", stomp: "queue",
    // Tier 3
    amazon_kinesis: "topic_log", amazon_eventbridge: "event_bus",
    custom: "topic_log",
};