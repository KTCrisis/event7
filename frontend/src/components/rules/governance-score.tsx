// src/components/rules/governance-score.tsx
// Reusable governance score widget — grade circle + breakdown + confidence
// Use: <GovernanceScoreWidget registryId="..." subject="..." /> or inline <GovernanceScoreBadge score={score} />
"use client";

import { useEffect, useState } from "react";
import { Shield, Loader2, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getGovernanceScore } from "@/lib/api/rules";
import { GradeBadge } from "./rule-badges";
import type { GovernanceScore, ScoreGrade, ScoreConfidence } from "@/types/governance-rules";
import { GRADE_CONFIG } from "@/types/governance-rules";

// ============================================================
// Inline score badge (for catalog rows, explorer headers)
// ============================================================

export function GovernanceScoreBadge({
  score,
  size = "sm",
}: {
  score: GovernanceScore | null;
  size?: "sm" | "md";
}) {
  if (!score) return null;

  const config = GRADE_CONFIG[score.grade as ScoreGrade];

  if (size === "sm") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
          config.bg, config.color,
        )}
        title={`Governance: ${score.score}/100 (${score.confidence} confidence)`}
      >
        {score.grade}
        <span className="font-normal opacity-70">{score.score}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold",
        config.bg, config.color,
      )}
      title={`Governance: ${score.score}/100 (${score.confidence} confidence)`}
    >
      <GradeBadge grade={score.grade as ScoreGrade} size="sm" />
      <div className="flex flex-col">
        <span>{score.score}/100</span>
        <span className="text-[9px] font-normal opacity-60">{score.confidence}</span>
      </div>
    </div>
  );
}

// ============================================================
// Full score widget (for dashboard, rules page, detail views)
// ============================================================

interface GovernanceScoreWidgetProps {
  registryId: string;
  subject?: string | null;
  compact?: boolean;  // Compact = just the score circle, no breakdown
}

export function GovernanceScoreWidget({
  registryId,
  subject,
  compact = false,
}: GovernanceScoreWidgetProps) {
  const [score, setScore] = useState<GovernanceScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getGovernanceScore(registryId, subject ?? undefined)
      .then((data) => {
        if (!cancelled) setScore(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.detail || "Failed to load score");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [registryId, subject]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Loader2 size={14} className="animate-spin" />
        <span>Loading score…</span>
      </div>
    );
  }

  if (error || !score) {
    return null; // Silent fail — don't break the page
  }

  if (compact) {
    return <CompactScore score={score} />;
  }

  return <FullScore score={score} />;
}

// ============================================================
// Compact view — circle + number
// ============================================================

function CompactScore({ score }: { score: GovernanceScore }) {
  const config = GRADE_CONFIG[score.grade as ScoreGrade];
  const pct = (score.score / score.max_score) * 100;

  return (
    <div className="flex items-center gap-3">
      <ScoreCircle grade={score.grade as ScoreGrade} score={score.score} size={56} />
      <div>
        <div className={cn("text-sm font-bold", config.color)}>
          {score.score}/100
        </div>
        <div className="text-[10px] text-muted-foreground">
          {score.confidence} confidence
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Full view — circle + 3-axis breakdown
// ============================================================

function FullScore({ score }: { score: GovernanceScore }) {
  const config = GRADE_CONFIG[score.grade as ScoreGrade];
  const { enrichments, rules, schema_quality } = score.breakdown;

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Shield size={12} className="text-cyan-400" />
          Governance Score
          {score.subject && (
            <span className="font-normal normal-case truncate max-w-[200px]" title={score.subject}>
              · {score.subject}
            </span>
          )}
        </h3>
        <ConfidenceBadge confidence={score.confidence} />
      </div>

      {/* Score circle + grade */}
      <div className="flex items-center gap-4">
        <ScoreCircle grade={score.grade as ScoreGrade} score={score.score} size={72} />
        <div>
          <div className={cn("text-2xl font-bold", config.color)}>
            {score.score}<span className="text-sm text-muted-foreground font-normal">/100</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {score.grade === "A" && "Excellent governance"}
            {score.grade === "B" && "Good governance"}
            {score.grade === "C" && "Needs improvement"}
            {score.grade === "D" && "Poor governance"}
            {score.grade === "F" && "Critical — action needed"}
          </div>
        </div>
      </div>

      {/* 3-axis breakdown */}
      <div className="space-y-2.5">
        <AxisBar
          label="Enrichments"
          points={enrichments.points}
          maxPoints={enrichments.max_points}
          color="#22d3ee"
          detail={[
            enrichments.has_description && "description",
            enrichments.has_owner && "owner",
            enrichments.has_tags && "tags",
            enrichments.has_classification && "classification",
          ].filter(Boolean).join(", ") || "none set"}
        />
        <AxisBar
          label="Rules & Policies"
          points={rules.points}
          maxPoints={rules.max_points}
          color="#a78bfa"
          detail={`${rules.total_rules} rules, ${rules.total_policies} policies`}
        />
        <AxisBar
          label="Schema Quality"
          points={schema_quality.points}
          maxPoints={schema_quality.max_points}
          color="#34d399"
          detail={[
            schema_quality.compatibility_set && "compatibility",
            schema_quality.has_doc && "doc",
            schema_quality.has_references && "references",
          ].filter(Boolean).join(", ") || "basic"}
        />
      </div>
    </Card>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ScoreCircle({
  grade,
  score,
  size = 64,
}: {
  grade: ScoreGrade;
  score: number;
  size?: number;
}) {
  const config = GRADE_CONFIG[grade];
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // Map grade color to stroke
  const strokeColors: Record<ScoreGrade, string> = {
    A: "#34d399",
    B: "#22d3ee",
    C: "#facc15",
    D: "#fb923c",
    F: "#f87171",
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-zinc-800"
        />
        {/* Score ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColors[grade]}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Grade letter */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("font-bold", config.color)} style={{ fontSize: size * 0.3 }}>
          {grade}
        </span>
      </div>
    </div>
  );
}

function AxisBar({
  label,
  points,
  maxPoints,
  color,
  detail,
}: {
  label: string;
  points: number;
  maxPoints: number;
  color: string;
  detail: string;
}) {
  const pct = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-500 tabular-nums">
          {points}/{maxPoints}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="text-[9px] text-zinc-600 mt-0.5">{detail}</div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: ScoreConfidence }) {
  const styles: Record<ScoreConfidence, { label: string; class: string }> = {
    high: { label: "High confidence", class: "text-emerald-400 bg-emerald-400/10" },
    medium: { label: "Medium confidence", class: "text-yellow-400 bg-yellow-400/10" },
    low: { label: "Low confidence", class: "text-zinc-500 bg-zinc-500/10" },
  };
  const s = styles[confidence];
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", s.class)}>
      {s.label}
    </span>
  );
}