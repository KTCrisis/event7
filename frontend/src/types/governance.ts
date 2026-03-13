// src/types/governance.ts
// Types matching backend Pydantic models (app/models/governance.py)
// v0.4.0: Added DataLayer type + data_layer field on CatalogEntry, Enrichment, EnrichmentUpdate

export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export type DataLayer = "raw" | "core" | "refined" | "application";

export interface CatalogEntry {
  subject: string;
  format: string;
  latest_version: number;
  version_count: number;
  description: string | null;
  owner_team: string | null;
  tags: string[];
  classification: DataClassification;
  data_layer: DataLayer | null;
  has_asyncapi: boolean;
  reference_count: number;
  // Channel binding info
  broker_types: string[];
  channel_count: number;
  updated_at: string | null;
}

export interface Enrichment {
  subject: string;
  description: string | null;
  owner_team: string | null;
  tags: string[];
  classification: DataClassification;
  data_layer: DataLayer | null;
  updated_at: string | null;
}

export interface EnrichmentUpdate {
  description?: string | null;
  owner_team?: string | null;
  tags?: string[] | null;
  classification?: DataClassification | null;
  data_layer?: DataLayer | null;
}