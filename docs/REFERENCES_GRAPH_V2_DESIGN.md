# event7 — References Graph v2 — Design Document

**Version:** 2.0.0
**Date:** 13 mars 2026
**Authors:** Marc / Claude
**Status:** v1 implemented, v2 planned
**Last updated:** 5 avril 2026

---

## Implementation status

| Step | Feature | Status | Notes |
|:----:|---------|:------:|-------|
| — | **v1: Force-directed graph** | **Done** | d3-force SVG, N=1 highlight, search, filters, namespace colors |
| 1 | Transitive chain highlight | Planned | BFS upstream+downstream on click |
| 2 | Enriched detail panel | Planned | Channels, enrichments, governance score, quick actions |
| 3 | Color by data layer | Planned | Toggle namespace/data_layer coloring |
| 4 | Layout modes (Tree, Group) | Planned | d3.tree DAG + namespace clustering |
| 5 | Focus mode (search → zoom) | Planned | d3.transition zoom to selected node |
| 6 | Export SVG/PNG | Planned | Serialize SVG, rasterize to canvas for PNG |

---

## 1. Current state — References Graph v1

### Architecture

| File | Role |
|------|------|
| `types/references.ts` | Types: `GraphNode`, `GraphEdge`, `GraphData`, `GraphStats`, `NamespaceColor`, `NodeFilter` |
| `lib/api/references.ts` | 5 functions: `buildGraph`, `filterGraph`, `computeStats`, `extractNamespace`, `getNamespaceColor` |
| `components/references/references-graph.tsx` | d3-force SVG — rectangular nodes, zoom, drag, arrows |
| `components/references/graph-sidebar.tsx` | Sidebar: search, filters, stats, namespace legend, basic detail panel |
| `app/(dashboard)/references/page.tsx` | Page with loading/empty/error states |

### Graph engine

- **d3-force** simulation: `link` (distance 220), `charge` (-600), `center`, `collision` (NODE_W/2 + 20)
- **SVG** rendering (not Canvas) — CSS styling and DOM interaction
- **Zoom/Pan** via `d3.zoom`, stored in `useRef` for Reset View

### Node design

```
+------------------------------+
|# CustomerCreated             |  160x52px, slate-800 fill
|# [Avro] v3  >2 <1           |  colored left bar (namespace)
+------------------------------+
```

- Rectangle 160x52px, border-radius 6px, drop shadow
- Left colored bar (4px) = namespace color
- Line 1: label (truncated at 18 chars)
- Line 2: format badge (Avro/JSON), version count, refs out/deps in

### Interactions

| Interaction | Behavior |
|-------------|----------|
| Hover node | Tooltip: label, full ID, format, versions, refs out, deps in |
| Click node | Highlight node + **direct neighbors only (N=1)**. Deselect on re-click |
| Drag node | d3-force drag — node follows cursor |
| Zoom/Pan | Scroll wheel zoom, click-drag pan |
| Reset View | Button in sidebar — re-centers and resets zoom |
| Search | Text input in sidebar — filters list, click result → selects node |

### Filters

| Filter | Logic |
|--------|-------|
| All | All nodes |
| Connected | Nodes with >= 1 edge |
| Parents | Nodes referenced by others |
| Children | Nodes that reference others |
| Orphans | Nodes with no edges |

### Detail panel (basic)

When a node is selected: full subject name, format, version count, references out list, dependents list, "Open in Explorer" link.

### Limitations (v1)

1. **N=1 highlight only** — click shows direct neighbors, not the full chain
2. **Basic detail panel** — no channels, enrichments, governance
3. **Namespace colors only** — no data layer view
4. **Single layout** — force-directed only, no tree/group
5. **Search without zoom** — search filters list but doesn't zoom to node
6. **No export** — can't save the graph as image

---

## 2. Step 1 — Transitive chain

### Objective

Click a node → highlight the **entire chain** (upstream + downstream), not just N=1.

### Algorithm

```typescript
function getTransitiveSet(
  nodeId: string,
  edges: GraphEdge[],
  direction: "both" | "upstream" | "downstream" = "both"
): Set<string> {
  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      const src = typeof edge.source === "string" ? edge.source : edge.source.id;
      const tgt = typeof edge.target === "string" ? edge.target : edge.target.id;

      if ((direction === "both" || direction === "downstream") && src === current && !visited.has(tgt)) {
        visited.add(tgt);
        queue.push(tgt);
      }
      if ((direction === "both" || direction === "upstream") && tgt === current && !visited.has(src)) {
        visited.add(src);
        queue.push(src);
      }
    }
  }
  return visited;
}
```

### UX

- **Single click** → highlight full transitive chain (upstream + downstream)
- **Double-click** → reset highlight (deselect)
- Nodes outside chain → opacity 0.1
- Chain edges → cyan, others → opacity 0.05

### Files

- `lib/api/references.ts` — add `getTransitiveSet()`
- `references-graph.tsx` — modify `getHighlightSet` to use transitive instead of N=1

---

## 3. Step 2 — Enriched detail panel

### Objective

When a node is selected, the sidebar shows a complete panel with all governance data.

### Content

```
+------------------------------+
|  com.event7.Customer         |
|  Avro . 3 versions           |
+------------------------------+
|  ENRICHMENTS                 |
|  Owner: platform-team        |
|  Layer: CORE                 |
|  Tags: customer, pii         |
|  Classification: internal    |
+------------------------------+
|  REFERENCES OUT (2)          |
|  -> com.event7.Address:v1    |
|  -> com.event7.ContactInfo   |
|  REFERENCED BY (3)           |
|  <- com.event7.Order         |
|  <- com.event7.Invoice       |
+------------------------------+
|  CHANNELS (2)                |
|  customer-events (Kafka)     |
|  customer-updates (RabbitMQ) |
+------------------------------+
|  GOVERNANCE                  |
|  Score: 85/100               |
|  Rules: 5/7 passed           |
|                              |
|  [Open in Explorer]          |
|  [Open in Catalog]           |
|  [Validate]                  |
+------------------------------+
```

### Data to fetch (lazy, on click)

| Data | Existing endpoint |
|------|-------------------|
| Enrichments | `GET /subjects/{subject}/enrichment` |
| Channels | `GET /channels/reverse/{subject}` |
| Governance score | `GET /governance/score?subject={subject}` |
| Refs out / deps in | Already in `GraphNode` |

---

## 4. Step 3 — Color by data layer

### Objective

Toggle between namespace coloring (existing) and data layer coloring.

### Color mapping

| Layer | Color | Hex |
|-------|-------|-----|
| RAW | Slate | #64748b |
| CORE | Cyan | #22d3ee |
| REFINED | Emerald | #34d399 |
| APPLICATION | Violet | #a78bfa |
| (unknown) | Zinc | #3f3f46 |

### UX

- Toggle dropdown in sidebar header: `Color: [Namespace v]` with Namespace / Data Layer options
- When "Data Layer": left bar + stroke use layer color, legend switches to 4+1 entries
- When "Namespace": current behavior

---

## 5. Step 4 — Layout modes

### Modes

| Mode | Description | Use case |
|------|-------------|----------|
| **Force** (default) | Current d3-force simulation | Overview, free exploration |
| **Tree** | DAG hierarchical, roots at top | Reference chains, linearity |
| **Group** | Nodes clustered by namespace | Domain identification |

### Tree layout

Uses `d3.tree()` with root detection (nodes with `dependents.length === 0`). Cycle fallback via topological sort with cycle breaking.

### Group layout

Cluster nodes by namespace. Each cluster has gravitational force toward a fixed point via `d3.forceX`/`d3.forceY`.

### UX

3 icon buttons in graph header: Force / Tree / Group. Animated switch via d3.transition.

---

## 6. Step 5 — Focus mode

### Objective

Search a node → animated zoom + center + highlight.

### Behavior

1. User types in search input
2. Click on search result
3. Graph zooms (d3.transition ~500ms) to selected node
4. Zoom level adjusts to show node + transitive neighbors
5. Transitive highlight activates automatically

```typescript
function focusOnNode(nodeId: string) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node?.x || !node?.y) return;

  const scale = 1.5;
  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(scale)
    .translate(-node.x, -node.y);

  svg.transition().duration(500).call(zoom.transform, transform);
  onNodeSelect(nodeId);
}
```

---

## 7. Step 6 — Export SVG/PNG

### SVG export

Serialize SVG element via `XMLSerializer`, download as `.svg` blob.

### PNG export

Render SVG to canvas at 2x resolution (retina), export via `canvas.toBlob()`.

### UX

Dropdown "Export" in graph header with SVG / PNG options.

---

## 8. Files impacted

| Step | File | Action |
|------|------|--------|
| 1 | `lib/api/references.ts` | Add `getTransitiveSet()` |
| 1 | `references-graph.tsx` | Modify `getHighlightSet` → transitive |
| 2 | `graph-sidebar.tsx` | Enrich detail panel (enrichments, channels, governance, actions) |
| 2 | `lib/api/references.ts` | Add `fetchNodeDetails()` (lazy) |
| 3 | `references-graph.tsx` | Color mode toggle, layer color mapping |
| 3 | `graph-sidebar.tsx` | Color toggle, data layer legend |
| 3 | `types/references.ts` | Add `data_layer?: string` on `GraphNode` |
| 4 | `references-graph.tsx` | 3 layout engines (force, tree, group) |
| 5 | `references-graph.tsx` | `focusOnNode()` with d3.transition |
| 5 | `graph-sidebar.tsx` | Connect search → focus callback |
| 6 | `references-graph.tsx` | Export SVG/PNG |

**No backend changes.** All frontend-only using existing endpoints.

---

## 9. Backlog

| Step | Name | Effort | Dependency |
|:----:|------|:------:|------------|
| 1 | Transitive chain | 0.5 session | — |
| 2 | Enriched detail panel | 1 session | Step 1 |
| 3 | Color by data layer | 0.5 session | — |
| 4 | Layout modes (Tree + Group) | 1.5 session | — |
| 5 | Focus mode | 0.5 session | Step 1 |
| 6 | Export SVG/PNG | 0.5 session | — |

**Recommended order:** 1 → 5 → 2 → 3 → 6 → 4

Rationale: transitive (1) unblocks focus (5) and improves detail panel (2). Color by layer (3) and export (6) are independent. Layout modes (4) is the biggest piece and can wait.

**Total estimated:** ~4.5 sessions
