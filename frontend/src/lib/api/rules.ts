// src/lib/api/rules.ts
// Governance Rules & Templates API functions
// v2: Added custom template CRUD (create, update, delete, clone)
// Placement: frontend/src/lib/api/rules.ts

import { api } from "./client";
import type {
  GovernanceRule,
  GovernanceRuleCreate,
  GovernanceRuleUpdate,
  GovernanceRuleListResponse,
  GovernanceTemplate,
  GovernanceTemplateCreate,
  GovernanceTemplateUpdate,
  GovernanceTemplateClone,
  ApplyTemplateRequest,
  ApplyTemplateResponse,
  GovernanceScore,
} from "@/types/governance-rules";

const base = (registryId: string) =>
  `/api/v1/registries/${registryId}`;

// ============================================================
// CRUD — Rules & Policies
// ============================================================

/** List governance rules with optional filters */
export async function listRules(
  registryId: string,
  filters?: {
    subject?: string;
    scope?: string;
    kind?: string;
    category?: string;
    severity?: string;
    enforcement_status?: string;
    source?: string;
  }
): Promise<GovernanceRuleListResponse> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }
  const query = params.toString();
  const url = `${base(registryId)}/rules${query ? `?${query}` : ""}`;
  return api.get<GovernanceRuleListResponse>(url);
}

/** Get a single governance rule by ID */
export async function getRule(
  registryId: string,
  ruleId: string
): Promise<GovernanceRule> {
  return api.get<GovernanceRule>(
    `${base(registryId)}/rules/${ruleId}`
  );
}

/** Create a new governance rule or policy */
export async function createRule(
  registryId: string,
  data: GovernanceRuleCreate
): Promise<GovernanceRule> {
  return api.post<GovernanceRule>(
    `${base(registryId)}/rules`,
    data
  );
}

/** Update a governance rule or policy */
export async function updateRule(
  registryId: string,
  ruleId: string,
  data: GovernanceRuleUpdate
): Promise<GovernanceRule> {
  return api.put<GovernanceRule>(
    `${base(registryId)}/rules/${ruleId}`,
    data
  );
}

/** Delete a governance rule or policy */
export async function deleteRule(
  registryId: string,
  ruleId: string
): Promise<void> {
  return api.delete(`${base(registryId)}/rules/${ruleId}`);
}

// ============================================================
// Provider Sync — Import Confluent ruleSet
// ============================================================

export interface ImportProviderResult {
  subject: string;
  imported: number;
  skipped: number;
  rules: string[];
  pii_fields: Array<{ field: string; tags: string[] }>;
  message: string;
}

export interface ImportProviderAllResult {
  subjects_scanned: number;
  subjects_with_rules: number;
  imported: number;
  skipped: number;
  pii_fields: Array<{ subject: string; field: string; tags: string[] }>;
  message: string;
}

/** Import governance rules from the schema registry provider for a single subject */
export async function importProviderRules(
  registryId: string,
  subject: string
): Promise<ImportProviderResult> {
  return api.post<ImportProviderResult>(
    `${base(registryId)}/rules/import-provider?subject=${encodeURIComponent(subject)}`
  );
}

/** Import governance rules from ALL subjects with ruleSet */
export async function importProviderRulesAll(
  registryId: string
): Promise<ImportProviderAllResult> {
  return api.post<ImportProviderAllResult>(
    `${base(registryId)}/rules/import-provider-all`
  );
}

// ============================================================
// Provider Sync — Push event7 rules to Confluent
// ============================================================

export interface PushProviderResult {
  subject: string;
  pushed: number;
  schema_id?: number;
  rule_set?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  message: string;
}

/** Push event7 governance rules to the provider as a Confluent ruleSet */
export async function pushProviderRules(
  registryId: string,
  subject: string
): Promise<PushProviderResult> {
  return api.post<PushProviderResult>(
    `${base(registryId)}/rules/push-provider?subject=${encodeURIComponent(subject)}`
  );
}

// ============================================================
// Templates — Read
// ============================================================

/** List all governance rule templates (builtin + custom) */
export async function listTemplates(): Promise<GovernanceTemplate[]> {
  return api.get<GovernanceTemplate[]>("/api/v1/governance/templates");
}

/** Get a single governance rule template */
export async function getTemplate(
  templateId: string
): Promise<GovernanceTemplate> {
  return api.get<GovernanceTemplate>(
    `/api/v1/governance/templates/${templateId}`
  );
}

// ============================================================
// Templates — Custom CRUD
// ============================================================

/** Create a custom governance template */
export async function createTemplate(
  data: GovernanceTemplateCreate
): Promise<GovernanceTemplate> {
  return api.post<GovernanceTemplate>(
    "/api/v1/governance/templates",
    data
  );
}

/** Update a governance template */
export async function updateTemplate(
  templateId: string,
  data: GovernanceTemplateUpdate
): Promise<GovernanceTemplate> {
  return api.put<GovernanceTemplate>(
    `/api/v1/governance/templates/${templateId}`,
    data
  );
}

/** Delete a custom governance template */
export async function deleteTemplate(
  templateId: string
): Promise<void> {
  return api.delete(`/api/v1/governance/templates/${templateId}`);
}

/** Clone a template (builtin or custom) with a new name */
export async function cloneTemplate(
  templateId: string,
  data: GovernanceTemplateClone
): Promise<GovernanceTemplate> {
  return api.post<GovernanceTemplate>(
    `/api/v1/governance/templates/${templateId}/clone`,
    data
  );
}

// ============================================================
// Templates — Apply
// ============================================================

/** Apply a template to a registry/subject */
export async function applyTemplate(
  registryId: string,
  templateId: string,
  data: ApplyTemplateRequest
): Promise<ApplyTemplateResponse> {
  return api.post<ApplyTemplateResponse>(
    `${base(registryId)}/rules/templates/${templateId}/apply`,
    data
  );
}

// ============================================================
// Scoring
// ============================================================

/** Get governance score for a subject or the whole registry */
export async function getGovernanceScore(
  registryId: string,
  subject?: string
): Promise<GovernanceScore> {
  const params = subject
    ? `?subject=${encodeURIComponent(subject)}`
    : "";
  return api.get<GovernanceScore>(
    `${base(registryId)}/governance/score${params}`
  );
}