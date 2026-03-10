// src/types/asyncapi.ts
// TypeScript types for AsyncAPI feature

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