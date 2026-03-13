"use client";

import { useEffect, useState, useCallback } from "react";
import { X, FileCode, Loader2, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getAsyncAPI, generateAsyncAPI } from "@/lib/api/asyncapi";

/**
 * AsyncAPI Drawer — opens from catalog, shows spec for a subject.
 * Auto-generates if no spec exists.
 *
 * Placement: frontend/src/components/catalog/asyncapi-drawer.tsx
 */

interface AsyncAPIDrawerProps {
  open: boolean;
  onClose: () => void;
  registryId: string;
  subject: string;
}

export function AsyncAPIDrawer({
  open,
  onClose,
  registryId,
  subject,
}: AsyncAPIDrawerProps) {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load or generate spec when drawer opens
  useEffect(() => {
    if (!open || !registryId || !subject) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSpec(null);

    (async () => {
      try {
        // Try existing spec first
        const existing = await getAsyncAPI(registryId, subject);
        if (!cancelled && existing) {
          setSpec(existing.spec_content);
          return;
        }
        // Auto-generate
        if (!cancelled) {
          setGenerating(true);
          const generated = await generateAsyncAPI(registryId, subject, {
            include_examples: true,
            include_confluent_bindings: true,
            include_key_schema: true,
          });
          if (!cancelled) setSpec(generated.spec_content);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load AsyncAPI spec");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setGenerating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, registryId, subject]);

  const handleRegenerate = useCallback(async () => {
    if (!registryId || !subject) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAsyncAPI(registryId, subject, {
        include_examples: true,
        include_confluent_bindings: true,
        include_key_schema: true,
      });
      setSpec(result.spec_content);
    } catch (err: any) {
      setError(err?.message || "Failed to generate spec");
    } finally {
      setGenerating(false);
    }
  }, [registryId, subject]);

  const rawSpec = spec ? JSON.stringify(spec, null, 2) : "";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
      >
        <SheetHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileCode size={16} className="text-cyan-400" />
              AsyncAPI — {subject}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleRegenerate}
                disabled={generating || loading}
              >
                {generating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Zap size={12} />
                )}
                {generating ? "Generating…" : "Regenerate"}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="p-6">
          {loading && !generating && (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 size={18} className="animate-spin" />
              Loading spec…
            </div>
          )}

          {generating && (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 size={18} className="animate-spin" />
              Generating AsyncAPI spec…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {spec && !loading && !generating && (
            <div className="space-y-4">
              {/* Info summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-border p-3 bg-muted/20">
                  <span className="text-muted-foreground">Title</span>
                  <p className="font-medium mt-0.5 truncate">
                    {(spec as any)?.info?.title || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 bg-muted/20">
                  <span className="text-muted-foreground">Version</span>
                  <p className="font-medium mt-0.5">
                    {(spec as any)?.info?.version || "—"}
                  </p>
                </div>
              </div>

              {/* Channels summary */}
              {(spec as any)?.channels && (
                <div className="rounded-lg border border-border p-3 bg-muted/20 text-xs">
                  <span className="text-muted-foreground">Channels</span>
                  <div className="mt-1 space-y-1">
                    {Object.entries((spec as any).channels).map(
                      ([id, ch]: [string, any]) => (
                        <div
                          key={id}
                          className="flex items-center justify-between"
                        >
                          <span className="font-mono text-cyan-400 truncate">
                            {ch.address || id}
                          </span>
                          <span className="text-muted-foreground">
                            {Object.keys(ch.messages || {}).length} msg
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Raw spec */}
              <div className="rounded-lg overflow-hidden border border-border">
                <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                    JSON Spec
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => navigator.clipboard.writeText(rawSpec)}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="p-4 bg-zinc-950 text-emerald-400 text-[11px] font-mono overflow-auto max-h-[500px] leading-relaxed">
                  {rawSpec}
                </pre>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}