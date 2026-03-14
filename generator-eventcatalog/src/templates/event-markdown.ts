/**
 * Generates enriched markdown for an EventCatalog event page.
 * Includes governance scores, rules summary, metadata, and references.
 */

import type {
  ExportSchema,
  ExportRegistryInfo,
  ExportGovernanceScore,
  ExportRuleSummary,
  ExportReference,
} from "../types";

// ── Score emoji ──

function scoreEmoji(score: number): string {
  if (score >= 75) return "🟢";
  if (score >= 50) return "🟡";
  return "🔴";
}

function severityIcon(severity: string): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "error":
      return "🔴";
    case "warning":
      return "🟡";
    default:
      return "🔵";
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case "PASS":
      return "✅";
    case "WARN":
      return "⚠️";
    case "FAIL":
      return "❌";
    default:
      return "❓";
  }
}

// ── Sections ──

function governanceSection(score: ExportGovernanceScore): string {
  const b = score.breakdown;
  return `## Governance

| Metric | Score |
|--------|-------|
| Overall | ${scoreEmoji(score.score)} **${score.score}/100** (${score.grade}) |
| Enrichment | ${b.enrichments}/${b.enrichments_max} |
| Rules | ${b.rules}/${b.rules_max} |
| Schema Quality | ${b.schema_quality}/${b.schema_quality_max} |

**Confidence**: ${score.confidence}`;
}

function rulesSection(rules: ExportRuleSummary[]): string {
  if (rules.length === 0) return "";

  const rows = rules
    .map(
      (r) =>
        `| ${r.rule_name} | ${severityIcon(r.severity)} ${r.severity} | ${statusIcon(r.status)} ${r.status} |`,
    )
    .join("\n");

  return `## Rules

| Rule | Severity | Status |
|------|----------|--------|
${rows}`;
}

function metadataSection(
  schema: ExportSchema,
  registry: ExportRegistryInfo,
): string {
  const rows: string[] = [];

  if (schema.enrichment.data_layer) {
    rows.push(`| Data Layer | \`${schema.enrichment.data_layer.toUpperCase()}\` |`);
  }
  if (schema.enrichment.classification) {
    rows.push(`| Classification | \`${schema.enrichment.classification.toUpperCase()}\` |`);
  }
  rows.push(`| Format | ${schema.format} |`);
  rows.push(`| Versions | ${schema.version_count} |`);
  rows.push(`| Provider | ${registry.provider_type} |`);
  rows.push(`| Registry | ${registry.name} |`);

  return `## Metadata

| Key | Value |
|-----|-------|
${rows.join("\n")}`;
}

function referencesSection(refs: ExportReference[]): string {
  if (refs.length === 0) return "";

  const rows = refs
    .map((r) => `| ${r.subject} | ${r.version} |`)
    .join("\n");

  return `## References

| Schema | Version |
|--------|---------|
${rows}`;
}

// ── Main template ──

export function generateEventMarkdown(
  schema: ExportSchema,
  registry: ExportRegistryInfo,
  options: {
    includeGovernance: boolean;
    includeReferences: boolean;
  },
): string {
  const sections: string[] = [];

  // Description
  sections.push(schema.enrichment.description || "No description provided.");

  // Governance
  if (options.includeGovernance && schema.governance_score) {
    sections.push(governanceSection(schema.governance_score));
  }

  // Rules
  if (options.includeGovernance && schema.rules_summary.length > 0) {
    sections.push(rulesSection(schema.rules_summary));
  }

  // Metadata
  sections.push(metadataSection(schema, registry));

  // References
  if (options.includeReferences && schema.references.length > 0) {
    sections.push(referencesSection(schema.references));
  }

  // Footer
  const now = new Date().toISOString().split("T")[0];
  sections.push(
    `---\n\n*Synced from [event7](https://github.com/KTCrisis/event7) — ${now}*`,
  );

  return sections.join("\n\n");
}