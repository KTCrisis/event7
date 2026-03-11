// Placement: frontend/src/components/settings/settings-content.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { useRegistry } from "@/providers/registry-provider";
import { RegistryCard } from "@/components/settings/registry-card";
import { RegistryChooser } from "@/components/settings/registry-chooser";
import { RegistryForm } from "@/components/settings/registry-form";
import { HostedRegistryForm } from "@/components/settings/hosted-registry-form";

type DialogStep = "closed" | "choose" | "connect" | "hosted";

export function SettingsContent() {
  const { registries, selected, select, refresh, loading } = useRegistry();
  const [step, setStep] = useState<DialogStep>("closed");
  const searchParams = useSearchParams();

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "connect") setStep("connect");
    else if (action === "hosted") setStep("hosted");
  }, [searchParams]);

  const handleSuccess = () => { setStep("closed"); refresh(); };
  const openDialog = () => setStep("choose");
  const closeDialog = () => setStep("closed");

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Settings2 size={20} className="text-slate-400" />
          <h1 className="text-lg font-semibold text-slate-100">Registry Connections</h1>
        </div>
        <button onClick={openDialog} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-colors">
          <Plus size={16} /> Add Registry
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Loading registries...</div>
      ) : registries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-slate-400 mb-6">No registry connected yet. Get started by connecting your existing registry or creating a free one.</p>
          <RegistryChooser onSelect={(mode) => setStep(mode === "connect" ? "connect" : "hosted")} variant="full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {registries.map((reg) => (
            <RegistryCard key={reg.id} registry={reg} isSelected={selected?.id === reg.id} onSelect={select} onDeleted={refresh} />
          ))}
        </div>
      )}

      {step !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
          <div className="w-full max-w-lg rounded-xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-slate-100">
                {step === "choose" && "Add Registry"}
                {step === "connect" && "Connect Registry"}
                {step === "hosted" && "Create Hosted Registry"}
              </h2>
              <button onClick={closeDialog} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Cancel</button>
            </div>
            {step === "choose" && <RegistryChooser onSelect={(mode) => setStep(mode === "connect" ? "connect" : "hosted")} variant="compact" />}
            {step === "connect" && <RegistryForm onSuccess={handleSuccess} onBack={() => setStep("choose")} />}
            {step === "hosted" && <HostedRegistryForm onSuccess={handleSuccess} onBack={() => setStep("choose")} />}
          </div>
        </div>
      )}
    </div>
  );
}