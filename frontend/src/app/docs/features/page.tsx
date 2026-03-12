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
      "At-a-glance metrics: schema count, enrichment coverage, compatibility modes distribution, top-referenced schemas, and recent version activity. Built with Recharts for a clean, real-time overview.",
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
      "Terminal-style interface powered by LLM. Six context commands (/health, /schemas, /drift, /catalog, /refs, /asyncapi) and three write actions (enrich, generate, delete) with confirmation UI. Pluggable: Ollama local, Ollama Cloud, or any OpenAI-compatible API.",
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

      <div className="space-y-4">
        {features.map((f) => (
          <div
            key={f.name}
            className="group rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 hover:border-slate-700 hover:bg-slate-900/50 transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/15 transition-colors">
                <f.icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <h3 className="text-sm font-semibold text-white">
                    {f.name}
                  </h3>
                  <BadgeColor tier={f.badge} />
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {f.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}