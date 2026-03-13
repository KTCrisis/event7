// src/types/validator.ts
// Types matching backend Pydantic models (app/models/validator.py)
// Design doc: SCHEMA_VALIDATOR_DESIGN.md v1.0.0

import type { SchemaFormat } from "@/types/schema";

// === Verdict ===

export type Verdict = "pass" | "warn" | "fail";

// === Request ===

export interface SchemaValidateRequest {
  subject: string;
  schema_content: string;
  schema_type?: SchemaFormat;
  references?: Record<string, unknown>[];
  compare_version?: string;
}

// === Sub-results ===

export interface CompatibilityResult {
  is_compatible: boolean;
  mode: string;
  messages: string[];
  provider_checked: boolean;
}

export interface RuleViolation {
  rule_id: string;
  rule_name: string;
  rule_scope: string;
  severity: string;
  message: string;
  category: string;
}

export interface RuleSkipped {
  rule_id: string;
  rule_name: string;
  reason: string;
}

export interface GovernanceResult {
  score: number;
  violations: RuleViolation[];
  skipped: RuleSkipped[];
  passed: number;
  failed: number;
  total: number;
}

export interface DiffResult {
  has_changes: boolean;
  fields_added: string[];
  fields_removed: string[];
  fields_modified: string[];
  is_breaking: boolean;
  total_changes: number;
  is_new_subject: boolean;
}

// === Response ===

export interface SchemaValidateResponse {
  subject: string;
  schema_type: SchemaFormat;
  compare_version: number | null;
  timestamp: string;
  compatibility: CompatibilityResult;
  governance: GovernanceResult;
  diff: DiffResult;
  verdict: Verdict;
}