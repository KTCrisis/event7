// src/lib/api/channels.ts
// Channels & Bindings API functions
//
// Placement: frontend/src/lib/api/channels.ts

import { api } from "./client";
import type {
  ChannelCreate,
  ChannelUpdate,
  ChannelResponse,
  ChannelSummary,
  ChannelSubjectCreate,
  ChannelSubjectResponse,
  ChannelMapResponse,
} from "@/types/channel";

const base = (registryId: string) =>
  `/api/v1/registries/${registryId}`;

// ================================================================
// CHANNELS CRUD
// ================================================================

/** List all channels for a registry (with optional filters) */
export async function listChannels(
  registryId: string,
  params?: { broker_type?: string; data_layer?: string; search?: string }
): Promise<ChannelSummary[]> {
  const query = new URLSearchParams();
  if (params?.broker_type) query.set("broker_type", params.broker_type);
  if (params?.data_layer) query.set("data_layer", params.data_layer);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return api.get<ChannelSummary[]>(
    `${base(registryId)}/channels${qs ? `?${qs}` : ""}`
  );
}

/** Get a single channel with its bindings */
export async function getChannel(
  registryId: string,
  channelId: string
): Promise<ChannelResponse> {
  return api.get<ChannelResponse>(
    `${base(registryId)}/channels/${channelId}`
  );
}

/** Create a new channel */
export async function createChannel(
  registryId: string,
  data: ChannelCreate
): Promise<ChannelResponse> {
  return api.post<ChannelResponse>(
    `${base(registryId)}/channels`,
    data
  );
}

/** Update a channel */
export async function updateChannel(
  registryId: string,
  channelId: string,
  data: ChannelUpdate
): Promise<ChannelResponse> {
  return api.put<ChannelResponse>(
    `${base(registryId)}/channels/${channelId}`,
    data
  );
}

/** Delete a channel (cascades bindings) */
export async function deleteChannel(
  registryId: string,
  channelId: string
): Promise<void> {
  return api.delete(
    `${base(registryId)}/channels/${channelId}`
  );
}

// ================================================================
// BINDINGS
// ================================================================

/** List all subject bindings for a channel */
export async function listBindings(
  registryId: string,
  channelId: string
): Promise<ChannelSubjectResponse[]> {
  return api.get<ChannelSubjectResponse[]>(
    `${base(registryId)}/channels/${channelId}/subjects`
  );
}

/** Bind a subject to a channel */
export async function createBinding(
  registryId: string,
  channelId: string,
  data: ChannelSubjectCreate
): Promise<ChannelSubjectResponse> {
  return api.post<ChannelSubjectResponse>(
    `${base(registryId)}/channels/${channelId}/subjects`,
    data
  );
}

/** Remove a subject binding from a channel */
export async function deleteBinding(
  registryId: string,
  channelId: string,
  bindingId: string
): Promise<void> {
  return api.delete(
    `${base(registryId)}/channels/${channelId}/subjects/${bindingId}`
  );
}

// ================================================================
// REVERSE LOOKUP
// ================================================================

/** List all channels that transport a given subject */
export async function getChannelsForSubject(
  registryId: string,
  subjectName: string
): Promise<Record<string, unknown>[]> {
  return api.get<Record<string, unknown>[]>(
    `${base(registryId)}/subjects/${encodeURIComponent(subjectName)}/channels`
  );
}

// ================================================================
// CHANNEL MAP (aggregated view)
// ================================================================

/** Full channel-map view: channels + subjects + bindings + metrics */
export async function getChannelMap(
  registryId: string
): Promise<ChannelMapResponse> {
  return api.get<ChannelMapResponse>(
    `${base(registryId)}/channel-map`
  );
}