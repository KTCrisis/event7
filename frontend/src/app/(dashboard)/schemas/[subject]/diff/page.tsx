// src/app/(dashboard)/schemas/[subject]/diff/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRightLeft, ChevronDown, Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRegistry } from "@/providers/registry-provider";
import { getVersions } from "@/lib/api/schemas";
import { DiffViewer } from "@/components/schemas/diff-viewer";

export default function DiffPage() {
  const params = useParams();
  const router = useRouter();
  const { selected: registry } = useRegistry();

  const subject = decodeURIComponent(params.subject as string);

  const [versions, setVersions] = useState<number[]>([]);
  const [v1, setV1] = useState<number | null>(null);
  const [v2, setV2] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch versions on mount
  useEffect(() => {
    if (!registry) return;

    let cancelled = false;
    setLoading(true);

    getVersions(registry.id, subject)
      .then((data) => {
        if (cancelled) return;
        const sorted = [...data].sort((a, b) => a - b);
        setVersions(sorted);

        // Default: compare last two versions
        if (sorted.length >= 2) {
          setV1(sorted[sorted.length - 2]);
          setV2(sorted[sorted.length - 1]);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.detail || "Failed to load versions");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [registry, subject]);

  // Swap versions
  const handleSwap = () => {
    setV1(v2);
    setV2(v1);
  };

  if (!registry) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a registry first
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        Loading versions…
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

  if (versions.length < 2) {
    return (
      <div className="p-6 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => router.push("/schemas")}
        >
          <ArrowLeft size={14} />
          Back to Explorer
        </Button>
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-sm">This subject only has one version — nothing to compare.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border space-y-3">
        {/* Back + subject name */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={() => router.push("/schemas")}
          >
            <ArrowLeft size={14} />
            Back
          </Button>
          <h1 className="text-sm font-semibold truncate" title={subject}>
            {subject}
          </h1>
        </div>

        {/* Version selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* V1 selector */}
          <VersionSelector
            label="From"
            value={v1}
            versions={versions}
            onChange={setV1}
            latest={Math.max(...versions)}
          />

          {/* Swap button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleSwap}
            title="Swap versions"
          >
            <ArrowRightLeft size={14} className="text-muted-foreground" />
          </Button>

          {/* V2 selector */}
          <VersionSelector
            label="To"
            value={v2}
            versions={versions}
            onChange={setV2}
            latest={Math.max(...versions)}
          />

          {v1 === v2 && v1 !== null && (
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
              Same version selected
            </Badge>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto p-4">
        {v1 !== null && v2 !== null && v1 !== v2 ? (
          <DiffViewer
            registryId={registry.id}
            subject={subject}
            v1={v1}
            v2={v2}
          />
        ) : (
          <div className="text-center py-20 text-muted-foreground text-sm">
            Select two different versions to compare
          </div>
        )}
      </div>
    </div>
  );
}

// --- Version selector dropdown ---

function VersionSelector({
  label,
  value,
  versions,
  onChange,
  latest,
}: {
  label: string;
  value: number | null;
  versions: number[];
  onChange: (v: number) => void;
  latest: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium w-8">
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8 min-w-[100px]">
            {value !== null ? `Version ${value}` : "Select…"}
            <ChevronDown size={12} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
          {[...versions].reverse().map((v) => (
            <DropdownMenuItem
              key={v}
              onClick={() => onChange(v)}
              className="text-xs"
            >
              Version {v}
              {v === latest && (
                <Badge className="ml-2 text-[9px] px-1 py-0 h-3.5">latest</Badge>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}