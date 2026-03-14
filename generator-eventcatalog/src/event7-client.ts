/**
 * event7 API client — fetches the /export/eventcatalog endpoint.
 */

import type { EventCatalogExport } from "./types";

export async function fetchExport(
  event7Url: string,
  registryId: string,
  token?: string,
  debug = false,
): Promise<EventCatalogExport> {
  const url = `${event7Url.replace(/\/+$/, "")}/api/v1/registries/${registryId}/export/eventcatalog`;

  if (debug) {
    console.log(`[event7] Fetching ${url}`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `[event7] Export failed: ${response.status} ${response.statusText} — ${body}`,
    );
  }

  const data = (await response.json()) as EventCatalogExport;

  if (debug) {
    console.log(
      `[event7] Received: ${data.schemas.length} schemas, ` +
        `${data.channels.length} channels, ${data.teams.length} teams`,
    );
  }

  return data;
}