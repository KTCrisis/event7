/**
 * event7 EventCatalog Export — TypeScript interfaces
 * Mirrors backend/app/models/export.py
 */

// ── Registry ──

export interface ExportRegistryInfo {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
}

// ── Enrichment ──

export interface ExportEnrichment {
  description: string | null;
  owner_team: string | null;
  tags: string[];
  classification: string;
  data_layer: string | null;
}

// ── Reference ──

export interface ExportReference {
  subject: string;
  version: number;
}

// ── Governance Score ──

export interface ExportScoreBreakdown {
  enrichments: number;
  enrichments_max: number;
  rules: number;
  rules_max: number;
  schema_quality: number;
  schema_quality_max: number;
}

export interface ExportGovernanceScore {
  score: number;
  grade: string;
  confidence: string;
  breakdown: ExportScoreBreakdown;
}

// ── Rule Summary ──

export interface ExportRuleSummary {
  rule_name: string;
  status: string; // PASS, WARN, FAIL
  severity: string; // info, warning, error, critical
  category: string;
}

// ── Schema ──

export interface ExportSchema {
  subject: string;
  format: string;
  latest_version: number;
  version_count: number;
  schema_content: Record<string, unknown> | null;
  enrichment: ExportEnrichment;
  references: ExportReference[];
  governance_score: ExportGovernanceScore | null;
  rules_summary: ExportRuleSummary[];
  asyncapi_yaml: string | null;
}

// ── Channel ──

export interface ExportChannelBinding {
  subject: string;
  schema_role: string;
  binding_status: string;
}

export interface ExportChannel {
  id: string;
  name: string;
  address: string;
  broker_type: string;
  resource_kind: string;
  data_layer: string | null;
  bindings: ExportChannelBinding[];
}

// ── Top-level payload ──

export interface EventCatalogExport {
  registry: ExportRegistryInfo;
  schemas: ExportSchema[];
  channels: ExportChannel[];
  teams: string[];
}

// ── Generator config (user-facing) ──

export interface DomainMatch {
  prefix?: string;
  tag?: string;
}

export interface DomainConfig {
  id: string;
  name: string;
  version?: string;
  match: DomainMatch;
}

export interface FilterConfig {
  prefix?: string | null;
  excludePrefix?: string[];
  excludeTags?: string[];
}

export interface GeneratorOptions {
  // Connection
  event7Url: string;
  event7Token?: string;
  registryId: string;

  // Domain mapping
  domains?: DomainConfig[];
  defaultDomain?: { id: string; name: string };

  // Message type
  messageType?: "event" | "command" | "auto";

  // Feature flags
  includeGovernance?: boolean;
  includeChannels?: boolean;
  includeAsyncAPI?: boolean;
  includeTeams?: boolean;
  includeReferences?: boolean;

  // Filters
  filter?: FilterConfig;

  // Debug
  debug?: boolean;
}