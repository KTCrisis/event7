// src/types/asyncapi.ts
// TypeScript types for AsyncAPI feature
// v2: Added import types (preview, result, entities)

// ════════════════════════════════════════════════════════════════════
// GENERATE / VIEWER (existing)
// ════════════════════════════════════════════════════════════════════

export interface AsyncAPISpec {
  subject: string;
  spec_content: Record<string, unknown>;
  is_auto_generated: boolean;
  updated_at: string | null;
}

export interface AsyncAPIGenerateRequest {
  title?: string;
  description?: string;
  server_url?: string;
  include_examples?: boolean;
  topic_name?: string;
  partitions?: number;
  replication_factor?: number;
  include_key_schema?: boolean;
  include_confluent_bindings?: boolean;
}

export interface AsyncAPIYamlExport {
  subject: string;
  format: "yaml";
  content: string;
}

// ════════════════════════════════════════════════════════════════════
// IMPORT — Request, Preview, Result
// ════════════════════════════════════════════════════════════════════

export interface AsyncAPIImportRequest {
  spec_content: Record<string, unknown>;
  register_schemas?: boolean;
}

export interface ImportedChannel {
  address: string;
  name: string;
  broker_type: string;
  resource_kind: string;
  messaging_pattern: string;
  data_layer: string | null;
  description: string | null;
  broker_config: Record<string, unknown>;
}

export interface ImportedBinding {
  channel_address: string;
  subject_name: string;
  schema_role: string;
  binding_strategy: string;
  binding_origin: string;
  binding_selector: string | null;
  found_in_registry: boolean;
}

export interface ImportedEnrichment {
  subject: string;
  description: string | null;
  owner_team: string | null;
  tags: string[];
  data_layer: string | null;
}

export interface ImportedSchema {
  subject_name: string;
  schema_content: Record<string, unknown>;
  format: string;
}

export interface AsyncAPIImportPreview {
  spec_title: string | null;
  spec_version: string | null;
  asyncapi_version: string | null;
  channels: ImportedChannel[];
  bindings: ImportedBinding[];
  enrichments: ImportedEnrichment[];
  unknown_schemas: ImportedSchema[];
  total_channels: number;
  total_bindings: number;
  total_enrichments: number;
  schemas_found: number;
  schemas_missing: number;
  warnings: string[];
}

export interface ImportEntityResult {
  entity_type: string;
  name: string;
  status: "created" | "updated" | "skipped" | "failed";
  detail: string | null;
}

export interface AsyncAPIImportResult {
  channels_created: number;
  bindings_created: number;
  enrichments_updated: number;
  schemas_registered: number;
  spec_stored: boolean;
  results: ImportEntityResult[];
  warnings: string[];
}