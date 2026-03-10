// src/lib/api/asyncapi.ts
// AsyncAPI API module — wraps event7 backend routes
//
// Placement: frontend/src/lib/api/asyncapi.ts

import { api } from "./client";
import type {
  AsyncAPISpec,
  AsyncAPIGenerateRequest,
  AsyncAPIYamlExport,
} from "@/types/asyncapi";

/**
 * Generate an AsyncAPI spec from a subject's schema + enrichments.
 * POST /api/v1/registries/{registryId}/subjects/{subject}/asyncapi/generate
 */
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

/**
 * Get an existing AsyncAPI spec (from cache/DB).
 * GET /api/v1/registries/{registryId}/subjects/{subject}/asyncapi
 */
export async function getAsyncAPI(
  registryId: string,
  subject: string
): Promise<AsyncAPISpec | null> {
  try {
    return await api.get<AsyncAPISpec>(
      `/api/v1/registries/${registryId}/subjects/${encodeURIComponent(subject)}/asyncapi`
    );
  } catch {
    // 404 = no spec generated yet
    return null;
  }
}

/**
 * Update an AsyncAPI spec manually.
 * PUT /api/v1/registries/{registryId}/subjects/{subject}/asyncapi
 */
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

/**
 * Export the spec as YAML string.
 * GET /api/v1/registries/{registryId}/subjects/{subject}/asyncapi/yaml
 */
export async function exportAsyncAPIYaml(
  registryId: string,
  subject: string
): Promise<string> {
  const data = await api.get<AsyncAPIYamlExport>(
    `/api/v1/registries/${registryId}/subjects/${encodeURIComponent(subject)}/asyncapi/yaml`
  );
  return data.content;
}