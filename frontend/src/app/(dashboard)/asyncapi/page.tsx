// src/app/(dashboard)/asyncapi/page.tsx
// AsyncAPI page — Dual Mode: Overview + Import
// v5: Removed Generate tab (actions in Overview), added save in viewer sheet
//
// Placement: frontend/src/app/(dashboard)/asyncapi/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileCode, Loader2, Zap, AlertCircle, Upload, Eye, Search,
  BarChart3, CheckCircle2, Clock, Circle, RefreshCw, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRegistry } from "@/providers/registry-provider";
import {
  generateAsyncAPI,
  getAsyncAPI,
  updateAsyncAPI,
  exportAsyncAPIYaml,
  getAsyncAPIOverview,
} from "@/lib/api/asyncapi";
import { AsyncApiViewer } from "@/components/asyncapi/asyncapi-viewer";
import { AsyncAPIImport } from "@/components/asyncapi/asyncapi-import";
import type {
  AsyncAPISpec,
  AsyncAPIOverviewResponse,
} from "@/types/asyncapi";

type Tab = "overview" | "import";
type StatusFilter = "all" | "documented" | "ready" | "raw";
type OriginFilter = "all" | "imported" | "generated" | "none";

const STATUS_ORDER: Record<string, number> = { documented: 0, ready: 1, raw: 2 };

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ════════════════════════════════════════════════════════════════════
// STATUS / ORIGIN BADGES
// ════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "documented":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={11} /> documented
        </span>
      );
    case "ready":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock size={11} /> ready
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <Circle size={11} /> raw
        </span>
      );
  }
}

function OriginBadge({ origin }: { origin: string | null }) {
  if (!origin) return <span className="text-xs text-muted-foreground">—</span>;
  if (origin === "imported") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
        imported
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      generated
    </span>
  );
}


function SyncBadge({ syncStatus }: { syncStatus: string | null }) {
  if (!syncStatus || syncStatus === "unknown") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (syncStatus === "in_sync") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 size={10} /> synced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20"
      title="Schema has changed since last generation. Click Regen to update."
    >
      <AlertCircle size={10} /> outdated
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════
// KPI CARD
// ════════════════════════════════════════════════════════════════════

function KpiCard({
  label, value, icon: Icon, accent = "text-muted-foreground",
}: {
  label: string; value: number | string;
  icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className={cn("p-2 rounded-md bg-muted/50", accent)}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-lg font-semibold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════

export default function AsyncApiPage() {
  const { selected } = useRegistry();
  const registryId = selected?.id;

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // ── Overview state ──
  const [overview, setOverview] = useState<AsyncAPIOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");

  // ── Viewer sheet state ──
  const [viewerSubject, setViewerSubject] = useState<string | null>(null);
  const [viewerSpec, setViewerSpec] = useState<AsyncAPISpec | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  // ── Action state (for overview inline actions) ──
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ════════════════════════════════════════════════════════════════
  // OVERVIEW DATA
  // ════════════════════════════════════════════════════════════════

  const loadOverview = useCallback(async () => {
    if (!registryId) return;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await getAsyncAPIOverview(registryId);
      setOverview(data);
    } catch (err: any) {
      setOverviewError(err?.message || "Failed to load overview");
    } finally {
      setOverviewLoading(false);
    }
  }, [registryId]);

  useEffect(() => {
    if (activeTab === "overview") loadOverview();
  }, [registryId, activeTab, loadOverview]);

  // ── Filtered + sorted subjects ──
  const filteredSubjects = useMemo(() => {
    if (!overview) return [];
    return overview.subjects
      .filter((s) => {
        if (search && !s.subject.toLowerCase().includes(search.toLowerCase()) &&
            !(s.description || "").toLowerCase().includes(search.toLowerCase()) &&
            !(s.owner_team || "").toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        if (originFilter === "none" && s.origin !== null) return false;
        if (originFilter === "imported" && s.origin !== "imported") return false;
        if (originFilter === "generated" && s.origin !== "generated") return false;
        return true;
      })
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
  }, [overview, search, statusFilter, originFilter]);

  // ════════════════════════════════════════════════════════════════
  // VIEWER SHEET
  // ════════════════════════════════════════════════════════════════

  const openViewer = useCallback(async (subject: string) => {
    if (!registryId) return;
    setViewerSubject(subject);
    setViewerLoading(true);
    setViewerError(null);
    setViewerSpec(null);
    try {
      const existing = await getAsyncAPI(registryId, subject);
      setViewerSpec(existing);
    } catch (err: any) {
      setViewerError(err?.message || "Failed to load spec");
    } finally {
      setViewerLoading(false);
    }
  }, [registryId]);

  const handleViewerExportYaml = useCallback(async () => {
    if (!registryId || !viewerSubject) return;
    try {
      const yamlContent = await exportAsyncAPIYaml(registryId, viewerSubject);
      const blob = new Blob([yamlContent], { type: "application/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${viewerSubject}.asyncapi.yaml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setViewerError("Failed to export YAML");
    }
  }, [registryId, viewerSubject]);

  const handleViewerSave = useCallback(async (updatedSpec: Record<string, unknown>) => {
    if (!registryId || !viewerSubject) return;
    const result = await updateAsyncAPI(registryId, viewerSubject, updatedSpec);
    setViewerSpec(result);
    // Refresh overview to reflect changes
    loadOverview();
  }, [registryId, viewerSubject, loadOverview]);

  // ════════════════════════════════════════════════════════════════
  // OVERVIEW ACTIONS
  // ════════════════════════════════════════════════════════════════

  const handleGenerate = useCallback(async (subject: string) => {
    if (!registryId) return;
    setActionLoading(subject);
    try {
      await generateAsyncAPI(registryId, subject, {
        include_examples: true,
        include_confluent_bindings: true,
        include_key_schema: true,
      });
      await loadOverview();
      openViewer(subject);
    } catch (err: any) {
      setOverviewError(`Failed to generate spec for ${subject}`);
    } finally {
      setActionLoading(null);
    }
  }, [registryId, loadOverview, openViewer]);

  const handleRegenerate = useCallback(async (subject: string) => {
    if (!registryId) return;
    setActionLoading(subject);
    try {
      await generateAsyncAPI(registryId, subject, {
        include_examples: true,
        include_confluent_bindings: true,
        include_key_schema: true,
      });
      await loadOverview();
      openViewer(subject);
    } catch (err: any) {
      setOverviewError(`Failed to regenerate spec for ${subject}`);
    } finally {
      setActionLoading(null);
    }
  }, [registryId, loadOverview, openViewer]);

  // ════════════════════════════════════════════════════════════════
  // NO REGISTRY GUARD
  // ════════════════════════════════════════════════════════════════

  if (!registryId) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground">
        <FileCode size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-medium">No registry selected</p>
        <p className="text-sm">Select a registry from the top bar to browse AsyncAPI specs.</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FileCode size={18} className="text-cyan-400" />
            AsyncAPI
          </h1>
          <p className="text-xs text-muted-foreground">
            Explore, generate, and import AsyncAPI 3.0 specs.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { key: "overview", label: "Overview", icon: BarChart3 },
          { key: "import", label: "Import", icon: Upload },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === key
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW                                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {overviewLoading && !overview ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : overviewError && !overview ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle size={16} /> {overviewError}
            </div>
          ) : overview ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-5 gap-3">
                <KpiCard label="Total subjects" value={overview.kpis.total_subjects} icon={FileCode} accent="text-cyan-400" />
                <KpiCard label="Documented" value={overview.kpis.documented} icon={CheckCircle2} accent="text-emerald-400" />
                <KpiCard label="Ready" value={overview.kpis.ready} icon={Clock} accent="text-amber-400" />
                <KpiCard label="Raw" value={overview.kpis.raw} icon={Circle} accent="text-slate-400" />
                <KpiCard label="Coverage" value={`${overview.kpis.coverage_pct}%`} icon={BarChart3} accent="text-cyan-400" />
              </div>

              {/* Coverage bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  {overview.kpis.total_subjects > 0 && (
                    <div className="h-full flex">
                      <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(overview.kpis.documented / overview.kpis.total_subjects) * 100}%` }} />
                      <div className="bg-amber-500 transition-all duration-500" style={{ width: `${(overview.kpis.ready / overview.kpis.total_subjects) * 100}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> documented</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> ready</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> raw</span>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search subjects, descriptions, owners..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="documented">Documented</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="raw">Raw</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={originFilter} onValueChange={(v: string) => setOriginFilter(v as OriginFilter)}>
                  <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Origin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All origins</SelectItem>
                    <SelectItem value="generated">Generated</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                    <SelectItem value="none">No spec</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={loadOverview} disabled={overviewLoading}>
                  <RefreshCw size={13} className={cn("mr-1", overviewLoading && "animate-spin")} /> Refresh
                </Button>
                <p className="text-xs text-muted-foreground ml-auto">
                  {filteredSubjects.length} of {overview.subjects.length} subjects
                </p>
              </div>

              {/* Error banner */}
              {overviewError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle size={16} /> {overviewError}
                </div>
              )}

              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Subject</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[120px]">Status</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[110px]">Origin</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[80px]">Version</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">Sync</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[100px]">Owner</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[80px]">Layer</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">Updated</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-[140px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-muted-foreground">
                          No subjects match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((s) => (
                        <tr
                          key={s.subject}
                          className={cn(
                            "border-b last:border-0 hover:bg-muted/20 transition-colors",
                            s.status === "documented" && "cursor-pointer"
                          )}
                          onClick={() => s.status === "documented" && openViewer(s.subject)}
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-mono text-xs truncate max-w-[300px]">{s.subject}</p>
                            {s.description && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[300px] mt-0.5">{s.description}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                          <td className="px-3 py-2.5"><OriginBadge origin={s.origin} /></td>
                          <td className="px-3 py-2.5">
                            {s.spec_version ? (
                              <span className="text-xs font-mono text-muted-foreground">v{s.spec_version}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                          <SyncBadge syncStatus={s.sync_status} />
                        </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[100px]">
                            {s.owner_team || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            {s.data_layer ? (
                              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.data_layer}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {s.spec_updated_at ? (
                              <span className="text-[11px] text-muted-foreground" title={s.spec_updated_at}>{timeAgo(s.spec_updated_at)}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {actionLoading === s.subject ? (
                                <Loader2 size={14} className="animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  {/* View — documented only */}
                                  {s.status === "documented" && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => openViewer(s.subject)}>
                                      <Eye size={12} /> View
                                    </Button>
                                  )}

                                  {/* Generate — ready or raw (no spec yet) */}
                                  {(s.status === "ready" || s.status === "raw") && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1 text-amber-400 hover:text-amber-300" onClick={() => handleGenerate(s.subject)}>
                                      <Zap size={12} /> Generate
                                    </Button>
                                  )}

                                  {/* Regen — generated specs only */}
                                  {s.status === "documented" && s.origin === "generated" && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => handleRegenerate(s.subject)}>
                                      <RefreshCw size={12} /> Regen
                                    </Button>
                                  )}

                                  {/* Enrich — always available */}
                                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" asChild>
                                    <a href={`/catalog?subject=${encodeURIComponent(s.subject)}`}>
                                      <Pencil size={12} /> Enrich
                                    </a>
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : !overviewLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
              <FileCode size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">No overview data</p>
              <p className="text-sm mt-1 text-center max-w-md">
                Start by enriching your schemas in the{" "}
                <a href="/catalog" className="text-cyan-400 hover:underline">Catalog</a>,
                then come back here to generate AsyncAPI specs.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB: IMPORT                                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "import" && (
        <AsyncAPIImport registryId={registryId} />
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* VIEWER SHEET                                              */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Sheet open={!!viewerSubject} onOpenChange={(open) => !open && setViewerSubject(null)}>
        <SheetContent side="right" className="w-full !max-w-[75vw] overflow-y-auto p-0">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileCode size={16} className="text-cyan-400" />
              {viewerSubject}
            </SheetTitle>
          </SheetHeader>

          <div className="p-4">
            {viewerLoading && (
              <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
                <Loader2 size={18} className="animate-spin" /> Loading spec...
              </div>
            )}

            {viewerError && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle size={16} /> {viewerError}
              </div>
            )}

            {viewerSpec && !viewerLoading && (
              <AsyncApiViewer
                schema={viewerSpec.spec_content}
                isAutoGenerated={viewerSpec.is_auto_generated}
                onExportYaml={handleViewerExportYaml}
                onSave={handleViewerSave}
              />
            )}

            {!viewerSpec && !viewerLoading && !viewerError && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileCode size={32} className="mb-4 opacity-40" />
                <p className="font-medium">No spec found</p>
                <p className="text-sm mt-1">Generate a spec first from the Overview.</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}