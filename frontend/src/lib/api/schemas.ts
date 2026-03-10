// src/lib/api/schemas.ts
// Schema API functions — uses the shared ApiClient

import { api } from "./client";
import type {
  SubjectInfo,
  SchemaDetail,
  SchemaVersion,
  SchemaDiff,
  CompatibilityInfo,
} from "@/types/schema";

const base = (registryId: string) =>
  `/api/v1/registries/${registryId}`;

/** List all subjects (with optional enrichments) */
export async function listSubjects(
  registryId: string
): Promise<SubjectInfo[]> {
  return api.get<SubjectInfo[]>(`${base(registryId)}/subjects`);
}

/** Get latest schema for a subject */
export async function getSchema(
  registryId: string,
  subject: string
): Promise<SchemaDetail> {
  return api.get<SchemaDetail>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}`
  );
}

/** Get a specific version */
export async function getSchemaVersion(
  registryId: string,
  subject: string,
  version: number
): Promise<SchemaDetail> {
  return api.get<SchemaDetail>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}/versions/${version}`
  );
}

/** Get version numbers */
export async function getVersions(
  registryId: string,
  subject: string
): Promise<number[]> {
  return api.get<number[]>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}/versions`
  );
}

/** Get all versions with full content */
export async function getVersionsDetail(
  registryId: string,
  subject: string
): Promise<SchemaVersion[]> {
  return api.get<SchemaVersion[]>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}/versions-detail`
  );
}

/** Diff between two versions */
export async function diffVersions(
  registryId: string,
  subject: string,
  v1: number,
  v2: number
): Promise<SchemaDiff> {
  return api.get<SchemaDiff>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}/diff?v1=${v1}&v2=${v2}`
  );
}

/** Get compatibility mode */
export async function getCompatibility(
  registryId: string,
  subject: string
): Promise<CompatibilityInfo> {
  return api.get<CompatibilityInfo>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}/compatibility`
  );
}

/** Get references (outgoing) */
export async function getReferences(
  registryId: string,
  subject: string
) {
  return api.get<{ name: string; subject: string; version: number }[]>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}/references`
  );
}

/** Get dependents (incoming — who references this) */
export async function getDependents(
  registryId: string,
  subject: string
) {
  return api.get<{ name: string; subject: string; version: number }[]>(
    `${base(registryId)}/subjects/${encodeURIComponent(subject)}/dependents`
  );
}