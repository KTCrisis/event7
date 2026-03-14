/**
 * generator-event7 — EventCatalog generator plugin
 *
 * Imports governance data from event7 into EventCatalog:
 * schemas, enrichments, governance scores, channels, teams, and AsyncAPI specs.
 *
 * Usage in eventcatalog.config.js:
 *
 *   generators: [
 *     ['@event7/generator-eventcatalog', {
 *       event7Url: 'http://localhost:8000',
 *       event7Token: process.env.EVENT7_TOKEN,
 *       registryId: process.env.EVENT7_REGISTRY_ID,
 *     }]
 *   ]
 */

import type { GeneratorOptions, ExportSchema, FilterConfig } from "./types";
import { fetchExport } from "./event7-client";
import { mapTeams } from "./mappers/teams";
import { mapDomains } from "./mappers/domains";
import { mapEvents } from "./mappers/events";
import { mapChannels } from "./mappers/channels";


// ── Filter logic ──

function applyFilters(
  schemas: ExportSchema[],
  filter?: FilterConfig,
): ExportSchema[] {
  if (!filter) return schemas;

  let filtered = schemas;

  // Include prefix
  if (filter.prefix) {
    const prefix = filter.prefix;
    filtered = filtered.filter((s) => s.subject.startsWith(prefix));
  }

  // Exclude prefixes
  if (filter.excludePrefix && filter.excludePrefix.length > 0) {
    const excludes = filter.excludePrefix;
    filtered = filtered.filter(
      (s) => !excludes.some((ex: string) => s.subject.startsWith(ex)),
    );
  }

  // Exclude tags
  if (filter.excludeTags && filter.excludeTags.length > 0) {
    const excludeTags = filter.excludeTags;
    filtered = filtered.filter(
      (s) => !s.enrichment.tags.some((t: string) => excludeTags.includes(t)),
    );
  }

  return filtered;
}

// ── Generator entry point ──

/**
 * EventCatalog generator function.
 *
 * @param config - EventCatalog global config (eventcatalog.config.js)
 * @param options - Generator-specific options (connection, domains, flags)
 */
async function generator(
  config: Record<string, unknown>,
  options: GeneratorOptions,
): Promise<void> {
  const debug = options.debug || false;

  // Validate required options
  if (!options.event7Url) {
    throw new Error("[event7] Missing required option: event7Url");
  }
  if (!options.registryId) {
    throw new Error("[event7] Missing required option: registryId");
  }

  console.log(`[event7] Starting EventCatalog export from ${options.event7Url}`);

  // ── Phase 0: Fetch ──

  const payload = await fetchExport(
    options.event7Url,
    options.registryId,
    options.event7Token,
    debug,
  );

  // Apply filters
  const schemas = applyFilters(payload.schemas, options.filter);

  console.log(
    `[event7] Exporting ${schemas.length} schemas` +
      (payload.schemas.length !== schemas.length
        ? ` (filtered from ${payload.schemas.length})`
        : "") +
      `, ${payload.channels.length} channels, ${payload.teams.length} teams`,
  );

  // ── Get SDK utils ──
  // EventCatalog SDK is loaded via require at runtime (CJS)
  // The SDK is initialized with __dirname which points to the catalog root

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sdkModule = require("@eventcatalog/sdk");
  const sdk = sdkModule.default || sdkModule;
  const utils = sdk(process.env.PROJECT_DIR || process.cwd());

  // ── Phase 1: Teams ──

  if (options.includeTeams !== false && payload.teams.length > 0) {
    if (debug) console.log(`\n[event7] Phase 1: Teams (${payload.teams.length})`);
    await mapTeams(payload.teams, utils, debug);
  }

  // ── Phase 2: Domains ──

  if (options.domains && options.domains.length > 0) {
    if (debug) console.log(`\n[event7] Phase 2: Domains (${options.domains.length})`);
    await mapDomains(options.domains, options.defaultDomain, utils, debug);
  }

  // ── Phase 3: Events/Commands ──

  if (debug) console.log(`\n[event7] Phase 3: Events (${schemas.length})`);
  await mapEvents(schemas, payload.registry, options, utils, debug);

  // ── Phase 4: Channels ──

  if (options.includeChannels !== false && payload.channels.length > 0) {
    if (debug) console.log(`\n[event7] Phase 4: Channels (${payload.channels.length})`);
    await mapChannels(payload.channels, utils, debug);
  }

  // ── Done ──

  console.log(`[event7] ✓ Export complete`);
}

// Also export as default for ESM compat
export default generator;