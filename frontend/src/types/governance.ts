// src/types/governance.ts
// Types matching backend Pydantic models (app/models/governance.py)

export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export interface CatalogEntry {
  subject: string;
  format: string;
  latest_version: number;
  version_count: number;
  description: string | null;
  owner_team: string | null;
  tags: string[];
  classification: DataClassification;
  has_asyncapi: boolean;
  reference_count: number;
}

export interface Enrichment {
  subject: string;
  description: string | null;
  owner_team: string | null;
  tags: string[];
  classification: DataClassification;
  updated_at: string | null;
}

export interface EnrichmentUpdate {
  description?: string | null;
  owner_team?: string | null;
  tags?: string[] | null;
  classification?: DataClassification | null;
}