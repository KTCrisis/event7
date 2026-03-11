// app/(dashboard)/references/page.tsx
// Phase 5 — Schema References Graph page
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { GitBranch, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useRegistry } from "@/providers/registry-provider";
import { buildGraph, computeStats, filterGraph } from "@/lib/api/references";
import { ReferencesGraph } from "@/components/references/references-graph";
import { GraphSidebar } from "@/components/references/graph-sidebar";
import type { GraphData, GraphStats, NodeFilter } from "@/types/references";

export default function ReferencesPage() {
  const { selected } = useRegistry();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<NodeFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSelectedNode(null);
    try {
      const data = await buildGraph(selected.id);
      setGraph(data);
      setStats(computeStats(data));
    } catch (err: any) {
      setError(err?.message || "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Apply filter to graph data
  const filteredGraph = useMemo(() => {
    if (!graph) return null;
    return filterGraph(graph, filter);
  }, [graph, filter]);

  // Recompute stats for filtered view (keep original stats for sidebar overview)
  const filteredStats = useMemo(() => {
    if (!filteredGraph) return null;
    return computeStats(filteredGraph);
  }, [filteredGraph]);

  // No registry
  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <GitBranch size={40} className="mx-auto text-zinc-700 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No Registry Connected</h2>
          <p className="text-sm text-zinc-500">
            Connect a Schema Registry in{" "}
            <a href="/settings" className="text-cyan-400 hover:underline">Settings</a>{" "}
            to view schema references.
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-cyan-400 animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Building dependency graph...</p>
          <p className="text-[11px] text-zinc-600 mt-1">Fetching references for all subjects</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <AlertCircle size={36} className="mx-auto text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-white mb-2">Failed to Load</h2>
          <p className="text-sm text-zinc-500 mb-4">{error}</p>
          <button onClick={loadGraph} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-zinc-800 text-zinc-200 rounded-md border border-zinc-700 hover:bg-zinc-700 transition-colors">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (graph && graph.edges.length === 0 && filter === "all") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center">
            <GitBranch size={28} className="text-zinc-600" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Schema References</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            No explicit references were detected between schemas.
            References appear when schemas are registered with a{" "}
            <code className="text-cyan-400/80 bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">references</code>{" "}
            array in Schema Registry.
          </p>
          <div className="mt-4 p-3 bg-zinc-800/40 rounded-lg border border-zinc-800 text-left">
            <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
              {`POST /subjects/{subject}/versions`}<br />
              {`{ "schema": "...",`}<br />
              {`  "references": [`}<br />
              {`    { "name": "Address",`}<br />
              {`      "subject": "com.event7.common.Address",`}<br />
              {`      "version": 1 }`}<br />
              {`  ] }`}
            </p>
          </div>
          <p className="text-[11px] text-zinc-600 mt-3">
            {graph.nodes.length} schemas found — all orphans (no references)
          </p>
          <button onClick={loadGraph} className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm bg-zinc-800 text-zinc-200 rounded-md border border-zinc-700 hover:bg-zinc-700 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>
    );
  }

  if (!graph || !stats || !filteredGraph || !filteredStats) return null;

  return (
    <div className="flex h-full -m-6">
      {/* Sidebar — always uses full graph for search/detail, but shows filter controls */}
      <GraphSidebar
        graph={graph}
        stats={stats}
        selectedNode={selectedNode}
        onNodeSelect={setSelectedNode}
        filter={filter}
        onFilterChange={setFilter}
        filteredCount={filteredGraph.nodes.length}
      />

      {/* Graph area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-white">Dependency Graph</h1>
            <span className="text-[11px] text-zinc-500">
              {filteredGraph.nodes.length} schemas · {filteredGraph.edges.length} references
              {filter !== "all" && (
                <span className="text-cyan-400/60 ml-1">
                  (filtered: {filter})
                </span>
              )}
            </span>
          </div>
          <button onClick={loadGraph} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="flex-1 p-2">
          {filteredGraph.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              No schemas match the "{filter}" filter
            </div>
          ) : (
            <ReferencesGraph
              data={filteredGraph}
              namespaces={stats.namespaces}
              selectedNode={selectedNode}
              onNodeSelect={setSelectedNode}
            />
          )}
        </div>
      </div>
    </div>
  );
}