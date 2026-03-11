// Placement: frontend/src/types/registry.ts
// Changes: Added is_hosted field, HostedRegistryCreate type

export interface RegistryCredentials {
  api_key?: string;
  api_secret?: string;
}

export type ProviderType = "confluent" | "apicurio" | "glue" | "pulsar";

export interface RegistryCreate {
  name: string;
  provider_type: ProviderType;
  base_url: string;
  environment?: string;
  api_key?: string;
  api_secret?: string;
}

/** Hosted registry: no URL/credentials needed */
export interface HostedRegistryCreate {
  name: string;
  environment?: string;
}

export interface RegistryResponse {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string;
  environment: string;
  is_active: boolean;
  created_at?: string;
  is_connected?: boolean;
  subject_count?: number | null;
  /** true if provisioned by event7 (Apicurio hosted) */
  is_hosted?: boolean;
}

export interface RegistryHealth {
  registry_id: string;
  is_healthy: boolean;
  response_time_ms?: number | null;
  error?: string | null;
}