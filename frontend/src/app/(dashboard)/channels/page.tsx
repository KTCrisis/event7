// src/app/(dashboard)/channels/page.tsx
// Phase D — Channels page: list, filters, create, detail drawer
// v2: Tier 1-3 broker types (22 total), imports from types/channel.ts
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Search, Plus, Loader2, AlertCircle, Radio,
  ChevronDown, Trash2, DatabaseZap, Network,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRegistry } from "@/providers/registry-provider";
import { listChannels, createChannel, deleteChannel } from "@/lib/api/channels";
import { ChannelDetail } from "@/components/channels/channel-detail";
import { DataLayerBadge } from "@/components/catalog/data-layer-badge";
import { toast } from "sonner";
import type {
  ChannelSummary, ChannelCreate, BrokerType, ResourceKind,
  MessagingPattern,
} from "@/types/channel";
import {
  BROKER_ICONS, BROKER_LABELS, PATTERN_LABELS,
  DEFAULT_RESOURCE, DEFAULT_PATTERN,
} from "@/types/channel";
import type { DataLayer } from "@/types/governance";

const HEALTH_DOT: Record<string, string> = {
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  unknown: "bg-slate-500",
};

export default function ChannelsPage() {
  const { selected: registry } = useRegistry();
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [brokerFilter, setBrokerFilter] = useState<string>("all");
  const [layerFilter, setLayerFilter] = useState<string>("all");

  // Detail drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);

  // Fetch channels (with cancellation to prevent race conditions)
  const loadRef = useRef(0);
  const load = useCallback(() => {
    if (!registry) { setChannels([]); return; }
    const id = ++loadRef.current;
    setLoading(true);
    setError(null);
    listChannels(registry.id)
      .then((data) => { if (id === loadRef.current) setChannels(data); })
      .catch((err) => { if (id === loadRef.current) setError(err?.detail || "Failed to load channels"); })
      .finally(() => { if (id === loadRef.current) setLoading(false); });
  }, [registry]);

  useEffect(() => { load(); }, [load]);

  // Stats
  const stats = useMemo(() => {
    const brokers = new Set(channels.map((c) => c.broker_type));
    const totalBindings = channels.reduce((s, c) => s + c.subject_count, 0);
    const degraded = channels.filter((c) => c.binding_health === "degraded").length;
    return { total: channels.length, brokers: brokers.size, totalBindings, degraded };
  }, [channels]);

  // Filtered
  const filtered = useMemo(() => {
    return channels.filter((c) => {
      const matchSearch = !search
        || c.name.toLowerCase().includes(search.toLowerCase())
        || c.address.toLowerCase().includes(search.toLowerCase());
      const matchBroker = brokerFilter === "all" || c.broker_type === brokerFilter;
      const matchLayer = layerFilter === "all" || c.data_layer === layerFilter;
      return matchSearch && matchBroker && matchLayer;
    });
  }, [channels, search, brokerFilter, layerFilter]);

  // Unique brokers for filter
  const brokerTypes = useMemo(() => {
    return [...new Set(channels.map((c) => c.broker_type))].sort();
  }, [channels]);

  // Delete
  const handleDelete = async (id: string, name: string) => {
    if (!registry) return;
    if (!confirm(`Delete channel "${name}" and all its bindings?`)) return;
    try {
      await deleteChannel(registry.id, id);
      toast.success(`Channel "${name}" deleted`);
      load();
      if (selectedId === id) setSelectedId(null);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to delete channel");
    }
  };

  // No registry
  if (!registry) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <DatabaseZap size={40} className="text-muted-foreground/30" />
        <p className="text-sm">Select a registry to view channels</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        Loading channels…
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
            <Network size={18} className="text-cyan-400" />
            Channels
          </h1>
          <p className="text-xs text-muted-foreground">
            Messaging channels bound to your schemas — topics, exchanges, queues, streams.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
          <Plus size={13} />
          New Channel
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <MiniKpi label="Channels" value={stats.total} icon={<Network size={14} className="text-cyan-400" />} />
        <MiniKpi label="Brokers" value={stats.brokers} icon={<Radio size={14} className="text-emerald-400" />} />
        <MiniKpi label="Bindings" value={stats.totalBindings} icon={<DatabaseZap size={14} className="text-purple-400" />} />
        <MiniKpi label="Degraded" value={stats.degraded} icon={<AlertCircle size={14} className={stats.degraded > 0 ? "text-amber-400" : "text-muted-foreground"} />} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input
            placeholder="Search channels by name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm bg-muted/30"
          />
        </div>

        {/* Broker filter */}
        {brokerTypes.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
                <Radio size={11} />
                {brokerFilter === "all" ? "All brokers" : BROKER_LABELS[brokerFilter]}
                <ChevronDown size={10} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setBrokerFilter("all")} className="text-xs">All brokers</DropdownMenuItem>
              {brokerTypes.map((b) => (
                <DropdownMenuItem key={b} onClick={() => setBrokerFilter(b)} className="text-xs">
                  {BROKER_ICONS[b]} {BROKER_LABELS[b]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Layer filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
              {layerFilter === "all" ? "All layers" : layerFilter.toUpperCase()}
              <ChevronDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLayerFilter("all")} className="text-xs">All layers</DropdownMenuItem>
            {(["raw", "core", "refined", "application"] as const).map((l) => (
              <DropdownMenuItem key={l} onClick={() => setLayerFilter(l)} className="text-xs">
                <DataLayerBadge layer={l} size="sm" />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_80px_70px_60px_60px_36px] gap-2 px-4 py-2 border-b border-border bg-muted/20 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
          <div>Channel</div>
          <div>Broker</div>
          <div>Pattern</div>
          <div>Layer</div>
          <div className="text-center">Subjects</div>
          <div className="text-center">Health</div>
          <div />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/30">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? "No matching channels" : "No channels yet — create one to get started"}
            </div>
          ) : (
            filtered.map((ch) => (
              <div
                key={ch.id}
                onClick={() => setSelectedId(ch.id)}
                className="grid grid-cols-[1fr_100px_80px_70px_60px_60px_36px] gap-2 px-4 py-2.5 items-center hover:bg-muted/20 transition-colors cursor-pointer group"
              >
                {/* Name + address */}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{ch.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate" title={ch.address}>
                    {ch.address}
                  </div>
                </div>

                {/* Broker */}
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>{BROKER_ICONS[ch.broker_type]}</span>
                  <span className="truncate">{BROKER_LABELS[ch.broker_type]}</span>
                </div>

                {/* Pattern */}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 w-fit">
                  {PATTERN_LABELS[ch.messaging_pattern]}
                </Badge>

                {/* Layer */}
                <DataLayerBadge layer={ch.data_layer as any} />

                {/* Subject count */}
                <div className="text-center text-xs text-muted-foreground tabular-nums">
                  {ch.subject_count}
                </div>

                {/* Health dot */}
                <div className="flex justify-center">
                  <span
                    className={cn("inline-block h-2 w-2 rounded-full", HEALTH_DOT[ch.binding_health] || HEALTH_DOT.unknown)}
                    title={ch.binding_health}
                  />
                </div>

                {/* Delete */}
                <div className="flex justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(ch.id, ch.name); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                    title="Delete channel"
                  >
                    <Trash2 size={13} className="text-muted-foreground hover:text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          {filtered.length} of {channels.length} channels
        </div>
      </Card>

      {/* Detail drawer */}
      {selectedId && registry && (
        <ChannelDetail
          registryId={registry.id}
          channelId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
        />
      )}

      {/* Create dialog */}
      {showCreate && registry && (
        <CreateChannelDialog
          registryId={registry.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

// === Mini KPI ===
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

// === Create Channel Dialog ===
function CreateChannelDialog({
  registryId,
  onClose,
  onCreated,
}: {
  registryId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [brokerType, setBrokerType] = useState<BrokerType>("kafka");
  const [dataLayer, setDataLayer] = useState<DataLayer | "">("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !address.trim()) return;
    setSaving(true);
    try {
      await createChannel(registryId, {
        name: name.trim(),
        address: address.trim(),
        broker_type: brokerType,
        resource_kind: DEFAULT_RESOURCE[brokerType] || "topic",
        messaging_pattern: DEFAULT_PATTERN[brokerType] || "topic_log",
        data_layer: dataLayer || null,
        description: description.trim() || null,
      });
      toast.success(`Channel "${name}" created`);
      onCreated();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to create channel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">New Channel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Billing Events" className="h-9 text-sm" />
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Address</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. corp.billing.events.v1" className="h-9 text-sm" />
            <p className="text-[10px] text-muted-foreground/60">Topic name, exchange name, NATS subject, etc.</p>
          </div>

          {/* Broker */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Broker Type</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(BROKER_LABELS) as BrokerType[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setBrokerType(b)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium border transition-all",
                    brokerType === b
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
                  )}
                >
                  {BROKER_ICONS[b]} {BROKER_LABELS[b]}
                </button>
              ))}
            </div>
          </div>

          {/* Layer (optional) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Layer (optional)</label>
            <div className="flex gap-1.5">
              {(["", "raw", "core", "refined", "application"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setDataLayer(l)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium border transition-all",
                    dataLayer === l
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
                  )}
                >
                  {l ? <DataLayerBadge layer={l} size="sm" /> : "None"}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What flows through this channel?"
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={saving || !name.trim() || !address.trim()} className="gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}