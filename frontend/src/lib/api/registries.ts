// src/lib/api/registries.ts
import { api } from "./client";
import type {
  RegistryCreate,
  RegistryResponse,
  RegistryHealth,
} from "@/types/registry";

const BASE = "/api/v1/registries";

export const registriesApi = {
  list(): Promise<RegistryResponse[]> {
    return api.get<RegistryResponse[]>(BASE);
  },

  create(data: RegistryCreate): Promise<RegistryResponse> {
    return api.post<RegistryResponse>(BASE, data);
  },

  health(registryId: string): Promise<RegistryHealth> {
    return api.get<RegistryHealth>(`${BASE}/${registryId}/health`);
  },

  delete(registryId: string): Promise<void> {
    return api.delete(`${BASE}/${registryId}`);
  },
};