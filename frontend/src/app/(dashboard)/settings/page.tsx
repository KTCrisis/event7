// src/app/(dashboard)/settings/page.tsx
"use client";

import { useState } from "react";
import { useRegistry } from "@/providers/registry-provider";
import { RegistryCard } from "@/components/settings/registry-card";
import { RegistryForm } from "@/components/settings/registry-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Settings } from "lucide-react";

export default function SettingsPage() {
  const { registries, refresh, loading } = useRegistry();
  const [open, setOpen] = useState(false);

  const handleCreated = async () => {
    setOpen(false);
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings size={24} />
            Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your Schema Registry connections
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus size={16} className="mr-2" />
              Add Registry
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect a Schema Registry</DialogTitle>
            </DialogHeader>
            <RegistryForm onSuccess={handleCreated} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading registries...</p>
      ) : registries.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">No registries connected yet.</p>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus size={16} className="mr-2" />
            Connect your first registry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {registries.map((r) => (
            <RegistryCard key={r.id} registry={r} onDeleted={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}