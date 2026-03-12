// Placement: frontend/src/app/(dashboard)/ai/page.tsx
"use client";

import { Suspense } from "react";
import { AIContent } from "@/components/ai/ai-content";

export default function AIPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 font-mono">
            // initializing agent…
          </div>
        }
      >
        <AIContent />
      </Suspense>
    </div>
  );
}