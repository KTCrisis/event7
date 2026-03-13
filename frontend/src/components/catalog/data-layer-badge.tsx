// Placement: frontend/src/components/catalog/data-layer-badge.tsx
// Reusable badge for Data Layer display (RAW/CORE/REFINED/APPLICATION)
// Used in: Catalog table, Dashboard donut, Channel detail

"use client";

import type { DataLayer } from "@/types/governance";

const LAYER_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  raw:         { label: "RAW",     bg: "bg-cyan-500/15",    text: "text-cyan-400" },
  core:        { label: "CORE",    bg: "bg-emerald-500/15", text: "text-emerald-400" },
  refined:     { label: "REFINED", bg: "bg-amber-500/15",   text: "text-amber-400" },
  application: { label: "APP",     bg: "bg-violet-500/15",  text: "text-violet-400" },
};

interface DataLayerBadgeProps {
  layer: DataLayer | null | undefined;
  size?: "sm" | "md";
}

export function DataLayerBadge({ layer, size = "sm" }: DataLayerBadgeProps) {
  if (!layer) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-500/10 text-slate-500">
        —
      </span>
    );
  }

  const config = LAYER_CONFIG[layer] ?? LAYER_CONFIG.raw;
  const sizeClass = size === "md" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center rounded font-semibold uppercase tracking-wider ${config.bg} ${config.text} ${sizeClass}`}
    >
      {config.label}
    </span>
  );
}

/** Color map for Recharts (donut/bar charts) */
export const LAYER_COLORS: Record<string, string> = {
  raw: "#22d3ee",         // cyan-400
  core: "#34d399",        // emerald-400
  refined: "#fbbf24",     // amber-400
  application: "#a78bfa", // violet-400
  unknown: "#64748b",     // slate-500
};