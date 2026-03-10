// src/types/registry.ts

export type ProviderType = "confluent" | "apicurio" | "glue" | "pulsar";

export interface RegistryCreate {
  name: string;
  provider_type: ProviderType;
  base_url: string;
  environment?: string;
  // Credentials (flat, not nested)
  api_key?: string;
  api_secret?: string;
  username?: string;
  password?: string;
  token?: string;
}

export interface RegistryResponse {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string;
  environment: string;
  is_active: boolean;
  created_at: string | null;
  is_connected: boolean;
  subject_count: number | null;
}

export interface RegistryHealth {
  registry_id: string;
  is_healthy: boolean;
  response_time_ms: number | null;
  error?: string;
}