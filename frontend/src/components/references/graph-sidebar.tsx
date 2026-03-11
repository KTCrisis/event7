// components/references/graph-sidebar.tsx
// Phase 5 — Sidebar: search, filters, stats, legend, detail panel
"use client";

import { useState, useMemo } from "react";
import {
  Search, GitBranch, GitMerge, Circle, ExternalLink, X, AlertTriangle,
  Network, ArrowUpRight, ArrowDownLeft, Unplug,
} from "lucide-react";
import type { GraphData, GraphStats, NamespaceColor, GraphNode, NodeFilter } from "@/types/references";

interface GraphSidebarProps {
  graph: GraphData;
  stats: GraphStats;
  selectedNode: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  filter: NodeFilter;
  onFilterChange: (filter: NodeFilter) => void;
  filteredCount: number;
}

const FILTERS: { value: NodeFilter; label: string; icon: typeof Network }[] = [
  { value: "all", label: "All", icon: Network },
  { value: "connected", label: "Connected", icon: GitBranch },
  { value: "parents", label: "Parents", icon: ArrowDownLeft },
  { value: "children", label: "Children", icon: ArrowUpRight },
  { value: "orphans", label: "Orphans", icon: Unplug },
];

export function GraphSidebar({
  graph,
  stats,
  selectedNode,
  onNodeSelect,
  filter,
  onFilterChange,
  filteredCount,
}: GraphSidebarProps) {
  const [search, setSearch] = useState("");

  // Filtered subjects for search dropdown
  const searchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return graph.nodes.filter(
      (n) => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)
    );
  }, [graph.nodes, search]);

  // Selected node details
  const detail: GraphNode | null = useMemo(() => {
    if (!selectedNode) return null;
    return graph.nodes.find((n) => n.id === selectedNode) || null;
  }, [graph.nodes, selectedNode]);

  return (
    <div className="w-[300px] shrink-0 bg-zinc-900/60 border-r border-zinc-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <GitBranch size={16} className="text-cyan-400" />
          Schema References
        </h2>
        <p className="text-[11px] text-zinc-500 mt-1">
          Dependency graph from Schema Registry
        </p>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
          />
        </div>
        {search && (
          <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
            {searchResults.map((n) => (
              <button
                key={n.id}
                onClick={() => { onNodeSelect(n.id); setSearch(""); }}
                className={`w-full text-left px-2 py-1.5 rounded text-[11px] truncate transition-colors ${
                  selectedNode === n.id
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {n.label}
                <span className="text-zinc-600 ml-1">({n.format})</span>
              </button>
            ))}
            {searchResults.length === 0 && (
              <p className="text-[11px] text-zinc-600 px-2 py-1">No matches</p>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-zinc-800">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">
          Filter
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const isActive = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                    : "bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <f.icon size={10} />
                {f.label}
              </button>
            );
          })}
        </div>
        {filter !== "all" && (
          <p className="text-[10px] text-zinc-600 mt-1.5">
            Showing {filteredCount} of {stats.totalNodes} schemas
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="p-3 border-b border-zinc-800">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">
          Overview
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Schemas" value={stats.totalNodes} />
          <StatCard label="Edges" value={stats.totalEdges} />
          <StatCard label="Orphans" value={stats.orphans} warn={stats.orphans > 0} />
        </div>
      </div>

      {/* Namespace Legend */}
      <div className="p-3 border-b border-zinc-800 flex-1 overflow-y-auto">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">
          Namespaces
        </h3>
        <div className="space-y-1.5">
          {stats.namespaces.map((ns) => (
            <div key={ns.namespace} className="flex items-center gap-2 text-[11px]">
              <Circle size={10} fill={ns.color} stroke="none" className="shrink-0" />
              <span className="text-zinc-400 truncate flex-1" title={ns.namespace}>
                {shortenNamespace(ns.namespace)}
              </span>
              <span className="text-zinc-600 tabular-nums">{ns.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      {detail && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              Selected
            </h3>
            <button
              onClick={() => onNodeSelect(null)}
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-white">{detail.label}</p>
              <p className="text-[10px] text-zinc-500 break-all">{detail.id}</p>
            </div>
            <div className="flex gap-3 text-[11px]">
              <span className="text-zinc-400">
                Format: <span className="text-zinc-200">{detail.format}</span>
              </span>
              <span className="text-zinc-400">
                v<span className="text-zinc-200">{detail.version_count}</span>
              </span>
            </div>

            {detail.referencesOut.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-500 flex items-center gap-1 mb-1">
                  <GitBranch size={10} /> References ({detail.referencesOut.length})
                </p>
                {detail.referencesOut.map((r) => (
                  <button
                    key={r.subject}
                    onClick={() => onNodeSelect(r.subject)}
                    className="block text-[11px] text-cyan-400/80 hover:text-cyan-300 truncate w-full text-left"
                  >
                    → {extractLabel(r.subject)}
                  </button>
                ))}
              </div>
            )}

            {detail.dependents.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-500 flex items-center gap-1 mb-1">
                  <GitMerge size={10} /> Dependents ({detail.dependents.length})
                </p>
                {detail.dependents.map((dep) => (
                  <button
                    key={dep}
                    onClick={() => onNodeSelect(dep)}
                    className="block text-[11px] text-amber-400/80 hover:text-amber-300 truncate w-full text-left"
                  >
                    ← {extractLabel(dep)}
                  </button>
                ))}
              </div>
            )}

            <a
              href={`/schemas?subject=${encodeURIComponent(detail.id)}`}
              className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 mt-1 transition-colors"
            >
              <ExternalLink size={11} />
              Open in Explorer
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function StatCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="bg-zinc-800/50 rounded-md px-2 py-1.5 text-center">
      <p className={`text-base font-semibold tabular-nums ${warn ? "text-amber-400" : "text-white"}`}>
        {warn && value > 0 && <AlertTriangle size={10} className="inline mr-1 -mt-0.5" />}
        {value}
      </p>
      <p className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function shortenNamespace(ns: string): string {
  if (ns.startsWith("com.")) return ns.slice(4);
  return ns;
}

function extractLabel(subject: string): string {
  const clean = subject.replace(/-(value|key)$/, "");
  const parts = clean.split(".");
  return parts[parts.length - 1] || subject;
}