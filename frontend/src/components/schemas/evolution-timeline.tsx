// src/components/schemas/evolution-timeline.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  ArrowRightLeft,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getVersionsDetail, diffVersions, getCompatibility } from "@/lib/api/schemas";
import type { SchemaVersion, SchemaDiff, CompatibilityInfo } from "@/types/schema";

interface EvolutionTimelineProps {
  registryId: string;
  subject: string;
  versions: number[];
}

interface VersionEntry {
  version: SchemaVersion;
  diff: SchemaDiff | null;
  diffLoading: boolean;
  diffError: string | null;
}

function countTopLevelFields(content: Record<string, unknown>): number {
  if (Array.isArray(content.fields)) return content.fields.length;
  if (content.properties && typeof content.properties === "object")
    return Object.keys(content.properties).length;
  return 0;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EvolutionTimeline({
  registryId,
  subject,
  versions,
}: EvolutionTimelineProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<VersionEntry[]>([]);
  const [compat, setCompat] = useState<CompatibilityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  const INITIAL_BATCH = 3;

  // Step 1: Load all versions detail + compatibility
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getVersionsDetail(registryId, subject),
      getCompatibility(registryId, subject).catch(() => null),
    ])
      .then(([versionsData, compatData]) => {
        if (cancelled) return;

        // Sort descending (newest first)
        const sorted = [...versionsData].sort(
          (a, b) => b.version - a.version
        );

        setEntries(
          sorted.map((v) => ({
            version: v,
            diff: null,
            diffLoading: false,
            diffError: null,
          }))
        );
        setCompat(compatData);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.detail || "Failed to load version history");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [registryId, subject]);

  // Step 2: Load diffs for the first batch once entries are ready
  const loadDiff = useCallback(
    async (currentVersion: number, previousVersion: number, index: number) => {
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, diffLoading: true } : e))
      );

      try {
        const diff = await diffVersions(
          registryId,
          subject,
          previousVersion,
          currentVersion
        );
        setEntries((prev) =>
          prev.map((e, i) =>
            i === index ? { ...e, diff, diffLoading: false } : e
          )
        );
      } catch (err: any) {
        setEntries((prev) =>
          prev.map((e, i) =>
            i === index
              ? {
                  ...e,
                  diffLoading: false,
                  diffError: err?.detail || "Diff failed",
                }
              : e
          )
        );
      }
    },
    [registryId, subject]
  );

  useEffect(() => {
    if (entries.length < 2 || loadedCount > 0) return;

    // Load first batch of diffs (skip index 0 if it's the latest with no diff needed for last entry)
    const toLoad = Math.min(INITIAL_BATCH, entries.length - 1);
    for (let i = 0; i < toLoad; i++) {
      const curr = entries[i];
      const prev = entries[i + 1];
      if (curr && prev) {
        loadDiff(curr.version.version, prev.version.version, i);
      }
    }
    setLoadedCount(toLoad);
  }, [entries, loadedCount, loadDiff]);

  const loadMore = () => {
    const start = loadedCount;
    const toLoad = Math.min(INITIAL_BATCH, entries.length - 1 - start);
    for (let i = start; i < start + toLoad; i++) {
      const curr = entries[i];
      const prev = entries[i + 1];
      if (curr && prev) {
        loadDiff(curr.version.version, prev.version.version, i);
      }
    }
    setLoadedCount(start + toLoad);
  };

  const handleViewDiff = (v1: number, v2: number) => {
    router.push(
      `/schemas/${encodeURIComponent(subject)}/diff?v1=${v1}&v2=${v2}`
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        Loading evolution…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-destructive gap-2">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  }

  if (entries.length === 0) return null;

  const latestVersion = entries[0]?.version.version;
  const hasMoreToLoad = loadedCount < entries.length - 1;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <History size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {entries.length} version{entries.length > 1 ? "s" : ""}
          </span>
          {compat && (
            <Badge
              variant="outline"
              className="text-[10px] gap-1 text-muted-foreground"
            >
              <GitBranch size={10} />
              {compat.compatibility}
            </Badge>
          )}
        </div>
      </div>

      {/* Single version */}
      {entries.length === 1 && (
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-teal-500/30 border-2 border-teal-500" />
            <span className="text-sm font-medium text-foreground">
              v{entries[0].version.version}
            </span>
            <Badge className="text-[9px] px-1.5 py-0 h-4">latest</Badge>
            <span className="text-xs text-muted-foreground ml-2">
              {formatDate(entries[0].version.registered_at)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Initial schema —{" "}
            {countTopLevelFields(entries[0].version.schema_content)} fields
          </p>
          <p className="text-xs text-muted-foreground/50 mt-3">
            Single version — no evolution history yet.
          </p>
        </div>
      )}

      {/* Timeline */}
      {entries.length > 1 && (
        <div className="relative">
          {entries.map((entry, index) => {
            const isLatest = entry.version.version === latestVersion;
            const isFirst = index === entries.length - 1; // oldest
            const prevEntry = entries[index + 1];

            return (
              <div key={entry.version.version} className="relative flex gap-3">
                {/* Timeline rail */}
                <div className="flex flex-col items-center w-5 shrink-0">
                  {/* Dot */}
                  <div
                    className={`h-3 w-3 rounded-full border-2 shrink-0 mt-0.5 ${
                      isLatest
                        ? "bg-teal-500/30 border-teal-500"
                        : entry.diff?.is_breaking
                          ? "bg-red-500/30 border-red-500"
                          : "bg-slate-700/50 border-slate-600"
                    }`}
                  />
                  {/* Line */}
                  {!isFirst && (
                    <div className="w-px flex-1 bg-border/50 min-h-[24px]" />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 ${isFirst ? "pb-0" : "pb-5"}`}>
                  {/* Version header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      v{entry.version.version}
                    </span>
                    {isLatest && (
                      <Badge className="text-[9px] px-1.5 py-0 h-4">
                        latest
                      </Badge>
                    )}
                    {entry.diff?.is_breaking && (
                      <Badge
                        variant="outline"
                        className="text-[9px] gap-1 text-red-400 border-red-500/30 bg-red-500/5"
                      >
                        <AlertTriangle size={9} />
                        BREAKING
                      </Badge>
                    )}
                    {entry.diff && !entry.diff.is_breaking && (
                      <span className="text-[10px] text-emerald-500/70">
                        non-breaking
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {formatDate(entry.version.registered_at)}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="mt-1">
                    {isFirst && !entry.diff ? (
                      // First version — no diff
                      <p className="text-xs text-muted-foreground">
                        Initial schema —{" "}
                        {countTopLevelFields(entry.version.schema_content)}{" "}
                        fields
                      </p>
                    ) : entry.diffLoading ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 size={11} className="animate-spin" />
                        Computing diff…
                      </div>
                    ) : entry.diffError ? (
                      <p className="text-xs text-muted-foreground/50">
                        Could not compute diff
                      </p>
                    ) : entry.diff ? (
                      <div className="space-y-1.5">
                        {/* Change summary */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.diff.changes.filter(
                            (c) => c.change_type === "added"
                          ).length > 0 && (
                            <span className="text-[11px] text-emerald-400">
                              +
                              {
                                entry.diff.changes.filter(
                                  (c) => c.change_type === "added"
                                ).length
                              }{" "}
                              added
                            </span>
                          )}
                          {entry.diff.changes.filter(
                            (c) => c.change_type === "removed"
                          ).length > 0 && (
                            <span className="text-[11px] text-red-400">
                              −
                              {
                                entry.diff.changes.filter(
                                  (c) => c.change_type === "removed"
                                ).length
                              }{" "}
                              removed
                            </span>
                          )}
                          {entry.diff.changes.filter(
                            (c) => c.change_type === "modified"
                          ).length > 0 && (
                            <span className="text-[11px] text-amber-400">
                              ~
                              {
                                entry.diff.changes.filter(
                                  (c) => c.change_type === "modified"
                                ).length
                              }{" "}
                              modified
                            </span>
                          )}
                          {entry.diff.changes.length === 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              No field changes
                            </span>
                          )}
                        </div>

                        {/* Field names preview (compact) */}
                        {entry.diff.changes.length > 0 &&
                          entry.diff.changes.length <= 5 && (
                            <p className="text-[10px] text-muted-foreground/70">
                              {entry.diff.changes
                                .map(
                                  (c) =>
                                    `${c.change_type === "added" ? "+" : c.change_type === "removed" ? "−" : "~"}${c.field_path}`
                                )
                                .join(", ")}
                            </p>
                          )}

                        {/* Diff link */}
                        {prevEntry && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-cyan-400 gap-1"
                            onClick={() =>
                              handleViewDiff(
                                prevEntry.version.version,
                                entry.version.version
                              )
                            }
                          >
                            <ArrowRightLeft size={10} />
                            View diff v{prevEntry.version.version} → v
                            {entry.version.version}
                          </Button>
                        )}
                      </div>
                    ) : !isFirst ? (
                      // Not loaded yet
                      <p className="text-xs text-muted-foreground/40 italic">
                        Diff not loaded
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {hasMoreToLoad && (
            <div className="flex justify-center pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                onClick={loadMore}
              >
                Load older versions
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}