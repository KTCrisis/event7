// src/app/(dashboard)/page.tsx
"use client";

import { useRegistry } from "@/providers/registry-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Database, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { selected, loading } = useRegistry();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center space-y-4 max-w-md">
          <Database size={40} className="mx-auto text-muted-foreground" />
          <h2 className="text-xl font-bold">No registry connected</h2>
          <p className="text-muted-foreground text-sm">
            Connect your first Schema Registry to get started.
          </p>
          <Button onClick={() => router.push("/settings")}>
            Add Registry <ArrowRight size={16} className="ml-2" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Connected to {selected.name} · {selected.provider_type} · {selected.environment}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Schemas</p>
          <p className="text-3xl font-bold mt-1">—</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Format</p>
          <p className="text-3xl font-bold mt-1">—</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Health</p>
          <p className="text-3xl font-bold mt-1">—</p>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        KPIs will be populated in Phase 4.
      </p>
    </div>
  );
}