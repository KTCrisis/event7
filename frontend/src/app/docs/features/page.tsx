// src/app/docs/features/page.tsx
// Documentation page — Features overview
// v3: Grouped layout (Explore / Govern / Document / Tools) with compact cards.
// Placement: frontend/src/app/docs/features/page.tsx

import Link from "next/link";
import {
  Search,
  GitCompare,
  BookOpen,
  FileJson,
  Workflow,
  Bot,
  Layers,
  BarChart3,
  Tags,
  ShieldCheck,
  ScrollText,
  Database,
  RefreshCw,
  Lock,
  Shield,
  Network,
  Upload,
  FileCode,
  Route,
  GitBranch,
  Eye,
  ExternalLink,
  Pencil,
  ArrowRight,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════
// Feature data — grouped
// ════════════════════════════════════════════════════════════════════

interface Feature {
  icon: React.ElementType;
  name: string;
  description: string;
  badge: "Community" | "Pro" | "Enterprise";
  link?: string;
}

interface FeatureGroup {
  id: string;
  title: string;
  subtitle: string;
  color: string;       // tailwind color token (e.g. "cyan")
  features: Feature[];
}

const groups: FeatureGroup[] = [
  {
    id: "explore",
    title: "Explore",
    subtitle: "Browse, compare, and understand your schemas",
    color: "cyan",
    features: [
      {
        icon: Search,
        name: "Schema Explorer",
        description:
          "Browse every subject in your registries. View schema content, field structure, format (Avro, JSON Schema, Protobuf), and all versions at a glance.",
        badge: "Community",
      },
      {
        icon: GitCompare,
        name: "Visual Diff Viewer",
        description:
          "Side-by-side, field-level comparison between any two versions. LCS-based algorithm highlights additions, removals, and modifications.",
        badge: "Community",
      },
      {
        icon: Workflow,
        name: "References Graph",
        description:
          "Interactive dependency graph between schemas. Spot orphans, shared components, and high-impact schemas that many others depend on.",
        badge: "Community",
      },
      {
        icon: BarChart3,
        name: "Dashboard & KPIs",
        description:
          "At-a-glance metrics: subject count, AsyncAPI coverage, channel coverage, enrichment progress, governance score distribution, and data layer breakdown.",
        badge: "Community",
      },
      {
        icon: GitBranch,
        name: "Compatibility Tracking",
        description:
          "View and monitor the compatibility mode of each subject (BACKWARD, FORWARD, FULL, NONE). Detect drift between policy and configuration.",
        badge: "Community",
      },
    ],
  },
  {
    id: "govern",
    title: "Govern",
    subtitle: "Enrich, validate, and enforce governance standards",
    color: "teal",
    features: [
      {
        icon: BookOpen,
        name: "Schema Catalog",
        description:
          "Business-friendly view of your subjects. AsyncAPI status column, governance score badges, broker bindings, CatalogSheet viewer (Schema + AsyncAPI tabs). Inline enrichment editing and CSV export.",
        badge: "Community",
        link: "/docs/catalog",
      },
      {
        icon: Tags,
        name: "Enrichments",
        description:
          "Tags, ownership, descriptions, data layers, and classification — stored in event7, not your registry. Provider-agnostic: survives registry migrations.",
        badge: "Community",
      },
      {
        icon: Shield,
        name: "Governance Rules & Policies",
        description:
          "CEL conditions, compatibility checks, encryption transforms, and organizational policies. Four built-in templates (RAW/CORE/REFINED/APP). Confluent Data Contract import (ruleSet + PII metadata). Three-axis scoring with confidence indicator.",
        badge: "Community",
        link: "/docs/governance-rules",
      },
      {
        icon: ShieldCheck,
        name: "Schema Validator",
        description:
          "Validate before publishing — in one call. Combines SR compatibility check, governance rules evaluation, and field-level diff preview. Verdict: PASS / WARN / FAIL.",
        badge: "Community",
        link: "/docs/validator",
      },
      {
        icon: Route,
        name: "Smart Schema Registration",
        description:
          "Routes schemas based on registry type during import. Apicurio accepts all formats. Confluent-like registries only receive Kafka schemas — others are skipped with a warning.",
        badge: "Community",
      },
    ],
  },
  {
    id: "document",
    title: "Document",
    subtitle: "Generate specs, map channels, track documentation coverage",
    color: "amber",
    features: [
      {
        icon: Eye,
        name: "AsyncAPI Dual Mode",
        description:
          "Every subject has an AsyncAPI status: origin (imported/generated), status (documented/ready/raw), sync (in_sync/outdated). Overview with KPIs, coverage bar, and two-tier drift detection.",
        badge: "Community",
        link: "/docs/asyncapi",
      },
      {
        icon: FileCode,
        name: "AsyncAPI Generation",
        description:
          "Generate AsyncAPI 3.0 specs with Kafka bindings (partitions, replication, Magic Byte), key schema separation, Avro-to-JSON-Schema conversion. Stores hash for drift detection.",
        badge: "Community",
      },
      {
        icon: Upload,
        name: "AsyncAPI Import",
        description:
          "Import a v3 spec to create channels, bindings, enrichments, and register schemas — all in one operation. Two-phase: preview then apply. 22 broker protocols supported.",
        badge: "Community",
      },
      {
        icon: Network,
        name: "Channel Model",
        description:
          "Map subjects to messaging channels across 22 broker types. N:N bindings with strategy, data layers (RAW→CORE→REFINED→APP), and broker-specific config.",
        badge: "Community",
        link: "/docs/channels",
      },
      {
        icon: ExternalLink,
        name: "EventCatalog Generator",
        description:
          "Export governance data to EventCatalog — scores, rules, channels, teams, AsyncAPI specs. First governance-aware generator. Domain mapping by prefix or tag.",
        badge: "Community",
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    subtitle: "Multi-provider support, AI automation, deployment",
    color: "violet",
    features: [
      {
        icon: Layers,
        name: "Multi-Provider",
        description:
          "Connect Confluent Cloud (API Key), Confluent Platform (LDAP/RBAC), or Apicurio v3. Adapter pattern — one Python file per provider. Karapace and Redpanda work out of the box.",
        badge: "Community",
      },
      {
        icon: Bot,
        name: "AI Agent",
        description:
          "Terminal-style interface with 6 context commands (/health, /schemas, /drift, /catalog, /refs, /asyncapi) and 3 write actions (enrich, generate, delete). BYOM — Ollama, OpenAI, or any compatible API.",
        badge: "Community",
      },
    ],
  },
];

// ════════════════════════════════════════════════════════════════════
// Coming soon
// ════════════════════════════════════════════════════════════════════

const comingSoon: Feature[] = [
  {
    icon: Database,
    name: "Hosted Registry",
    description: "event7 provisions an Apicurio instance for brokers without a native SR (Redis Streams, RabbitMQ, NATS).",
    badge: "Pro",
  },
  {
    icon: ScrollText,
    name: "Provider Rule Sync",
    description: "Bidirectional Confluent sync — import ruleSet + PII metadata, push event7 rules back as Data Contracts. Apicurio import + drift detection — planned.",
    badge: "Pro",
  },
  {
    icon: FileJson,
    name: "AsyncAPI Export (Mode 3)",
    description: "Export real event7 channels as a complete AsyncAPI spec — the round-trip: import → govern → export a better one.",
    badge: "Pro",
  },
  {
    icon: RefreshCw,
    name: "Registry Metadata Sync",
    description: "Read tags and metadata from Confluent Catalog API or Apicurio labels. Unify all metadata in event7.",
    badge: "Community",
  },
  {
    icon: Lock,
    name: "Encryption Tracking",
    description: "Display field-level encryption metadata (CSFLE, custom). Visualize encrypted fields without vendor lock-in.",
    badge: "Pro",
  },
  {
    icon: Route,
    name: "Multi-Registry Routing",
    description: "Import a multi-broker spec → event7 routes schemas to the right registry automatically.",
    badge: "Enterprise",
  },
  {
    icon: Pencil,
    name: "EventCatalog Enricher",
    description: "V2: enrich existing EventCatalog entries with governance scores, rules badges, and compliance data.",
    badge: "Community",
  },
];

// ════════════════════════════════════════════════════════════════════
// Color maps (static for Tailwind purge safety)
// ════════════════════════════════════════════════════════════════════

const groupColors: Record<string, { border: string; accent: string; badge: string; icon: string }> = {
  cyan: {
    border: "border-cyan-500/20",
    accent: "text-cyan-400",
    badge: "bg-cyan-500/10 text-cyan-400",
    icon: "bg-cyan-500/10 text-cyan-400",
  },
  teal: {
    border: "border-teal-500/20",
    accent: "text-teal-400",
    badge: "bg-teal-500/10 text-teal-400",
    icon: "bg-teal-500/10 text-teal-400",
  },
  amber: {
    border: "border-amber-500/20",
    accent: "text-amber-400",
    badge: "bg-amber-500/10 text-amber-400",
    icon: "bg-amber-500/10 text-amber-400",
  },
  violet: {
    border: "border-violet-500/20",
    accent: "text-violet-400",
    badge: "bg-violet-500/10 text-violet-400",
    icon: "bg-violet-500/10 text-violet-400",
  },
};

const tierColors: Record<string, string> = {
  Community: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  Pro: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Enterprise: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

// ════════════════════════════════════════════════════════════════════
// Page
// ════════════════════════════════════════════════════════════════════

export default function FeaturesPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
        Features
      </h1>
      <p className="text-base text-slate-400 leading-relaxed mb-4 max-w-2xl">
        Everything you need to govern your event schemas — from exploration to
        pre-publish validation, multi-broker channel mapping, and AI-powered
        automation.
      </p>
      <p className="text-sm text-slate-500 mb-10">
        All features below are{" "}
        <span className="text-teal-400 font-medium">Community</span> tier —
        free and open-source under Apache 2.0.
      </p>

      {/* Feature groups */}
      <div className="space-y-12">
        {groups.map((group) => {
          const colors = groupColors[group.color];
          return (
            <section key={group.id} id={group.id}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-bold uppercase tracking-widest ${colors.accent}`}>
                  {group.title}
                </span>
                <div className="h-px flex-1 bg-slate-800/60" />
                <span className="text-[10px] text-slate-600">
                  {group.features.length} features
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-5">{group.subtitle}</p>

              {/* Cards grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {group.features.map((feature) => (
                  <FeatureCard
                    key={feature.name}
                    feature={feature}
                    groupColor={group.color}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Coming soon */}
      <section className="mt-14">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Coming soon
          </span>
          <div className="h-px flex-1 bg-slate-800/60" />
          <span className="text-[10px] text-slate-600">
            {comingSoon.length} planned
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Planned features for Pro, Enterprise, and Community tiers.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {comingSoon.map((feature) => (
            <div
              key={feature.name}
              className="group rounded-xl border border-dashed border-slate-800/60 bg-slate-900/20 p-4 transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/50 text-slate-500">
                  <feature.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-300">
                      {feature.name}
                    </h3>
                    <TierBadge tier={feature.badge} />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-14">
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">
              Ready to try?
            </h3>
            <p className="text-sm text-slate-400">
              Get event7 running locally in 5 minutes with Docker, or request a
              demo account on the hosted version.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/docs/concepts"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-slate-300 border border-slate-700 hover:border-slate-600 hover:text-white transition-colors"
            >
              Core Concepts
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════

function FeatureCard({
  feature,
  groupColor,
}: {
  feature: Feature;
  groupColor: string;
}) {
  const colors = groupColors[groupColor];

  const content = (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors.icon} group-hover:brightness-110 transition-all`}>
        <feature.icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-white">{feature.name}</h3>
          {feature.link && (
            <span className="text-[10px] text-teal-400/60 font-medium">
              docs →
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  );

  const className =
    "group rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 hover:border-slate-700 hover:bg-slate-900/50 transition-all duration-200";

  if (feature.link) {
    return (
      <Link href={feature.link} className={`block ${className}`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tierColors[tier]}`}
    >
      {tier}
    </span>
  );
}