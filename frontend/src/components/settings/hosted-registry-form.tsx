// Placement: frontend/src/components/settings/hosted-registry-form.tsx
"use client";

import { useState } from "react";
import { Sparkles, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { registriesApi } from "@/lib/api/registries";
import type { HostedRegistryCreate } from "@/types/registry";

interface HostedRegistryFormProps {
  onSuccess: () => void;
  onBack: () => void;
}

const ENVIRONMENTS = ["DEV", "STAGING", "PROD"] as const;

export function HostedRegistryForm({
  onSuccess,
  onBack,
}: HostedRegistryFormProps) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<string>("DEV");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const payload: HostedRegistryCreate = {
        name: name.trim(),
        environment,
      };
      await registriesApi.createHosted(payload);
      onSuccess();
    } catch (err: any) {
      // Backend returns 501 until provisioning is implemented
      if (err?.status === 501 || err?.message?.includes("501")) {
        setError(
          "Hosted registries are coming soon. Connect an existing registry for now."
        );
      } else {
        setError(err?.message || "Failed to create hosted registry");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to options
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Create Free Registry
          </h3>
          <p className="text-xs text-slate-400">
            We provision an Apicurio registry for you
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2
            size={14}
            className="text-emerald-400 mt-0.5 shrink-0"
          />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-medium text-emerald-300">Free tier</span>{" "}
            includes 1 hosted registry with up to 50 schemas. No URL or
            credentials needed — event7 handles everything.
          </div>
        </div>
      </div>

      {/* Name field */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Registry name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My first registry"
          className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-colors"
          autoFocus
        />
      </div>

      {/* Environment selector */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Environment
        </label>
        <div className="flex gap-2">
          {ENVIRONMENTS.map((env) => (
            <button
              key={env}
              onClick={() => setEnvironment(env)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                environment === env
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              {env}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !name.trim()}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Sparkles size={14} />
            Create my registry
          </>
        )}
      </button>
    </div>
  );
}