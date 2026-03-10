// src/components/schemas/subject-list.tsx
"use client";

import { useState, useMemo } from "react";
import { Search, FileCode, Braces, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubjectInfo, SchemaFormat } from "@/types/schema";

interface SubjectListProps {
  subjects: SubjectInfo[];
  selected: string | null;
  onSelect: (subject: string) => void;
}

const FORMAT_CONFIG: Record<SchemaFormat, { label: string; color: string; icon: typeof FileCode }> = {
  AVRO: { label: "Avro", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", icon: FileCode },
  JSON: { label: "JSON", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Braces },
  PROTOBUF: { label: "Proto", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: FileCode },
};

function shortName(subject: string): string {
  const parts = subject.split(".");
  // Show last 2-3 meaningful parts
  if (parts.length <= 3) return subject;
  return "…" + parts.slice(-3).join(".");
}

export function SubjectList({ subjects, selected, onSelect }: SubjectListProps) {
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<SchemaFormat | "ALL">("ALL");

  const filtered = useMemo(() => {
    return subjects.filter((s) => {
      const matchSearch = !search || s.subject.toLowerCase().includes(search.toLowerCase());
      const matchFormat = formatFilter === "ALL" || s.format === formatFilter;
      return matchSearch && matchFormat;
    });
  }, [subjects, search, formatFilter]);

  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: subjects.length };
    subjects.forEach((s) => {
      counts[s.format] = (counts[s.format] || 0) + 1;
    });
    return counts;
  }, [subjects]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input
            placeholder="Search subjects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm bg-muted/50"
          />
        </div>

        {/* Format filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {(["ALL", "AVRO", "JSON", "PROTOBUF"] as const).map((f) => {
            const count = formatCounts[f] || 0;
            if (f !== "ALL" && count === 0) return null;
            return (
              <button
                key={f}
                onClick={() => setFormatFilter(f)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors border",
                  formatFilter === f
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                    : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
                )}
              >
                {f === "ALL" ? "All" : f} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            {search ? "No matching subjects" : "No schemas found"}
          </div>
        ) : (
          filtered.map((s) => {
            const fmt = FORMAT_CONFIG[s.format];
            const isSelected = selected === s.subject;
            return (
              <button
                key={s.subject}
                onClick={() => onSelect(s.subject)}
                className={cn(
                  "w-full text-left px-3 py-3 border-b border-border/50 transition-colors",
                  isSelected
                    ? "bg-cyan-500/5 border-l-2 border-l-cyan-500"
                    : "hover:bg-muted/30 border-l-2 border-l-transparent"
                )}
              >
                {/* Subject name */}
                <div className="flex items-center gap-2 mb-1">
                  <fmt.icon size={14} className={cn("shrink-0", isSelected ? "text-cyan-400" : "text-muted-foreground")} />
                  <span className="text-sm font-medium truncate" title={s.subject}>
                    {shortName(s.subject)}
                  </span>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 ml-[22px]">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 border", fmt.color)}>
                    {fmt.label}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    v{s.latest_version} · {s.version_count} ver.
                  </span>
                  {s.tags?.length > 0 && (
                    <span className="text-[10px] text-muted-foreground/60 truncate">
                      {s.tags.slice(0, 2).join(", ")}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground">
        {filtered.length} of {subjects.length} subjects
      </div>
    </div>
  );
}