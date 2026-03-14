// src/lib/api/asyncapi.ts
// AsyncAPI API module — wraps event7 backend routes
// v2: Added import preview + apply functions
//
// Placement: frontend/src/lib/api/asyncapi.ts

import { api } from "./client";
import type {
  AsyncAPISpec,
  AsyncAPIGenerateRequest,
  AsyncAPIYamlExport,
  AsyncAPIImportRequest,
  AsyncAPIImportPreview,
  AsyncAPIImportResult,
  AsyncAPIOverviewResponse
} from "@/types/asyncapi";

// ════════════════════════════════════════════════════════════════════
// GENERATE / VIEW / EDIT (existing)
// ════════════════════════════════════════════════════════════════════

/** Generate an AsyncAPI spec from a subject's schema + enrichments. */
export async function generateAsyncAPI(
  registryId: string,
  subject: string,
  params?: AsyncAPIGenerateRequest
): Promise<AsyncAPISpec> {
  return api.post<AsyncAPISpec>(
    `/api/v1/registries/${registryId}/subjects/${encodeURIComponent(subject)}/asyncapi/generate`,
    params ?? {}
  );
}

/** Get an existing AsyncAPI spec (from cache/DB). */
export async function getAsyncAPI(
  registryId: string,
  subject: string
): Promise<AsyncAPISpec | null> {
  try {
    return await api.get<AsyncAPISpec>(
      `/api/v1/registries/${registryId}/subjects/${encodeURIComponent(subject)}/asyncapi`
    );
  } catch {
    return null;
  }
}

/** Update an AsyncAPI spec manually. */
export async function updateAsyncAPI(
  registryId: string,
  subject: string,
  specContent: Record<string, unknown>
): Promise<AsyncAPISpec> {
  return api.put<AsyncAPISpec>(
    `/api/v1/registries/${registryId}/subjects/${encodeURIComponent(subject)}/asyncapi`,
    specContent
  );
}

/** Export the spec as YAML string. */
export async function exportAsyncAPIYaml(
  registryId: string,
  subject: string
): Promise<string> {
  const data = await api.get<AsyncAPIYamlExport>(
    `/api/v1/registries/${registryId}/subjects/${encodeURIComponent(subject)}/asyncapi/yaml`
  );
  return data.content;
}

// ════════════════════════════════════════════════════════════════════
// IMPORT (new)
// ════════════════════════════════════════════════════════════════════

/**
 * Preview what would be created from an AsyncAPI spec (dry-run).
 * Nothing is persisted.
 */
export async function importPreview(
  registryId: string,
  specContent: Record<string, unknown>
): Promise<AsyncAPIImportPreview> {
  return api.post<AsyncAPIImportPreview>(
    `/api/v1/registries/${registryId}/asyncapi/import/preview`,
    { spec_content: specContent } satisfies AsyncAPIImportRequest
  );
}

/**
 * Parse an AsyncAPI spec and persist all extracted entities.
 * Creates channels, bindings, enrichments, and optionally registers schemas.
 */
export async function importApply(
  registryId: string,
  specContent: Record<string, unknown>,
  registerSchemas: boolean = false
): Promise<AsyncAPIImportResult> {
  return api.post<AsyncAPIImportResult>(
    `/api/v1/registries/${registryId}/asyncapi/import/apply`,
    { spec_content: specContent, register_schemas: registerSchemas } satisfies AsyncAPIImportRequest
  );
}

// ════════════════════════════════════════════════════════════════════
// OVERVIEW (Dual Mode)
// ════════════════════════════════════════════════════════════════════

/** Fetch dual-mode overview: KPIs + per-subject status. */
export async function getAsyncAPIOverview(
  registryId: string
): Promise<AsyncAPIOverviewResponse> {
  return api.get<AsyncAPIOverviewResponse>(
    `/api/v1/registries/${registryId}/asyncapi/overview`
  );
}
 