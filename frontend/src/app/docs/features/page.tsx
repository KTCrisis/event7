// src/app/docs/features/page.tsx

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
} from "lucide-react";

const features = [
  {
    icon: Search,
    name: "Schema Explorer",
    description:
      "Browse every subject in your registries. View schema content, field structure, format (Avro, JSON Schema), and all versions at a glance. Filter and search across hundreds of schemas instantly.",
    badge: "Community",
  },
  {
    icon: GitCompare,
    name: "Visual Diff Viewer",
    description:
      "Side-by-side, field-level comparison between any two versions of a schema. LCS-based algorithm highlights additions, removals, and modifications with color-coded markers. Works for both Avro and JSON Schema.",
    badge: "Community",
  },
  {
    icon: BookOpen,
    name: "Event Catalog",
    description:
      "A business-friendly view of your event ecosystem. Search, filter, tag, assign owners, add descriptions and data classifications. Inline editing via a drawer panel. CSV export for governance reports.",
    badge: "Community",
  },
  {
    icon: Tags,
    name: "Enrichments",
    description:
      "Tags, ownership, descriptions, and data classification stored in event7's own database — not in your registry. Provider-agnostic by design: enrichments survive registry migrations and work across Confluent, Apicurio, or any future provider.",
    badge: "Community",
  },
  {
    icon: Shield,
    name: "Governance Rules & Policies",
    description:
      "Define rules (CEL conditions, compatibility checks, encryption transforms) and policies (organizational standards, naming conventions, ownership requirements) stored in event7 — provider-agnostic. Four built-in templates for RAW/CORE/REFINED/APPLICATION layers. Three-axis governance scoring with confidence indicator.",
    badge: "Community",
    link: "/docs/governance-rules",
  },
  {
    icon: FileJson,
    name: "AsyncAPI Generation",
    description:
      "Automatically generate AsyncAPI 3.0 specs from your schemas. Avro-to-JSON-Schema conversion built in. View rendered specs or download YAML. Covers your event-driven architecture documentation in one click.",
    badge: "Community",
  },
  {
    icon: Workflow,
    name: "References Graph",
    description:
      "Interactive dependency graph between schemas. Visualize which schemas reference others, spot orphan schemas with no dependents, and identify high-impact schemas that many others depend on.",
    badge: "Community",
  },
  {
    icon: BarChart3,
    name: "Dashboard & KPIs",
    description:
      "At-a-glance metrics: schema count, enrichment coverage, governance score, rules by scope, enforcement funnel, compatibility distribution, and top-referenced schemas. Built with Recharts for a clean, real-time overview.",
    badge: "Community",
  },
  {
    icon: Layers,
    name: "Multi-Provider",
    description:
      "Connect Confluent Cloud (API Key), Confluent Platform (LDAP/RBAC), or Apicurio Registry v3 — all through the same interface. Adapter pattern means adding a new provider is one Python file.",
    badge: "Community",
  },
  {
    icon: ShieldCheck,
    name: "Compatibility Tracking",
    description:
      "View and monitor the compatibility mode of each subject (BACKWARD, FORWARD, FULL, NONE). Detect drift between intended policy and actual configuration across your registries.",
    badge: "Community",
  },
  {
    icon: Bot,
    name: "AI Agent",
    description:
      "Terminal-style interface powered by LLM. Six context commands (/health, /schemas, /drift, /catalog, /refs, /asyncapi) and three write actions (enrich, generate, delete) with confirmation UI. Bring your own model — Ollama local, Ollama Cloud, or any OpenAI-compatible API.",
    badge: "Community",
  },
];

const comingSoon = [
  {
    icon: ScrollText,
    name: "Provider Rule Sync",
    description:
      "Import rules from Confluent ruleSet (CEL, JSONATA) and Apicurio artifact rules. Push event7 governance rules back to providers. Drift detection between declared and actual state.",
    badge: "Pro",
  },
  {
    icon: Database,
    name: "Extended Metadata",
    description:
      "Custom business attributes beyond tags and ownership. Define structured key-value metadata to capture domain-specific context — data lineage annotations, SLA tiers, data sensitivity levels, and more.",
    badge: "Community",
  },
  {
    icon: RefreshCw,
    name: "Registry Metadata Sync",
    description:
      "Read tags, business metadata, and rules from Confluent Catalog API (Stream Governance) or Apicurio labels and rules. Unify all metadata in event7's governance layer regardless of source.",
    badge: "Community",
  },
  {
    icon: Lock,
    name: "Encryption Tracking",
    description:
      "Display field-level encryption metadata (CSFLE, custom encryption). Visualize which fields are encrypted across your schemas — without vendor lock-in on the encryption mechanism itself.",
    badge: "Pro",
  },
];

function BadgeColor({ tier }: { tier: string }) {
  if (tier === "Pro") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
      Community
    </span>
  );
}

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const content = (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/15 transition-colors">
        <feature.icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5">
          <h3 className="text-sm font-semibold text-white">
            {feature.name}
          </h3>
          <BadgeColor tier={feature.badge} />
          {"link" in feature && (
            <span className="text-[10px] text-teal-400/60 font-medium">
              docs →
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  );

  if ("link" in feature && feature.link) {
    return (
      <Link
        href={feature.link}
        className="group block rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 hover:border-teal-500/30 hover:bg-slate-900/50 transition-all duration-200"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="group rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 hover:border-slate-700 hover:bg-slate-900/50 transition-all duration-200">
      {content}
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
        Features
      </h1>
      <p className="text-base text-slate-400 leading-relaxed mb-10 max-w-2xl">
        Everything you need to govern your event schemas — from exploration to
        AI-powered automation. Community features are free and open-source.
      </p>

      {/* Current features */}
      <div className="space-y-4">
        {features.map((f) => (
          <FeatureCard key={f.name} feature={f} />
        ))}
      </div>

      {/* Coming soon */}
      <section className="mt-14">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Coming soon
          </h2>
          <div className="h-px flex-1 bg-slate-800/60" />
        </div>
        <div className="space-y-4">
          {comingSoon.map((f) => (
            <div
              key={f.name}
              className="group rounded-xl border border-dashed border-slate-800/60 bg-slate-900/20 p-5 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/50 text-slate-500">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <h3 className="text-sm font-semibold text-slate-300">
                      {f.name}
                    </h3>
                    <BadgeColor tier={f.badge} />
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-500 border border-slate-700">
                      Soon
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}