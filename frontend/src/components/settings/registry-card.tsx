// Placement: frontend/src/components/settings/registry-card.tsx
"use client";

import { useState } from "react";
import {
  Activity,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Cloud,
  ExternalLink,
} from "lucide-react";
import { registriesApi } from "@/lib/api/registries";
import type { RegistryResponse, RegistryHealth } from "@/types/registry";

interface RegistryCardProps {
  registry: RegistryResponse;
  isSelected: boolean;
  onSelect: (registry: RegistryResponse) => void;
  onDeleted: () => void;
}

export function RegistryCard({
  registry,
  isSelected,
  onSelect,
  onDeleted,
}: RegistryCardProps) {
  const [health, setHealth] = useState<RegistryHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleHealthCheck = async () => {
    setChecking(true);
    try {
      const result = await registriesApi.health(registry.id);
      setHealth(result);
    } catch {
      setHealth({
        registry_id: registry.id,
        is_healthy: false,
        error: "Health check failed",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete registry "${registry.name}"?`)) return;
    setDeleting(true);
    try {
      await registriesApi.delete(registry.id);
      onDeleted();
    } catch {
      // toast would go here
    } finally {
      setDeleting(false);
    }
  };

  const isHosted = registry.is_hosted === true;

  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all cursor-pointer ${
        isSelected
          ? "border-cyan-500/50 bg-cyan-500/5 shadow-sm shadow-cyan-500/10"
          : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
      }`}
      onClick={() => onSelect(registry)}
    >
      {/* Top row: name + badges */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 truncate">
            {registry.name}
          </h3>
          {/* Hosted / External badge */}
          {isHosted ? (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Cloud size={10} />
              Hosted
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-700/50 border border-slate-600/50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              <ExternalLink size={10} />
              External
            </span>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-all"
          title="Delete registry"
        >
          {deleting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      </div>

      {/* Provider + environment */}
      <div className="flex items-center gap-2 mb-3">
        <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 uppercase">
          {registry.provider_type}
        </span>
        <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          {registry.environment}
        </span>
      </div>

      {/* URL (only for external) */}
      {!isHosted && (
        <p className="text-xs text-slate-500 truncate mb-3">
          {registry.base_url}
        </p>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between">
        {/* Health check */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleHealthCheck();
          }}
          disabled={checking}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
        >
          {checking ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Activity size={12} />
          )}
          {checking ? "Checking..." : "Health check"}
        </button>

        {/* Health result */}
        {health && !checking && (
          <div className="flex items-center gap-1.5">
            {health.is_healthy ? (
              <>
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span className="text-xs text-emerald-400">
                  {health.response_time_ms
                    ? `${Math.round(health.response_time_ms)}ms`
                    : "Healthy"}
                </span>
              </>
            ) : (
              <>
                <XCircle size={12} className="text-rose-400" />
                <span className="text-xs text-rose-400">Unreachable</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}