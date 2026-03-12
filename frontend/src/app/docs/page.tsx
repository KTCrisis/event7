import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Layers,
  GitCompare,
  Search,
  Workflow,
  Bot,
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
    desc: "Side-by-side field-level diff between any two versions of a schema.",
  },
  {
    icon: Layers,
    title: "Multi-Provider",
    desc: "Connect Confluent Cloud, Confluent Platform, or Apicurio — same UI.",
  },
  {
    icon: Shield,
    title: "Governance Overlay",
    desc: "Tags, ownership, classification, and descriptions stored independently of your registry.",
  },
  {
    icon: Workflow,
    title: "References Graph",
    desc: "Interactive dependency graph between schemas — spot orphans and hotspots.",
  },
  {
    icon: Bot,
    title: "AI Agent",
    desc: "Natural-language commands to audit drift, coverage gaps, and automate enrichments.",
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

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          event7 is a provider-agnostic governance layer for your schema
          registries. Explore schemas, track drift, manage ownership, and
          generate AsyncAPI specs — whether you run Confluent, Apicurio, or
          both.
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

      {/* Highlights grid */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          What you get
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
          How it works
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
          <pre className="text-sm text-slate-400 font-mono leading-relaxed overflow-x-auto">
{`┌─────────────────────────────────────────────────┐
│  event7 UI  (Next.js · Cloudflare Pages)        │
│  Schema Explorer · Catalog · Diff · Graph · AI  │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────┐
│  event7 API  (FastAPI · Railway / GKE)          │
│  Services → Providers → Cache (Redis)           │
│            → Database (Supabase / PostgreSQL)    │
└──────┬──────────────┬───────────────────────────┘
       │              │
┌──────┴─────┐ ┌──────┴──────┐
│ Confluent  │ │  Apicurio   │   ← your registries
│ Cloud / CP │ │  Registry   │
└────────────┘ └─────────────┘`}
          </pre>
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
              Redis, no external dependencies.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}