// components/references/references-graph.tsx
// Phase 5 — D3 force-directed graph with rectangular detailed nodes
"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode, GraphEdge, NamespaceColor } from "@/types/references";
import { getNamespaceColor } from "@/lib/api/references";

// Rectangle dimensions
const NODE_W = 160;
const NODE_H = 52;
const NODE_R = 6; // border radius

interface ReferencesGraphProps {
  data: GraphData;
  namespaces: NamespaceColor[];
  selectedNode: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

export function ReferencesGraph({
  data,
  namespaces,
  selectedNode,
  onNodeSelect,
}: ReferencesGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Highlight set: selected + direct neighbors
  const getHighlightSet = useCallback(
    (nodeId: string | null): Set<string> => {
      if (!nodeId) return new Set();
      const set = new Set<string>([nodeId]);
      for (const edge of data.edges) {
        const srcId = typeof edge.source === "string" ? edge.source : (edge.source as unknown as GraphNode)?.id;
        const tgtId = typeof edge.target === "string" ? edge.target : (edge.target as unknown as GraphNode)?.id;
        if (srcId === nodeId && tgtId) set.add(tgtId);
        if (tgtId === nodeId && srcId) set.add(srcId);
      }
      return set;
    },
    [data.edges]
  );

  // Main d3 render
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    const width = container?.clientWidth || 900;
    const height = container?.clientHeight || 600;

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    // Defs: arrow markers
    const defs = svg.append("defs");

    // Drop shadow filter
    const filter = defs.append("filter").attr("id", "node-shadow").attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%");
    filter.append("feDropShadow").attr("dx", "0").attr("dy", "2").attr("stdDeviation", "3").attr("flood-color", "#000").attr("flood-opacity", "0.3");

    defs.append("marker").attr("id", "arrowhead").attr("viewBox", "0 -5 10 10")
      .attr("refX", 10).attr("refY", 0).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
      .append("path").attr("d", "M0,-4L10,0L0,4").attr("fill", "#475569");

    defs.append("marker").attr("id", "arrowhead-hl").attr("viewBox", "0 -5 10 10")
      .attr("refX", 10).attr("refY", 0).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
      .append("path").attr("d", "M0,-4L10,0L0,4").attr("fill", "#22d3ee");

    // Zoom
    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.15, 3]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);
    zoomRef.current = zoom;  
    // Deep copy
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const edges: GraphEdge[] = data.edges.map((e) => ({ ...e }));

    // Simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(220))
      .force("charge", d3.forceManyBody().strength(-600))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(NODE_W / 2 + 20));

    simulationRef.current = simulation;

    // Edge lines
    const link = g.append("g").attr("class", "links").selectAll("line").data(edges).join("line")
      .attr("stroke", "#334155").attr("stroke-width", 1.5).attr("marker-end", "url(#arrowhead)").attr("opacity", 0.5);

    // Node groups
    const node = g.append("g").attr("class", "nodes")
      .selectAll<SVGGElement, GraphNode>("g").data(nodes).join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Rectangle background
    node.append("rect")
      .attr("x", -NODE_W / 2).attr("y", -NODE_H / 2)
      .attr("width", NODE_W).attr("height", NODE_H)
      .attr("rx", NODE_R).attr("ry", NODE_R)
      .attr("fill", "#1e293b")
      .attr("stroke", (d) => getNamespaceColor(d.namespace, namespaces))
      .attr("stroke-width", 1.5)
      .attr("filter", "url(#node-shadow)");

    // Colored left accent bar
    node.append("rect")
      .attr("x", -NODE_W / 2).attr("y", -NODE_H / 2)
      .attr("width", 4).attr("height", NODE_H)
      .attr("rx", NODE_R).attr("ry", 0)
      .attr("fill", (d) => getNamespaceColor(d.namespace, namespaces));

    // Label (main text)
    node.append("text")
      .attr("x", -NODE_W / 2 + 14).attr("y", -8)
      .attr("font-size", "12px").attr("font-weight", "600")
      .attr("fill", "#f1f5f9") // slate-100
      .attr("pointer-events", "none")
      .text((d) => d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label);

    // Bottom line: format badge + version count + ref counts
    node.each(function (d) {
      const row = d3.select(this).append("g").attr("transform", `translate(${-NODE_W / 2 + 14}, 8)`);

      // Format badge
      const fmt = d.format === "AVRO" ? "Avro" : d.format === "JSON" ? "JSON" : d.format;
      const badgeColor = d.format === "AVRO" ? "#22d3ee" : d.format === "JSON" ? "#f59e0b" : "#a78bfa";

      row.append("rect")
        .attr("x", 0).attr("y", -9).attr("width", fmt.length * 6 + 8).attr("height", 14)
        .attr("rx", 3).attr("fill", badgeColor).attr("opacity", 0.15);
      row.append("text")
        .attr("x", 4).attr("y", 1)
        .attr("font-size", "9px").attr("font-weight", "600").attr("fill", badgeColor)
        .text(fmt);

      // Version count
      const vX = fmt.length * 6 + 16;
      row.append("text")
        .attr("x", vX).attr("y", 1)
        .attr("font-size", "9px").attr("fill", "#64748b")
        .text(`v${d.version_count}`);

      // Refs out / in
      const refsOut = d.referencesOut.length;
      const refsIn = d.dependents.length;
      if (refsOut > 0 || refsIn > 0) {
        const refX = vX + 28;
        row.append("text")
          .attr("x", refX).attr("y", 1)
          .attr("font-size", "9px").attr("fill", "#64748b")
          .text(`↗${refsOut} ↙${refsIn}`);
      }
    });

    // Tooltip
    const tooltip = d3.select("body").append("div").attr("class", "graph-tooltip")
      .style("position", "absolute").style("pointer-events", "none")
      .style("background", "#1e293b").style("border", "1px solid #334155")
      .style("border-radius", "8px").style("padding", "10px 14px")
      .style("font-size", "12px").style("color", "#e2e8f0")
      .style("box-shadow", "0 4px 16px rgba(0,0,0,0.4)").style("z-index", "50")
      .style("opacity", "0").style("font-family", "Outfit, sans-serif")
      .style("max-width", "280px");

    node
      .on("mouseenter", (event, d) => {
        tooltip.html(
          `<div style="font-weight:600;margin-bottom:4px;color:#22d3ee">${d.label}</div>
           <div style="color:#64748b;font-size:10px;margin-bottom:6px;word-break:break-all">${d.id}</div>
           <div>Format: <span style="color:#f8fafc">${d.format}</span> · Versions: <span style="color:#f8fafc">${d.version_count}</span></div>
           <div>Refs out: <span style="color:#f8fafc">${d.referencesOut.length}</span> · Deps in: <span style="color:#f8fafc">${d.dependents.length}</span></div>`
        ).style("opacity", "1").style("left", event.pageX + 14 + "px").style("top", event.pageY - 10 + "px");
      })
      .on("mousemove", (event) => {
        tooltip.style("left", event.pageX + 14 + "px").style("top", event.pageY - 10 + "px");
      })
      .on("mouseleave", () => tooltip.style("opacity", "0"));

    // Click
    node.on("click", (_event, d) => {
      onNodeSelect(selectedNode === d.id ? null : d.id);
    });

    // Edge routing: connect to rect borders, not center
    function linkPath(d: GraphEdge) {
      const src = d.source as unknown as GraphNode;
      const tgt = d.target as unknown as GraphNode;
      if (!src.x || !src.y || !tgt.x || !tgt.y) return;

      // Vector from source to target
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const angle = Math.atan2(dy, dx);

      // Clip to rectangle edges
      const srcPt = rectEdgePoint(src.x, src.y, angle);
      const tgtPt = rectEdgePoint(tgt.x, tgt.y, angle + Math.PI);

      return { x1: srcPt.x, y1: srcPt.y, x2: tgtPt.x, y2: tgtPt.y };
    }

    function rectEdgePoint(cx: number, cy: number, angle: number) {
      const hw = NODE_W / 2 + 2;
      const hh = NODE_H / 2 + 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Scale factor to reach rect border
      const sx = cos !== 0 ? hw / Math.abs(cos) : Infinity;
      const sy = sin !== 0 ? hh / Math.abs(sin) : Infinity;
      const s = Math.min(sx, sy);
      return { x: cx + cos * s, y: cy + sin * s };
    }

    // Tick
    simulation.on("tick", () => {
      link.each(function (d) {
        const pts = linkPath(d);
        if (pts) {
          d3.select(this).attr("x1", pts.x1).attr("y1", pts.y1).attr("x2", pts.x2).attr("y2", pts.y2);
        }
      });
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { simulation.stop(); tooltip.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, namespaces]);

  // Highlight update (separate effect to avoid re-creating simulation)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const highlightSet = getHighlightSet(selectedNode);
    const hasSel = highlightSet.size > 0;

    // Nodes
    svg.selectAll<SVGGElement, GraphNode>(".nodes g").each(function (d) {
      const el = d3.select(this);
      const nsColor = getNamespaceColor(d.namespace, namespaces);

      if (!hasSel) {
        el.select("rect:first-of-type").attr("stroke", nsColor).attr("stroke-width", 1.5).attr("opacity", 1);
        el.selectAll("text").attr("opacity", 1);
      } else if (highlightSet.has(d.id)) {
        el.select("rect:first-of-type")
          .attr("stroke", d.id === selectedNode ? "#22d3ee" : nsColor)
          .attr("stroke-width", d.id === selectedNode ? 2.5 : 1.5)
          .attr("opacity", 1);
        el.selectAll("text").attr("opacity", 1);
      } else {
        el.select("rect:first-of-type").attr("stroke", "#1e293b").attr("stroke-width", 1).attr("opacity", 0.2);
        el.selectAll("text").attr("opacity", 0.15);
      }
    });

    // Edges
    svg.selectAll<SVGLineElement, GraphEdge>(".links line").each(function (d) {
      const el = d3.select(this);
      const srcId = typeof d.source === "string" ? d.source : (d.source as unknown as GraphNode)?.id;
      const tgtId = typeof d.target === "string" ? d.target : (d.target as unknown as GraphNode)?.id;
      const isHl = hasSel && srcId && tgtId && highlightSet.has(srcId) && highlightSet.has(tgtId);

      el.attr("stroke", isHl ? "#22d3ee" : "#334155")
        .attr("stroke-width", isHl ? 2.5 : 1.5)
        .attr("opacity", !hasSel ? 0.5 : isHl ? 1 : 0.06)
        .attr("marker-end", isHl ? "url(#arrowhead-hl)" : "url(#arrowhead)");
    });
  }, [selectedNode, getHighlightSet, namespaces]);

  // Reset zoom
    const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    }, []);

  return (
    <div className="relative w-full h-full bg-zinc-950/50 rounded-lg border border-zinc-800 overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" style={{ minHeight: "500px" }} />
      <button
        onClick={handleResetZoom}
        className="absolute bottom-4 right-4 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors"
      >
        Reset View
      </button>
      <div className="absolute bottom-4 left-4 text-[10px] text-zinc-600">
        Scroll to zoom · Drag to pan · Click node to select
      </div>
    </div>
  );
}