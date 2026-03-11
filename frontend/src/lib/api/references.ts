// lib/api/references.ts
// Phase 5 — Build the full dependency graph from Schema Registry data

import { listSubjects, getReferences } from "./schemas";
import type { GraphNode, GraphEdge, GraphData, GraphStats, NamespaceColor, NodeFilter } from "@/types/references";
import type { SubjectInfo } from "@/types/schema";

// Color palette for namespaces — distinct, dark-theme friendly
const NAMESPACE_COLORS = [
  "#22d3ee", // cyan-400
  "#a78bfa", // violet-400
  "#f59e0b", // amber-500
  "#34d399", // emerald-400
  "#f472b6", // pink-400
  "#60a5fa", // blue-400
  "#fb923c", // orange-400
  "#a3e635", // lime-400
  "#e879f9", // fuchsia-400
  "#38bdf8", // sky-400
];

/**
 * Extract namespace from a subject name.
 * e.g. "com.event7.common.Address" → "com.event7.common"
 */
export function extractNamespace(subject: string): string {
  const clean = subject.replace(/-(value|key)$/, "");
  const parts = clean.split(".");
  if (parts.length <= 1) return "default";
  return parts.slice(0, -1).join(".");
}

/**
 * Extract short label from subject name.
 * e.g. "com.event7.orders.OrderPlaced-value" → "OrderPlaced"
 */
export function extractLabel(subject: string): string {
  const clean = subject.replace(/-(value|key)$/, "");
  const parts = clean.split(".");
  return parts[parts.length - 1] || subject;
}

/**
 * Build the full graph by querying all subjects, then their references.
 */
export async function buildGraph(registryId: string): Promise<GraphData> {
  const subjects: SubjectInfo[] = await listSubjects(registryId);

  const refResults = await Promise.allSettled(
    subjects.map((s) => getReferences(registryId, s.subject))
  );

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const dependentsMap = new Map<string, string[]>();

  subjects.forEach((s, i) => {
    const refs = refResults[i].status === "fulfilled" ? refResults[i].value : [];

    for (const ref of refs) {
      edges.push({
        source: s.subject,
        target: ref.subject,
        version: ref.version,
      });
      const deps = dependentsMap.get(ref.subject) || [];
      deps.push(s.subject);
      dependentsMap.set(ref.subject, deps);
    }

    nodes.push({
      id: s.subject,
      label: extractLabel(s.subject),
      namespace: extractNamespace(s.subject),
      format: s.format || "UNKNOWN",
      version_count: s.version_count ?? 1,
      referencesOut: refs,
      dependents: [],
    });
  });

  for (const node of nodes) {
    node.dependents = dependentsMap.get(node.id) || [];
  }

  return { nodes, edges };
}

/**
 * Apply a filter to the graph data.
 * Returns a new GraphData with only the matching nodes and their edges.
 */
export function filterGraph(graph: GraphData, filter: NodeFilter): GraphData {
  if (filter === "all") return graph;

  const nodesWithEdges = new Set<string>();
  const parentNodes = new Set<string>(); // referenced by others
  const childNodes = new Set<string>();  // reference others

  for (const edge of graph.edges) {
    nodesWithEdges.add(edge.source);
    nodesWithEdges.add(edge.target);
    childNodes.add(edge.source);   // source references something → child
    parentNodes.add(edge.target);  // target is referenced → parent
  }

  let filteredNodes: GraphNode[];

  switch (filter) {
    case "connected":
      filteredNodes = graph.nodes.filter((n) => nodesWithEdges.has(n.id));
      break;
    case "parents":
      filteredNodes = graph.nodes.filter((n) => parentNodes.has(n.id));
      break;
    case "children":
      filteredNodes = graph.nodes.filter((n) => childNodes.has(n.id));
      break;
    case "orphans":
      filteredNodes = graph.nodes.filter((n) => !nodesWithEdges.has(n.id));
      break;
    default:
      filteredNodes = graph.nodes;
  }

  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * Compute stats from graph data for the sidebar.
 */
export function computeStats(graph: GraphData): GraphStats {
  const nsMap = new Map<string, number>();

  for (const node of graph.nodes) {
    nsMap.set(node.namespace, (nsMap.get(node.namespace) || 0) + 1);
  }

  const namespaces: NamespaceColor[] = Array.from(nsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ns, count], i) => ({
      namespace: ns,
      color: NAMESPACE_COLORS[i % NAMESPACE_COLORS.length],
      count,
    }));

  const nodesWithEdges = new Set<string>();
  for (const edge of graph.edges) {
    nodesWithEdges.add(edge.source);
    nodesWithEdges.add(edge.target);
  }
  const orphans = graph.nodes.filter((n) => !nodesWithEdges.has(n.id)).length;

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    orphans,
    namespaces,
  };
}

/**
 * Get the color for a namespace based on computed stats.
 */
export function getNamespaceColor(namespace: string, namespaces: NamespaceColor[]): string {
  const found = namespaces.find((n) => n.namespace === namespace);
  return found?.color || "#64748b";
}