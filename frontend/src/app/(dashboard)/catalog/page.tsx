// src/app/(dashboard)/catalog/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search, Download, Edit3, FileCode, Braces, Tag,
  Shield, Users, Layers, Link2, Loader2, AlertCircle,
  DatabaseZap, ChevronDown, Eye, EyeOff, Library,
  Network, Clock, Pencil,
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
import { EnrichmentEditor } from "@/components/catalog/enrichment-editor";
import { CatalogScoreBadge } from "@/components/rules/catalog-score";
import { DataLayerBadge } from "@/components/catalog/data-layer-badge";
import { AsyncAPIDrawer } from "@/components/catalog/asyncapi-drawer";
import type { CatalogEntry, DataClassification, DataLayer } from "@/types/governance";

// Classification badge config
const CLASS_CONFIG: Record<DataClassification, { label: string; color: string; icon: string }> = {
  public: { label: "Public", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: "🟢" },
  internal: { label: "Internal", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: "🔵" },
  confidential: { label: "Confidential", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: "🟡" },
  restricted: { label: "Restricted", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: "🔴" },
};

// Broker display config
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

type FilterKey = "all" | "documented" | "undocumented" | "with-refs";
type SortKey = "subject" | "version" | "owner" | "classification";

const GRID_WITH_SCORE = "grid-cols-[36px_1fr_90px_70px_120px_100px_80px_60px_50px_70px_50px]";
const GRID_NO_SCORE = "grid-cols-[1fr_90px_70px_120px_100px_80px_60px_50px_70px_50px]";

export default function CatalogPage() {
  const { selected: registry } = useRegistry();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
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

  // Editor
  const [editing, setEditing] = useState<CatalogEntry | null>(null);

  // AsyncAPI drawer
  const [asyncapiSubject, setAsyncapiSubject] = useState<string | null>(null);

  const gridCols = showScores ? GRID_WITH_SCORE : GRID_NO_SCORE;

  // Fetch catalog
  useEffect(() => {
    if (!registry) {
      setCatalog([]);
      return;
    }

    setLoading(true);
    setError(null);

    getCatalog(registry.id)
      .then(setCatalog)
      .catch((err) => setError(err?.detail || "Failed to load catalog"))
      .finally(() => setLoading(false));
  }, [registry]);

  // Unique owners for filter
  const owners = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((e) => {
      if (e.owner_team) set.add(e.owner_team);
    });
    return Array.from(set).sort();
  }, [catalog]);

  // Unique broker types for filter
  const brokers = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((e) => {
      (e.broker_types || []).forEach((b) => set.add(b));
    });
    return Array.from(set).sort();
  }, [catalog]);

  // Stats
  const stats = useMemo(() => ({
    total: catalog.length,
    documented: catalog.filter((e) => e.description).length,
    withRefs: catalog.filter((e) => e.reference_count > 0).length,
    owners: owners.length,
  }), [catalog, owners]);

  // Filtered + sorted entries
  const filtered = useMemo(() => {
    let result = catalog.filter((e) => {
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
        (filter === "with-refs" && e.reference_count > 0);

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
  }, [catalog, search, filter, ownerFilter, classFilter, layerFilter, brokerFilter, sortBy]);

  // Export CSV
  const handleExport = async () => {
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
  };

  // Update entry in local state after save
  const handleSaved = (updated: CatalogEntry) => {
    setCatalog((prev) =>
      prev.map((e) => (e.subject === updated.subject ? updated : e))
    );
  };

  // No registry
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
            Business view of schemas — document, tag, and classify your events.
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
            {showScores ? <EyeOff size={13} /> : <Eye size={13} />}
            Scores
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport}>
            <Download size={13} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <MiniKpi label="Total" value={stats.total} icon={<Layers size={14} className="text-cyan-400" />} />
        <MiniKpi label="Documented" value={stats.documented} icon={<FileCode size={14} className="text-emerald-400" />} />
        <MiniKpi label="With Refs" value={stats.withRefs} icon={<Link2 size={14} className="text-purple-400" />} />
        <MiniKpi label="Teams" value={stats.owners} icon={<Users size={14} className="text-amber-400" />} />
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input
            placeholder="Search subjects, descriptions, owners, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm bg-muted/30"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {([
            ["all", "All"],
            ["documented", "Documented"],
            ["undocumented", "Undocumented"],
            ["with-refs", "With Refs"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-medium transition-colors border",
                filter === key
                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                  : "bg-muted/20 text-muted-foreground border-transparent hover:border-border"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Owner filter */}
        {owners.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
                <Users size={11} />
                {ownerFilter === "all" ? "All teams" : ownerFilter}
                <ChevronDown size={10} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setOwnerFilter("all")} className="text-xs">
                All teams
              </DropdownMenuItem>
              {owners.map((o) => (
                <DropdownMenuItem key={o} onClick={() => setOwnerFilter(o)} className="text-xs">
                  {o}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Classification filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
              <Shield size={11} />
              {classFilter === "all" ? "All levels" : classFilter}
              <ChevronDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setClassFilter("all")} className="text-xs">
              All levels
            </DropdownMenuItem>
            {(["public", "internal", "confidential", "restricted"] as DataClassification[]).map((c) => (
              <DropdownMenuItem key={c} onClick={() => setClassFilter(c)} className="text-xs capitalize">
                {CLASS_CONFIG[c].icon} {c}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Layer filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
              <Layers size={11} />
              {layerFilter === "all" ? "All layers" : layerFilter.toUpperCase()}
              <ChevronDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLayerFilter("all")} className="text-xs">
              All layers
            </DropdownMenuItem>
            {(["raw", "core", "refined", "application"] as DataLayer[]).map((l) => (
              <DropdownMenuItem key={l} onClick={() => setLayerFilter(l)} className="text-xs">
                <DataLayerBadge layer={l} size="sm" />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Broker filter */}
        {brokers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
                <Network size={11} />
                {brokerFilter === "all" ? "All brokers" : BROKER_CONFIG[brokerFilter]?.label || brokerFilter}
                <ChevronDown size={10} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setBrokerFilter("all")} className="text-xs">
                All brokers
              </DropdownMenuItem>
              {brokers.map((b) => (
                <DropdownMenuItem key={b} onClick={() => setBrokerFilter(b)} className="text-xs">
                  <span className={BROKER_CONFIG[b]?.color || "text-zinc-400"}>●</span>
                  <span className="ml-1.5">{BROKER_CONFIG[b]?.label || b}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {/* Table header */}
        <div className={cn("grid gap-2 px-4 py-2 border-b border-border bg-muted/20 text-[10px] uppercase tracking-wider font-medium text-muted-foreground", gridCols)}>
          {showScores && <div className="text-center">Score</div>}
          <div>Subject</div>
          <div>Broker</div>
          <div>Layer</div>
          <div>Owner</div>
          <div>Classification</div>
          <div>Tags</div>
          <div className="text-center">Format</div>
          <div className="text-center">Ver.</div>
          <div>Updated</div>
          <div />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/30">
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
                  className={cn("grid gap-2 px-4 py-2.5 items-center hover:bg-muted/20 transition-colors group", gridCols)}
                >
                  {/* Governance Score (conditional) */}
                  {showScores && (
                    <div className="flex justify-center">
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
                      <div className="text-[11px] text-muted-foreground/40 italic">
                        No description
                      </div>
                    )}
                  </div>

                  {/* Broker badges */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {(entry.broker_types || []).length > 0 ? (
                      entry.broker_types.map((b) => (
                        <span
                          key={b}
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded border border-border/50 bg-muted/30",
                            BROKER_CONFIG[b]?.color || "text-zinc-400"
                          )}
                        >
                          {BROKER_CONFIG[b]?.label || b}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                  </div>

                  {/* Data Layer */}
                  <div>
                    <DataLayerBadge layer={entry.data_layer} />
                  </div>

                  {/* Owner */}
                  <div className="text-xs text-muted-foreground truncate">
                    {entry.owner_team || (
                      <span className="text-muted-foreground/40 italic">—</span>
                    )}
                  </div>

                  {/* Classification */}
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 h-5 w-fit border", cls.color)}
                  >
                    {cls.label}
                  </Badge>

                  {/* Tags */}
                  <div className="flex gap-1 overflow-hidden">
                    {entry.tags.length > 0 ? (
                      entry.tags.slice(0, 2).map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-4 shrink-0"
                        >
                          {t}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                    {entry.tags.length > 2 && (
                      <span className="text-[9px] text-muted-foreground/50">
                        +{entry.tags.length - 2}
                      </span>
                    )}
                  </div>

                  {/* Format */}
                  <div className="flex justify-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4 border",
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

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setAsyncapiSubject(entry.subject)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-cyan-400 transition-colors"
                      title="View AsyncAPI spec"
                    >
                      <FileCode size={13} />
                    </button>
                    <button
                      onClick={() => setEditing(entry)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit enrichment"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex justify-between">
          <span>{filtered.length} of {catalog.length} entries</span>
          <span>
            {stats.documented} documented · {catalog.length - stats.documented} undocumented
          </span>
        </div>
      </Card>

      {/* Enrichment editor drawer */}
      {editing && registry && (
        <EnrichmentEditor
          registryId={registry.id}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {/* AsyncAPI drawer */}
      {asyncapiSubject && registry && (
        <AsyncAPIDrawer
          open={!!asyncapiSubject}
          onClose={() => setAsyncapiSubject(null)}
          registryId={registry.id}
          subject={asyncapiSubject}
        />
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