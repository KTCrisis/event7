// src/components/rules/template-manager.tsx
// Self-contained template management panel.
// Shows builtin + custom templates with CRUD actions.
// Drop into the Rules page as a tab content.
// Placement: frontend/src/components/rules/template-manager.tsx

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Layers, Plus, Copy, Pencil, Trash2, Lock, ChevronDown, ChevronRight,
  Loader2, AlertCircle, Shield, Zap, ClipboardList, Search as SearchIcon,
  ShieldCheck, X, Save, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  applyTemplate,
} from "@/lib/api/rules";
import { SeverityBadge, ScopeBadge, KindBadge } from "@/components/rules/rule-badges";
import type {
  GovernanceTemplate,
  GovernanceTemplateRule,
  GovernanceTemplateCreate,
  GovernanceTemplateUpdate,
  GovernanceTemplateClone,
  RuleScope,
  RuleCategory,
  RuleKind,
  RuleMode,
  RuleSeverity,
  EvaluationSource,
  EnforcementStatus,
} from "@/types/governance-rules";
import { toast } from "sonner";

// ════════════════════════════════════════════════════════════════════
// Props
// ════════════════════════════════════════════════════════════════════

interface TemplateManagerProps {
  registryId: string | null;
  onApplied?: () => void;
}

// ════════════════════════════════════════════════════════════════════
// Layer colors — with dynamic fallback for custom layers
// ════════════════════════════════════════════════════════════════════

const LAYER_COLORS: Record<string, string> = {
  raw: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  core: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  refined: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  application: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

const CUSTOM_LAYER_COLOR = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

function getLayerColor(layer: string | null | undefined): string {
  if (!layer) return "bg-zinc-800 text-zinc-400 border-zinc-700";
  return LAYER_COLORS[layer.toLowerCase()] || CUSTOM_LAYER_COLOR;
}

// ════════════════════════════════════════════════════════════════════
// Default layer suggestions (Medallion)
// ════════════════════════════════════════════════════════════════════

const DEFAULT_LAYERS = [
  { value: "raw", label: "RAW", hint: "Collection layer — raw data" },
  { value: "core", label: "CORE", hint: "Canonical business model" },
  { value: "refined", label: "REFINED", hint: "Aggregated / enriched data" },
  { value: "application", label: "APPLICATION", hint: "Consumption views" },
];

// ════════════════════════════════════════════════════════════════════
// LayerInput — combobox with suggestions + free-text input
// ════════════════════════════════════════════════════════════════════

function LayerInput({
  value,
  onChange,
  disabled = false,
  existingLayers = [],
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  existingLayers?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build suggestions: defaults + custom layers from existing templates
  const customLayers = existingLayers
    .filter((l) => l && !DEFAULT_LAYERS.some((d) => d.value === l.toLowerCase()))
    .map((l) => l.toLowerCase())
    .filter((v, i, arr) => arr.indexOf(v) === i); // dedupe

  const allSuggestions = [
    ...DEFAULT_LAYERS,
    ...customLayers.map((l) => ({
      value: l,
      label: l.toUpperCase(),
      hint: "Custom",
    })),
  ];

  // Filter suggestions by search
  const filtered = allSuggestions.filter(
    (s) =>
      s.label.toLowerCase().includes((search || value).toLowerCase()) ||
      s.hint.toLowerCase().includes((search || value).toLowerCase())
  );

  // Is the current input a new custom value?
  const inputVal = search !== "" ? search : value;
  const isNewCustom =
    inputVal.trim() !== "" &&
    !allSuggestions.some((s) => s.value === inputVal.trim().toLowerCase());

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (val: string) => {
    onChange(val);
    setSearch("");
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!open) setOpen(true);
  };

  const handleFocus = () => {
    if (!disabled) setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
    if (e.key === "Enter" && inputVal.trim()) {
      e.preventDefault();
      select(inputVal.trim().toLowerCase());
    }
  };

  const displayValue = value ? value.toUpperCase() : "";

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={open ? search : displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Type or select a layer…"
        disabled={disabled}
        className="text-sm pr-8"
      />
      {/* Clear button */}
      {value && !disabled && (
        <button
          type="button"
          onClick={() => { onChange(""); setSearch(""); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X size={12} />
        </button>
      )}

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {/* No layer option */}
          <button
            type="button"
            onClick={() => select("")}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-left",
              !value && "bg-accent/30"
            )}
          >
            <span className="text-muted-foreground italic">No layer</span>
          </button>

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Suggestions */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((s) => {
              const layerColor = getLayerColor(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => select(s.value)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-left",
                    value === s.value && "bg-accent/30"
                  )}
                >
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 shrink-0", layerColor)}
                  >
                    {s.label}
                  </Badge>
                  <span className="text-muted-foreground truncate">{s.hint}</span>
                  {value === s.value && (
                    <Check size={12} className="ml-auto text-cyan-400 shrink-0" />
                  )}
                </button>
              );
            })}

            {/* Create new custom layer */}
            {isNewCustom && (
              <>
                <div className="border-t border-border/50" />
                <button
                  type="button"
                  onClick={() => select(inputVal.trim().toLowerCase())}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-left"
                >
                  <Plus size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-medium">
                    Create "{inputVal.trim().toUpperCase()}"
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  >
                    Custom
                  </Badge>
                </button>
              </>
            )}

            {filtered.length === 0 && !isNewCustom && (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                No matching layers
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════

export function TemplateManager({ registryId, onApplied }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<GovernanceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  // Editor state
  const [editing, setEditing] = useState<GovernanceTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [cloning, setCloning] = useState<GovernanceTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Collect all existing layers for suggestions
  const existingLayers = templates
    .map((t) => t.layer)
    .filter((l): l is string => !!l);

  const handleDelete = async (t: GovernanceTemplate) => {
    if (t.is_builtin) return;
    if (!confirm(`Delete template "${t.display_name}"? This cannot be undone.`)) return;
    try {
      await deleteTemplate(t.id);
      load();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to delete template");
    }
  };

  const handleApply = async (t: GovernanceTemplate) => {
    if (!registryId) {
      toast.warning("Select a registry first");
      return;
    }
    setApplying(t.id);
    try {
      const result = await applyTemplate(registryId, t.id, {
        registry_id: registryId,
        subject: null,
        overwrite: false,
      });
      toast.success(`Template "${t.display_name}" applied: ${result.rules_created} created, ${result.rules_skipped} skipped, ${result.rules_updated} updated`);
      onApplied?.();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to apply template");
    } finally {
      setApplying(null);
    }
  };

  const handleSaved = () => {
    setEditing(null);
    setCreating(false);
    setCloning(null);
    load();
  };

  // Sort: builtin first, then custom by name
  const sorted = [...templates].sort((a, b) => {
    if (a.is_builtin !== b.is_builtin) return a.is_builtin ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });

  const builtinCount = templates.filter((t) => t.is_builtin).length;
  const customCount = templates.filter((t) => !t.is_builtin).length;

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={16} />
        <span className="text-sm">Loading templates…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive gap-2">
        <AlertCircle size={20} />
        <p className="text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }

  // Show editor
  if (creating) {
    return (
      <TemplateEditor
        existingLayers={existingLayers}
        onSave={handleSaved}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <TemplateEditor
        template={editing}
        existingLayers={existingLayers}
        onSave={handleSaved}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (cloning) {
    return (
      <TemplateCloneForm
        source={cloning}
        existingLayers={existingLayers}
        onSave={handleSaved}
        onCancel={() => setCloning(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {builtinCount} builtin · {customCount} custom
          </span>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} className="mr-1" />
          Create Template
        </Button>
      </div>

      {/* Template cards */}
      <div className="space-y-3">
        {sorted.map((t) => {
          const isExpanded = expanded === t.id;
          const layerColor = getLayerColor(t.layer);

          return (
            <Card key={t.id} className="overflow-hidden">
              {/* Template header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : t.id)}
              >
                {isExpanded ? (
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{t.display_name}</span>
                    {t.layer && (
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", layerColor)}>
                        {t.layer.toUpperCase()}
                      </Badge>
                    )}
                    {t.is_builtin ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-teal-500/10 text-teal-400 border-teal-500/20">
                        <Lock size={8} className="mr-0.5" />
                        Builtin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/20">
                        Custom
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {t.rules.length} rule{t.rules.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {t.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {registryId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleApply(t)}
                      disabled={applying === t.id}
                    >
                      {applying === t.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <>
                          <Layers size={12} className="mr-1" />
                          Apply
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setCloning(t)}
                    title="Clone template"
                  >
                    <Copy size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEditing(t)}
                    title={t.is_builtin ? "Edit rules & description" : "Edit template"}
                  >
                    <Pencil size={12} />
                  </Button>
                  {!t.is_builtin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(t)}
                      title="Delete template"
                    >
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded: rule list */}
              {isExpanded && (
                <div className="border-t px-4 py-3 space-y-2 bg-accent/5">
                  {t.rules.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No rules in this template</p>
                  ) : (
                    t.rules.map((rule, i) => (
                      <div
                        key={`${t.id}-${i}`}
                        className="flex items-start gap-3 py-2 px-3 rounded-md bg-background/50 border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium">{rule.rule_name}</span>
                            <SeverityBadge severity={rule.severity} />
                            <KindBadge kind={rule.rule_kind} />
                            <ScopeBadge scope={rule.rule_scope} />
                          </div>
                          {rule.description && (
                            <p className="text-[11px] text-muted-foreground">{rule.description}</p>
                          )}
                          {rule.expression && (
                            <code className="text-[10px] text-cyan-400/80 bg-cyan-500/5 px-1.5 py-0.5 rounded mt-1 inline-block">
                              {rule.expression}
                            </code>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {rule.default_enforcement}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Layers size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No templates yet</p>
          <Button size="sm" className="mt-3" onClick={() => setCreating(true)}>
            <Plus size={14} className="mr-1" />
            Create your first template
          </Button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Template Editor (create + edit)
// ════════════════════════════════════════════════════════════════════

function TemplateEditor({
  template,
  existingLayers = [],
  onSave,
  onCancel,
}: {
  template?: GovernanceTemplate;
  existingLayers?: string[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!template;
  const isBuiltin = template?.is_builtin ?? false;

  const [name, setName] = useState(template?.template_name || "");
  const [displayName, setDisplayName] = useState(template?.display_name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [layer, setLayer] = useState(template?.layer || "");
  const [rules, setRules] = useState<GovernanceTemplateRule[]>(template?.rules || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New rule form
  const [addingRule, setAddingRule] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isEdit && template) {
        const data: GovernanceTemplateUpdate = {};
        if (!isBuiltin) {
          if (displayName !== template.display_name) data.display_name = displayName;
          if (layer !== (template.layer || "")) data.layer = layer || null;
        }
        if (description !== (template.description || "")) data.description = description;
        data.rules = rules;
        await updateTemplate(template.id, data);
      } else {
        if (!name.trim() || !displayName.trim()) {
          setError("Name and display name are required");
          setSaving(false);
          return;
        }
        const data: GovernanceTemplateCreate = {
          template_name: name.trim().toLowerCase().replace(/\s+/g, "_"),
          display_name: displayName.trim(),
          description: description.trim() || undefined,
          layer: layer || undefined,
          rules,
        };
        await createTemplate(data);
      }
      onSave();
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const addRule = (rule: GovernanceTemplateRule) => {
    setRules((prev) => [...prev, rule]);
    setAddingRule(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {isEdit ? (isBuiltin ? "Edit Builtin Template" : "Edit Template") : "Create Template"}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X size={14} className="mr-1" /> Cancel
        </Button>
      </div>

      {isBuiltin && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          <Lock size={10} className="inline mr-1" />
          Builtin template — you can edit description and rules, but not the name or layer.
        </div>
      )}

      {/* Form fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            Template Name (slug)
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my_custom_template"
            disabled={isEdit}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            Display Name
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="My Custom Template"
            disabled={isBuiltin}
            className="text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description of what this template enforces"
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            Layer / Category (optional)
          </label>
          <LayerInput
            value={layer}
            onChange={setLayer}
            disabled={isBuiltin}
            existingLayers={existingLayers}
          />
        </div>
      </div>

      {/* Rules list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] text-muted-foreground font-medium">
            Rules ({rules.length})
          </label>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddingRule(true)}>
            <Plus size={12} className="mr-1" /> Add Rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            No rules yet — add rules to define this template
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 px-3 rounded-md border bg-background/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium">{rule.rule_name}</span>
                    <SeverityBadge severity={rule.severity} />
                    <KindBadge kind={rule.rule_kind} />
                  </div>
                  {rule.description && (
                    <p className="text-[10px] text-muted-foreground">{rule.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeRule(i)}
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add rule inline form */}
      {addingRule && (
        <AddRuleForm onAdd={addRule} onCancel={() => setAddingRule(false)} />
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
          {isEdit ? "Update" : "Create"}
        </Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Add Rule Form (inline within TemplateEditor)
// ════════════════════════════════════════════════════════════════════

function AddRuleForm({
  onAdd,
  onCancel,
}: {
  onAdd: (rule: GovernanceTemplateRule) => void;
  onCancel: () => void;
}) {
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [ruleScope, setRuleScope] = useState<RuleScope>("declarative");
  const [ruleCategory, setRuleCategory] = useState<RuleCategory>("custom");
  const [ruleKind, setRuleKind] = useState<RuleKind>("POLICY");
  const [ruleMode, setRuleMode] = useState<RuleMode>("REGISTER");
  const [severity, setSeverity] = useState<RuleSeverity>("warning");
  const [expression, setExpression] = useState("");
  const [evaluationSource, setEvaluationSource] = useState<EvaluationSource>("declared_only");
  const [defaultEnforcement, setDefaultEnforcement] = useState<EnforcementStatus>("expected");

  const handleAdd = () => {
    if (!ruleName.trim()) return;
    onAdd({
      rule_name: ruleName.trim().toLowerCase().replace(/\s+/g, "-"),
      rule_scope: ruleScope,
      rule_category: ruleCategory,
      rule_kind: ruleKind,
      rule_type: "CUSTOM",
      rule_mode: ruleMode,
      expression: expression.trim() || null,
      params: {},
      on_success: null,
      on_failure: null,
      severity,
      evaluation_source: evaluationSource,
      default_enforcement: defaultEnforcement,
      description: ruleDescription.trim() || null,
    });
  };

  return (
    <Card className="p-4 space-y-3 border-cyan-500/20 bg-cyan-500/5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-cyan-400">Add Rule to Template</span>
        <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={onCancel}>
          <X size={12} />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Rule Name</label>
          <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="my-rule-name" className="text-xs h-8" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Description</label>
          <Input value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} placeholder="What this rule checks" className="text-xs h-8" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Kind</label>
          <select value={ruleKind} onChange={(e) => setRuleKind(e.target.value as RuleKind)} className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
            <option value="POLICY">POLICY</option>
            <option value="VALIDATION">VALIDATION</option>
            <option value="CONDITION">CONDITION</option>
            <option value="TRANSFORM">TRANSFORM</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Scope</label>
          <select value={ruleScope} onChange={(e) => setRuleScope(e.target.value as RuleScope)} className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
            <option value="declarative">Declarative</option>
            <option value="audit">Audit</option>
            <option value="control_plane">Control Plane</option>
            <option value="runtime">Runtime</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as RuleSeverity)} className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Category</label>
          <select value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value as RuleCategory)} className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
            <option value="custom">Custom</option>
            <option value="data_quality">Data Quality</option>
            <option value="schema_validation">Schema Validation</option>
            <option value="data_transform">Data Transform</option>
            <option value="migration">Migration</option>
            <option value="access_control">Access Control</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Evaluation Source</label>
          <select value={evaluationSource} onChange={(e) => setEvaluationSource(e.target.value as EvaluationSource)} className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
            <option value="declared_only">Declared Only</option>
            <option value="provider_config">Provider Config</option>
            <option value="schema_content">Schema Content</option>
            <option value="enrichment_metadata">Enrichment Metadata</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Default Enforcement</label>
          <select value={defaultEnforcement} onChange={(e) => setDefaultEnforcement(e.target.value as EnforcementStatus)} className="w-full rounded-md border bg-background px-2 py-1.5 text-xs">
            <option value="declared">Declared</option>
            <option value="expected">Expected</option>
          </select>
        </div>
      </div>

      {(ruleKind === "CONDITION" || ruleKind === "TRANSFORM" || ruleKind === "VALIDATION") && (
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Expression (CEL / JSONATA)</label>
          <Input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder='e.g. FULL_TRANSITIVE or has(value.id)' className="text-xs h-8 font-mono" />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!ruleName.trim()}>
          <Check size={12} className="mr-1" /> Add Rule
        </Button>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════
// Clone Form
// ════════════════════════════════════════════════════════════════════

function TemplateCloneForm({
  source,
  existingLayers = [],
  onSave,
  onCancel,
}: {
  source: GovernanceTemplate;
  existingLayers?: string[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(`${source.template_name}_copy`);
  const [displayName, setDisplayName] = useState(`${source.display_name} (Copy)`);
  const [description, setDescription] = useState(source.description || "");
  const [layer, setLayer] = useState(source.layer || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClone = async () => {
    if (!name.trim() || !displayName.trim()) {
      setError("Name and display name are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data: GovernanceTemplateClone = {
        template_name: name.trim().toLowerCase().replace(/\s+/g, "_"),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        layer: layer || undefined,
      };
      await cloneTemplate(source.id, data);
      onSave();
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to clone template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Clone "{source.display_name}"
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X size={14} className="mr-1" /> Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Creates a new custom template with the same {source.rules.length} rules.
        You can rename it and change the layer.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            New Template Name (slug)
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            New Display Name
          </label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            Description
          </label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            Layer / Category
          </label>
          <LayerInput
            value={layer}
            onChange={setLayer}
            existingLayers={existingLayers}
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleClone} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Copy size={14} className="mr-1" />}
          Clone Template
        </Button>
      </div>
    </div>
  );
}