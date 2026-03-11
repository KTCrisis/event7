// Placement: frontend/src/components/settings/registry-chooser.tsx
"use client";

import { Link2, Sparkles, ArrowRight } from "lucide-react";

type RegistryMode = "connect" | "hosted";

interface RegistryChooserProps {
  onSelect: (mode: RegistryMode) => void;
  /** Compact mode for dialog, full mode for dashboard empty state */
  variant?: "compact" | "full";
}

export function RegistryChooser({
  onSelect,
  variant = "full",
}: RegistryChooserProps) {
  const isCompact = variant === "compact";

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
        isCompact ? "" : "max-w-2xl mx-auto"
      }`}
    >
      {/* Connect your registry */}
      <button
        onClick={() => onSelect("connect")}
        className="group relative flex flex-col items-start text-left rounded-xl border border-slate-700/50 bg-slate-800/40 p-6 transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-800/70 hover:shadow-lg hover:shadow-cyan-500/5"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700/50 text-cyan-400 mb-4 transition-colors group-hover:bg-cyan-500/10">
          <Link2 size={20} />
        </div>
        <h3
          className={`font-semibold text-slate-100 mb-1.5 ${
            isCompact ? "text-sm" : "text-base"
          }`}
        >
          Connect Registry
        </h3>
        <p
          className={`text-slate-400 mb-4 leading-relaxed ${
            isCompact ? "text-xs" : "text-sm"
          }`}
        >
          Confluent, Apicurio, AWS Glue...
          <br />
          Bring your own URL and credentials.
        </p>
        <span className="mt-auto flex items-center gap-1.5 text-xs font-medium text-cyan-400 opacity-0 transition-opacity group-hover:opacity-100">
          Configure
          <ArrowRight size={12} />
        </span>
      </button>

      {/* Create free hosted registry */}
      <button
        onClick={() => onSelect("hosted")}
        className="group relative flex flex-col items-start text-left rounded-xl border border-slate-700/50 bg-slate-800/40 p-6 transition-all duration-200 hover:border-emerald-500/40 hover:bg-slate-800/70 hover:shadow-lg hover:shadow-emerald-500/5"
      >
        {/* Free badge */}
        <span className="absolute top-3 right-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          Free
        </span>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700/50 text-emerald-400 mb-4 transition-colors group-hover:bg-emerald-500/10">
          <Sparkles size={20} />
        </div>
        <h3
          className={`font-semibold text-slate-100 mb-1.5 ${
            isCompact ? "text-sm" : "text-base"
          }`}
        >
          Create Free Registry
        </h3>
        <p
          className={`text-slate-400 mb-4 leading-relaxed ${
            isCompact ? "text-xs" : "text-sm"
          }`}
        >
          No infrastructure needed.
          <br />
          Ready in seconds. 50 schemas free.
        </p>
        <span className="mt-auto flex items-center gap-1.5 text-xs font-medium text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
          Create
          <ArrowRight size={12} />
        </span>
      </button>
    </div>
  );
}