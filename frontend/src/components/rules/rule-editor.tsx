// src/components/rules/rule-editor.tsx
// Drawer for creating/editing governance rules & policies
// Form adapts based on rule_scope selection
"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createRule, updateRule } from "@/lib/api/rules";
import { ScopeBadge, SeverityBadge } from "./rule-badges";
import type {
  GovernanceRule,
  GovernanceRuleCreate,
  GovernanceRuleUpdate,
  RuleScope,
  RuleCategory,
  RuleKind,
  RuleMode,
  RuleSeverity,
  EnforcementStatus,
  EvaluationSource,
} from "@/types/governance-rules";

interface RuleEditorProps {
  registryId: string;
  rule?: GovernanceRule | null;      // null = create mode
  subject?: string | null;           // Pre-fill subject
  onClose: () => void;
  onSaved: (rule: GovernanceRule) => void;
}

// Helper data
const SCOPE_OPTIONS: { value: RuleScope; label: string; hint: string }[] = [
  { value: "runtime", label: "Runtime", hint: "Executed by serializer/deserializer (CEL, JSONATA)" },
  { value: "control_plane", label: "Control Plane", hint: "Applied at schema registration (compatibility, validity)" },
  { value: "declarative", label: "Declarative", hint: "Organizational standard, not automatically enforced" },
  { value: "audit", label: "Audit", hint: "Checked for scoring purposes" },
];

const CATEGORY_OPTIONS: { value: RuleCategory; label: string }[] = [
  { value: "data_quality", label: "Data Quality" },
  { value: "schema_validation", label: "Schema Validation" },
  { value: "data_transform", label: "Data Transform" },
  { value: "migration", label: "Migration" },
  { value: "access_control", label: "Access Control" },
  { value: "custom", label: "Custom" },
];

const SEVERITY_OPTIONS: RuleSeverity[] = ["info", "warning", "error", "critical"];

const ENFORCEMENT_OPTIONS: { value: EnforcementStatus; label: string }[] = [
  { value: "declared", label: "Declared" },
  { value: "expected", label: "Expected" },
];

// Map scope → default kind
const SCOPE_DEFAULT_KIND: Record<RuleScope, RuleKind> = {
  runtime: "CONDITION",
  control_plane: "VALIDATION",
  declarative: "POLICY",
  audit: "POLICY",
};

// Map scope → available rule_types
const SCOPE_RULE_TYPES: Record<RuleScope, string[]> = {
  runtime: ["CEL", "CEL_FIELD", "JSONATA", "ENCRYPT", "DECRYPT", "SS_TYPE"],
  control_plane: ["COMPATIBILITY", "VALIDITY", "INTEGRITY", "BREAKING_CHECK", "LINT"],
  declarative: ["CUSTOM", "REGEX", "REQUIRED_FIELDS", "NAMING"],
  audit: ["CUSTOM", "REGEX", "REQUIRED_FIELDS", "NAMING"],
};

// Map scope → available modes
const SCOPE_MODES: Record<RuleScope, RuleMode[]> = {
  runtime: ["WRITE", "READ", "READWRITE", "UPGRADE", "DOWNGRADE", "UPDOWN"],
  control_plane: ["REGISTER"],
  declarative: ["REGISTER", "WRITE", "READ", "READWRITE"],
  audit: ["REGISTER"],
};

const EVAL_SOURCE_OPTIONS: { value: EvaluationSource; label: string }[] = [
  { value: "provider_config", label: "Provider Config" },
  { value: "schema_content", label: "Schema Content" },
  { value: "enrichment_metadata", label: "Enrichment Metadata" },
  { value: "declared_only", label: "Declared Only" },
  { value: "not_evaluable", label: "Not Evaluable" },
];

export function RuleEditor({ registryId, rule, subject, onClose, onSaved }: RuleEditorProps) {
  const isEdit = !!rule;

  // Form state
  const [ruleName, setRuleName] = useState(rule?.rule_name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [ruleScope, setRuleScope] = useState<RuleScope>(rule?.rule_scope ?? "declarative");
  const [category, setCategory] = useState<RuleCategory>(rule?.rule_category ?? "custom");
  const [ruleKind, setRuleKind] = useState<RuleKind>(rule?.rule_kind ?? "POLICY");
  const [ruleType, setRuleType] = useState(rule?.rule_type ?? "CUSTOM");
  const [ruleMode, setRuleMode] = useState<RuleMode>(rule?.rule_mode ?? "REGISTER");
  const [expression, setExpression] = useState(rule?.expression ?? "");
  const [severity, setSeverity] = useState<RuleSeverity>(rule?.severity ?? "warning");
  const [enforcement, setEnforcement] = useState<EnforcementStatus>(rule?.enforcement_status ?? "declared");
  const [evalSource, setEvalSource] = useState<EvaluationSource>(rule?.evaluation_source ?? "declared_only");
  const [onSuccess, setOnSuccess] = useState(rule?.on_success ?? "");
  const [onFailure, setOnFailure] = useState(rule?.on_failure ?? "");
  const [subjectVal, setSubjectVal] = useState(rule?.subject ?? subject ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When scope changes, update defaults
  useEffect(() => {
    if (!isEdit) {
      setRuleKind(SCOPE_DEFAULT_KIND[ruleScope]);
      setRuleType(SCOPE_RULE_TYPES[ruleScope][0]);
      setRuleMode(SCOPE_MODES[ruleScope][0]);
      // Auto evaluation source
      if (ruleScope === "runtime" || ruleScope === "control_plane") {
        setEvalSource("provider_config");
      } else if (ruleScope === "audit") {
        setEvalSource("schema_content");
      } else {
        setEvalSource("declared_only");
      }
    }
  }, [ruleScope, isEdit]);

  const showExpression = ruleScope === "runtime" || ruleScope === "audit";
  const showOnSuccessFailure = ruleScope === "runtime" && ruleKind === "TRANSFORM";

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      let result: GovernanceRule;

      if (isEdit && rule) {
        const data: GovernanceRuleUpdate = {
          description: description || null,
          rule_scope: ruleScope,
          rule_category: category,
          rule_kind: ruleKind,
          rule_type: ruleType,
          rule_mode: ruleMode,
          expression: expression || null,
          severity,
          enforcement_status: enforcement,
          evaluation_source: evalSource,
          on_success: onSuccess || null,
          on_failure: onFailure || null,
        };
        result = await updateRule(registryId, rule.id, data);
      } else {
        const data: GovernanceRuleCreate = {
          subject: subjectVal || null,
          rule_name: ruleName,
          description: description || null,
          rule_scope: ruleScope,
          rule_category: category,
          rule_kind: ruleKind,
          rule_type: ruleType,
          rule_mode: ruleMode,
          expression: expression || null,
          severity,
          enforcement_status: enforcement,
          evaluation_source: evalSource,
          on_success: onSuccess || null,
          on_failure: onFailure || null,
        };
        result = await createRule(registryId, data);
      }

      onSaved(result);
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-[480px] bg-card border-l border-border h-full flex flex-col animate-in slide-in-from-right-2">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">
              {isEdit ? "Edit Rule" : "New Rule / Policy"}
            </h2>
            {isEdit && (
              <p className="text-xs text-muted-foreground truncate max-w-[350px]">
                {rule?.rule_name}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Scope selector — drives the whole form */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Scope</label>
            <div className="grid grid-cols-2 gap-2">
              {SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRuleScope(opt.value)}
                  className={cn(
                    "px-3 py-2 rounded-md text-xs font-medium border transition-all text-left",
                    ruleScope === opt.value
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-border bg-background text-muted-foreground hover:border-zinc-600"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <ScopeBadge scope={opt.value} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Rule name (create only) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rule Name</label>
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. require-customer-id"
                className="h-9 text-sm"
              />
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Subject <span className="text-zinc-600">(empty = global rule)</span>
            </label>
            <Input
              value={subjectVal}
              onChange={(e) => setSubjectVal(e.target.value)}
              placeholder="com.event7.orders.OrderPlaced-value"
              className="h-9 text-sm"
              disabled={isEdit}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={ruleScope === "declarative"
                ? "Describe this governance standard..."
                : "What does this rule check or transform?"
              }
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RuleCategory)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Rule Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Rule Type</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {SCOPE_RULE_TYPES[ruleScope].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Expression (runtime & audit only) */}
          {showExpression && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Expression</label>
              <textarea
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder={ruleScope === "runtime"
                  ? "has(value.customer_id)"
                  : "^com\\.[a-z]+\\.[A-Z].*-value$"
                }
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          )}

          {/* Control plane: expression as dropdown for COMPATIBILITY */}
          {ruleScope === "control_plane" && ruleType === "COMPATIBILITY" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Compatibility Level</label>
              <select
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {["BACKWARD", "BACKWARD_TRANSITIVE", "FORWARD", "FORWARD_TRANSITIVE", "FULL", "FULL_TRANSITIVE", "NONE"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {/* Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mode</label>
            <select
              value={ruleMode}
              onChange={(e) => setRuleMode(e.target.value as RuleMode)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {SCOPE_MODES[ruleScope].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* On Success / On Failure (runtime TRANSFORM only) */}
          {showOnSuccessFailure && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">On Success</label>
                <select
                  value={onSuccess}
                  onChange={(e) => setOnSuccess(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">None</option>
                  <option value="NONE">NONE</option>
                  <option value="ENCRYPT">ENCRYPT</option>
                  <option value="DECRYPT">DECRYPT</option>
                  <option value="DLQ">DLQ</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">On Failure</label>
                <select
                  value={onFailure}
                  onChange={(e) => setOnFailure(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">None</option>
                  <option value="NONE">NONE</option>
                  <option value="ERROR">ERROR</option>
                  <option value="DLQ">DLQ</option>
                </select>
              </div>
            </div>
          )}

          {/* Severity */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Severity</label>
            <div className="flex gap-2">
              {SEVERITY_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-xs font-medium border transition-all",
                    severity === s
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-border text-muted-foreground hover:border-zinc-600"
                  )}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Enforcement Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Enforcement Status</label>
            <div className="flex gap-2">
              {ENFORCEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEnforcement(opt.value)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-xs font-medium border transition-all",
                    enforcement === opt.value
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-border text-muted-foreground hover:border-zinc-600"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Evaluation Source (declarative & audit) */}
          {(ruleScope === "declarative" || ruleScope === "audit") && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Evaluation Source</label>
              <select
                value={evalSource}
                onChange={(e) => setEvalSource(e.target.value as EvaluationSource)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {EVAL_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Scope hint */}
          <div className="rounded-md bg-zinc-900/50 border border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
            {ruleScope === "runtime" && "This rule will be executed by the serializer/deserializer client. It can be synced to Confluent Schema Registry."}
            {ruleScope === "control_plane" && "This rule controls what is allowed when registering a schema. It can be synced to Confluent or Apicurio."}
            {ruleScope === "declarative" && "This is an organizational standard. It is not automatically enforced but contributes to governance scoring."}
            {ruleScope === "audit" && "This rule will be checked a posteriori for scoring. It is not enforced at runtime."}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (!isEdit && !ruleName)}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</>
            ) : (
              <><Save size={14} className="mr-1" /> {isEdit ? "Update" : "Create"}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}