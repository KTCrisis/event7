// types/references.ts
// Phase 5 — References Graph types

import { SchemaReference } from "./schema";

/** Filter for graph display */
export type NodeFilter = "all" | "connected" | "parents" | "children" | "orphans";

/** Node in the dependency graph = one subject */
export interface GraphNode {
  id: string;
  label: string;
  namespace: string;
  format: "AVRO" | "JSON" | "PROTOBUF" | "UNKNOWN";
  version_count: number;
  referencesOut: SchemaReference[];
  dependents: string[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

/** Directed edge: source references target */
export interface GraphEdge {
  source: string;
  target: string;
  version: number;
}

/** Full graph data */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Namespace → color mapping */
export interface NamespaceColor {
  namespace: string;
  color: string;
  count: number;
}

/** Stats for the sidebar */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  orphans: number;
  namespaces: NamespaceColor[];
}