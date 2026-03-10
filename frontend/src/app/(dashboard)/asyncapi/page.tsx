// src/app/(dashboard)/asyncapi/page.tsx
// AsyncAPI Documentation page — Phase 4
//
// Placement: frontend/src/app/(dashboard)/asyncapi/page.tsx
//
// Uses:
// - useRegistry() for registry_id context
// - lib/api/asyncapi.ts for generate/get/export
// - Subjects list from existing schemas API
// - @asyncapi/react-component for rendering

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FileCode, List, Loader2, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRegistry } from "@/providers/registry-provider";
import { api } from "@/lib/api/client";
import {
  generateAsyncAPI,
  getAsyncAPI,
  exportAsyncAPIYaml,
} from "@/lib/api/asyncapi";
import { AsyncApiViewer } from "@/components/asyncapi/asyncapi-viewer";
import type { AsyncAPISpec } from "@/types/asyncapi";

// Minimal subject type — matches what GET /subjects returns
interface SubjectInfo {
  name: string;
  format?: string;
  latest_version?: number;
}

export default function AsyncApiPage() {
  const { selected } = useRegistry();
  const registryId = selected?.id;

  // State
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [spec, setSpec] = useState<AsyncAPISpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // --- Load subjects when registry changes ---
  useEffect(() => {
    if (!registryId) {
      setSubjects([]);
      setSelectedSubject(null);
      setSpec(null);
      return;
    }

    let cancelled = false;

    async function loadSubjects() {
      setSubjectsLoading(true);
      try {
        const data = await api.get<SubjectInfo[]>(
          `/api/v1/registries/${registryId}/subjects`
        );
        if (!cancelled) {
          setSubjects(data);
        }
      } catch (err) {
        if (!cancelled) {
          setSubjects([]);
        }
      } finally {
        if (!cancelled) setSubjectsLoading(false);
      }
    }

    loadSubjects();
    return () => { cancelled = true; };
  }, [registryId]);

  // --- When a subject is selected, try to load existing spec ---
  useEffect(() => {
    if (!registryId || !selectedSubject) {
      setSpec(null);
      return;
    }

    let cancelled = false;

    async function loadSpec() {
      setLoading(true);
      setError(null);
      try {
        const existing = await getAsyncAPI(registryId!, selectedSubject!);
        if (!cancelled) {
          setSpec(existing);
        }
      } catch {
        // No existing spec — that's fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSpec();
    return () => { cancelled = true; };
  }, [registryId, selectedSubject]);

  // --- Generate spec ---
  const handleGenerate = useCallback(async () => {
    if (!registryId || !selectedSubject) return;

    setGenerating(true);
    setError(null);
    try {
      const result = await generateAsyncAPI(registryId, selectedSubject, {
        include_examples: true,
        include_confluent_bindings: true,
        include_key_schema: true,
      });
      setSpec(result);
    } catch (err: any) {
      setError(err?.message || "Failed to generate AsyncAPI spec");
    } finally {
      setGenerating(false);
    }
  }, [registryId, selectedSubject]);

  // --- Export YAML ---
  const handleExportYaml = useCallback(async () => {
    if (!registryId || !selectedSubject) return;

    try {
      const yamlContent = await exportAsyncAPIYaml(registryId, selectedSubject);

      // Trigger download
      const blob = new Blob([yamlContent], { type: "application/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedSubject}.asyncapi.yaml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export YAML");
    }
  }, [registryId, selectedSubject]);

  // --- No registry selected ---
  if (!registryId) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground">
        <FileCode size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-medium">No registry selected</p>
        <p className="text-sm">Select a registry from the top bar to browse AsyncAPI specs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCode className="text-primary" size={24} />
            AsyncAPI Documentation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate and browse AsyncAPI 3.0 specs from your registry schemas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar: Subject list */}
        <div className="col-span-3">
          <div className="border rounded-lg bg-card p-4 h-fit max-h-[800px] overflow-y-auto">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-muted-foreground">
              <List size={16} /> Subjects ({subjects.length})
            </h3>

            {subjectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : subjects.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No subjects found in this registry.
              </p>
            ) : (
              <div className="space-y-1">
                {subjects.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setSelectedSubject(s.name)}
                    className={cn(
                      "w-full text-left p-2 text-xs rounded-md transition-colors",
                      selectedSubject === s.name
                        ? "bg-primary/10 text-primary border-l-2 border-primary font-semibold"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="block truncate">{s.name}</span>
                    <div className="flex gap-1 mt-1">
                      {s.format && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {s.format}
                        </Badge>
                      )}
                      {s.latest_version && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          v{s.latest_version}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="col-span-9">
          {!selectedSubject ? (
            /* Empty state */
            <div className="border rounded-lg border-dashed flex flex-col items-center justify-center h-[600px] bg-card">
              <div className="bg-muted p-4 rounded-full mb-4">
                <FileCode size={40} className="text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-muted-foreground">
                Select a subject
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Pick a subject from the sidebar to generate or view its AsyncAPI spec.
              </p>
            </div>
          ) : loading ? (
            /* Loading */
            <div className="border rounded-lg flex items-center justify-center h-[600px] bg-card">
              <Loader2 size={32} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold truncate max-w-lg">
                    {selectedSubject}
                  </h2>
                  {spec?.updated_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last updated: {new Date(spec.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button
                onClick={handleGenerate}
                disabled={generating}
                size="sm"
                >
                {generating && <Loader2 size={14} className="mr-1 animate-spin" />}
                {!generating && <Zap size={14} className="mr-1" />}
                {generating ? "Generating..." : spec ? "Regenerate" : "Generate AsyncAPI"}
                </Button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Viewer or empty */}
              {spec ? (
                <AsyncApiViewer
                  schema={spec.spec_content}
                  isAutoGenerated={spec.is_auto_generated}
                  onExportYaml={handleExportYaml}
                />
              ) : !generating && !error ? (
                <div className="border rounded-lg border-dashed flex flex-col items-center justify-center h-[500px] bg-card">
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <Zap size={32} className="text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                    No spec generated yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click &quot;Generate AsyncAPI&quot; to create a spec from this schema.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}