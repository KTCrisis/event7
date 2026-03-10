// src/types/schema.ts
// Types matching backend Pydantic models (app/models/schema.py)

export type SchemaFormat = "AVRO" | "JSON" | "PROTOBUF";

export interface SubjectInfo {
  subject: string;
  format: SchemaFormat;
  latest_version: number;
  version_count: number;
  schema_id: number | null;
  description: string | null;
  owner_team: string | null;
  tags: string[];
}

export interface SchemaDetail {
  subject: string;
  version: number;
  schema_id: number;
  format: SchemaFormat;
  schema_content: Record<string, unknown>;
  references: SchemaReference[];
  registered_at: string | null;
}

export interface SchemaVersion {
  version: number;
  schema_id: number;
  format: SchemaFormat;
  schema_content: Record<string, unknown>;
  registered_at: string | null;
}

export interface SchemaReference {
  name: string;
  subject: string;
  version: number;
}

export type DiffChangeType = "added" | "removed" | "modified" | "unchanged";

export interface FieldDiff {
  field_path: string;
  change_type: DiffChangeType;
  old_value: string | Record<string, unknown> | null;
  new_value: string | Record<string, unknown> | null;
  details: string | null;
}

export interface SchemaDiff {
  subject: string;
  version_from: number;
  version_to: number;
  format: SchemaFormat;
  changes: FieldDiff[];
  is_breaking: boolean;
  summary: string;
}

export interface CompatibilityInfo {
  subject: string;
  compatibility: string;
}