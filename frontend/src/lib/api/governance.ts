// src/lib/api/governance.ts
// Catalog & Enrichment API functions

import { api } from "./client";
import type { CatalogEntry, Enrichment, EnrichmentUpdate } from "@/types/governance";

const base = (registryId: string) =>
  `/api/v1/registries/${registryId}`;

/** Get full catalog (subjects + enrichments + refs) */
export async function getCatalog(registryId: string): Promise<CatalogEntry[]> {
  return api.get<CatalogEntry[]>(`${base(registryId)}/catalog`);
}

/** Export catalog as CSV — returns blob URL */
export async function exportCatalogCsv(registryId: string): Promise<string> {
  // Use api.get headers for auth, but handle blob manually
  const { createClient } = await import("@/lib/supabase/client");
  const headers: Record<string, string> = {};
  const supabase = createClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      headers["Authorization"] = `Bearer ${data.session.access_token}`;
    }
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || ""}${base(registryId)}/catalog/export?format=csv`,
    { headers }
  );
  if (!res.ok) {
    throw { detail: `Export failed: ${res.statusText}`, status: res.status };
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Export catalog as JSON */
export async function exportCatalogJson(registryId: string): Promise<CatalogEntry[]> {
  return api.get<CatalogEntry[]>(`${base(registryId)}/catalog/export?format=json`);
}

/** Get enrichment for a subject */
export async function getEnrichment(
  registryId: string,
  subject: string
): Promise<Enrichment | null> {
  try {
    return await api.get<Enrichment>(
      `${base(registryId)}/subjects/${encodeURIComponent(subject)}/enrichment`
    );
  } catch {
    return null;
  }
}

/** Update enrichment for a subject */
export async function updateEnrichment(
  registryId: string,
  subject: string,
  update: EnrichmentUpdate
): Promise<Enrichment> {
  return api.put<Enrichment>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}/enrichment`,
    update
  );
}