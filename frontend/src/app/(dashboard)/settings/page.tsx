"use client";

import { Suspense } from "react";
import { SettingsContent } from "@/components/settings/settings-content";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}