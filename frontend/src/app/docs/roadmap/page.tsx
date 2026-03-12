// src/app/docs/roadmap/page.tsx

import { Check, ArrowRight, Clock, Telescope } from "lucide-react";

interface RoadmapItem {
  name: string;
  tier: "Community" | "Pro" | "Enterprise";
}

const done: RoadmapItem[] = [
  { name: "Confluent Schema Registry provider (Cloud + Platform)", tier: "Community" },
  { name: "Apicurio Registry v3 provider", tier: "Community" },
  { name: "Schema Explorer with field-level detail", tier: "Community" },
  { name: "Visual Diff Viewer (LCS-based, Avro + JSON Schema)", tier: "Community" },
  { name: "Event Catalog with search, filter, CSV export", tier: "Community" },
  { name: "Enrichments — tags, owner, description, classification", tier: "Community" },
  { name: "AsyncAPI 3.0 generation and export", tier: "Community" },
  { name: "References Graph with dependency visualization", tier: "Community" },
  { name: "Dashboard with governance KPIs", tier: "Community" },
  { name: "AI Agent — BYOM (Ollama, OpenAI, etc.)", tier: "Community" },
  { name: "Confluent Auth Mode (Cloud API Key vs Self-Managed LDAP)", tier: "Community" },
  { name: "Dual-mode deployment (SaaS + self-hosted Docker)", tier: "Community" },
  { name: "Dual-mode database (Supabase + PostgreSQL)", tier: "Community" },
  { name: "Public documentation (/docs)", tier: "Community" },
  { name: "Hosted Registry UX stub (coming soon flow)", tier: "Pro" },
  { name: "Governance Rules & Policies — CRUD, templates, scoring", tier: "Community" },
  { name: "Governance Templates — RAW, CORE, REFINED, APPLICATION layers", tier: "Community" },
  { name: "Governance Score — 3-axis scoring with confidence indicator", tier: "Community" },
  { name: "Dashboard governance integration — coverage, rules, enforcement funnel", tier: "Community" },
  { name: "Catalog score badges with toggle", tier: "Community" },
];

const next: RoadmapItem[] = [
  { name: "RLS Supabase — multi-tenant security", tier: "Community" },
  { name: "Provider Rule Sync — import from Confluent ruleSet", tier: "Pro" },
  { name: "Provider Rule Sync — push rules to Confluent", tier: "Pro" },
  { name: "Provider Rule Sync — import Apicurio artifact rules", tier: "Pro" },
  { name: "Drift detection — event7 vs provider comparison", tier: "Pro" },
  { name: "Hosted registry provisioning (Apicurio-backed)", tier: "Pro" },
  { name: "Protobuf support — 3rd schema format", tier: "Community" },
  { name: "Cross-registry aggregated view (All registries)", tier: "Community" },
  { name: "Extended business metadata — custom attributes", tier: "Community" },
  { name: "Confluent Catalog API reader (Stream Governance)", tier: "Community" },
  { name: "Apicurio metadata sync (labels + rules)", tier: "Community" },
  { name: "Encryption tracking (CSFLE metadata)", tier: "Pro" },
  { name: "Channel model — topics, queues, exchanges", tier: "Community" },
  { name: "Kafka TNS auto-detect + RNS manual mapping", tier: "Community" },
  { name: "RabbitMQ exchange/queue support", tier: "Community" },
  { name: "Cloud broker channels (Pub/Sub, SNS/SQS, Service Bus)", tier: "Community" },
  { name: "AsyncAPI channel bindings from channel model", tier: "Community" },
];

const planned: RoadmapItem[] = [
  { name: "AuthProvider abstraction — Supabase vs OIDC", tier: "Enterprise" },
  { name: "AI Agent Managed — hosted LLM with tokens included", tier: "Pro" },
  { name: "AWS Glue Schema Registry provider", tier: "Community" },
  { name: "Automated policy evaluation (schema content + enrichment checks)", tier: "Community" },
  { name: "Custom governance templates (user-created)", tier: "Community" },
];

const future: RoadmapItem[] = [
  { name: "RBAC — role-based access control", tier: "Enterprise" },
  { name: "SSO / SAML integration", tier: "Enterprise" },
  { name: "Public REST API", tier: "Community" },
  { name: "Breaking change notifications", tier: "Pro" },
  { name: "Schema health scoring", tier: "Pro" },
  { name: "Audit log export", tier: "Enterprise" },
];

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    Community: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    Pro: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Enterprise: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[tier]}`}
    >
      {tier}
    </span>
  );
}

function RoadmapSection({
  icon: Icon,
  title,
  subtitle,
  color,
  items,
  doneStyle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  items: RoadmapItem[];
  doneStyle?: boolean;
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-2.5 mb-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="text-xs text-slate-600 font-medium">
          {items.length} items
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-5">{subtitle}</p>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 divide-y divide-slate-800/30 overflow-hidden">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-900/40 transition-colors"
          >
            {doneStyle ? (
              <Check className="h-4 w-4 shrink-0 text-teal-500" />
            ) : (
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
            )}
            <span
              className={`flex-1 text-sm ${
                doneStyle ? "text-slate-500" : "text-slate-300"
              }`}
            >
              {item.name}
            </span>
            <TierBadge tier={item.tier} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RoadmapPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
        Roadmap
      </h1>
      <p className="text-base text-slate-400 leading-relaxed mb-10 max-w-2xl">
        Where event7 is today and where it&apos;s going. Community features are
        open-source under Apache 2.0. Pro and Enterprise features are coming in
        paid tiers.
      </p>

      <RoadmapSection
        icon={Check}
        title="Done"
        subtitle="Shipped and available today."
        color="text-teal-400"
        items={done}
        doneStyle
      />

      <RoadmapSection
        icon={ArrowRight}
        title="Next"
        subtitle="Actively planned — provider sync, channel model, and multi-tenant security."
        color="text-cyan-400"
        items={next}
      />

      <RoadmapSection
        icon={Clock}
        title="Planned"
        subtitle="Designed but not yet scheduled."
        color="text-amber-400"
        items={planned}
      />

      <RoadmapSection
        icon={Telescope}
        title="Future"
        subtitle="On the radar for post-MVP evolution."
        color="text-violet-400"
        items={future}
      />
    </article>
  );
}