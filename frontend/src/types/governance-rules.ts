// src/types/governance-rules.ts
// Types matching backend Pydantic models (app/models/governance_rules.py)

// ============================================================
// Enums
// ============================================================

export type RuleScope = "runtime" | "control_plane" | "declarative" | "audit";

export type RuleCategory =
  | "data_quality"
  | "schema_validation"
  | "data_transform"
  | "migration"
  | "access_control"
  | "custom";

export type RuleKind = "CONDITION" | "TRANSFORM" | "VALIDATION" | "POLICY";

export type RuleMode =
  | "READ"
  | "WRITE"
  | "READWRITE"
  | "UPGRADE"
  | "DOWNGRADE"
  | "UPDOWN"
  | "REGISTER";

export type RuleSeverity = "info" | "warning" | "error" | "critical";

export type EnforcementStatus =
  | "declared"
  | "expected"
  | "synced"
  | "verified"
  | "drifted";

export type EvaluationSource =
  | "provider_config"
  | "schema_content"
  | "enrichment_metadata"
  | "declared_only"
  | "not_evaluable";

export type RuleSource =
  | "manual"
  | "template"
  | "imported_provider"
  | "system_generated";

export type TargetType =
  | "registry"
  | "subject"
  | "group"
  | "namespace"
  | "layer"
  | "tag";

export type ScoreConfidence = "high" | "medium" | "low";

export type ScoreGrade = "A" | "B" | "C" | "D" | "F";

// ============================================================
// Governance Rule
// ============================================================

export interface GovernanceRule {
  id: string;
  registry_id: string;
  subject: string | null;

  // Identification
  rule_name: string;
  description: string | null;

  // Classification
  rule_scope: RuleScope;
  rule_category: RuleCategory;
  rule_kind: RuleKind;

  // Technical definition
  rule_type: string;
  rule_mode: RuleMode;
  expression: string | null;
  params: Record<string, unknown>;
  tags: string[];
  on_success: string | null;
  on_failure: string | null;

  // Governance
  severity: RuleSeverity;
  enforcement_status: EnforcementStatus;
  evaluation_source: EvaluationSource;

  // Extended scope
  target_type: TargetType;
  target_ref: string | null;

  // Provider reference
  provider_rule_ref: Record<string, unknown> | null;

  // Traceability
  source: RuleSource;
  origin_template_id: string | null;
  applies_to_version: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GovernanceRuleCreate {
  subject?: string | null;
  rule_name: string;
  description?: string | null;
  rule_scope?: RuleScope;
  rule_category: RuleCategory;
  rule_kind?: RuleKind;
  rule_type?: string;
  rule_mode?: RuleMode;
  expression?: string | null;
  params?: Record<string, unknown>;
  tags?: string[];
  on_success?: string | null;
  on_failure?: string | null;
  severity?: RuleSeverity;
  enforcement_status?: EnforcementStatus;
  evaluation_source?: EvaluationSource;
  target_type?: TargetType;
  target_ref?: string | null;
}

export interface GovernanceRuleUpdate {
  description?: string | null;
  rule_scope?: RuleScope;
  rule_category?: RuleCategory;
  rule_kind?: RuleKind;
  rule_type?: string;
  rule_mode?: RuleMode;
  expression?: string | null;
  params?: Record<string, unknown>;
  tags?: string[];
  on_success?: string | null;
  on_failure?: string | null;
  severity?: RuleSeverity;
  enforcement_status?: EnforcementStatus;
  evaluation_source?: EvaluationSource;
  target_type?: TargetType;
  target_ref?: string | null;
}

export interface GovernanceRuleListResponse {
  rules: GovernanceRule[];
  total: number;
  by_kind: Record<string, number>;
  by_scope: Record<string, number>;
  by_enforcement: Record<string, number>;
  global_rules: number;
  subject_rules: number;
}

// ============================================================
// Templates
// ============================================================

export interface GovernanceTemplateRule {
  rule_name: string;
  rule_scope: RuleScope;
  rule_category: RuleCategory;
  rule_kind: RuleKind;
  rule_type: string;
  rule_mode: RuleMode;
  expression: string | null;
  params: Record<string, unknown>;
  on_success: string | null;
  on_failure: string | null;
  severity: RuleSeverity;
  evaluation_source: EvaluationSource;
  default_enforcement: EnforcementStatus;
  description: string | null;
}

export interface GovernanceTemplate {
  id: string;
  template_name: string;
  display_name: string;
  description: string | null;
  layer: string | null;
  is_builtin: boolean;  
  rules: GovernanceTemplateRule[];
  created_at: string;
  updated_at: string;
}

export interface ApplyTemplateRequest {
  registry_id: string;
  subject?: string | null;
  overwrite?: boolean;
}

export interface ApplyTemplateResponse {
  template_name: string;
  rules_created: number;
  rules_skipped: number;
  rules_updated: number;
  rule_ids: string[];
}

export interface GovernanceTemplateCreate {
  template_name: string;
  display_name: string;
  description?: string | null;
  layer?: string | null;
  rules: GovernanceTemplateRule[];
}
 
export interface GovernanceTemplateUpdate {
  display_name?: string | null;
  description?: string | null;
  layer?: string | null;
  rules?: GovernanceTemplateRule[] | null;
}
 
export interface GovernanceTemplateClone {
  template_name: string;
  display_name: string;
  description?: string | null;
  layer?: string | null;
}
// ============================================================
// Scoring
// ============================================================

export interface EnrichmentScoreBreakdown {
  has_description: boolean;
  has_owner: boolean;
  has_tags: boolean;
  has_classification: boolean;
  points: number;
  max_points: number;
}

export interface RuleScopeCount {
  met: number;
  total: number;
}

export interface RuleScoreBreakdown {
  total_rules: number;
  total_policies: number;
  by_scope: Record<string, RuleScopeCount>;
  by_evaluation_source: Record<string, number>;
  critical_met: number;
  critical_total: number;
  error_met: number;
  error_total: number;
  warning_met: number;
  warning_total: number;
  points: number;
  max_points: number;
}

export interface SchemaQualityBreakdown {
  has_doc: boolean;
  has_references: boolean;
  version_count: number;
  compatibility_set: boolean;
  points: number;
  max_points: number;
}

export interface ScoreBreakdown {
  enrichments: EnrichmentScoreBreakdown;
  rules: RuleScoreBreakdown;
  schema_quality: SchemaQualityBreakdown;
}

export interface GovernanceScore {
  registry_id: string;
  subject: string | null;
  score: number;
  max_score: number;
  grade: ScoreGrade;
  confidence: ScoreConfidence;
  breakdown: ScoreBreakdown;
}

// ============================================================
// UI Helpers
// ============================================================

/** Badge colors per scope */
export const SCOPE_CONFIG: Record<
  RuleScope,
  { label: string; color: string; icon: string }
> = {
  runtime: { label: "Runtime", color: "cyan", icon: "Zap" },
  control_plane: { label: "Control Plane", color: "amber", icon: "Shield" },
  declarative: { label: "Declarative", color: "slate", icon: "ClipboardList" },
  audit: { label: "Audit", color: "violet", icon: "Search" },
};

/** Badge colors per enforcement status */
export const ENFORCEMENT_CONFIG: Record<
  EnforcementStatus,
  { label: string; color: string }
> = {
  declared: { label: "Declared", color: "gray" },
  expected: { label: "Expected", color: "yellow" },
  synced: { label: "Synced", color: "green" },
  verified: { label: "Verified", color: "emerald" },
  drifted: { label: "Drifted", color: "red" },
};

/** Badge colors per severity */
export const SEVERITY_CONFIG: Record<
  RuleSeverity,
  { label: string; color: string }
> = {
  info: { label: "Info", color: "slate" },
  warning: { label: "Warning", color: "yellow" },
  error: { label: "Error", color: "orange" },
  critical: { label: "Critical", color: "red" },
};

/** Grade colors */
export const GRADE_CONFIG: Record<
  ScoreGrade,
  { color: string; bg: string }
> = {
  A: { color: "text-emerald-400", bg: "bg-emerald-400/10" },
  B: { color: "text-cyan-400", bg: "bg-cyan-400/10" },
  C: { color: "text-yellow-400", bg: "bg-yellow-400/10" },
  D: { color: "text-orange-400", bg: "bg-orange-400/10" },
  F: { color: "text-red-400", bg: "bg-red-400/10" },
};