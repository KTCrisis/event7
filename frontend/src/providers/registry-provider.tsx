// src/providers/registry-provider.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { registriesApi } from "@/lib/api/registries";
import type { RegistryResponse } from "@/types/registry";

interface RegistryContextType {
  registries: RegistryResponse[];
  selected: RegistryResponse | null;
  select: (registry: RegistryResponse) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const RegistryContext = createContext<RegistryContextType | null>(null);

const STORAGE_KEY = "event7_selected_registry";

export function RegistryProvider({ children }: { children: React.ReactNode }) {
  const [registries, setRegistries] = useState<RegistryResponse[]>([]);
  const [selected, setSelected] = useState<RegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const refresh = useCallback(async () => {
    try {
      const data = await registriesApi.list();
      setRegistries(data);

      // Restore selection from cookie or pick first (only if nothing selected)
      if (!selectedRef.current && data.length > 0) {
        const savedId =
          typeof document !== "undefined"
            ? document.cookie
                .split("; ")
                .find((c) => c.startsWith(STORAGE_KEY))
                ?.split("=")[1]
            : null;
        const saved = data.find((r) => r.id === savedId);
        setSelected(saved || data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch registries:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const select = useCallback((registry: RegistryResponse) => {
    setSelected(registry);
    document.cookie = `${STORAGE_KEY}=${registry.id};path=/;max-age=31536000`;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <RegistryContext.Provider
      value={{ registries, selected, select, refresh, loading }}
    >
      {children}
    </RegistryContext.Provider>
  );
}

export function useRegistry() {
  const ctx = useContext(RegistryContext);
  if (!ctx) {
    throw new Error("useRegistry must be used within RegistryProvider");
  }
  return ctx;
}