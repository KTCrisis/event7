// Placement: frontend/src/lib/api/registries.ts
// Exports registriesApi object (matching existing codebase pattern)
// + individual named exports for convenience

import { api } from "./client";
import type {
  RegistryCreate,
  RegistryResponse,
  RegistryHealth,
  HostedRegistryCreate,
} from "@/types/registry";

/** Object-style API (used by registry-form.tsx, settings, etc.) */
export const registriesApi = {
  list: (): Promise<RegistryResponse[]> =>
    api.get<RegistryResponse[]>("/api/v1/registries"),

  create: (data: RegistryCreate): Promise<RegistryResponse> =>
    api.post<RegistryResponse>("/api/v1/registries", data),

  /**
   * Create a hosted Apicurio registry (provisioned by event7).
   * Backend stub returns 501 until Apicurio provisioning is implemented.
   */
  createHosted: (data: HostedRegistryCreate): Promise<RegistryResponse> =>
    api.post<RegistryResponse>("/api/v1/registries/hosted", data),

  health: (registryId: string): Promise<RegistryHealth> =>
    api.get<RegistryHealth>(`/api/v1/registries/${registryId}/health`),

  delete: (registryId: string): Promise<void> =>
    api.delete(`/api/v1/registries/${registryId}`),
};

// Named exports (used by dashboard, schemas, etc.)
export const listRegistries = registriesApi.list;
export const createRegistry = registriesApi.create;
export const createHostedRegistry = registriesApi.createHosted;
export const checkHealth = registriesApi.health;
export const deleteRegistry = registriesApi.delete;