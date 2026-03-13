// src/components/channels/channel-detail.tsx
// Drawer showing channel details + bindings list + add binding form
"use client";

import { useEffect, useState } from "react";
import {
  X, Save, Loader2, Plus, Trash2, Link2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getChannel, createBinding, deleteBinding } from "@/lib/api/channels";
import { DataLayerBadge } from "@/components/catalog/data-layer-badge";
import { toast } from "sonner";
import type {
  ChannelResponse,
  ChannelSubjectResponse,
  ChannelSubjectCreate,
  BindingStrategy,
  SchemaRole,
  BindingOrigin,
  BindingStatus,
} from "@/types/channel";

// Display helpers (inlined to avoid import issues with const objects from types)
const BROKER_ICONS: Record<string, string> = {
  kafka: "🔶", redpanda: "🐼", rabbitmq: "🐰", pulsar: "⚡", nats: "🔷",
  google_pubsub: "☁️", aws_sns_sqs: "📦", azure_servicebus: "🔵",
  redis_streams: "🔴", custom: "⚙️",
};
const BROKER_LABELS: Record<string, string> = {
  kafka: "Kafka", redpanda: "Redpanda", rabbitmq: "RabbitMQ", pulsar: "Pulsar",
  nats: "NATS", google_pubsub: "Google Pub/Sub", aws_sns_sqs: "AWS SNS/SQS",
  azure_servicebus: "Azure Service Bus", redis_streams: "Redis Streams", custom: "Custom",
};
const PATTERN_LABELS: Record<string, string> = {
  topic_log: "Topic Log", pubsub: "Pub/Sub", queue: "Queue",
};
const RESOURCE_LABELS: Record<string, string> = {
  topic: "Topic", exchange: "Exchange", subject: "Subject", queue: "Queue", stream: "Stream",
};
const STRATEGY_LABELS: Record<string, string> = {
  channel_bound: "Channel-Bound", domain_bound: "Domain-Bound", app_bound: "App-Bound",
};
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-emerald-400", dot: "bg-emerald-400" },
  missing_subject: { label: "Missing", color: "text-red-400", dot: "bg-red-400" },
  stale: { label: "Stale", color: "text-amber-400", dot: "bg-amber-400" },
  unverified: { label: "Unverified", color: "text-slate-400", dot: "bg-slate-400" },
};

interface ChannelDetailProps {
  registryId: string;
  channelId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function ChannelDetail({ registryId, channelId, onClose, onUpdated }: ChannelDetailProps) {
  const [channel, setChannel] = useState<ChannelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add binding form
  const [showAddForm, setShowAddForm] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getChannel(registryId, channelId)
      .then(setChannel)
      .catch((err) => setError(err?.detail || "Failed to load channel"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [registryId, channelId]);

  const handleDeleteBinding = async (bindingId: string, subjectName: string) => {
    try {
      await deleteBinding(registryId, channelId, bindingId);
      toast.success(`Binding to "${subjectName}" removed`);
      load();
      onUpdated();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to delete binding");
    }
  };

  const handleBindingCreated = () => {
    setShowAddForm(false);
    load();
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-[480px] bg-card border-l border-border h-full flex flex-col animate-in slide-in-from-right-2">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0 flex-1">
            {channel ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{BROKER_ICONS[channel.broker_type]}</span>
                  <h2 className="text-sm font-semibold truncate">{channel.name}</h2>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5" title={channel.address}>
                  {channel.address}
                </p>
              </>
            ) : (
              <h2 className="text-sm font-semibold">Channel Detail</h2>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="animate-spin" size={16} />
              <span className="text-sm">Loading…</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-destructive gap-2">
              <AlertTriangle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          ) : channel ? (
            <div className="divide-y divide-border/30">
              {/* Channel info */}
              <div className="p-5 space-y-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Channel Info</h3>

                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="Broker" value={
                    <span className="flex items-center gap-1.5">
                      {BROKER_ICONS[channel.broker_type]}
                      {BROKER_LABELS[channel.broker_type]}
                    </span>
                  } />
                  <InfoItem label="Resource" value={RESOURCE_LABELS[channel.resource_kind] || channel.resource_kind} />
                  <InfoItem label="Pattern" value={
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {PATTERN_LABELS[channel.messaging_pattern]}
                    </Badge>
                  } />
                  <InfoItem label="Layer" value={<DataLayerBadge layer={channel.data_layer as any} size="md" />} />
                </div>

                {channel.description && (
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">Description</span>
                    <p className="text-xs text-foreground mt-0.5">{channel.description}</p>
                  </div>
                )}

                {channel.owner && (
                  <InfoItem label="Owner" value={channel.owner} />
                )}

                {channel.tags && channel.tags.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">Tags</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {channel.tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-[9px] px-1 py-0 h-4">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {channel.is_auto_detected && (
                  <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                    <span>Auto-detected via {channel.auto_detect_source}</span>
                  </div>
                )}
              </div>

              {/* Bindings */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Subject Bindings ({channel.subjects.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1"
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    <Plus size={10} />
                    Add
                  </Button>
                </div>

                {/* Add binding form */}
                {showAddForm && (
                  <AddBindingForm
                    registryId={registryId}
                    channelId={channelId}
                    onCreated={handleBindingCreated}
                    onCancel={() => setShowAddForm(false)}
                  />
                )}

                {/* Bindings list */}
                {channel.subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 py-4 text-center">
                    No subjects bound to this channel yet
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {channel.subjects.map((b) => (
                      <BindingRow
                        key={b.id}
                        binding={b}
                        onDelete={() => handleDeleteBinding(b.id, b.subject_name)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Broker config (collapsible raw JSON) */}
              {channel.broker_config && Object.keys(channel.broker_config).length > 0 && (
                <BrokerConfigSection config={channel.broker_config} />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// === Sub-components ===

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <div className="text-xs text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function BindingRow({ binding, onDelete }: { binding: ChannelSubjectResponse; onDelete: () => void }) {
  const status = STATUS_CONFIG[binding.binding_status] || STATUS_CONFIG.unverified;

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors group">
      {/* Status dot */}
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} title={status.label} />

      {/* Subject name */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" title={binding.subject_name}>
          {binding.subject_name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-muted-foreground">
            {STRATEGY_LABELS[binding.binding_strategy]}
          </span>
          <span className="text-[9px] text-muted-foreground/50">·</span>
          <span className="text-[9px] text-muted-foreground">
            {binding.schema_role}
          </span>
          {binding.binding_selector && (
            <>
              <span className="text-[9px] text-muted-foreground/50">·</span>
              <span className="text-[9px] text-cyan-400/70 truncate" title={binding.binding_selector}>
                {binding.binding_selector}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Origin badge */}
      <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 shrink-0 text-muted-foreground/60">
        {binding.binding_origin}
      </Badge>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted shrink-0"
        title="Remove binding"
      >
        <Trash2 size={11} className="text-muted-foreground hover:text-red-400" />
      </button>
    </div>
  );
}

function BrokerConfigSection({ config }: { config: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-5 space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        Broker Config {open ? "▾" : "▸"}
      </button>
      {open && (
        <pre className="text-[10px] text-muted-foreground bg-muted/30 rounded p-3 overflow-x-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      )}
    </div>
  );
}

// === Add Binding Form ===

function AddBindingForm({
  registryId,
  channelId,
  onCreated,
  onCancel,
}: {
  registryId: string;
  channelId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [subjectName, setSubjectName] = useState("");
  const [strategy, setStrategy] = useState<BindingStrategy>("channel_bound");
  const [role, setRole] = useState<SchemaRole>("value");
  const [selector, setSelector] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!subjectName.trim()) return;
    setSaving(true);
    try {
      await createBinding(registryId, channelId, {
        subject_name: subjectName.trim(),
        binding_strategy: strategy,
        schema_role: role,
        binding_origin: "manual",
        binding_selector: selector.trim() || null,
      });
      toast.success(`Bound "${subjectName}" to channel`);
      onCreated();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to create binding");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-3">
      {/* Subject name */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground">Subject Name</label>
        <Input
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          placeholder="e.g. orders-value or com.acme.billing.Invoice.v2"
          className="h-8 text-xs"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      {/* Strategy */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground">Binding Strategy</label>
        <div className="flex gap-1.5">
          {(["channel_bound", "domain_bound", "app_bound"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-medium border transition-all",
                strategy === s
                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                  : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
              )}
            >
              {STRATEGY_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Role */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground">Schema Role</label>
        <div className="flex gap-1.5">
          {(["value", "key", "header", "envelope"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-medium border transition-all capitalize",
                role === r
                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                  : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Selector (optional) */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground">Binding Selector (optional)</label>
        <Input
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
          placeholder="e.g. billing.invoice.* or eventType=InvoiceCreated"
          className="h-8 text-xs"
        />
        <p className="text-[9px] text-muted-foreground/50">Routing key pattern, attribute filter, record name…</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-[10px] gap-1"
          onClick={handleSubmit}
          disabled={saving || !subjectName.trim()}
        >
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Link2 size={10} />}
          Bind
        </Button>
      </div>
    </div>
  );
}