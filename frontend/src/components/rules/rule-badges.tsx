// src/components/rules/rule-badges.tsx
// Reusable badges for governance rules: scope, enforcement, severity, source, kind
"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Zap, Shield, ClipboardList, Search,
} from "lucide-react";
import type {
  RuleScope, RuleKind, EnforcementStatus, RuleSeverity, RuleSource,
} from "@/types/governance-rules";
import {
  SCOPE_CONFIG, ENFORCEMENT_CONFIG, SEVERITY_CONFIG,
} from "@/types/governance-rules";

// ============================================================
// Scope Badge (Runtime / Control Plane / Declarative / Audit)
// ============================================================

const SCOPE_ICONS: Record<RuleScope, React.ElementType> = {
  runtime: Zap,
  control_plane: Shield,
  declarative: ClipboardList,
  audit: Search,
};

const SCOPE_STYLES: Record<RuleScope, string> = {
  runtime: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  control_plane: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  declarative: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  audit: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

export function ScopeBadge({ scope }: { scope: RuleScope }) {
  const Icon = SCOPE_ICONS[scope];
  const config = SCOPE_CONFIG[scope];
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px] font-medium", SCOPE_STYLES[scope])}>
      <Icon size={10} />
      {config.label}
    </Badge>
  );
}

// ============================================================
// Enforcement Badge (Declared / Expected / Synced / Verified / Drifted)
// ============================================================

const ENFORCEMENT_STYLES: Record<EnforcementStatus, string> = {
  declared: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  expected: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  synced: "bg-green-500/10 text-green-400 border-green-500/20",
  verified: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  drifted: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function EnforcementBadge({ status }: { status: EnforcementStatus }) {
  if (status === "declared") return null; // No badge for declared
  const config = ENFORCEMENT_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", ENFORCEMENT_STYLES[status])}>
      {status === "verified" && "✓✓ "}
      {status === "synced" && "✓ "}
      {status === "drifted" && "✗ "}
      {status === "expected" && "⚠ "}
      {config.label}
    </Badge>
  );
}

// ============================================================
// Severity Badge (Info / Warning / Error / Critical)
// ============================================================

const SEVERITY_STYLES: Record<RuleSeverity, string> = {
  info: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  error: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function SeverityBadge({ severity }: { severity: RuleSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", SEVERITY_STYLES[severity])}>
      {config.label}
    </Badge>
  );
}

// ============================================================
// Kind Badge (Rules vs Policies)
// ============================================================

export function KindBadge({ kind }: { kind: RuleKind }) {
  const isPolicy = kind === "POLICY";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-medium",
        isPolicy
          ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
      )}
    >
      {isPolicy ? "Policy" : "Rule"}
    </Badge>
  );
}

// ============================================================
// Source Badge (Manual / Template / Imported / System)
// ============================================================

const SOURCE_STYLES: Record<RuleSource, { label: string; style: string }> = {
  manual: { label: "Manual", style: "" },
  template: { label: "From template", style: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  imported_provider: { label: "Imported", style: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  system_generated: { label: "System", style: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" },
};

export function SourceBadge({ source }: { source: RuleSource }) {
  if (source === "manual") return null; // No badge for manual
  const config = SOURCE_STYLES[source];
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", config.style)}>
      {config.label}
    </Badge>
  );
}

// ============================================================
// Grade Badge (A / B / C / D / F)
// ============================================================

import { GRADE_CONFIG, type ScoreGrade } from "@/types/governance-rules";

export function GradeBadge({ grade, size = "md" }: { grade: ScoreGrade; size?: "sm" | "md" | "lg" }) {
  const config = GRADE_CONFIG[grade];
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-lg",
  };
  return (
    <div
      className={cn(
        "rounded-md font-bold flex items-center justify-center",
        config.color, config.bg,
        sizeClasses[size],
      )}
    >
      {grade}
    </div>
  );
}