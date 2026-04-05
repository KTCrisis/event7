# event7 — Schema Evolution Timeline — Design Document

**Version:** 1.0.0
**Date:** 13 mars 2026
**Authors:** Marc / Claude
**Status:** Implemented (Phase 1)
**Last updated:** 5 avril 2026

---

## Implementation status

| Component | Status | Notes |
|-----------|:------:|-------|
| Schema Detail tabs (Schema / Evolution) | **Done** | `schema-detail.tsx` |
| Evolution Timeline component | **Done** | `evolution-timeline.tsx` |
| Diff lazy loading (3 most recent first) | **Done** | Progressive batch loading |
| Breaking change badges | **Done** | |
| Diff viewer navigation with query params | **Done** | |
| Phase 2 (annotations, compat history, export, search) | Planned | |

---

## 1. Context & motivation

### The problem

The Schema Explorer allows viewing a version's content, diffing two versions, and navigating via a dropdown. But there is **no chronological view** of schema evolution — no timeline, no per-version change summary, no overview of "what happened on this subject".

A dev arriving on a subject with 8 versions has to click version by version and manually launch diffs to understand the history.

### The solution

An **"Evolution" tab** in the Schema Detail (right panel of the Explorer) showing a vertical timeline of all versions, with for each transition:

- Registration date
- Change summary (fields added/removed/modified)
- Breaking change badge
- Compatibility mode
- Direct link to the Diff Viewer

### Principles

1. **Frontend-only**: zero backend changes. All data already exists (versions-detail, diff, compatibility).
2. **Contextual tab**: the dev is already in the Explorer, no page change needed.
3. **Lazy loading**: diffs are computed on demand (not all in parallel for 20 versions).
4. **Community tier**: free feature, fundamental dev tool.

---

## 2. Available data (existing APIs)

| API | Endpoint | Data |
|-----|----------|------|
| Versions detail | `GET /subjects/{subject}/versions-detail` | All versions with `version`, `schema_id`, `format`, `schema_content`, `registered_at` |
| Diff | `GET /subjects/{subject}/diff?v1=X&v2=Y` | `changes[]`, `is_breaking`, `summary` (e.g. "2 added, 1 removed") |
| Compatibility | `GET /subjects/{subject}/compatibility` | `compatibility` mode (BACKWARD, FULL_TRANSITIVE, etc.) |

**No new endpoint required.**

---

## 3. UX Design

### Placement

Schema Detail (right panel of Explorer) → **tab bar**:

```
[ Schema ]  [ Evolution ]
```

- **Schema** (default): current content (existing view)
- **Evolution**: version timeline

### Timeline layout

```
+-----------------------------------------------------+
|  Evolution — com.event7.User                        |
|  Compatibility: FULL_TRANSITIVE                     |
|  5 versions                                         |
+-----------------------------------------------------+
|                                                     |
|  * v5 (latest)                    13 Mar 2026       |
|  |  +1 added (phone), non-breaking                  |
|  |  [View diff v4 -> v5]                             |
|  |                                                  |
|  * v4                             12 Mar 2026       |
|  |  +1 added (role), non-breaking                   |
|  |  [View diff v3 -> v4]                             |
|  |                                                  |
|  * v3                             10 Mar 2026       |
|  |  ~1 modified (email type), ! BREAKING            |
|  |  [View diff v2 -> v3]                             |
|  |                                                  |
|  * v2                             08 Mar 2026       |
|  |  +2 added (email, created_at), non-breaking      |
|  |  [View diff v1 -> v2]                             |
|  |                                                  |
|  o v1                             01 Mar 2026       |
|     Initial schema — 3 fields                       |
|                                                     |
+-----------------------------------------------------+
```

### Visual elements per version

| Element | Detail |
|---------|--------|
| **Version badge** | `v5` in teal, `(latest)` badge on the most recent |
| **Date** | `registered_at` formatted relative or absolute depending on age |
| **Summary line** | "+N added, -N removed, ~N modified" — from diff `summary` |
| **Breaking badge** | Red badge `! BREAKING` if `is_breaking === true` |
| **Non-breaking** | Discrete green "non-breaking" text |
| **Diff link** | Button/link "View diff vN-1 -> vN" navigating to diff page |
| **Timeline line** | Vertical line connecting dots, `border-left` style |
| **v1 (first)** | No diff, just "Initial schema — X fields" with top-level field count |

### States

| State | Display |
|-------|---------|
| Loading | Skeleton timeline (3-4 placeholder lines) |
| 1 version | Message "Single version — no evolution history yet" |
| 2+ versions | Full timeline |
| Diff loading | Inline spinner on summary during computation |
| Diff error | "Could not compute diff" in discrete gray |

---

## 4. Diff loading strategy

### Problem

For N versions, there are N-1 diffs to compute. Each diff is an API call. For a subject with 20 versions, launching 19 calls in parallel would be excessive.

### Solution: progressive loading

1. **On mount**: call `versions-detail` + `compatibility` (2 calls)
2. **Display timeline immediately** with dates and versions (without summaries)
3. **Load diffs in batches**: 3 most recent first (v5->v4, v4->v3, v3->v2)
4. **Lazy load the rest**: older diffs loaded on scroll or via "Load older" button
5. **Cache in state**: once computed, diff is stored in React state to avoid re-fetches

### Future optimization

A backend endpoint `GET /subjects/{subject}/evolution` that returns all diffs pre-computed in a single response. Not needed for v1 — individual diffs with lazy loading are sufficient.

---

## 5. Components

| Component | File | Role |
|-----------|------|------|
| `SchemaDetail` | `schema-detail.tsx` (modified) | Added Schema / Evolution tabs |
| `EvolutionTimeline` | `evolution-timeline.tsx` (new) | Timeline container — fetches versions + diffs |
| `EvolutionEntry` | `evolution-timeline.tsx` (inline) | Single timeline entry (version + summary + badges) |

### No new API file

Existing calls are sufficient:
- `getSubjectVersionsDetail(registryId, subject)` — versions with content
- `diffVersions(registryId, subject, v1, v2)` — diff between two versions
- `getCompatibility(registryId, subject)` — compatibility mode

---

## 6. Field counting (v1)

For the first version (no diff), display "Initial schema — X fields":

```typescript
function countTopLevelFields(content: Record<string, unknown>): number {
  // Avro: content.fields?.length
  if (Array.isArray(content.fields)) return content.fields.length;
  // JSON Schema: Object.keys(content.properties || {}).length
  if (content.properties) return Object.keys(content.properties).length;
  return 0;
}
```

---

## 7. Phase 2 — Future enrichments

| Feature | Description |
|---------|-------------|
| Annotations | Who published the version, why (if metadata available) |
| Compat mode history | Compatibility mode at each publication time (requires new endpoint) |
| Export | Timeline export as image/PDF |
| Search | Filter versions by change type (breaking only, additions only) |
