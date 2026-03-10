// src/components/layout/registry-switcher.tsx
"use client";

import { useRegistry } from "@/providers/registry-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Database } from "lucide-react";

export function RegistrySwitcher() {
  const { registries, selected, select, loading } = useRegistry();

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        Loading...
      </Button>
    );
  }

  if (registries.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Database size={14} className="mr-2" />
        No registries
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database size={14} />
          {selected?.name || "Select registry"}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {registries.map((r) => (
          <DropdownMenuItem
            key={r.id}
            onClick={() => select(r)}
            className="flex items-center justify-between gap-4"
          >
            <span>{r.name}</span>
            <Badge variant="secondary" className="text-[10px]">
              {r.environment}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}