import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Layers,
  GitCompare,
  Search,
  Workflow,
  Bot,
  Network,
  FileCode,
  Library,
  BarChart3,
  Scale,
  Upload,
  ShieldCheck,
} from "lucide-react";

const highlights = [
  {
    icon: Search,
    title: "Schema Explorer",
    desc: "Browse subjects, versions, and fields across all your registries in one place.",
  },
  {
    icon: GitCompare,
    title: "Visual Diff",
    desc: "Side-by-side field-level diff between any two versions — with breaking change detection.",
  },
  {
    icon: ShieldCheck,
    title: "Schema Validator",
    desc: "Validate before publishing: SR compatibility + governance rules + diff preview in one report. PASS / WARN / FAIL.",
  },
  {
    icon: Library,
    title: "Event Catalog",
    desc: "Business view of your schemas — ownership, tags, classification, data layers, and broker bindings.",
  },
  {
    icon: Network,
    title: "Channel Model",
    desc: "Map schemas to messaging channels across Kafka, RabbitMQ, Pulsar, NATS, Redis Streams, and cloud brokers.",
  },
  {
    icon: FileCode,
    title: "AsyncAPI Bi-directional",
    desc: "Generate specs from schemas, or import specs to create channels, bindings, and enrichments in one click.",
  },
  {
    icon: Scale,
    title: "Governance Rules",
    desc: "Define data rules — naming policies, field requirements, compliance checks — enforced across all schemas.",
  },
  {
    icon: Workflow,
    title: "References Graph",
    desc: "Interactive dependency graph between schemas — spot orphans, hotspots, and high-impact schemas.",
  },
  {
    icon: Shield,
    title: "Governance Overlay",
    desc: "Tags, ownership, classification, and descriptions stored in event7 — independent of your registry provider.",
  },
  {
    icon: Layers,
    title: "Multi-Provider",
    desc: "Connect Confluent Cloud, Confluent Platform, Apicurio, Karapace, or Redpanda — same UI, same governance.",
  },
  {
    icon: BarChart3,
    title: "Dashboard & KPIs",
    desc: "Schema health, enrichment coverage, governance score, compatibility distribution — all at a glance.",
  },
  {
    icon: Upload,
    title: "Smart Registration",
    desc: "Import AsyncAPI specs and event7 routes schemas to the right registry — Kafka to Confluent, everything else to Apicurio.",
  },
  {
    icon: Bot,
    title: "AI Agent",
    desc: "Natural-language commands to audit drift, coverage gaps, and automate governance tasks.",
  },
];

export default function DocsIntroPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Apache 2.0
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Open-core
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          Universal schema
          <br />
          registry governance
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-4">
          Explore, validate, and govern your event schemas — across any
          registry, any broker, any spec.
        </p>

        <p className="text-base text-slate-500 leading-relaxed max-w-2xl mb-8">
          Schema registries store schemas. They don&apos;t govern them. event7
          adds a provider-agnostic governance layer above your registries.
          Schemas stay in your registry (Confluent, Apicurio, Karapace,
          Redpanda). Everything else — enrichments, channels, rules, validation,
          AsyncAPI specs — lives in event7.{" "}
          <span className="text-slate-400 font-medium">
            event7 is not a registry. It&apos;s the governance layer your
            registries are missing.
          </span>
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/features"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 border border-slate-700 hover:border-slate-600 hover:text-white transition-colors"
          >
            Explore features
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-12" />

      {/* Two missions */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Two missions, one platform
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-2">
              Explore
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Help developers version schemas with confidence: visual diff with
              breaking change detection, dependency graph to anticipate impact,
              schema validation that combines SR compatibility and governance
              rules before publishing.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">
              Govern
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Give organizations a single place to govern events across any
              registry and any broker: enrichments, ownership, data layers,
              scoring, channel model, AsyncAPI import/export — all
              provider-agnostic, all stored in event7.
            </p>
          </div>
        </div>
      </section>

      {/* Highlights grid */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          What you get
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((h) => (
            <div
              key={h.title}
              className="group rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 hover:border-slate-700 hover:bg-slate-900/50 transition-all duration-200"
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                  <h.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {h.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {h.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture overview */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          How it fits
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
          <pre className="text-sm text-slate-400 font-mono leading-relaxed overflow-x-auto">
{`Schema Registry  ↔  event7                ↔  AsyncAPI / CloudEvents  →  EventCatalog / Backstage
  (stores)          (governs + validates)      (specifies)                (documents)

┌──────────────────────────────────────────────────────────────────┐
│  event7 UI  (Next.js · Cloudflare Pages)                         │
│  Explorer · Diff · Validate · Catalog · Channels · Rules · AI    │
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST API
┌───────────────────────────┴──────────────────────────────────────┐
│  event7 API  (FastAPI · Railway / GKE)                           │
│  Services → Providers → Cache (Redis)                            │
│            → Database (Supabase / PostgreSQL)                     │
│            → Channels · Rules · Enrichments · AsyncAPI Specs      │
└──────┬──────────────┬────────────────────────────────────────────┘
       │              │
┌──────┴─────┐ ┌──────┴──────┐
│ Confluent  │ │  Apicurio   │   ← your registries (schemas live here)
│ Cloud / CP │ │  Registry   │
└────────────┘ └─────────────┘
                                   event7 = governance layer
  Kafka · RabbitMQ · Pulsar        schemas → registry (external)
  NATS · Redis · Pub/Sub           channels + rules + enrichments → event7 DB`}
          </pre>
        </div>
      </section>

      {/* Key flows */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Key flows
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-2">
              Connect & Explore
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Register a schema registry, browse subjects, view versions,
              inspect references, and compare diffs — all in one UI.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-teal-400 mb-2">
              Validate & Ship
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Test a schema before publishing: SR compatibility check,
              governance rules evaluation, and diff preview — in a single
              report. PASS, WARN, or FAIL.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">
              Import & Govern
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Import an AsyncAPI spec to create channels, bindings, and
              enrichments. Define governance rules. event7 routes schemas
              to the right registry automatically.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">
              Catalog & Share
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              The Event Catalog gives business teams a searchable view with
              ownership, data layers, broker types, and AsyncAPI specs —
              bridging developers and data governance.
            </p>
          </div>
        </div>
      </section>

      {/* Deployment modes */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Deployment modes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-2">
              SaaS
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign up, connect your registry, start governing. Hosted on
              Cloudflare Pages + Railway + Supabase Cloud.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">
              Self-hosted
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Docker Compose or Kubernetes. Your infra, your data. PostgreSQL +
              Redis + Apicurio, no external dependencies.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}