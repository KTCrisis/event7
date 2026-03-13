// src/components/asyncapi/asyncapi-import.tsx
// 3-step import flow: paste/upload → preview → apply → results
"use client";

import { useState, useCallback } from "react";
import {
  Upload, FileCode, Loader2, AlertTriangle, CheckCircle2,
  XCircle, SkipForward, ArrowRight, ArrowLeft, ExternalLink,
  Network, Library, DatabaseZap, Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { importPreview, importApply } from "@/lib/api/asyncapi";
import { DataLayerBadge } from "@/components/catalog/data-layer-badge";
import { toast } from "sonner";
import Link from "next/link";
import type {
  AsyncAPIImportPreview,
  AsyncAPIImportResult,
  ImportEntityResult,
} from "@/types/asyncapi";

// Try parsing YAML if js-yaml is available, fallback to JSON only
let jsYaml: any = null;
try {
  jsYaml = require("js-yaml");
} catch {
  // js-yaml not installed — YAML paste won't work, only JSON
}

interface AsyncAPIImportProps {
  registryId: string;
}

type Step = "input" | "preview" | "result";

const STATUS_ICON: Record<string, React.ReactNode> = {
  created: <CheckCircle2 size={12} className="text-emerald-400" />,
  updated: <CheckCircle2 size={12} className="text-cyan-400" />,
  skipped: <SkipForward size={12} className="text-slate-400" />,
  failed: <XCircle size={12} className="text-red-400" />,
};

const BROKER_ICONS: Record<string, string> = {
  kafka: "🔶", redpanda: "🐼", rabbitmq: "🐰", pulsar: "⚡", nats: "🔷",
  google_pubsub: "☁️", aws_sns_sqs: "📦", azure_servicebus: "🔵",
  redis_streams: "🔴", custom: "⚙️",
};

export function AsyncAPIImport({ registryId }: AsyncAPIImportProps) {
  const [step, setStep] = useState<Step>("input");
  const [rawInput, setRawInput] = useState("");
  const [parsedSpec, setParsedSpec] = useState<Record<string, unknown> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Preview
  const [preview, setPreview] = useState<AsyncAPIImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Apply
  const [registerSchemas, setRegisterSchemas] = useState(false);
  const [result, setResult] = useState<AsyncAPIImportResult | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);

  // ── Parse input ──
  const handleParse = useCallback(() => {
    setParseError(null);
    const trimmed = rawInput.trim();
    if (!trimmed) {
      setParseError("Please paste or upload an AsyncAPI spec");
      return;
    }

    let parsed: Record<string, unknown> | null = null;

    // Try JSON first
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Try YAML
      if (jsYaml) {
        try {
          parsed = jsYaml.load(trimmed) as Record<string, unknown>;
        } catch (e: any) {
          setParseError(`Invalid JSON or YAML: ${e.message || "parse error"}`);
          return;
        }
      } else {
        setParseError("Invalid JSON. For YAML support, install js-yaml (npm i js-yaml).");
        return;
      }
    }

    if (!parsed || typeof parsed !== "object") {
      setParseError("Parsed content is not a valid object");
      return;
    }

    // Basic AsyncAPI validation
    if (!parsed.channels && !parsed.asyncapi) {
      setParseError("This doesn't look like an AsyncAPI spec — missing 'asyncapi' or 'channels' field");
      return;
    }

    setParsedSpec(parsed);
    handlePreview(parsed);
  }, [rawInput, registryId]);

  // ── Preview ──
  const handlePreview = async (spec: Record<string, unknown>) => {
    setPreviewLoading(true);
    try {
      const result = await importPreview(registryId, spec);
      setPreview(result);
      setStep("preview");
    } catch (err: any) {
      setParseError(err?.detail || "Preview failed — check your spec format");
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Apply ──
  const handleApply = async () => {
    if (!parsedSpec) return;
    setApplyLoading(true);
    try {
      const res = await importApply(registryId, parsedSpec, registerSchemas);
      setResult(res);
      setStep("result");
      toast.success(
        `Import complete: ${res.channels_created} channels, ${res.bindings_created} bindings`
      );
    } catch (err: any) {
      toast.error(err?.detail || "Import failed");
    } finally {
      setApplyLoading(false);
    }
  };

  // ── File upload ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawInput(reader.result as string);
      setParseError(null);
    };
    reader.readAsText(file);
    e.target.value = ""; // reset input
  };

  // ── Reset ──
  const handleReset = () => {
    setStep("input");
    setRawInput("");
    setParsedSpec(null);
    setParseError(null);
    setPreview(null);
    setResult(null);
    setRegisterSchemas(false);
  };

  return (
    <div className="space-y-4">
      {/* ── Step 1: Input ── */}
      {step === "input" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Paste an AsyncAPI v3 spec (JSON or YAML) or upload a file.
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                <Upload size={12} />
                Upload file
              </span>
            </label>
          </div>

          <textarea
            value={rawInput}
            onChange={(e) => { setRawInput(e.target.value); setParseError(null); }}
            placeholder={`{
  "asyncapi": "3.0.0",
  "info": { "title": "My API", "version": "1.0.0" },
  "channels": { ... },
  "operations": { ... }
}`}
            rows={16}
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />

          {parseError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/5 border border-red-500/15 rounded-md px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleParse}
              disabled={!rawInput.trim() || previewLoading}
            >
              {previewLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              Preview Import
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* Spec info */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <FileCode size={18} className="text-cyan-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {preview.spec_title || "Untitled Spec"}
                  {preview.spec_version && (
                    <span className="text-muted-foreground ml-2 font-normal">v{preview.spec_version}</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  AsyncAPI {preview.asyncapi_version || "unknown"}
                </div>
              </div>
            </div>
          </Card>

          {/* Counts */}
          <div className="grid grid-cols-5 gap-2">
            <MiniStat label="Channels" value={preview.total_channels} icon={<Network size={12} className="text-cyan-400" />} />
            <MiniStat label="Bindings" value={preview.total_bindings} icon={<DatabaseZap size={12} className="text-purple-400" />} />
            <MiniStat label="Enrichments" value={preview.total_enrichments} icon={<Library size={12} className="text-emerald-400" />} />
            <MiniStat label="Schemas found" value={preview.schemas_found} icon={<CheckCircle2 size={12} className="text-emerald-400" />} />
            <MiniStat label="Schemas missing" value={preview.schemas_missing} icon={<AlertTriangle size={12} className={preview.schemas_missing > 0 ? "text-amber-400" : "text-slate-500"} />} />
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2 space-y-1">
              {preview.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Channels preview */}
          {preview.channels.length > 0 && (
            <PreviewSection title="Channels" count={preview.channels.length}>
              {preview.channels.map((ch) => (
                <div key={ch.address} className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/20">
                  <span className="text-sm">{BROKER_ICONS[ch.broker_type] || "⚙️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{ch.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{ch.address}</div>
                  </div>
                  <DataLayerBadge layer={ch.data_layer as any} />
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    {ch.messaging_pattern}
                  </Badge>
                </div>
              ))}
            </PreviewSection>
          )}

          {/* Bindings preview */}
          {preview.bindings.length > 0 && (
            <PreviewSection title="Subject Bindings" count={preview.bindings.length}>
              {preview.bindings.map((b, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/20">
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    b.found_in_registry ? "bg-emerald-400" : "bg-amber-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{b.subject_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      → {b.channel_address} · {b.schema_role}
                    </div>
                  </div>
                  {!b.found_in_registry && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-amber-400 border-amber-500/20">
                      not in SR
                    </Badge>
                  )}
                </div>
              ))}
            </PreviewSection>
          )}

          {/* Enrichments preview */}
          {preview.enrichments.length > 0 && (
            <PreviewSection title="Enrichments" count={preview.enrichments.length}>
              {preview.enrichments.map((e) => (
                <div key={e.subject} className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{e.subject}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {e.owner_team && `owner=${e.owner_team}`}
                      {e.data_layer && ` · layer=${e.data_layer}`}
                      {e.tags.length > 0 && ` · tags=${e.tags.join(", ")}`}
                    </div>
                  </div>
                  <DataLayerBadge layer={e.data_layer as any} />
                </div>
              ))}
            </PreviewSection>
          )}

          {/* Unknown schemas + register option */}
          {preview.schemas_missing > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                <AlertTriangle size={13} />
                {preview.schemas_missing} schema{preview.schemas_missing > 1 ? "s" : ""} not found in the registry
              </div>
              <div className="space-y-1 pl-5">
                {preview.unknown_schemas.map((s) => (
                  <div key={s.subject_name} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <Braces size={10} />
                    {s.subject_name}
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3">{s.format}</Badge>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={registerSchemas}
                  onChange={(e) => setRegisterSchemas(e.target.checked)}
                  className="rounded border-border"
                />
                Register missing schemas in the Schema Registry
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep("input")}>
              <ArrowLeft size={14} />
              Back
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleApply}
              disabled={applyLoading}
            >
              {applyLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Apply Import ({preview.total_channels} channels, {preview.total_bindings} bindings)
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === "result" && result && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="p-4 bg-emerald-500/5 border-emerald-500/15">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <div>
                <div className="text-sm font-medium text-emerald-300">Import Complete</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {result.channels_created} channels · {result.bindings_created} bindings · {result.enrichments_updated} enrichments
                  {result.schemas_registered > 0 && ` · ${result.schemas_registered} schemas registered`}
                </div>
              </div>
            </div>
          </Card>

          {/* Quick links */}
          <div className="flex gap-2">
            {result.channels_created > 0 && (
              <Link
                href="/channels"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-cyan-500/30 transition-colors"
              >
                <Network size={12} />
                View Channels
                <ExternalLink size={10} />
              </Link>
            )}
            {result.enrichments_updated > 0 && (
              <Link
                href="/catalog"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-cyan-500/30 transition-colors"
              >
                <Library size={12} />
                View Catalog
                <ExternalLink size={10} />
              </Link>
            )}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2 space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Detail log */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/20 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
              Detail Log ({result.results.length} operations)
            </div>
            <div className="divide-y divide-border/20 max-h-[300px] overflow-y-auto">
              {result.results.map((r, i) => (
                <ResultRow key={i} result={r} />
              ))}
            </div>
          </Card>

          {/* Reset */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReset}>
              Import Another Spec
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function MiniStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="px-2.5 py-2 flex items-center gap-2">
      {icon}
      <div>
        <div className="text-sm font-bold leading-tight">{value}</div>
        <div className="text-[9px] text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function PreviewSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/20 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
        {title} ({count})
      </div>
      <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
        {children}
      </div>
    </Card>
  );
}

function ResultRow({ result }: { result: ImportEntityResult }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      {STATUS_ICON[result.status] || STATUS_ICON.skipped}
      <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 w-16 justify-center shrink-0">
        {result.entity_type}
      </Badge>
      <span className="text-xs text-foreground truncate flex-1" title={result.name}>
        {result.name}
      </span>
      <span className={cn(
        "text-[10px] shrink-0",
        result.status === "created" && "text-emerald-400",
        result.status === "updated" && "text-cyan-400",
        result.status === "skipped" && "text-slate-400",
        result.status === "failed" && "text-red-400",
      )}>
        {result.status}
      </span>
      {result.detail && (
        <span className="text-[9px] text-muted-foreground/60 truncate max-w-[150px]" title={result.detail}>
          {result.detail}
        </span>
      )}
    </div>
  );
}