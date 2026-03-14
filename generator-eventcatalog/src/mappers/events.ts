/**
 * Events mapper — creates EventCatalog events (or commands) from event7 schemas.
 * Handles: writeEvent, addSchemaToEvent, addFileToEvent, addEventToDomain.
 */

import type {
  ExportSchema,
  ExportRegistryInfo,
  DomainConfig,
  GeneratorOptions,
} from "../types";
import { generateEventMarkdown } from "../templates/event-markdown";
import { resolveDomain } from "./domains";
import { slugify } from "./teams";

// ── Helpers ──

/**
 * Build badges array for EventCatalog frontmatter.
 */
function buildBadges(schema: ExportSchema): Array<{
  content: string;
  textColor: string;
  backgroundColor: string;
}> {
  const badges: Array<{
    content: string;
    textColor: string;
    backgroundColor: string;
  }> = [];

  // Data layer badge
  if (schema.enrichment.data_layer) {
    badges.push({
      content: schema.enrichment.data_layer.toUpperCase(),
      textColor: "white",
      backgroundColor: "blue",
    });
  }

  // Classification badge
  if (
    schema.enrichment.classification &&
    schema.enrichment.classification !== "internal"
  ) {
    const bgColor =
      schema.enrichment.classification === "restricted"
        ? "red"
        : schema.enrichment.classification === "confidential"
          ? "orange"
          : "gray";
    badges.push({
      content: schema.enrichment.classification.toUpperCase(),
      textColor: "white",
      backgroundColor: bgColor,
    });
  }

  // Score badge
  if (schema.governance_score) {
    const s = schema.governance_score;
    const bgColor = s.score >= 75 ? "green" : s.score >= 50 ? "yellow" : "red";
    badges.push({
      content: `Score: ${s.score}/100 (${s.grade})`,
      textColor: "white",
      backgroundColor: bgColor,
    });
  }

  // Format badge
  badges.push({
    content: schema.format,
    textColor: "white",
    backgroundColor: schema.format === "AVRO" ? "purple" : "teal",
  });

  return badges;
}

/**
 * Determine if a schema should be skipped in 'auto' mode.
 * -key suffixed schemas are key schemas, not events.
 */
function shouldSkipAuto(subject: string): boolean {
  return subject.endsWith("-key");
}

/**
 * Clean subject name for display (strip -value suffix in auto mode).
 */
function cleanName(subject: string, messageType: string): string {
  if (messageType === "auto" && subject.endsWith("-value")) {
    return subject.slice(0, -6); // strip "-value"
  }
  return subject;
}

// ── Main mapper ──

export async function mapEvents(
  schemas: ExportSchema[],
  registry: ExportRegistryInfo,
  options: GeneratorOptions,
  utils: Record<string, Function>,
  debug: boolean,
): Promise<void> {
  const {
    writeEvent,
    writeCommand,
    addSchemaToEvent,
    addSchemaToCommand,
    addFileToEvent,
    addFileToCommand,
    addEventToDomain,
    addCommandToDomain,
  } = utils;

  const messageType = options.messageType || "event";
  const domains = options.domains || [];
  const includeGovernance = options.includeGovernance !== false;
  const includeReferences = options.includeReferences !== false;
  const includeAsyncAPI = options.includeAsyncAPI !== false;

  for (const schema of schemas) {
    // Auto mode: skip key schemas
    if (messageType === "auto" && shouldSkipAuto(schema.subject)) {
      if (debug) {
        console.log(`[event7] Skip (key schema): ${schema.subject}`);
      }
      continue;
    }

    const name = cleanName(schema.subject, messageType);
    const version = String(schema.latest_version);

    // Build markdown
    const markdown = generateEventMarkdown(schema, registry, {
      includeGovernance,
      includeReferences,
    });

    // Build badges
    const badges = buildBadges(schema);

    // Build owners
    const owners: Array<{ id: string }> = [];
    if (schema.enrichment.owner_team) {
      owners.push({ id: slugify(schema.enrichment.owner_team) });
    }

    // Resolve domain
    const domain = resolveDomain(schema, domains, options.defaultDomain);

    // Choose write function based on message type
    const isCommand = messageType === "command";
    const writeFn = isCommand ? writeCommand : writeEvent;
    const addSchemaFn = isCommand ? addSchemaToCommand : addSchemaToEvent;
    const addFileFn = isCommand ? addFileToCommand : addFileToEvent;
    const addToDomainFn = isCommand ? addCommandToDomain : addEventToDomain;

    // 1. Write event/command
    const eventData: Record<string, unknown> = {
      id: schema.subject,
      name,
      version,
      markdown,
    };

    // Only include defined values (YAML frontmatter can't serialize undefined)
    if (schema.enrichment.description) {
      eventData.summary = schema.enrichment.description;
    }
    if (schema.enrichment.owner_team) {
      eventData.owners = [schema.enrichment.owner_team];
    }
    if (badges.length > 0) {
      eventData.badges = badges;
    }

    await writeFn(eventData, { override: true });
    if (debug) {
      console.log(
        `[event7] ${isCommand ? "Command" : "Event"}: ${schema.subject} (v${version})`,
      );
    }

    // 2. Attach schema content
    if (schema.schema_content && addSchemaFn) {
      try {
        const ext = schema.format === "AVRO" ? "avsc" : "json";
        const content = JSON.stringify(schema.schema_content, null, 2);
        await addSchemaFn(schema.subject, {
          fileName: `schema.${ext}`,
          schema: content,
        });
      } catch (e) {
        if (debug) {
          console.warn(`[event7] Could not attach schema to ${schema.subject}:`, e);
        }
      }
    }

    // 3. Attach AsyncAPI spec
    if (includeAsyncAPI && schema.asyncapi_yaml && addFileFn) {
      try {
        await addFileFn(schema.subject, {
          fileName: "asyncapi.yaml",
          content: schema.asyncapi_yaml,
        });
      } catch (e) {
        if (debug) {
          console.warn(
            `[event7] Could not attach AsyncAPI to ${schema.subject}:`,
            e,
          );
        }
      }
    }

    // 4. Add to domain
    if (domain) {
      try {
        const { addEventToDomain, addCommandToDomain } = utils;
        const fn = isCommand ? addCommandToDomain : addEventToDomain;
        if (fn) {
          await fn(domain.id, { id: schema.subject, version });
          if (debug) {
            console.log(`[event7]   → domain: ${domain.id}`);
          }
        }
      } catch (e: any) {
        console.warn(`[event7] ⚠ domain link failed: ${schema.subject} → ${domain.id}: ${e.message}`);
      }
    }
  }
}