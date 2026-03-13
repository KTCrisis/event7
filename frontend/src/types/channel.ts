// src/types/channel.ts
// Types matching backend Pydantic models (app/models/channel.py)
// Design doc: CHANNEL_MODEL_DESIGN.md v1.1.0

// === Enums ===

export type BrokerType =
  | "kafka"
  | "redpanda"
  | "rabbitmq"
  | "pulsar"
  | "nats"
  | "google_pubsub"
  | "aws_sns_sqs"
  | "azure_servicebus"
  | "redis_streams"
  | "custom";

export type ResourceKind = "topic" | "exchange" | "subject" | "queue" | "stream";

export type MessagingPattern = "topic_log" | "pubsub" | "queue";

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

export const BROKER_ICONS: Record<BrokerType, string> = {
  kafka: "🔶",
  redpanda: "🐼",
  rabbitmq: "🐰",
  pulsar: "⚡",
  nats: "🔷",
  google_pubsub: "☁️",
  aws_sns_sqs: "📦",
  azure_servicebus: "🔵",
  redis_streams: "🔴",
  custom: "⚙️",
};

export const BROKER_LABELS: Record<BrokerType, string> = {
  kafka: "Kafka",
  redpanda: "Redpanda",
  rabbitmq: "RabbitMQ",
  pulsar: "Pulsar",
  nats: "NATS",
  google_pubsub: "Google Pub/Sub",
  aws_sns_sqs: "AWS SNS/SQS",
  azure_servicebus: "Azure Service Bus",
  redis_streams: "Redis Streams",
  custom: "Custom",
};

export const PATTERN_LABELS: Record<MessagingPattern, string> = {
  topic_log: "Topic Log",
  pubsub: "Pub/Sub",
  queue: "Queue",
};

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  topic: "Topic",
  exchange: "Exchange",
  subject: "Subject",
  queue: "Queue",
  stream: "Stream",
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