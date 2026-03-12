// src/components/rules/catalog-score.tsx
// Lightweight score badge for catalog entries
// Usage in catalog row: <CatalogScoreBadge registryId={registry.id} subject={entry.subject} />
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getGovernanceScore } from "@/lib/api/rules";
import type { GovernanceScore, ScoreGrade } from "@/types/governance-rules";
import { GRADE_CONFIG } from "@/types/governance-rules";

interface CatalogScoreBadgeProps {
  registryId: string;
  subject: string;
}

// Cache scores in memory to avoid re-fetching on every render
const scoreCache = new Map<string, GovernanceScore>();

export function CatalogScoreBadge({ registryId, subject }: CatalogScoreBadgeProps) {
  const cacheKey = `${registryId}:${subject}`;
  const [score, setScore] = useState<GovernanceScore | null>(
    scoreCache.get(cacheKey) ?? null
  );
  const [loading, setLoading] = useState(!scoreCache.has(cacheKey));

  useEffect(() => {
    if (scoreCache.has(cacheKey)) {
      setScore(scoreCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getGovernanceScore(registryId, subject)
      .then((data) => {
        if (cancelled) return;
        scoreCache.set(cacheKey, data);
        setScore(data);
      })
      .catch(() => {
        // Silent fail
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [registryId, subject, cacheKey]);

  if (loading) {
    return (
      <div className="w-6 h-6 rounded bg-zinc-800 animate-pulse" />
    );
  }

  if (!score || score.score === 0) {
    return (
      <div
        className="w-6 h-6 rounded bg-zinc-800/50 flex items-center justify-center text-[9px] text-zinc-600"
        title="No governance score"
      >
        —
      </div>
    );
  }

  const config = GRADE_CONFIG[score.grade as ScoreGrade];

  return (
    <div
      className={cn(
        "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold",
        config.bg, config.color,
      )}
      title={`Governance: ${score.grade} (${score.score}/100, ${score.confidence} confidence)`}
    >
      {score.grade}
    </div>
  );
}

/** Clear the in-memory score cache (call after rule changes) */
export function clearScoreCache() {
  scoreCache.clear();
}