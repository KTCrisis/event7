// src/app/(dashboard)/rules/page.tsx
// Governance Rules & Policies — main page
// v2: Added Templates tab with TemplateManager component
// Placement: frontend/src/app/(dashboard)/rules/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Shield, Plus, Search, Loader2, AlertCircle,
  DatabaseZap, RefreshCw, Layers, Zap, ClipboardList,
  ChevronDown, Trash2, Edit3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useRegistry } from "@/providers/registry-provider";
import { listRules, deleteRule, listTemplates, applyTemplate } from "@/lib/api/rules";
import { RuleEditor } from "@/components/rules/rule-editor";
import { TemplateManager } from "@/components/rules/template-manager";
import {
  ScopeBadge, EnforcementBadge, SeverityBadge,
  KindBadge, SourceBadge,
} from "@/components/rules/rule-badges";
import type {
  GovernanceRule,
  GovernanceRuleListResponse,
  GovernanceTemplate,
  RuleScope,
  EnforcementStatus,
  RuleSeverity,
} from "@/types/governance-rules";

type FilterScope = RuleScope | "all";
type FilterKind = "all" | "rules" | "policies";
type FilterEnforcement = EnforcementStatus | "all";
type FilterSeverity = RuleSeverity | "all";
type PageTab = "rules" | "templates";

export default function RulesPage() {
  const { selected: registry } = useRegistry();

  // Tab
  const [tab, setTab] = useState<PageTab>("rules");

  // Data
  const [data, setData] = useState<GovernanceRuleListResponse | null>(null);
  const [templates, setTemplates] = useState<GovernanceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<FilterScope>("all");
  const [kindFilter, setKindFilter] = useState<FilterKind>("all");
  const [enforcementFilter, setEnforcementFilter] = useState<FilterEnforcement>("all");
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>("all");

  // Editor
  const [editing, setEditing] = useState<GovernanceRule | null | undefined>(undefined);

  // Template applying
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  // Fetch data
  const loadData = useCallback(async () => {
    if (!registry) return;
    setLoading(true);
    setError(null);
    try {
      const [rulesData, templatesData] = await Promise.all([
        listRules(registry.id),
        listTemplates(),
      ]);
      setData(rulesData);
      setTemplates(templatesData);
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [registry]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered rules
  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.rules;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.rule_name.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          (r.subject || "").toLowerCase().includes(q)
      );
    }

    if (scopeFilter !== "all") {
      result = result.filter((r) => r.rule_scope === scopeFilter);
    }

    if (kindFilter === "rules") {
      result = result.filter((r) => r.rule_kind !== "POLICY");
    } else if (kindFilter === "policies") {
      result = result.filter((r) => r.rule_kind === "POLICY");
    }

    if (enforcementFilter !== "all") {
      result = result.filter((r) => r.enforcement_status === enforcementFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((r) => r.severity === severityFilter);
    }

    return result;
  }, [data, search, scopeFilter, kindFilter, enforcementFilter, severityFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!data) return null;
    return {
      total: data.total,
      rules: data.total - (data.by_kind?.POLICY ?? 0),
      policies: data.by_kind?.POLICY ?? 0,
      expected: data.by_enforcement?.expected ?? 0,
      synced: data.by_enforcement?.synced ?? 0,
      drifted: data.by_enforcement?.drifted ?? 0,
    };
  }, [data]);

  // Handlers
  const handleDelete = async (rule: GovernanceRule) => {
    if (!registry) return;
    if (!confirm(`Delete "${rule.rule_name}"?`)) return;
    try {
      await deleteRule(registry.id, rule.id);
      loadData();
    } catch (err: any) {
      alert(err?.detail || "Failed to delete rule");
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (!registry) return;
    setApplyingTemplate(templateId);
    try {
      const result = await applyTemplate(registry.id, templateId, {
        registry_id: registry.id,
        subject: null,
        overwrite: false,
      });
      alert(
        `Template applied: ${result.rules_created} created, ${result.rules_skipped} skipped`
      );
      loadData();
    } catch (err: any) {
      alert(err?.detail || "Failed to apply template");
    } finally {
      setApplyingTemplate(null);
    }
  };

  const handleSaved = () => {
    setEditing(undefined);
    loadData();
  };

  // --- No registry ---
  if (!registry) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <DatabaseZap size={40} className="text-muted-foreground/40" />
        <p className="text-sm">Select a registry to manage governance rules</p>
      </div>
    );
  }

  // --- Loading ---
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">Loading rules…</span>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive gap-2">
        <AlertCircle size={24} />
        <p className="text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield size={18} className="text-cyan-400" />
            Governance Rules
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rules, policies, and templates for {registry.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab toggle */}
          <div className="flex gap-0.5 bg-zinc-800/50 rounded-md p-0.5">
            <button
              onClick={() => setTab("rules")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded transition-colors",
                tab === "rules"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-300"
              )}
            >
              Rules
              {stats && (
                <span className="ml-1 text-[10px] text-zinc-500">{stats.total}</span>
              )}
            </button>
            <button
              onClick={() => setTab("templates")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded transition-colors",
                tab === "templates"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-300"
              )}
            >
              Templates
              <span className="ml-1 text-[10px] text-zinc-500">{templates.length}</span>
            </button>
          </div>

          {tab === "rules" && (
            <>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw size={14} className={cn("mr-1", loading && "animate-spin")} />
                Refresh
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Layers size={14} className="mr-1" />
                    Apply Template
                    <ChevronDown size={12} className="ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {templates.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => handleApplyTemplate(t.id)}
                      disabled={applyingTemplate === t.id}
                    >
                      <div>
                        <div className="text-sm">{t.display_name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {t.rules.length} rules{t.layer ? ` · ${t.layer} layer` : ""}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {templates.length === 0 && (
                    <DropdownMenuItem disabled>No templates available</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" onClick={() => setEditing(null)} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                <Plus size={14} className="mr-1" />
                New Rule
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* Templates tab */}
      {/* ════════════════════════════════════════════════════════ */}
      {tab === "templates" && (
        <TemplateManager
          registryId={registry?.id ?? null}
          onApplied={loadData}
        />
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* Rules tab */}
      {/* ════════════════════════════════════════════════════════ */}
      {tab === "rules" && (
        <>
          {/* Stats KPIs */}
          {stats && (
            <div className="grid grid-cols-6 gap-3">
              <MiniKpi label="Total" value={stats.total} icon={<Shield size={16} className="text-cyan-400" />} />
              <MiniKpi label="Rules" value={stats.rules} icon={<Zap size={16} className="text-cyan-400" />} />
              <MiniKpi label="Policies" value={stats.policies} icon={<ClipboardList size={16} className="text-zinc-400" />} />
              <MiniKpi label="Expected" value={stats.expected} icon={<span className="text-yellow-400 text-sm">⚠</span>} />
              <MiniKpi label="Synced" value={stats.synced} icon={<span className="text-green-400 text-sm">✓</span>} />
              <MiniKpi label="Drifted" value={stats.drifted} icon={<span className="text-red-400 text-sm">✗</span>} />
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rules..."
                className="pl-9 h-8 text-sm"
              />
            </div>

            {/* Kind filter */}
            <div className="flex gap-1">
              {(["all", "rules", "policies"] as FilterKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium border transition-all",
                    kindFilter === k
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-border text-muted-foreground hover:border-zinc-600"
                  )}
                >
                  {k === "all" ? "All" : k === "rules" ? "Rules" : "Policies"}
                </button>
              ))}
            </div>

            {/* Scope filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-2.5 py-1 rounded text-[11px] font-medium border border-border text-muted-foreground hover:border-zinc-600 flex items-center gap-1">
                  Scope{scopeFilter !== "all" && `: ${scopeFilter}`}
                  <ChevronDown size={10} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setScopeFilter("all")}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScopeFilter("runtime")}>Runtime</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScopeFilter("control_plane")}>Control Plane</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScopeFilter("declarative")}>Declarative</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScopeFilter("audit")}>Audit</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Severity filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-2.5 py-1 rounded text-[11px] font-medium border border-border text-muted-foreground hover:border-zinc-600 flex items-center gap-1">
                  Severity{severityFilter !== "all" && `: ${severityFilter}`}
                  <ChevronDown size={10} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSeverityFilter("all")}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSeverityFilter("critical")}>Critical</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSeverityFilter("error")}>Error</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSeverityFilter("warning")}>Warning</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSeverityFilter("info")}>Info</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Enforcement filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-2.5 py-1 rounded text-[11px] font-medium border border-border text-muted-foreground hover:border-zinc-600 flex items-center gap-1">
                  Status{enforcementFilter !== "all" && `: ${enforcementFilter}`}
                  <ChevronDown size={10} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setEnforcementFilter("all")}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnforcementFilter("declared")}>Declared</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnforcementFilter("expected")}>Expected</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnforcementFilter("synced")}>Synced</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnforcementFilter("verified")}>Verified</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEnforcementFilter("drifted")}>Drifted</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-[11px] text-muted-foreground ml-auto">
              {filtered.length} of {data?.total ?? 0}
            </span>
          </div>

          {/* Rules list */}
          <Card className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                {data?.total === 0
                  ? "No governance rules yet. Create one or apply a template."
                  : "No rules match the current filters."
                }
              </div>
            ) : (
              filtered.map((rule) => (
                <div
                  key={rule.id}
                  className="px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: name + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {rule.rule_name}
                        </span>
                        <KindBadge kind={rule.rule_kind} />
                        <ScopeBadge scope={rule.rule_scope} />
                        <SeverityBadge severity={rule.severity} />
                        <EnforcementBadge status={rule.enforcement_status} />
                        <SourceBadge source={rule.source} />
                      </div>

                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {rule.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-600">
                        {rule.subject ? (
                          <span className="truncate max-w-xs" title={rule.subject}>
                            {rule.subject}
                          </span>
                        ) : (
                          <span className="text-violet-400">Global (registry)</span>
                        )}
                        {rule.expression && (
                          <span className="font-mono truncate max-w-xs text-zinc-500" title={rule.expression}>
                            {rule.expression}
                          </span>
                        )}
                        <span>{rule.rule_type}</span>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => setEditing(rule)}
                        className="p-1.5 rounded hover:bg-muted"
                        title="Edit"
                      >
                        <Edit3 size={13} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="p-1.5 rounded hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* Editor drawer */}
          {editing !== undefined && (
            <RuleEditor
              registryId={registry.id}
              rule={editing}
              onClose={() => setEditing(undefined)}
              onSaved={handleSaved}
            />
          )}
        </>
      )}
    </div>
  );
}

// --- Mini KPI card ---
function MiniKpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="px-3 py-2.5 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-lg font-bold leading-tight">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}