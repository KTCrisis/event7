// Placement: frontend/src/app/(dashboard)/page.tsx
// Phase 7 — Dashboard with AsyncAPI coverage, channel coverage, governance, charts
// v3: Added AsyncAPI coverage (documented/ready/raw + drift), channel coverage (bound/unbound, broker breakdown)
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Database, FileCode, GitBranch, AlertCircle,
  Loader2, RefreshCw, Search, ExternalLink, ArrowRight,
  FileJson, Network, CheckCircle, Minus, AlertTriangle,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useRegistry } from "@/providers/registry-provider";
import { listSubjects } from "@/lib/api/schemas";
import { getCatalog } from "@/lib/api/governance";
import { buildGraph, extractNamespace } from "@/lib/api/references";
import { getAsyncAPIOverview } from "@/lib/api/asyncapi";
import { RegistryChooser } from "@/components/settings/registry-chooser";
import { DashboardGovernance } from "@/components/rules/dashboard-governance";
import { LAYER_COLORS } from "@/components/catalog/data-layer-badge";
import type { SubjectInfo } from "@/types/schema";
import type { CatalogEntry } from "@/types/governance";
import type { AsyncAPIOverviewResponse } from "@/types/asyncapi";

// === Types ===

interface ChannelMapEntry {
  id: string;
  name: string;
  broker_type: string;
  binding_count: number;
}

interface DashboardData {
  subjects: SubjectInfo[];
  catalog: CatalogEntry[];
  refEdges: number;
  asyncapiOverview: AsyncAPIOverviewResponse | null;
  channels: ChannelMapEntry[];
}

// === Colors ===

const FORMAT_COLORS: Record<string, string> = {
  AVRO: "#22d3ee",
  JSON: "#f59e0b",
  PROTOBUF: "#a78bfa",
  UNKNOWN: "#64748b",
};

const BAR_COLOR = "#22d3ee";

// === Dashboard Page ===

export default function DashboardPage() {
  const { selected } = useRegistry();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const [subjects, catalog, graph, asyncapiOverview, channelMapRes] = await Promise.all([
        listSubjects(selected.id),
        getCatalog(selected.id).catch(() => [] as CatalogEntry[]),
        buildGraph(selected.id).catch(() => ({ nodes: [], edges: [] })),
        getAsyncAPIOverview(selected.id).catch(() => null),
        fetch(`/api/v1/registries/${selected.id}/channels/channel-map`)
          .then((r) => r.ok ? r.json() : { channels: [] })
          .catch(() => ({ channels: [] })),
      ]);
      setData({
        subjects,
        catalog,
        refEdges: graph.edges.length,
        asyncapiOverview,
        channels: channelMapRes.channels || [],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    if (!data) return null;
    return computeStats(data);
  }, [data]);

  // --- No registry ---
  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-xl">
          <LayoutDashboard size={40} className="mx-auto text-zinc-700 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Welcome to event7</h2>
          <p className="text-sm text-zinc-500 mb-6">
            Connect your existing Schema Registry or create a free hosted one
            to start exploring your schemas and events.
          </p>
          <RegistryChooser
            onSelect={(mode) => router.push(`/settings?action=${mode}`)}
            variant="full"
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-cyan-400 animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <AlertCircle size={36} className="mx-auto text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-white mb-2">Error</h2>
          <p className="text-sm text-zinc-500 mb-4">{error}</p>
          <button onClick={loadData} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-zinc-800 text-zinc-200 rounded-md border border-zinc-700 hover:bg-zinc-700 transition-colors">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <LayoutDashboard size={18} className="text-cyan-400" />
            Dashboard
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {selected.name} · {selected.environment}
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Database} label="Subjects" value={stats.total} />
        <KpiCard icon={FileCode} label="Avro" value={stats.avroCount} accent="#22d3ee" />
        <KpiCard icon={FileCode} label="JSON" value={stats.jsonCount} accent="#f59e0b" />
        <KpiCard icon={LayoutDashboard} label="Versions" value={stats.totalVersions} />
        <KpiCard icon={GitBranch} label="References" value={stats.refEdges} accent="#34d399" />
        <KpiCard icon={AlertCircle} label="Undocumented" value={stats.undocumented} accent={stats.undocumented > 0 ? "#f87171" : undefined} />
      </div>

      {/* AsyncAPI Coverage + Channel Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AsyncAPI Coverage */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileJson size={12} className="text-cyan-400" />
              AsyncAPI Coverage
            </h3>
            <Link href="/asyncapi" className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
              View overview →
            </Link>
          </div>
          {stats.asyncapi ? (
            <>
              {/* Coverage bar */}
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex mb-3">
                {stats.asyncapi.documentedPct > 0 && (
                  <div className="h-full bg-emerald-500" style={{ width: `${stats.asyncapi.documentedPct}%` }} />
                )}
                {stats.asyncapi.readyPct > 0 && (
                  <div className="h-full bg-amber-500" style={{ width: `${stats.asyncapi.readyPct}%` }} />
                )}
                {stats.asyncapi.rawPct > 0 && (
                  <div className="h-full bg-zinc-600" style={{ width: `${stats.asyncapi.rawPct}%` }} />
                )}
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2">
                <MiniStat label="Documented" value={stats.asyncapi.documented} color="text-emerald-400" icon={CheckCircle} />
                <MiniStat label="Ready" value={stats.asyncapi.ready} color="text-amber-400" icon={Minus} />
                <MiniStat label="Raw" value={stats.asyncapi.raw} color="text-zinc-500" icon={Minus} />
                <MiniStat label="Outdated" value={stats.asyncapi.outdated} color={stats.asyncapi.outdated > 0 ? "text-amber-400" : "text-zinc-600"} icon={AlertTriangle} />
              </div>
              {/* Coverage % */}
              <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">Coverage</span>
                <span className={`text-sm font-bold tabular-nums ${
                  stats.asyncapi.coveragePct >= 75 ? "text-emerald-400" :
                  stats.asyncapi.coveragePct >= 50 ? "text-amber-400" : "text-zinc-400"
                }`}>
                  {stats.asyncapi.coveragePct.toFixed(0)}%
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-24">
              <p className="text-xs text-zinc-600">No AsyncAPI data — generate or import specs</p>
            </div>
          )}
        </div>

        {/* Channel Coverage */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Network size={12} className="text-cyan-400" />
              Channel Coverage
            </h3>
            <Link href="/channels" className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
              View channels →
            </Link>
          </div>
          {stats.channels.totalChannels > 0 ? (
            <>
              {/* Bound vs unbound bar */}
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex mb-3">
                {stats.channels.boundPct > 0 && (
                  <div className="h-full bg-teal-500" style={{ width: `${stats.channels.boundPct}%` }} />
                )}
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Channels" value={stats.channels.totalChannels} color="text-teal-400" icon={Network} />
                <MiniStat label="Bound" value={stats.channels.boundSubjects} color="text-emerald-400" icon={CheckCircle} />
                <MiniStat label="Unbound" value={stats.channels.unboundSubjects} color={stats.channels.unboundSubjects > 0 ? "text-amber-400" : "text-zinc-600"} icon={Minus} />
              </div>
              {/* Broker breakdown */}
              {stats.channels.brokerBreakdown.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-2">
                  {stats.channels.brokerBreakdown.map((b) => (
                    <span key={b.broker} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                      {b.broker}
                      <span className="text-zinc-300 font-semibold">{b.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-24">
              <p className="text-xs text-zinc-600">No channels — create in Channels or import AsyncAPI</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts row: Format + Layer + Namespace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Format Distribution — Donut */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Format Distribution</h3>
          <div className="flex items-center gap-6">
            <div className="w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.formatData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} strokeWidth={0}>
                    {stats.formatData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", fontSize: "12px", color: "#e2e8f0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {stats.formatData.map((f) => (
                <div key={f.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-sm" style={{ background: f.color }} />
                  <span className="text-zinc-400">{f.name}</span>
                  <span className="text-white font-semibold ml-auto tabular-nums">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Layer Distribution — Donut */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Subjects by Layer</h3>
          {stats.layerData.length > 0 && stats.layerData.some((d) => d.name !== "UNKNOWN") ? (
            <div className="flex items-center gap-6">
              <div className="w-36 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.layerData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} strokeWidth={0}>
                      {stats.layerData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", fontSize: "12px", color: "#e2e8f0" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {stats.layerData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                    <span className="text-zinc-400">{d.name}</span>
                    <span className="text-white font-semibold ml-auto tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-36">
              <p className="text-xs text-zinc-600">No layers assigned yet — edit in Catalog</p>
            </div>
          )}
        </div>

        {/* Namespace Breakdown — Bar */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Subjects by Namespace</h3>
          {stats.namespaceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.namespaceData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", fontSize: "12px", color: "#e2e8f0" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-zinc-600">No namespace data</p>
          )}
        </div>
      </div>

      {/* Governance (unified: coverage + rules + score + charts) */}
      <DashboardGovernance
        registryId={selected.id}
        catalogStats={{
          total: stats.total,
          withDescription: stats.withDescription,
          withOwner: stats.withOwner,
          withTags: stats.withTags,
        }}
      />

      {/* Top Versioned Schemas */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Most Versioned Subjects</h3>
        <div className="space-y-2">
          {stats.topVersioned.map((s) => {
            const label = extractLabel(s.subject);
            return (
              <Link
                key={s.subject}
                href={`/schemas?subject=${encodeURIComponent(s.subject)}`}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: `${FORMAT_COLORS[s.format] || FORMAT_COLORS.UNKNOWN}20`,
                      color: FORMAT_COLORS[s.format] || FORMAT_COLORS.UNKNOWN,
                    }}
                  >
                    {s.format}
                  </span>
                  <span className="text-sm text-zinc-300 truncate">{label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-zinc-500 tabular-nums">v{s.version_count ?? 1}</span>
                  <ExternalLink size={12} className="text-zinc-700 group-hover:text-cyan-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-zinc-800">
          <Link href="/schemas" className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors">
            <Search size={11} /> Open Schema Explorer <ArrowRight size={10} />
          </Link>
        </div>
      </div>

      {/* Undocumented schemas call-to-action */}
      {stats.undocumentedSubjects.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-300 mb-1">
                {stats.undocumented} subject{stats.undocumented > 1 ? "s" : ""} without enrichment
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {stats.undocumentedSubjects.map((c) => (
                  <Link
                    key={c.subject}
                    href="/catalog"
                    className="text-[11px] px-2 py-1 bg-zinc-800/60 text-zinc-400 rounded hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                  >
                    {extractLabel(c.subject)}
                  </Link>
                ))}
                {stats.undocumented > 5 && (
                  <Link href="/catalog" className="text-[11px] px-2 py-1 text-amber-400 hover:text-amber-300 transition-colors">
                    +{stats.undocumented - 5} more →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Stat computation ===

function computeStats(data: DashboardData) {
  const { subjects, catalog, refEdges, asyncapiOverview, channels } = data;

  const avroCount = subjects.filter((s) => s.format === "AVRO").length;
  const jsonCount = subjects.filter((s) => s.format === "JSON").length;
  const protoCount = subjects.filter((s) => s.format === "PROTOBUF").length;
  const totalVersions = subjects.reduce((sum, s) => sum + (s.version_count ?? 1), 0);

  const withDescription = catalog.filter((c) => c.description && c.description.trim().length > 0).length;
  const withOwner = catalog.filter((c) => c.owner_team && c.owner_team.trim().length > 0).length;
  const withTags = catalog.filter((c) => c.tags && c.tags.length > 0).length;
  const undocumented = subjects.length - withDescription;

  const formatData = [
    { name: "Avro", value: avroCount, color: FORMAT_COLORS.AVRO },
    { name: "JSON", value: jsonCount, color: FORMAT_COLORS.JSON },
  ];
  if (protoCount > 0) formatData.push({ name: "Protobuf", value: protoCount, color: FORMAT_COLORS.PROTOBUF });

  const layerCounts: Record<string, number> = {};
  for (const c of catalog) {
    const layer = c.data_layer || "unknown";
    layerCounts[layer] = (layerCounts[layer] || 0) + 1;
  }
  const layerData = Object.entries(layerCounts)
    .map(([name, value]) => ({
      name: name === "application" ? "APP" : name.toUpperCase(),
      value,
      color: LAYER_COLORS[name] || LAYER_COLORS.unknown,
    }))
    .sort((a, b) => b.value - a.value);

  const nsMap = new Map<string, number>();
  for (const s of subjects) {
    const ns = extractNamespace(s.subject);
    const short = ns.startsWith("com.") ? ns.slice(4) : ns;
    nsMap.set(short, (nsMap.get(short) || 0) + 1);
  }
  const namespaceData = Array.from(nsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const topVersioned = [...subjects]
    .sort((a, b) => (b.version_count ?? 1) - (a.version_count ?? 1))
    .slice(0, 5);

  const undocumentedSubjects = catalog
    .filter((c) => !c.description || c.description.trim().length === 0)
    .slice(0, 5);

  // AsyncAPI stats
  const asyncapi = asyncapiOverview ? (() => {
    const kpis = asyncapiOverview.kpis;
    const total = kpis.total_subjects || 1;
    const outdated = asyncapiOverview.subjects.filter((s) => s.sync_status === "outdated").length;
    return {
      documented: kpis.documented,
      ready: kpis.ready,
      raw: kpis.raw,
      outdated,
      coveragePct: kpis.coverage_pct,
      documentedPct: (kpis.documented / total) * 100,
      readyPct: (kpis.ready / total) * 100,
      rawPct: (kpis.raw / total) * 100,
    };
  })() : null;

  // Channel stats
  const boundSubjectsSet = new Set<string>();
  const brokerCounts: Record<string, number> = {};
  for (const ch of channels) {
    const bt = ch.broker_type || "unknown";
    brokerCounts[bt] = (brokerCounts[bt] || 0) + 1;
  }
  // Count subjects that have at least one binding
  const totalBoundBindings = channels.reduce((sum, ch) => sum + (ch.binding_count || 0), 0);
  const boundSubjects = Math.min(totalBoundBindings, subjects.length); // approximate
  const unboundSubjects = Math.max(0, subjects.length - boundSubjects);
  const channelStats = {
    totalChannels: channels.length,
    boundSubjects,
    unboundSubjects,
    boundPct: subjects.length > 0 ? (boundSubjects / subjects.length) * 100 : 0,
    brokerBreakdown: Object.entries(brokerCounts)
      .map(([broker, count]) => ({ broker, count }))
      .sort((a, b) => b.count - a.count),
  };

  return {
    total: subjects.length,
    avroCount,
    jsonCount,
    protoCount,
    totalVersions,
    refEdges,
    undocumented,
    withDescription,
    withOwner,
    withTags,
    formatData,
    layerData,
    namespaceData,
    topVersioned,
    undocumentedSubjects,
    asyncapi,
    channels: channelStats,
  };
}

// === Sub-components ===

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Database;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color: accent || "#94a3b8" }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent || "#f1f5f9" }}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof CheckCircle;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-1 ${color} mb-0.5`}>
        <Icon size={10} />
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
      <span className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function extractLabel(subject: string): string {
  const clean = subject.replace(/-(value|key)$/, "");
  const parts = clean.split(".");
  return parts[parts.length - 1] || subject;
}