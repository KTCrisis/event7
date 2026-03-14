// src/app/docs/catalog/page.tsx
// Documentation page — Schema Catalog & Enrichments
// Covers: business view, enrichments, classifications, data layers, AsyncAPI integration,
// governance scores, broker badges, CSV export, CatalogSheet.
// Placement: frontend/src/app/docs/catalog/page.tsx

import Link from "next/link";
import {
  BookOpen,
  ArrowRight,
  Tags,
  Users,
  Shield,
  Layers,
  FileJson,
  Download,
  Pencil,
  Search,
  Network,
  BarChart3,
  ExternalLink,
} from "lucide-react";

export default function CatalogPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Community
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          Schema Catalog
          <br />
          <span className="text-teal-400">& Enrichments</span>
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          The Catalog is the business-friendly view of your event schemas. While
          the Explorer shows raw schema content, the Catalog surfaces what
          matters to governance: who owns it, what it&apos;s for, how it&apos;s
          classified, and whether it has AsyncAPI documentation.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            Open Catalog
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/api-reference"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 border border-slate-700 hover:border-slate-600 hover:text-white transition-colors"
          >
            API Reference
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-12" />

      {/* Core concept */}
      <Section title="Provider-agnostic enrichments">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Enrichments are stored in event7&apos;s own database — not in your
          schema registry. This is a deliberate design decision:
        </p>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <HighlightCard
            icon={Shield}
            title="Why not in the registry?"
            items={[
              "Confluent tags require the Advanced license ($$)",
              "Apicurio labels have limited metadata support",
              "Enrichments survive registry migrations",
              "Same data model regardless of provider",
              "No vendor lock-in on business metadata",
            ]}
          />
          <HighlightCard
            icon={Tags}
            title="What's stored in event7"
            items={[
              "Description — what this schema represents",
              "Owner team — who is responsible",
              "Tags — free-form labels (pii, gdpr, critical-path…)",
              "Classification — public / internal / confidential / restricted",
              "Data layer — RAW / CORE / REFINED / APPLICATION",
            ]}
          />
        </div>
        <p className="text-sm text-slate-500">
          The Schema Registry remains the source of truth for schemas. event7
          stores what the registry doesn&apos;t know — business context.
        </p>
      </Section>

      {/* Classifications */}
      <Section title="Data classifications">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Every schema can be classified to signal its sensitivity level:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ClassCard
            name="Public"
            color="emerald"
            desc="Open data — can be shared externally. No PII, no business secrets."
          />
          <ClassCard
            name="Internal"
            color="blue"
            desc="Default. Available within the organization but not outside. Standard business data."
          />
          <ClassCard
            name="Confidential"
            color="amber"
            desc="Sensitive business data. Restricted to specific teams. May contain PII."
          />
          <ClassCard
            name="Restricted"
            color="red"
            desc="Highest sensitivity. PCI, financial, regulated data. Requires encryption and audit."
          />
        </div>
        <p className="text-sm text-slate-500 mt-4">
          Classifications feed into the governance score — a schema with
          &quot;restricted&quot; classification and no encryption rule gets a lower score.
        </p>
      </Section>

      {/* Data Layers */}
      <Section title="Data layers">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Data layers categorize schemas by their position in the data pipeline.
          Each layer has different governance expectations:
        </p>
        <div className="space-y-3">
          <LayerCard
            name="RAW"
            color="slate"
            strategy="Coupled to topic"
            desc="Ingestion layer. Minimal constraints — backward compatibility, source metadata. Schemas mirror the source system structure."
            naming="<topic-name>-value"
          />
          <LayerCard
            name="CORE"
            color="cyan"
            strategy="Decoupled (business model)"
            desc="Canonical model. Strict governance — full transitive compatibility, mandatory doc fields, PII encryption, ownership. The backbone of your data platform."
            naming="<domain>.<entity>.<version>"
          />
          <LayerCard
            name="REFINED"
            color="amber"
            strategy="References Core"
            desc="Aggregated data. Backward transitive compatibility. Must reference Core types for consistency. Aggregation period documented."
            naming="<domain>.<entity>.agg.<period>.<version>"
          />
          <LayerCard
            name="APPLICATION"
            color="violet"
            strategy="Decoupled (business view)"
            desc="Consumption views. Lightweight governance — backward compatibility, keep schemas simple (max 30 fields). Optimized for specific consumers."
            naming="<app>.<domain>.<entity>.<version>"
          />
        </div>
        <p className="text-sm text-slate-500 mt-4">
          Data layers appear as badges in the Catalog and are used by the{" "}
          <Link href="/docs/governance-rules" className="text-teal-400 hover:text-teal-300">
            governance templates
          </Link>{" "}
          to apply layer-specific rules.
        </p>
      </Section>

      {/* Catalog UI */}
      <Section title="Catalog interface">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          The Catalog table shows one row per schema subject with these columns:
        </p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Column</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <ColRow col="Subject" desc="Schema subject name with format badge (AVRO / JSON)" />
              <ColRow col="Owner" desc="Team responsible for this schema" />
              <ColRow col="Classification" desc="Public / Internal / Confidential / Restricted badge" />
              <ColRow col="Data Layer" desc="RAW / CORE / REFINED / APPLICATION badge" />
              <ColRow col="Broker" desc="Broker types from channel bindings (Kafka, RabbitMQ, Redis…)" />
              <ColRow col="AsyncAPI" desc="Documentation status — documented (✅ vN) / ready / raw (—)" />
              <ColRow col="Score" desc="Governance score badge (A–F) with toggle visibility" />
              <ColRow col="Version" desc="Latest schema version number" />
              <ColRow col="Updated" desc="Relative timestamp (5m ago, 2d ago)" />
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-500">
          Filters: search by subject name, filter by owner, classification,
          data layer, broker type, and AsyncAPI status (all / documented /
          undocumented / with-refs / with-asyncapi / no-asyncapi).
        </p>
      </Section>

      {/* CatalogSheet */}
      <Section title="CatalogSheet viewer">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Clicking a row opens a full-width sheet panel with two tabs:
        </p>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <ViewerTab
            icon={BookOpen}
            title="Schema"
            desc="Raw schema content with syntax highlighting, field structure, version selector, and references list."
          />
          <ViewerTab
            icon={FileJson}
            title="AsyncAPI"
            desc="If documented: rendered AsyncAPI spec with Docs / Edit / JSON sub-tabs. If not: one-click Generate button."
          />
        </div>
        <p className="text-sm text-slate-500">
          The inline enrichment editor (pencil icon) lets you edit description,
          owner, tags, classification, and data layer without leaving the table.
        </p>
      </Section>

      {/* CSV Export */}
      <Section title="CSV export">
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          Export the full catalog as CSV for governance reports, audits, or
          external tools. The export includes all enrichments, format, version
          count, reference count, and governance score.
        </p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
          <code className="text-xs text-teal-400 font-mono">
            GET /api/v1/registries/&#123;id&#125;/catalog/export?format=csv
          </code>
        </div>
      </Section>

      {/* EventCatalog distinction */}
      <Section title="event7 Catalog vs EventCatalog">
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            <strong className="text-white">event7&apos;s Catalog</strong> is a
            governance view of schema subjects — enrichments, scores, and
            documentation status. It lives inside event7 and is designed for
            day-to-day governance work.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            <strong className="text-white">EventCatalog</strong>
            is a separate product — a static documentation site for events,
            services, and domains. event7 exports to EventCatalog via the{" "}
            <code className="text-teal-400 text-xs">generator-event7</code>{" "}
            plugin.
          </p>
          <p className="text-sm text-slate-500">
            Think of it as: event7 Catalog = governance workspace, EventCatalog
            = published documentation portal. They are complementary.
          </p>
        </div>
      </Section>

      {/* Quick start */}
      <Section title="Quick start">
        <div className="space-y-4">
          {[
            { step: "1", title: "Connect a registry", desc: "Go to Settings and connect your Schema Registry (Confluent, Apicurio, or self-hosted)." },
            { step: "2", title: "Open the Catalog", desc: "Navigate to Catalog. All subjects appear with their current enrichment status." },
            { step: "3", title: "Enrich a schema", desc: "Click the pencil icon. Add a description, assign an owner team, set tags and classification." },
            { step: "4", title: "Assign a data layer", desc: "Set RAW, CORE, REFINED, or APPLICATION. This unlocks layer-specific governance templates." },
            { step: "5", title: "Check governance", desc: "Toggle the score column. Enriched schemas get higher scores — target grade A." },
          ].map((s) => (
            <div key={s.step} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm font-bold shrink-0">
                {s.step}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{s.title}</div>
                <div className="text-sm text-slate-400 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </article>
  );
}

// === Sub-components ===

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
}

function HighlightCard({ icon: Icon, title, items }: { icon: typeof Shield; title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-7 w-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm text-slate-400 flex items-start gap-2">
            <span className="text-slate-600 mt-1">·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClassCard({ name, color, desc }: { name: string; color: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
      <div className={`text-xs font-bold text-${color}-400 mb-1.5`}>{name}</div>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function LayerCard({ name, color, strategy, desc, naming }: { name: string; color: string; strategy: string; desc: string; naming: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold text-${color}-400 bg-${color}-500/10 px-2 py-0.5 rounded`}>
            {name}
          </span>
          <span className="text-xs text-slate-500">{strategy}</span>
        </div>
        <code className="text-[10px] text-slate-600 font-mono">{naming}</code>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function ColRow({ col, desc }: { col: string; desc: string }) {
  return (
    <tr>
      <td className="py-2.5 px-4 text-slate-300 font-medium text-sm">{col}</td>
      <td className="py-2.5 px-4 text-slate-500 text-xs">{desc}</td>
    </tr>
  );
}

function ViewerTab({ icon: Icon, title, desc }: { icon: typeof BookOpen; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-teal-400" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}