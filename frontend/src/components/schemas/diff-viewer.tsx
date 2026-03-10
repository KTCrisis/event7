// src/components/schemas/diff-viewer.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Plus, Minus, RefreshCw, AlertTriangle,
  CheckCircle2, Loader2, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { diffVersions } from "@/lib/api/schemas";
import type { SchemaDiff, FieldDiff, DiffChangeType } from "@/types/schema";

interface DiffViewerProps {
  registryId: string;
  subject: string;
  v1: number;
  v2: number;
}

const CHANGE_CONFIG: Record<
  DiffChangeType,
  { icon: typeof Plus; color: string; bg: string; label: string }
> = {
  added: {
    icon: Plus,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    label: "Added",
  },
  removed: {
    icon: Minus,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    label: "Removed",
  },
  modified: {
    icon: RefreshCw,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    label: "Modified",
  },
  unchanged: {
    icon: CheckCircle2,
    color: "text-slate-500",
    bg: "bg-slate-500/10 border-slate-500/20",
    label: "Unchanged",
  },
};

function FieldDiffRow({ field }: { field: FieldDiff }) {
  const config = CHANGE_CONFIG[field.change_type];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 border rounded-lg", config.bg)}>
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        <Icon size={14} className={config.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Field path */}
        <div className="flex items-center gap-2 mb-1">
          <code className="text-sm font-mono font-medium text-foreground">
            {field.field_path}
          </code>
          <Badge
            variant="outline"
            className={cn("text-[9px] px-1.5 py-0 h-4 border", config.bg, config.color)}
          >
            {config.label}
          </Badge>
        </div>

        {/* Details */}
        {field.details && (
          <p className="text-xs text-muted-foreground mb-1.5">{field.details}</p>
        )}

        {/* Values */}
        <div className="flex flex-wrap gap-3 text-xs font-mono">
          {field.old_value !== null && field.old_value !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-red-400/70">−</span>
              <span className="text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded">
                {typeof field.old_value === "object"
                  ? JSON.stringify(field.old_value)
                  : String(field.old_value)}
              </span>
            </div>
          )}
          {field.new_value !== null && field.new_value !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400/70">+</span>
              <span className="text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {typeof field.new_value === "object"
                  ? JSON.stringify(field.new_value)
                  : String(field.new_value)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiffViewer({ registryId, subject, v1, v2 }: DiffViewerProps) {
  const [diff, setDiff] = useState<SchemaDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    diffVersions(registryId, subject, v1, v2)
      .then((data) => {
        if (!cancelled) {
          setDiff(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.detail || "Failed to compute diff");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [registryId, subject, v1, v2]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        Computing diff…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-destructive gap-2">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  }

  if (!diff) return null;

  const added = diff.changes.filter((c) => c.change_type === "added");
  const removed = diff.changes.filter((c) => c.change_type === "removed");
  const modified = diff.changes.filter((c) => c.change_type === "modified");

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <Card
        className={cn(
          "p-4 border flex items-center justify-between",
          diff.is_breaking
            ? "bg-red-500/5 border-red-500/20"
            : "bg-emerald-500/5 border-emerald-500/20"
        )}
      >
        <div className="flex items-center gap-3">
          {diff.is_breaking ? (
            <AlertTriangle size={20} className="text-red-400" />
          ) : (
            <CheckCircle2 size={20} className="text-emerald-400" />
          )}
          <div>
            <div className="text-sm font-medium">
              {diff.is_breaking ? "Breaking changes detected" : "Non-breaking changes"}
            </div>
            <div className="text-xs text-muted-foreground">{diff.summary}</div>
          </div>
        </div>

        {/* Counters */}
        <div className="flex items-center gap-3">
          {added.length > 0 && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs gap-1">
              <Plus size={10} /> {added.length}
            </Badge>
          )}
          {removed.length > 0 && (
            <Badge variant="outline" className="text-red-400 border-red-500/30 text-xs gap-1">
              <Minus size={10} /> {removed.length}
            </Badge>
          )}
          {modified.length > 0 && (
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs gap-1">
              <RefreshCw size={10} /> {modified.length}
            </Badge>
          )}
        </div>
      </Card>

      {/* No changes */}
      {diff.changes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No differences found between version {v1} and version {v2}
        </div>
      )}

      {/* Grouped changes */}
      {removed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider px-1">
            Removed ({removed.length})
          </h3>
          {removed.map((f, i) => (
            <FieldDiffRow key={`r-${i}`} field={f} />
          ))}
        </div>
      )}

      {modified.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider px-1">
            Modified ({modified.length})
          </h3>
          {modified.map((f, i) => (
            <FieldDiffRow key={`m-${i}`} field={f} />
          ))}
        </div>
      )}

      {added.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-emerald-400 uppercase tracking-wider px-1">
            Added ({added.length})
          </h3>
          {added.map((f, i) => (
            <FieldDiffRow key={`a-${i}`} field={f} />
          ))}
        </div>
      )}
    </div>
  );
}