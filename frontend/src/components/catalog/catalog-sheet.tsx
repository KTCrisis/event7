// Placement: frontend/src/components/catalog/catalog-sheet.tsx
// Catalog Sheet — dual-tab detail panel (Schema + AsyncAPI)
// Replaces the old AsyncAPIDrawer approach
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X, Braces, FileCode, Loader2, AlertCircle, Copy, Check,
  Download, Zap, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import {
  getAsyncAPI,
  generateAsyncAPI,
  exportAsyncAPIYaml,
} from "@/lib/api/asyncapi";
import { AsyncApiViewer } from "@/components/asyncapi/asyncapi-viewer";
import type { AsyncAPISpec } from "@/types/asyncapi";
import type { CatalogEntry } from "@/types/governance";

// ── Types ──

interface SchemaDetail {
  subject: string;
  version: number;
  schema_id: number;
  format: string;
  schema_content: Record<string, unknown>;
}

interface CatalogSheetProps {
  registryId: string;
  entry: CatalogEntry;
  /** AsyncAPI status info from overview merge (optional) */
  asyncapiStatus?: {
    status: string;       // documented | ready | raw
    origin: string | null;
    sync_status: string | null;
    spec_version: number | null;
  } | null;
  onClose: () => void;
  onEdit: () => void;     // Open enrichment editor
}

type SheetTab = "schema" | "asyncapi";

// ── Component ──

export function CatalogSheet({
  registryId,
  entry,
  asyncapiStatus,
  onClose,
  onEdit,
}: CatalogSheetProps) {
  const hasAsyncAPI = asyncapiStatus?.status === "documented";
  const [activeTab, setActiveTab] = useState<SheetTab>("schema");

  // Schema state
  const [schema, setSchema] = useState<SchemaDetail | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // AsyncAPI state
  const [spec, setSpec] = useState<AsyncAPISpec | null>(null);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // ── Fetch schema on open ──
  useEffect(() => {
    let cancelled = false;
    setSchemaLoading(true);
    setSchemaError(null);

    api
      .get<SchemaDetail>(
        `/api/v1/registries/${registryId}/subjects/${encodeURIComponent(entry.subject)}`
      )
      .then((data) => {
        if (!cancelled) setSchema(data);
      })
      .catch((err) => {
        if (!cancelled) setSchemaError(err?.detail || err?.message || "Failed to load schema");
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });

    return () => { cancelled = true; };
  }, [registryId, entry.subject]);

  // ── Fetch AsyncAPI spec on tab switch ──
  useEffect(() => {
    if (activeTab !== "asyncapi") return;
    if (spec) return; // already loaded

    let cancelled = false;
    setAsyncLoading(true);
    setAsyncError(null);

    getAsyncAPI(registryId, entry.subject)
      .then((data) => {
        if (!cancelled) setSpec(data);
      })
      .catch(() => {
        // No spec exists yet — not an error, just empty
        if (!cancelled) setSpec(null);
      })
      .finally(() => {
        if (!cancelled) setAsyncLoading(false);
      });

    return () => { cancelled = true; };
  }, [registryId, entry.subject, activeTab, spec]);

  // ── Generate AsyncAPI ──
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setAsyncError(null);
    try {
      const result = await generateAsyncAPI(registryId, entry.subject, {
        include_examples: true,
        include_confluent_bindings: true,
        include_key_schema: true,
      });
      setSpec(result);
    } catch (err: any) {
      setAsyncError(err?.detail || err?.message || "Failed to generate spec");
    } finally {
      setGenerating(false);
    }
  }, [registryId, entry.subject]);

  // ── Export YAML ──
  const handleExportYaml = useCallback(async () => {
    try {
      const yamlContent = await exportAsyncAPIYaml(registryId, entry.subject);
      const blob = new Blob([yamlContent], { type: "application/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entry.subject}.asyncapi.yaml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  }, [registryId, entry.subject]);

  // ── Copy schema JSON ──
  const handleCopySchema = useCallback(async () => {
    if (!schema) return;
    await navigator.clipboard.writeText(JSON.stringify(schema.schema_content, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [schema]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet panel */}
      <div className="relative w-[75vw] max-w-[1200px] bg-card border-l border-border h-full flex flex-col animate-in slide-in-from-right-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold truncate" title={entry.subject}>
              {entry.subject}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] h-5">
                {entry.format}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                v{entry.latest_version} · {entry.version_count} version{entry.version_count > 1 ? "s" : ""}
              </span>
              {entry.owner_team && (
                <span className="text-[11px] text-muted-foreground">
                  · {entry.owner_team}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onEdit}>
              <Pencil size={13} />
              Edit Enrichment
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border px-6 shrink-0">
          <button
            onClick={() => setActiveTab("schema")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === "schema"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Braces size={14} />
            Schema
          </button>
          <button
            onClick={() => setActiveTab("asyncapi")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === "asyncapi"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCode size={14} />
            AsyncAPI
            {hasAsyncAPI && asyncapiStatus?.spec_version && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">
                v{asyncapiStatus.spec_version}
              </Badge>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === "schema" ? (
            <SchemaTab
              schema={schema}
              loading={schemaLoading}
              error={schemaError}
              copied={copied}
              onCopy={handleCopySchema}
            />
          ) : (
            <AsyncAPITab
              spec={spec}
              loading={asyncLoading}
              error={asyncError}
              generating={generating}
              hasSpec={hasAsyncAPI}
              onGenerate={handleGenerate}
              onExportYaml={handleExportYaml}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Schema Tab ──

function SchemaTab({
  schema,
  loading,
  error,
  copied,
  onCopy,
}: {
  schema: SchemaDetail | null;
  loading: boolean;
  error: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive gap-2">
        <AlertCircle size={18} />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!schema) return null;

  const rawJson = JSON.stringify(schema.schema_content, null, 2);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Schema ID: {schema.schema_id}</span>
          <span>·</span>
          <span>Version: {schema.version}</span>
          <span>·</span>
          <span>Format: {schema.format}</span>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={onCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {/* Schema JSON */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-6">
        <pre className="font-mono text-sm text-emerald-400 whitespace-pre leading-relaxed">
          {rawJson}
        </pre>
      </div>
    </div>
  );
}

// ── AsyncAPI Tab ──

function AsyncAPITab({
  spec,
  loading,
  error,
  generating,
  hasSpec,
  onGenerate,
  onExportYaml,
}: {
  spec: AsyncAPISpec | null;
  loading: boolean;
  error: string | null;
  generating: boolean;
  hasSpec: boolean;
  onGenerate: () => void;
  onExportYaml: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
        <Button size="sm" onClick={onGenerate} disabled={generating}>
          <Zap size={14} className="mr-1" />
          Try Generate
        </Button>
      </div>
    );
  }

  // No spec yet — empty state with generate CTA
  if (!spec) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-4">
        <div className="bg-muted p-4 rounded-full">
          <FileCode size={32} className="text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium text-muted-foreground">No AsyncAPI spec yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Generate one from this schema to get started.
          </p>
        </div>
        <Button onClick={onGenerate} disabled={generating} className="gap-1.5">
          {generating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          {generating ? "Generating…" : "Generate AsyncAPI"}
        </Button>
      </div>
    );
  }

  // Spec exists — show the full viewer
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {spec.is_auto_generated ? (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              <Zap size={10} /> Auto-generated
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <Pencil size={10} /> Manually edited
            </Badge>
          )}
          {spec.updated_at && (
            <span>Updated: {new Date(spec.updated_at).toLocaleString()}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Regenerate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={onExportYaml}
          >
            <Download size={12} />
            YAML
          </Button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-auto">
        <AsyncApiViewer
          schema={spec.spec_content}
          isAutoGenerated={spec.is_auto_generated}
          onExportYaml={onExportYaml}
        />
      </div>
    </div>
  );
}