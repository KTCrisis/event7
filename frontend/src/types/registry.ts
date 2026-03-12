/**
 * event7 - Registry Types
 *
 * Placement: frontend/src/types/registry.ts
 * Modification: ajout AuthMode type + auth_mode dans RegistryCreate
 */

export type ProviderType = "confluent" | "apicurio" | "glue" | "pulsar";

export type AuthMode = "api_key" | "basic";

export interface RegistryCreate {
  name: string;
  provider_type: ProviderType;
  base_url: string;
  environment: string;
  auth_mode?: AuthMode;       // Confluent only: "api_key" (Cloud) | "basic" (Self-Managed)
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
  is_hosted?: boolean;
  created_at?: string;
  is_connected?: boolean;
  subject_count?: number;
}

export interface RegistryHealth {
  registry_id: string;
  is_healthy: boolean;
  response_time_ms?: number;
  error?: string;
}

export interface HostedRegistryCreate {
  name: string;
  environment: string;
}