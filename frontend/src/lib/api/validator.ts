// src/lib/api/validator.ts
// Schema Validator API — dry-run validation endpoint
// Design doc: SCHEMA_VALIDATOR_DESIGN.md v1.0.0

import { api } from "./client";
import type {
  SchemaValidateRequest,
  SchemaValidateResponse,
} from "@/types/validator";

const base = (registryId: string) =>
  `/api/v1/registries/${registryId}`;

/** Validate a candidate schema (dry-run). */
export async function validateSchema(
  registryId: string,
  payload: SchemaValidateRequest
): Promise<SchemaValidateResponse> {
  return api.post<SchemaValidateResponse>(
    `${base(registryId)}/schemas/validate`,
    payload
  );
}