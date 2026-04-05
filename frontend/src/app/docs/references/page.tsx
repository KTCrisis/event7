// src/app/docs/references/page.tsx
// Documentation page — References Graph

import {
  Share2,
  Search,
  Filter,
  MousePointer2,
  ZoomIn,
  Maximize2,
  Circle,
  GitBranch,
  GitMerge,
  ArrowRight,
  Unplug,
  Network,
} from "lucide-react";
import Link from "next/link";

export default function ReferencesPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Community
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            v1.0
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          References Graph
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          Visualize schema dependencies as an interactive force-directed graph.
          See which schemas reference others, identify orphans, and understand
          the impact radius of a breaking change — before it happens.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/references"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            Open References Graph <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-12" />

      {/* How it works */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          How it works
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            The References Graph scans all schemas in your registry and builds a
            dependency map from Avro references, JSON Schema <code className="text-teal-400">$ref</code>,
            and Protobuf imports. The result is an interactive SVG graph powered
            by d3-force.
          </p>
          <p>
            Each node is a schema subject. Edges represent references — if schema
            A references schema B, an arrow points from A to B. Nodes are colored
            by namespace for quick domain identification.
          </p>
        </div>
      </section>

      {/* Node design */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Node design
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Circle size={14} className="text-cyan-400 fill-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Schema node</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Each node shows the schema label, format badge (Avro/JSON),
              version count, and reference counts (outgoing and incoming).
              A colored left bar indicates the namespace.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Unplug size={14} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Orphan nodes</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Schemas with no references (neither outgoing nor incoming) are
              flagged as orphans. Use the Orphans filter to isolate them.
              Orphan count is shown in the sidebar stats.
            </p>
          </div>
        </div>
      </section>

      {/* Interactions */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Interactions
        </h2>
        <div className="space-y-3">
          {[
            { icon: MousePointer2, label: "Click", desc: "Select a node to highlight it and its direct neighbors. Click again to deselect." },
            { icon: MousePointer2, label: "Drag", desc: "Drag any node to reposition it. The force simulation adjusts in real-time." },
            { icon: ZoomIn, label: "Scroll", desc: "Scroll to zoom in/out. Click and drag the background to pan." },
            { icon: Maximize2, label: "Reset View", desc: "Button in the bottom-right corner recenters the graph and resets zoom." },
            { icon: Search, label: "Search", desc: "Type in the sidebar search to find a subject. Click a result to select the node." },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
              <item.icon size={14} className="text-teal-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-sm font-medium text-white">{item.label}</span>
                <span className="text-sm text-slate-400 ml-2">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Filters
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Network, label: "All", desc: "Show all schemas in the registry" },
            { icon: GitBranch, label: "Connected", desc: "Schemas with at least one reference (in or out)" },
            { icon: GitMerge, label: "Parents", desc: "Schemas referenced by others (depended upon)" },
            { icon: Share2, label: "Children", desc: "Schemas that reference others" },
            { icon: Unplug, label: "Orphans", desc: "Schemas with no references at all" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
              <div className="flex items-center gap-2 mb-1">
                <item.icon size={14} className="text-teal-400" />
                <span className="text-sm font-medium text-white">{item.label}</span>
              </div>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sidebar */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Sidebar
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            The left sidebar (300px) provides search, filters, stats overview
            (total schemas, edges, orphans), and a namespace legend with color
            indicators and counts.
          </p>
          <p>
            When a node is selected, a detail panel appears showing the full
            subject name, format, version count, outgoing references, incoming
            dependents, and a link to open the schema in the Explorer.
          </p>
        </div>
      </section>

      {/* Use cases */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Use cases
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <Filter size={14} className="text-teal-400 mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">Impact analysis</h3>
            <p className="text-xs text-slate-400">
              Before modifying a shared schema (e.g. Address), click its node to
              see all dependents. Know exactly which schemas will be affected.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <Unplug size={14} className="text-amber-400 mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">Find orphans</h3>
            <p className="text-xs text-slate-400">
              Filter to Orphans to find schemas that are not referenced by
              anything — potential candidates for cleanup or documentation.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}
