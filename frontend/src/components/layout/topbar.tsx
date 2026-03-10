// src/components/layout/topbar.tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRegistry } from "@/providers/registry-provider";
import { RegistrySwitcher } from "./registry-switcher";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export function Topbar() {
  const router = useRouter();
  const { selected } = useRegistry();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <RegistrySwitcher />
        {selected && (
          <span className="text-xs text-muted-foreground">
            {selected.provider_type} · {selected.environment}
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-muted-foreground"
      >
        <LogOut size={16} className="mr-2" />
        Sign out
      </Button>
    </header>
  );
}