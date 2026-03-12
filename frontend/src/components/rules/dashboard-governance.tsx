// src/components/rules/dashboard-governance.tsx
// Unified governance section for the dashboard
// Merges: enrichment coverage bars + rules KPIs + score + scope chart + enforcement funnel
// Drop-in replacement: <DashboardGovernance registryId={selected.id} catalogStats={stats} />
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Shield, ArrowRight, Loader2, AlertTriangle,
  Zap, ClipboardList, Library,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { listRules, getGovernanceScore } from "@/lib/api/rules";
import { GovernanceScoreWidget } from "./governance-score";
import type {
  GovernanceRuleListResponse,
  GovernanceScore,
} from "@/types/governance-rules";

interface DashboardGovernanceProps {
  registryId: string;
  /** Pass from existing dashboard stats to avoid re-fetching */
  catalogStats?: {
    total: number;
    withDescription: number;
    withOwner: number;
    withTags: number;
  };
}

export function DashboardGovernance({ registryId, catalogStats }: DashboardGovernanceProps) {
  const [rules, setRules] = useState<GovernanceRuleListResponse | null>(null);
  const [score, setScore] = useState<GovernanceScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      listRules(registryId).catch(() => null),
      getGovernanceScore(registryId).catch(() => null),
    ]).then(([rulesData, scoreData]) => {
      if (cancelled) return;
      setRules(rulesData);
      setScore(scoreData);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [registryId]);

  const scopeData = useMemo(() => {
    if (!rules) return [];
    const colors: Record<string, string> = {
      runtime: "#22d3ee",
      control_plane: "#f59e0b",
      declarative: "#64748b",
      audit: "#a78bfa",
    };
    return Object.entries(rules.by_scope)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: name === "control_plane" ? "Control Plane" : name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: colors[name] || "#64748b",
      }));
  }, [rules]);

  const enforcement = useMemo(() => {
    if (!rules) return { declared: 0, expected: 0, synced: 0, verified: 0, drifted: 0 };
    return {
      declared: rules.by_enforcement?.declared ?? 0,
      expected: rules.by_enforcement?.expected ?? 0,
      synced: rules.by_enforcement?.synced ?? 0,
      verified: rules.by_enforcement?.verified ?? 0,
      drifted: rules.by_enforcement?.drifted ?? 0,
    };
  }, [rules]);

  const govTotal = catalogStats?.total || 1;
  const hasRules = rules && rules.total > 0;
  const hasCatalogStats = catalogStats && catalogStats.total > 0;

  if (loading) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 size={14} className="animate-spin" />
          Loading governance…
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* LEFT: Coverage + Score */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Shield size={12} className="text-cyan-400" />
            Governance
          </h3>
          <Link
            href="/rules"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors"
          >
            Manage Rules <ArrowRight size={10} />
          </Link>
        </div>

        {/* Registry score (compact) */}
        {score && (
          <GovernanceScoreWidget registryId={registryId} compact />
        )}

        {/* Enrichment coverage bars */}
        {hasCatalogStats && (
          <div className="space-y-2.5">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Enrichment Coverage</div>
            <GovBar label="Description" count={catalogStats.withDescription} total={govTotal} color="#22d3ee" />
            <GovBar label="Owner" count={catalogStats.withOwner} total={govTotal} color="#a78bfa" />
            <GovBar label="Tags" count={catalogStats.withTags} total={govTotal} color="#34d399" />
          </div>
        )}

        {/* Rules KPIs */}
        {hasRules && (
          <div className="grid grid-cols-4 gap-2">
            <MiniKpi
              label="Rules"
              value={rules.total - (rules.by_kind?.POLICY ?? 0)}
              icon={<Zap size={12} className="text-cyan-400" />}
            />
            <MiniKpi
              label="Policies"
              value={rules.by_kind?.POLICY ?? 0}
              icon={<ClipboardList size={12} className="text-zinc-400" />}
            />
            <MiniKpi
              label="Active"
              value={enforcement.expected + enforcement.synced + enforcement.verified}
              icon={<span className="text-green-400 text-[10px]">✓</span>}
            />
            <MiniKpi
              label="Drifted"
              value={enforcement.drifted}
              icon={<span className="text-red-400 text-[10px]">✗</span>}
              alert={enforcement.drifted > 0}
            />
          </div>
        )}

        {/* Empty state */}
        {!hasRules && !hasCatalogStats && (
          <div className="text-center py-4">
            <Shield size={24} className="mx-auto text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-500 mb-2">No governance data yet</p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/catalog"
                className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                <Library size={10} /> Add enrichments
              </Link>
              <Link
                href="/rules"
                className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                <Shield size={10} /> Create rules
              </Link>
            </div>
          </div>
        )}

        {/* Link to catalog for enrichments */}
        {hasCatalogStats && (
          <div className="pt-2 border-t border-zinc-800">
            <Link
              href="/catalog"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors"
            >
              <Library size={11} /> Open Catalog to add enrichments <ArrowRight size={10} />
            </Link>
          </div>
        )}
      </div>

      {/* RIGHT: Scope chart + Enforcement funnel */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-4">

        {/* Scope distribution */}
        {hasRules && scopeData.length > 0 ? (
          <>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Rules by Scope</div>
            <div className="flex items-center gap-6">
              <div className="w-28 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={scopeData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={45}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {scopeData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#e2e8f0",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {scopeData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                    <span className="text-zinc-400">{s.name}</span>
                    <span className="text-white font-semibold ml-auto tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-zinc-600">Apply a template to see scope distribution</p>
          </div>
        )}

        {/* Enforcement funnel */}
        {hasRules && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Enforcement Status</div>
            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-zinc-800">
              {enforcement.verified > 0 && (
                <div className="bg-emerald-500" style={{ flex: enforcement.verified }} title={`Verified: ${enforcement.verified}`} />
              )}
              {enforcement.synced > 0 && (
                <div className="bg-green-500" style={{ flex: enforcement.synced }} title={`Synced: ${enforcement.synced}`} />
              )}
              {enforcement.expected > 0 && (
                <div className="bg-yellow-500" style={{ flex: enforcement.expected }} title={`Expected: ${enforcement.expected}`} />
              )}
              {enforcement.declared > 0 && (
                <div className="bg-zinc-600" style={{ flex: enforcement.declared }} title={`Declared: ${enforcement.declared}`} />
              )}
              {enforcement.drifted > 0 && (
                <div className="bg-red-500" style={{ flex: enforcement.drifted }} title={`Drifted: ${enforcement.drifted}`} />
              )}
            </div>
            <div className="flex gap-3 text-[9px] text-zinc-600 flex-wrap">
              {enforcement.verified > 0 && <Legend color="bg-emerald-500" label="Verified" count={enforcement.verified} />}
              {enforcement.synced > 0 && <Legend color="bg-green-500" label="Synced" count={enforcement.synced} />}
              {enforcement.expected > 0 && <Legend color="bg-yellow-500" label="Expected" count={enforcement.expected} />}
              {enforcement.declared > 0 && <Legend color="bg-zinc-600" label="Declared" count={enforcement.declared} />}
              {enforcement.drifted > 0 && <Legend color="bg-red-500" label="Drifted" count={enforcement.drifted} />}
            </div>
          </div>
        )}

        {/* Drift alert */}
        {enforcement.drifted > 0 && (
          <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="text-[11px] text-red-400">
              {enforcement.drifted} rule{enforcement.drifted > 1 ? "s" : ""} drifted from provider
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function GovBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-500 tabular-nums">{count}/{total} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function MiniKpi({ label, value, icon, alert = false }: { label: string; value: number; icon: React.ReactNode; alert?: boolean }) {
  return (
    <div className={cn(
      "rounded-md border px-2 py-1.5 text-center",
      alert ? "border-red-500/30 bg-red-500/5" : "border-zinc-800 bg-zinc-900/50"
    )}>
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <span className={cn("text-sm font-bold", alert && "text-red-400")}>{value}</span>
      </div>
      <div className="text-[9px] text-zinc-600">{label}</div>
    </div>
  );
}

function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("w-2 h-2 rounded-sm", color)} />
      {label} {count}
    </span>
  );
}