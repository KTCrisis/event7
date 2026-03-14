// Placement: frontend/src/app/(dashboard)/catalog/page.tsx
// Catalog v3 — Redesigned with AsyncAPI column + Sheet dual viewer
// Replaces: AsyncAPIDrawer → CatalogSheet (Schema + AsyncAPI tabs)
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search, Download, Tag, Shield, Users, Layers, Link2,
  Loader2, AlertCircle, DatabaseZap, ChevronDown, Eye, EyeOff,
  Library, Network, Clock, Pencil, FileCode, Braces, CheckCircle2,
  Circle, Minus,
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
import { getCatalog, exportCatalogCsv } from "@/lib/api/governance";
import { getAsyncAPIOverview } from "@/lib/api/asyncapi";
import { EnrichmentEditor } from "@/components/catalog/enrichment-editor";
import { CatalogScoreBadge } from "@/components/rules/catalog-score";
import { DataLayerBadge } from "@/components/catalog/data-layer-badge";
import { CatalogSheet } from "@/components/catalog/catalog-sheet";
import type { CatalogEntry, DataClassification, DataLayer } from "@/types/governance";
import type { AsyncAPIOverviewResponse, SubjectAsyncAPIStatus } from "@/types/asyncapi";

// ════════════════════════════════════════════════════════════════════
// Config
// ════════════════════════════════════════════════════════════════════

const CLASS_CONFIG: Record<DataClassification, { label: string; color: string }> = {
  public: { label: "Public", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  internal: { label: "Internal", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  confidential: { label: "Confidential", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  restricted: { label: "Restricted", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const BROKER_CONFIG: Record<string, { label: string; color: string }> = {
  kafka: { label: "Kafka", color: "text-orange-400" },
  rabbitmq: { label: "RabbitMQ", color: "text-amber-400" },
  redis_streams: { label: "Redis", color: "text-red-400" },
  pulsar: { label: "Pulsar", color: "text-purple-400" },
  nats: { label: "NATS", color: "text-green-400" },
  google_pubsub: { label: "Pub/Sub", color: "text-blue-400" },
  aws_sns_sqs: { label: "AWS SNS", color: "text-yellow-400" },
  azure_servicebus: { label: "Azure SB", color: "text-sky-400" },
  custom: { label: "Custom", color: "text-zinc-400" },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════

type FilterKey = "all" | "documented" | "undocumented" | "with-refs" | "with-asyncapi" | "no-asyncapi";
type SortKey = "subject" | "version" | "owner" | "classification";

/** Merged catalog + asyncapi status */
interface CatalogRow extends CatalogEntry {
  asyncapi_status?: string | null;       // documented | ready | raw
  asyncapi_origin?: string | null;       // imported | generated | null
  asyncapi_sync?: string | null;         // in_sync | outdated | unknown | null
  asyncapi_spec_version?: number | null;
}

// ════════════════════════════════════════════════════════════════════
// Grid layout
// ════════════════════════════════════════════════════════════════════

const GRID_WITH_SCORE = "grid-cols-[36px_1fr_80px_70px_100px_90px_70px_60px_55px_70px_50px]";
const GRID_NO_SCORE = "grid-cols-[1fr_80px_70px_100px_90px_70px_60px_55px_70px_50px]";

// ════════════════════════════════════════════════════════════════════
// Page Component
// ════════════════════════════════════════════════════════════════════

export default function CatalogPage() {
  const { selected: registry } = useRegistry();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [asyncOverview, setAsyncOverview] = useState<AsyncAPIOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<DataClassification | "all">("all");
  const [layerFilter, setLayerFilter] = useState<DataLayer | "all">("all");
  const [brokerFilter, setBrokerFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("subject");

  // Score toggle
  const [showScores, setShowScores] = useState(false);

  // Sheet & Editor state
  const [selectedEntry, setSelectedEntry] = useState<CatalogRow | null>(null);
  const [editing, setEditing] = useState<CatalogEntry | null>(null);

  const gridCols = showScores ? GRID_WITH_SCORE : GRID_NO_SCORE;

  // ── Fetch catalog + asyncapi overview ──
  useEffect(() => {
    if (!registry) {
      setCatalog([]);
      setAsyncOverview(null);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      getCatalog(registry.id),
      getAsyncAPIOverview(registry.id).catch(() => null),
    ])
      .then(([catalogData, overviewData]) => {
        setCatalog(catalogData);
        setAsyncOverview(overviewData);
      })
      .catch((err) => setError(err?.detail || "Failed to load catalog"))
      .finally(() => setLoading(false));
  }, [registry]);

  // ── Build asyncapi status map ──
  const asyncMap = useMemo(() => {
    const map = new Map<string, SubjectAsyncAPIStatus>();
    if (asyncOverview?.subjects) {
      for (const s of asyncOverview.subjects) {
        map.set(s.subject, s);
      }
    }
    return map;
  }, [asyncOverview]);

  // ── Merge catalog + asyncapi ──
  const rows: CatalogRow[] = useMemo(() => {
    return catalog.map((entry) => {
      const asyncInfo = asyncMap.get(entry.subject);
      return {
        ...entry,
        asyncapi_status: asyncInfo?.status ?? null,
        asyncapi_origin: asyncInfo?.origin ?? null,
        asyncapi_sync: asyncInfo?.sync_status ?? null,
        asyncapi_spec_version: asyncInfo?.spec_version ?? null,
      };
    });
  }, [catalog, asyncMap]);

  // ── Unique filter options ──
  const owners = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((e) => { if (e.owner_team) set.add(e.owner_team); });
    return Array.from(set).sort();
  }, [catalog]);

  const brokers = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((e) => { (e.broker_types || []).forEach((b) => set.add(b)); });
    return Array.from(set).sort();
  }, [catalog]);

  // ── Stats ──
  const stats = useMemo(() => ({
    total: rows.length,
    documented: rows.filter((e) => e.description).length,
    withRefs: rows.filter((e) => e.reference_count > 0).length,
    owners: owners.length,
    withAsyncAPI: rows.filter((e) => e.asyncapi_status === "documented").length,
  }), [rows, owners]);

  // ── Filtered + sorted ──
  const filtered = useMemo(() => {
    let result = rows.filter((e) => {
      const matchSearch =
        !search ||
        e.subject.toLowerCase().includes(search.toLowerCase()) ||
        (e.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.owner_team || "").toLowerCase().includes(search.toLowerCase()) ||
        e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      const matchFilter =
        filter === "all" ||
        (filter === "documented" && e.description) ||
        (filter === "undocumented" && !e.description) ||
        (filter === "with-refs" && e.reference_count > 0) ||
        (filter === "with-asyncapi" && e.asyncapi_status === "documented") ||
        (filter === "no-asyncapi" && e.asyncapi_status !== "documented");

      const matchOwner = ownerFilter === "all" || e.owner_team === ownerFilter;
      const matchClass = classFilter === "all" || e.classification === classFilter;
      const matchLayer = layerFilter === "all" || e.data_layer === layerFilter;
      const matchBroker =
        brokerFilter === "all" ||
        (e.broker_types || []).includes(brokerFilter);

      return matchSearch && matchFilter && matchOwner && matchClass && matchLayer && matchBroker;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "version": return b.latest_version - a.latest_version;
        case "owner": return (a.owner_team || "zzz").localeCompare(b.owner_team || "zzz");
        case "classification": return a.classification.localeCompare(b.classification);
        default: return a.subject.localeCompare(b.subject);
      }
    });

    return result;
  }, [rows, search, filter, ownerFilter, classFilter, layerFilter, brokerFilter, sortBy]);

  // ── Export CSV ──
  const handleExport = useCallback(async () => {
    if (!registry) return;
    try {
      const url = await exportCatalogCsv(registry.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalog-${registry.name}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
  }, [registry]);

  // ── Update entry in local state ──
  const handleSaved = useCallback((updated: CatalogEntry) => {
    setCatalog((prev) =>
      prev.map((e) => (e.subject === updated.subject ? updated : e))
    );
    // Also update the selected entry if it's open
    setSelectedEntry((prev) =>
      prev && prev.subject === updated.subject
        ? { ...prev, ...updated }
        : prev
    );
  }, []);

  // ── Open sheet from enrichment editor ──
  const handleEditFromSheet = useCallback(() => {
    if (selectedEntry) {
      setEditing(selectedEntry);
    }
  }, [selectedEntry]);

  // ════════════════════════════════════════════════════════════════════
  // Render — Empty / Loading / Error states
  // ════════════════════════════════════════════════════════════════════

  if (!registry) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <DatabaseZap size={40} className="text-muted-foreground/30" />
        <p className="text-sm">Select a registry to view the catalog</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        Loading catalog…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive gap-2">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // Render — Main
  // ════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Library size={18} className="text-cyan-400" />
            Event Catalog
          </h1>
          <p className="text-xs text-muted-foreground">
            Business view of schemas — document, tag, classify, and explore your events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 text-xs",
              showScores && "border-cyan-500/50 text-cyan-400"
            )}
            onClick={() => setShowScores((v) => !v)}
            title={showScores ? "Hide governance scores" : "Show governance scores"}
          >
            {showScores ? <EyeOff size={14} /> : <Eye size={14} />}
            Scores
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport}>
            <Download size={14} />
            CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <MiniKpi label="Total Schemas" value={stats.total} icon={<Braces size={16} className="text-cyan-400" />} />
        <MiniKpi label="Documented" value={stats.documented} icon={<Shield size={16} className="text-emerald-400" />} />
        <MiniKpi label="With Refs" value={stats.withRefs} icon={<Link2 size={16} className="text-violet-400" />} />
        <MiniKpi label="Teams" value={stats.owners} icon={<Users size={16} className="text-amber-400" />} />
        <MiniKpi label="AsyncAPI" value={stats.withAsyncAPI} icon={<FileCode size={16} className="text-pink-400" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects, descriptions, tags…"
            className="pl-9 h-8 text-xs"
          />
        </div>

        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
              Status: {filter === "all" ? "All" : filter.replace("-", " ")}
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(["all", "documented", "undocumented", "with-refs", "with-asyncapi", "no-asyncapi"] as FilterKey[]).map((f) => (
              <DropdownMenuItem key={f} onClick={() => setFilter(f)} className="text-xs">
                {f === "all" ? "All" : f.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Owner filter */}
        {owners.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
                Team: {ownerFilter === "all" ? "All" : ownerFilter}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setOwnerFilter("all")} className="text-xs">All</DropdownMenuItem>
              {owners.map((o) => (
                <DropdownMenuItem key={o} onClick={() => setOwnerFilter(o)} className="text-xs">{o}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Classification filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
              Class: {classFilter === "all" ? "All" : classFilter}
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setClassFilter("all")} className="text-xs">All</DropdownMenuItem>
            {(Object.keys(CLASS_CONFIG) as DataClassification[]).map((c) => (
              <DropdownMenuItem key={c} onClick={() => setClassFilter(c)} className="text-xs">
                {CLASS_CONFIG[c].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Layer filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
              Layer: {layerFilter === "all" ? "All" : layerFilter.toUpperCase()}
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setLayerFilter("all")} className="text-xs">All</DropdownMenuItem>
            {(["raw", "core", "refined", "application"] as DataLayer[]).map((l) => (
              <DropdownMenuItem key={l} onClick={() => setLayerFilter(l)} className="text-xs">
                {l.toUpperCase()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Broker filter */}
        {brokers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
                Broker: {brokerFilter === "all" ? "All" : BROKER_CONFIG[brokerFilter]?.label || brokerFilter}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setBrokerFilter("all")} className="text-xs">All</DropdownMenuItem>
              {brokers.map((b) => (
                <DropdownMenuItem key={b} onClick={() => setBrokerFilter(b)} className="text-xs">
                  {BROKER_CONFIG[b]?.label || b}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {/* Table header */}
        <div className={cn("grid gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/40", gridCols)}>
          {showScores && <div className="text-center">Score</div>}
          <div>Subject</div>
          <div>AsyncAPI</div>
          <div>Layer</div>
          <div>Owner</div>
          <div>Classification</div>
          <div>Tags</div>
          <div>Format</div>
          <div className="text-center">Ver</div>
          <div>Updated</div>
          <div></div>
        </div>

        {/* Table body */}
        <div className="divide-y divide-border max-h-[calc(100vh-380px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? "No matching entries" : "No schemas in catalog"}
            </div>
          ) : (
            filtered.map((entry) => {
              const cls = CLASS_CONFIG[entry.classification];
              return (
                <div
                  key={entry.subject}
                  onClick={() => setSelectedEntry(entry)}
                  className={cn(
                    "grid gap-2 px-4 py-2.5 items-center hover:bg-muted/30 transition-colors cursor-pointer group",
                    gridCols,
                    selectedEntry?.subject === entry.subject && "bg-muted/20 ring-1 ring-cyan-500/20"
                  )}
                >
                  {/* Governance Score */}
                  {showScores && (
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <CatalogScoreBadge registryId={registry.id} subject={entry.subject} />
                    </div>
                  )}

                  {/* Subject + description */}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" title={entry.subject}>
                      {entry.subject}
                    </div>
                    {entry.description ? (
                      <div className="text-[11px] text-muted-foreground truncate" title={entry.description}>
                        {entry.description}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground/40 italic">No description</div>
                    )}
                  </div>

                  {/* AsyncAPI status */}
                  <div>
                    <AsyncAPIBadge
                      status={entry.asyncapi_status}
                      specVersion={entry.asyncapi_spec_version}
                      syncStatus={entry.asyncapi_sync}
                    />
                  </div>

                  {/* Data Layer */}
                  <div>
                    <DataLayerBadge layer={entry.data_layer} />
                  </div>

                  {/* Owner */}
                  <div className="text-xs text-muted-foreground truncate">
                    {entry.owner_team || <span className="text-muted-foreground/40 italic">—</span>}
                  </div>

                  {/* Classification */}
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 w-fit border", cls.color)}>
                    {cls.label}
                  </Badge>

                  {/* Tags */}
                  <div className="flex gap-1 overflow-hidden">
                    {entry.tags.length > 0 ? (
                      entry.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0 h-4 truncate max-w-[50px]">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                    {entry.tags.length > 2 && (
                      <span className="text-[9px] text-muted-foreground">+{entry.tags.length - 2}</span>
                    )}
                  </div>

                  {/* Format */}
                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-5 border",
                        entry.format === "AVRO"
                          ? "text-cyan-400 border-cyan-500/20"
                          : "text-amber-400 border-amber-500/20"
                      )}
                    >
                      {entry.format}
                    </Badge>
                  </div>

                  {/* Version */}
                  <div className="text-center text-xs text-muted-foreground">
                    v{entry.latest_version}
                  </div>

                  {/* Updated */}
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1" title={entry.updated_at || ""}>
                    <Clock size={10} />
                    {timeAgo(entry.updated_at)}
                  </div>

                  {/* Edit action */}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditing(entry)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit enrichment"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex justify-between">
          <span>{filtered.length} of {rows.length} entries</span>
          <span>
            {stats.documented} documented · {stats.withAsyncAPI} with AsyncAPI · {rows.length - stats.documented} undocumented
          </span>
        </div>
      </Card>

      {/* ── Sheet (Schema + AsyncAPI viewer) ── */}
      {selectedEntry && registry && (
        <CatalogSheet
          registryId={registry.id}
          entry={selectedEntry}
          asyncapiStatus={
            selectedEntry.asyncapi_status
              ? {
                  status: selectedEntry.asyncapi_status,
                  origin: selectedEntry.asyncapi_origin ?? null,
                  sync_status: selectedEntry.asyncapi_sync ?? null,
                  spec_version: selectedEntry.asyncapi_spec_version ?? null,
                }
              : null
          }
          onClose={() => setSelectedEntry(null)}
          onEdit={handleEditFromSheet}
        />
      )}

      {/* ── Enrichment editor drawer ── */}
      {editing && registry && (
        <EnrichmentEditor
          registryId={registry.id}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════

/** AsyncAPI status badge for the catalog table */
function AsyncAPIBadge({
  status,
  specVersion,
  syncStatus,
}: {
  status: string | null | undefined;
  specVersion: number | null | undefined;
  syncStatus: string | null | undefined;
}) {
  if (status === "documented") {
    const syncColor =
      syncStatus === "in_sync" ? "text-emerald-400" :
      syncStatus === "outdated" ? "text-amber-400" :
      "text-zinc-400";

    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={13} className="text-emerald-400" />
        <span className="text-[10px] font-medium text-emerald-400">
          v{specVersion || 1}
        </span>
        {syncStatus && syncStatus !== "unknown" && (
          <Circle size={6} className={cn("fill-current", syncColor)} />
        )}
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex items-center gap-1.5">
        <Circle size={10} className="text-amber-400" />
        <span className="text-[10px] text-amber-400">Ready</span>
      </div>
    );
  }

  return (
    <span className="text-[10px] text-muted-foreground/40">
      <Minus size={14} />
    </span>
  );
}

/** Mini KPI card */
function MiniKpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
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