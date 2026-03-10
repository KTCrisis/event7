// src/components/settings/registry-card.tsx
"use client";

import { useState } from "react";
import { registriesApi } from "@/lib/api/registries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Activity, Database } from "lucide-react";
import type { RegistryResponse } from "@/types/registry";

interface RegistryCardProps {
  registry: RegistryResponse;
  onDeleted: () => Promise<void>;
}

export function RegistryCard({ registry, onDeleted }: RegistryCardProps) {
  const [health, setHealth] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);

 const checkHealth = async () => {
    setChecking(true);
    try {
      const result = await registriesApi.health(registry.id);
      setHealth(result.is_healthy);
      if (result.is_healthy) {
        toast.success(`${registry.name} is healthy`);
      } else {
        toast.error(result.error || "Health check failed");
      }
    } catch {
      setHealth(false);
      toast.error("Health check failed");
    } finally {
      setChecking(false);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm(`Delete "${registry.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await registriesApi.delete(registry.id);
      toast.success(`"${registry.name}" deleted`);
      await onDeleted();
    } catch (err: any) {
      toast.error(err.detail || "Failed to delete");
      setDeleting(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Database size={20} className="text-primary" />
          <div>
            <h3 className="font-semibold">{registry.name}</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[250px]">
              {registry.base_url}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{registry.environment}</Badge>
          <Badge variant="outline">{registry.provider_type}</Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={checkHealth}
          disabled={checking}
        >
          <Activity size={14} className="mr-1" />
          {checking ? "Checking..." : "Health check"}
        </Button>

        {health !== null && (
          <Badge variant={health ? "default" : "destructive"}>
            {health ? "Healthy" : "Unhealthy"}
          </Badge>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </Card>
  );
}