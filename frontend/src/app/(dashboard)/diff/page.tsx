// src/app/(dashboard)/diff/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ArrowRightLeft, ChevronDown, Loader2, AlertCircle,
  Search, FileCode, Braces, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRegistry } from "@/providers/registry-provider";
import { listSubjects, getSchemaVersion, getVersions, diffVersions } from "@/lib/api/schemas";
import { SideBySideDiff } from "@/components/schemas/side-by-side-diff";
import type { SubjectInfo, SchemaDiff } from "@/types/schema";

export default function DiffPage() {
  const { selected: registry } = useRegistry();

  // Subject selection
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectInfo | null>(null);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);

  // Version selection
  const [versions, setVersions] = useState<number[]>([]);
  const [v1, setV1] = useState<number | null>(null);
  const [v2, setV2] = useState<number | null>(null);

  // Schema content for side-by-side
  const [leftContent, setLeftContent] = useState<Record<string, unknown> | null>(null);
  const [rightContent, setRightContent] = useState<Record<string, unknown> | null>(null);

  // Field-level diff summary
  const [fieldDiff, setFieldDiff] = useState<SchemaDiff | null>(null);

  // Loading states
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch subjects on registry change
  useEffect(() => {
    if (!registry) {
      setSubjects([]);
      setSelectedSubject(null);
      return;
    }

    setLoadingSubjects(true);
    listSubjects(registry.id)
      .then((data) => {
        setSubjects(data);
        setLoadingSubjects(false);
      })
      .catch(() => {
        setSubjects([]);
        setLoadingSubjects(false);
      });
  }, [registry]);

  // Fetch versions when subject changes
  useEffect(() => {
    if (!registry || !selectedSubject) {
      setVersions([]);
      setV1(null);
      setV2(null);
      setLeftContent(null);
      setRightContent(null);
      setFieldDiff(null);
      return;
    }

    getVersions(registry.id, selectedSubject.subject)
      .then((data) => {
        const sorted = [...data].sort((a, b) => a - b);
        setVersions(sorted);
        if (sorted.length >= 2) {
          setV1(sorted[sorted.length - 2]);
          setV2(sorted[sorted.length - 1]);
        } else {
          setV1(null);
          setV2(null);
        }
      })
      .catch(() => setVersions([]));
  }, [registry, selectedSubject]);

  // Fetch both schemas + field diff when versions change
  useEffect(() => {
    if (!registry || !selectedSubject || !v1 || !v2 || v1 === v2) {
      setLeftContent(null);
      setRightContent(null);
      setFieldDiff(null);
      return;
    }

    let cancelled = false;
    setLoadingDiff(true);
    setError(null);

    Promise.all([
      getSchemaVersion(registry.id, selectedSubject.subject, v1),
      getSchemaVersion(registry.id, selectedSubject.subject, v2),
      diffVersions(registry.id, selectedSubject.subject, v1, v2),
    ])
      .then(([left, right, diff]) => {
        if (cancelled) return;
        setLeftContent(left.schema_content);
        setRightContent(right.schema_content);
        setFieldDiff(diff);
        setLoadingDiff(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.detail || "Failed to load diff");
        setLoadingDiff(false);
      });

    return () => { cancelled = true; };
  }, [registry, selectedSubject, v1, v2]);

  // Filtered subjects for search
  const filteredSubjects = useMemo(() => {
    if (!subjectSearch) return subjects;
    return subjects.filter((s) =>
      s.subject.toLowerCase().includes(subjectSearch.toLowerCase())
    );
  }, [subjects, subjectSearch]);

  const handleSwap = () => {
    setV1(v2);
    setV2(v1);
  };

  // No registry
  if (!registry) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <ArrowRightLeft size={40} className="text-muted-foreground/30" />
        <p className="text-sm">Select a registry to compare schema versions</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden -m-6">
      {/* Controls bar */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-card space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Subject selector */}
          <DropdownMenu open={subjectOpen} onOpenChange={setSubjectOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 min-w-[260px] justify-between">
                {selectedSubject ? (
                  <span className="truncate">{selectedSubject.subject}</span>
                ) : (
                  <span className="text-muted-foreground">Select a subject…</span>
                )}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[400px]">
              {/* Search input */}
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                  <Input
                    placeholder="Search subjects…"
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {loadingSubjects ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    <Loader2 className="animate-spin inline mr-1" size={12} />
                    Loading…
                  </div>
                ) : filteredSubjects.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No subjects found
                  </div>
                ) : (
                  filteredSubjects.map((s) => (
                    <DropdownMenuItem
                      key={s.subject}
                      onClick={() => {
                        setSelectedSubject(s);
                        setSubjectOpen(false);
                        setSubjectSearch("");
                      }}
                      className="text-xs gap-2"
                    >
                      {s.format === "AVRO" ? (
                        <FileCode size={12} className="text-cyan-400 shrink-0" />
                      ) : (
                        <Braces size={12} className="text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{s.subject}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {s.version_count} ver.
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Version selectors (only if subject selected) */}
          {selectedSubject && versions.length >= 2 && (
            <>
              <div className="h-4 w-px bg-border" />

              <VersionSelector
                label="From"
                value={v1}
                versions={versions}
                onChange={setV1}
                latest={Math.max(...versions)}
              />

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleSwap}
                title="Swap"
              >
                <ArrowRightLeft size={14} className="text-muted-foreground" />
              </Button>

              <VersionSelector
                label="To"
                value={v2}
                versions={versions}
                onChange={setV2}
                latest={Math.max(...versions)}
              />
            </>
          )}
        </div>

        {/* Diff summary banner */}
        {fieldDiff && !loadingDiff && (
          <div className="flex items-center gap-3 text-xs">
            {fieldDiff.is_breaking ? (
              <Badge variant="outline" className="text-red-400 border-red-500/30 gap-1">
                <AlertTriangle size={10} /> Breaking
              </Badge>
            ) : (
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 gap-1">
                <CheckCircle2 size={10} /> Non-breaking
              </Badge>
            )}
            <span className="text-muted-foreground">{fieldDiff.summary}</span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden p-4">
        {!selectedSubject ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <ArrowRightLeft size={32} className="text-muted-foreground/30" />
            <p className="text-sm">Choose a subject to start comparing versions</p>
          </div>
        ) : versions.length < 2 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            This subject has only one version — nothing to compare.
          </div>
        ) : v1 === v2 ? (
          <div className="flex items-center justify-center h-full text-amber-400 text-sm">
            Select two different versions to compare
          </div>
        ) : loadingDiff ? (
          <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
            <Loader2 className="animate-spin" size={18} />
            Computing diff…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-destructive gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        ) : leftContent && rightContent ? (
          <SideBySideDiff
            left={leftContent}
            right={rightContent}
            leftLabel={`Version ${v1}`}
            rightLabel={`Version ${v2}`}
          />
        ) : null}
      </div>
    </div>
  );
}

// --- Version selector ---

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
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8 min-w-[100px]">
            {value !== null ? `v${value}` : "Select…"}
            <ChevronDown size={12} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {[...versions].reverse().map((v) => (
            <DropdownMenuItem key={v} onClick={() => onChange(v)} className="text-xs">
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