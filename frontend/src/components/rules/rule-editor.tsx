// src/components/rules/rule-editor.tsx
// Drawer for creating/editing governance rules & policies
// Form adapts based on rule_scope — hides irrelevant fields
"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createRule, updateRule } from "@/lib/api/rules";
import { ScopeBadge } from "./rule-badges";
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
  rule?: GovernanceRule | null;
  subject?: string | null;
  onClose: () => void;
  onSaved: (rule: GovernanceRule) => void;
}

// === Scope options ===

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
  { value: "declared", label: "Declared — documented only" },
  { value: "expected", label: "Expected — required, affects score" },
];

// === Scope-driven defaults ===

const SCOPE_DEFAULT_KIND: Record<RuleScope, RuleKind> = {
  runtime: "CONDITION",
  control_plane: "VALIDATION",
  declarative: "POLICY",
  audit: "POLICY",
};

const SCOPE_RULE_TYPES: Record<RuleScope, string[]> = {
  runtime: ["CEL", "CEL_FIELD", "JSONATA", "ENCRYPT", "DECRYPT", "SS_TYPE"],
  control_plane: ["COMPATIBILITY", "VALIDITY", "INTEGRITY", "BREAKING_CHECK", "LINT"],
  declarative: ["CUSTOM"],
  audit: ["CUSTOM", "REGEX", "REQUIRED_FIELDS", "NAMING"],
};

const SCOPE_MODES: Record<RuleScope, RuleMode[]> = {
  runtime: ["WRITE", "READ", "READWRITE", "UPGRADE", "DOWNGRADE", "UPDOWN"],
  control_plane: ["REGISTER"],
  declarative: ["REGISTER"],
  audit: ["REGISTER"],
};

const EVAL_SOURCE_OPTIONS: { value: EvaluationSource; label: string }[] = [
  { value: "provider_config", label: "Provider Config — verifiable via API" },
  { value: "schema_content", label: "Schema Content — verifiable by inspecting schema" },
  { value: "enrichment_metadata", label: "Enrichment Metadata — verifiable via event7 enrichments" },
  { value: "declared_only", label: "Declared Only — taken on trust" },
  { value: "not_evaluable", label: "Not Evaluable — informational" },
];

// === Concrete placeholder examples per scope ===

const NAME_PLACEHOLDERS: Record<RuleScope, string> = {
  runtime: "encrypt-pii-fields",
  control_plane: "enforce-backward-compat",
  declarative: "require-owner-team",
  audit: "naming-convention-check",
};

const DESCRIPTION_PLACEHOLDERS: Record<RuleScope, string> = {
  runtime: "Encrypt all fields tagged PII using CSFLE before producing to Kafka",
  control_plane: "Enforce BACKWARD_TRANSITIVE compatibility to protect all downstream consumers",
  declarative: "Every schema in this registry must have an owner_team defined in enrichments",
  audit: "Subject names must follow the convention com.{domain}.{entity}-value",
};

const EXPRESSION_PLACEHOLDERS: Record<RuleScope, string> = {
  runtime: "has(value.customer_id) && has(value.timestamp)",
  control_plane: "",
  declarative: "",
  audit: "^com\\.[a-z]+\\.[a-z]+\\.[A-Z][a-zA-Z]+-value$",
};

// === What to show per scope ===

interface ScopeVisibility {
  ruleType: boolean;
  mode: boolean;
  expression: boolean;
  compatDropdown: boolean;
  onSuccessFailure: boolean;
  evalSource: boolean;
}

const SCOPE_VISIBILITY: Record<RuleScope, ScopeVisibility> = {
  runtime: {
    ruleType: true,
    mode: true,
    expression: true,
    compatDropdown: false,
    onSuccessFailure: true,
    evalSource: false,
  },
  control_plane: {
    ruleType: true,
    mode: false,
    expression: false,
    compatDropdown: true,
    onSuccessFailure: false,
    evalSource: false,
  },
  declarative: {
    ruleType: false,
    mode: false,
    expression: false,
    compatDropdown: false,
    onSuccessFailure: false,
    evalSource: true,
  },
  audit: {
    ruleType: true,
    mode: false,
    expression: true,
    compatDropdown: false,
    onSuccessFailure: false,
    evalSource: true,
  },
};

// === Component ===

export function RuleEditor({ registryId, rule, subject, onClose, onSaved }: RuleEditorProps) {
  const isEdit = !!rule;

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

  // When scope changes, update all auto-defaults
  useEffect(() => {
    if (!isEdit) {
      setRuleKind(SCOPE_DEFAULT_KIND[ruleScope]);
      setRuleType(SCOPE_RULE_TYPES[ruleScope][0]);
      setRuleMode(SCOPE_MODES[ruleScope][0]);
      setExpression("");

      if (ruleScope === "runtime" || ruleScope === "control_plane") {
        setEvalSource("provider_config");
      } else if (ruleScope === "audit") {
        setEvalSource("schema_content");
      } else {
        setEvalSource("declared_only");
      }
    }
  }, [ruleScope, isEdit]);

  const vis = SCOPE_VISIBILITY[ruleScope];
  const showOnSuccessFailure = vis.onSuccessFailure && ruleKind === "TRANSFORM";

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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

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

          {/* SCOPE */}
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

          {/* RULE NAME */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rule Name</label>
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder={NAME_PLACEHOLDERS[ruleScope]}
                className="h-9 text-sm"
              />
            </div>
          )}

          {/* SUBJECT */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Subject <span className="text-zinc-600">(empty = applies to all schemas)</span>
            </label>
            <Input
              value={subjectVal}
              onChange={(e) => setSubjectVal(e.target.value)}
              placeholder="com.event7.orders.OrderPlaced-value"
              className="h-9 text-sm"
              disabled={isEdit}
            />
          </div>

          {/* DESCRIPTION */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Description
              {ruleScope === "declarative" && <span className="text-cyan-400/60 ml-1">— this is the main content for policies</span>}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={DESCRIPTION_PLACEHOLDERS[ruleScope]}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* CATEGORY */}
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

          {/* RULE TYPE — runtime + control_plane + audit only */}
          {vis.ruleType && (
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
          )}

          {/* EXPRESSION — runtime + audit */}
          {vis.expression && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Expression
                {ruleScope === "audit" && <span className="text-zinc-600 ml-1">(optional)</span>}
              </label>
              <textarea
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder={EXPRESSION_PLACEHOLDERS[ruleScope]}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          )}

          {/* COMPATIBILITY DROPDOWN — control_plane only */}
          {vis.compatDropdown && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Compatibility Level</label>
              <select
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Select a level…</option>
                {["BACKWARD", "BACKWARD_TRANSITIVE", "FORWARD", "FORWARD_TRANSITIVE", "FULL", "FULL_TRANSITIVE", "NONE"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-600">
                Controls what schema changes are allowed when registering a new version.
              </p>
            </div>
          )}

          {/* MODE — runtime only */}
          {vis.mode && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mode</label>
              <select
                value={ruleMode}
                onChange={(e) => setRuleMode(e.target.value as RuleMode)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {SCOPE_MODES[ruleScope].map((m) => (
                  <option key={m} value={m}>
                    {m === "WRITE" && "WRITE — at produce (serialization)"}
                    {m === "READ" && "READ — at consume (deserialization)"}
                    {m === "READWRITE" && "READWRITE — both directions"}
                    {m === "UPGRADE" && "UPGRADE — migration to newer version"}
                    {m === "DOWNGRADE" && "DOWNGRADE — migration to older version"}
                    {m === "UPDOWN" && "UPDOWN — migration both directions"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ON SUCCESS / ON FAILURE — runtime TRANSFORM only */}
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
                  <option value="NONE">NONE — continue</option>
                  <option value="ENCRYPT">ENCRYPT — encrypt the field</option>
                  <option value="DECRYPT">DECRYPT — decrypt the field</option>
                  <option value="DLQ">DLQ — send to dead letter queue</option>
                  <option value="ERROR">ERROR — reject the message</option>
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
                  <option value="NONE">NONE — ignore</option>
                  <option value="ERROR">ERROR — reject the message</option>
                  <option value="DLQ">DLQ — send to dead letter queue</option>
                </select>
              </div>
            </div>
          )}

          {/* SEVERITY */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">How important is this rule?</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "info" as RuleSeverity, label: "Info", hint: "No penalty if not met", color: "zinc" },
                { value: "warning" as RuleSeverity, label: "Warning", hint: "Moderate impact on score", color: "yellow" },
                { value: "error" as RuleSeverity, label: "Error", hint: "Significant impact on score", color: "orange" },
                { value: "critical" as RuleSeverity, label: "Critical", hint: "Blocks compliance — major impact", color: "red" },
              ]).map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  className={cn(
                    "px-3 py-2 rounded-md text-xs border transition-all text-left",
                    severity === s.value
                      ? `border-${s.color}-500/50 bg-${s.color}-500/10 text-${s.color}-400`
                      : "border-border bg-background text-muted-foreground hover:border-zinc-600"
                  )}
                >
                  <div className="font-medium mb-0.5">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ENFORCEMENT */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Is this rule required?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEnforcement("declared")}
                className={cn(
                  "px-3 py-2 rounded-md text-xs border transition-all text-left",
                  enforcement === "declared"
                    ? "border-zinc-500/50 bg-zinc-500/10 text-zinc-400"
                    : "border-border bg-background text-muted-foreground hover:border-zinc-600"
                )}
              >
                <div className="font-medium mb-0.5">Declared</div>
                <div className="text-[10px] text-muted-foreground">Documented for reference — no effect on score</div>
              </button>
              <button
                onClick={() => setEnforcement("expected")}
                className={cn(
                  "px-3 py-2 rounded-md text-xs border transition-all text-left",
                  enforcement === "expected"
                    ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                    : "border-border bg-background text-muted-foreground hover:border-zinc-600"
                )}
              >
                <div className="font-medium mb-0.5">Expected</div>
                <div className="text-[10px] text-muted-foreground">Required by governance — impacts the score</div>
              </button>
            </div>
          </div>

          {/* EVALUATION SOURCE — declarative + audit only */}
          {vis.evalSource && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">How can this be verified?</label>
              <div className="grid grid-cols-1 gap-1.5">
                {([
                  { value: "enrichment_metadata" as EvaluationSource, label: "Check enrichments", hint: "event7 can verify via owner, tags, description, classification" },
                  { value: "schema_content" as EvaluationSource, label: "Inspect schema", hint: "event7 can check field names, doc attributes, references" },
                  { value: "provider_config" as EvaluationSource, label: "Query provider API", hint: "event7 can read the setting from the registry directly" },
                  { value: "declared_only" as EvaluationSource, label: "Trust — no auto-check", hint: "This is a convention taken on trust, not verifiable" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEvalSource(opt.value)}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2 rounded-md text-xs border transition-all text-left w-full",
                      evalSource === opt.value
                        ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                        : "border-border bg-background text-muted-foreground hover:border-zinc-600"
                    )}
                  >
                    <div className={cn(
                      "w-3 h-3 rounded-full border-2 mt-0.5 shrink-0",
                      evalSource === opt.value
                        ? "border-cyan-400 bg-cyan-400"
                        : "border-zinc-600 bg-transparent"
                    )} />
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SCOPE HINT */}
          <div className="rounded-md bg-zinc-900/50 border border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
            {ruleScope === "runtime" && (
              <><strong className="text-zinc-400">Runtime rule.</strong> Executed by the Kafka serializer/deserializer. Can be synced to Confluent ruleSet.</>
            )}
            {ruleScope === "control_plane" && (
              <><strong className="text-zinc-400">Control plane rule.</strong> Controls schema registration. Can be synced to Confluent or Apicurio.</>
            )}
            {ruleScope === "declarative" && (
              <><strong className="text-zinc-400">Organizational policy.</strong> Not enforced automatically — contributes to governance score when marked Expected.</>
            )}
            {ruleScope === "audit" && (
              <><strong className="text-zinc-400">Audit check.</strong> Evaluated against schema content or enrichments for scoring. Add a regex or description.</>
            )}
          </div>

          {/* ERROR */}
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