/**
 * Domains mapper — creates EventCatalog domains and resolves schema → domain.
 */

import type { DomainConfig, ExportSchema } from "../types";

/**
 * Resolve which domain a schema belongs to.
 * Priority: prefix match → tag match → defaultDomain → null.
 * First match wins (order in domains[] matters).
 */
export function resolveDomain(
  schema: ExportSchema,
  domains: DomainConfig[],
  defaultDomain?: { id: string; name: string },
): { id: string; name: string; version: string } | null {
  for (const domain of domains) {
    // Prefix match
    if (domain.match.prefix && schema.subject.startsWith(domain.match.prefix)) {
      return {
        id: domain.id,
        name: domain.name,
        version: domain.version || "1.0.0",
      };
    }

    // Tag match
    if (domain.match.tag && schema.enrichment.tags.includes(domain.match.tag)) {
      return {
        id: domain.id,
        name: domain.name,
        version: domain.version || "1.0.0",
      };
    }
  }

  // Default domain
  if (defaultDomain) {
    return {
      id: defaultDomain.id,
      name: defaultDomain.name,
      version: "1.0.0",
    };
  }

  return null;
}

/**
 * Create all configured domains in EventCatalog.
 */
export async function mapDomains(
  domains: DomainConfig[],
  defaultDomain: { id: string; name: string } | undefined,
  utils: Record<string, Function>,
  debug: boolean,
): Promise<void> {
  const { writeDomain } = utils;

  const allDomains = [
    ...domains.map((d) => ({
      id: d.id,
      name: d.name,
      version: d.version || "1.0.0",
    })),
  ];

  if (defaultDomain) {
    allDomains.push({
      id: defaultDomain.id,
      name: defaultDomain.name,
      version: "1.0.0",
    });
  }

  for (const domain of allDomains) {
    await writeDomain({
      id: domain.id,
      name: domain.name,
      version: domain.version,
      markdown: `Domain created by event7 generator.`,
    });

    if (debug) {
      console.log(`[event7] Domain: ${domain.name} (${domain.id})`);
    }
  }
}