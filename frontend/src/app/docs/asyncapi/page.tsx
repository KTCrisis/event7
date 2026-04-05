// src/app/docs/asyncapi/page.tsx
// Documentation page — AsyncAPI Dual Mode
// Covers: overview, generate, import, drift detection, viewer, KPIs, catalog integration.
// Placement: frontend/src/app/docs/asyncapi/page.tsx

import Link from "next/link";
import {
  FileJson,
  ArrowRight,
  RefreshCw,
  Upload,
  Eye,
  Zap,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Minus,
  Pencil,
  Code2,
  BookOpen,
  Network,
  Layers,
} from "lucide-react";

export default function AsyncAPIPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Community
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            AsyncAPI 3.0
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          AsyncAPI
          <br />
          <span className="text-teal-400">Dual Mode</span>
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          Every schema subject in event7 has an AsyncAPI status — generated from
          your registry, imported from a spec, or not yet documented. The dual
          mode gives you a real-time overview of documentation coverage with
          drift detection when schemas evolve.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/asyncapi"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            Open AsyncAPI
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

      {/* Three axes */}
      <Section title="The three axes">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Each subject carries three independent attributes that describe its
          AsyncAPI documentation state:
        </p>
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <AxisCard
            title="Origin"
            color="cyan"
            values={["imported", "generated", "null"]}
            desc="Where the spec came from. Imported = uploaded from a YAML/JSON file. Generated = built from schema + enrichments by event7."
          />
          <AxisCard
            title="Status"
            color="teal"
            values={["documented", "ready", "raw"]}
            desc="Documentation coverage. Documented = spec exists. Ready = has enrichments or channel bindings but no spec yet. Raw = nothing."
          />
          <AxisCard
            title="Sync Status"
            color="amber"
            values={["in_sync", "outdated", "unknown"]}
            desc="Drift between the spec and the current schema version. Only applies to documented subjects."
          />
        </div>
        <p className="text-sm text-slate-500">
          These axes are independent. A subject can be{" "}
          <code className="text-slate-300 text-xs">origin=generated, status=documented, sync=outdated</code>{" "}
          — meaning a spec was generated but the schema has evolved since.
        </p>
      </Section>

      {/* Workflows */}
      <Section title="Three workflows">
        <div className="space-y-4">
          <WorkflowCard
            icon={Zap}
            title="Generate"
            color="teal"
            desc="Build an AsyncAPI 3.0 spec from a schema's content and enrichments. Includes Kafka bindings (partitions, replication, Magic Byte encoding), key schema separation (-value → -key auto-detection), and Avro-to-JSON-Schema conversion."
            flow={["Select subject", "Generate", "View / Edit / Export"]}
            result="origin=generated, status=documented"
          />
          <WorkflowCard
            icon={Upload}
            title="Import"
            color="cyan"
            desc="Upload an AsyncAPI v3 spec (YAML or JSON) to create channels, bindings, enrichments, and optionally register schemas — all in one operation. Two-phase: preview (dry-run) then apply. Supports 22 broker protocols."
            flow={["Upload spec", "Preview", "Apply"]}
            result="origin=imported, status=documented"
          />
          <WorkflowCard
            icon={Eye}
            title="Overview"
            color="amber"
            desc="Real-time dashboard showing every subject's AsyncAPI status with KPIs, coverage metrics, and per-subject drift detection. Filterable by status, origin, and search."
            flow={["Open Overview", "Filter / Search", "Click to view"]}
            result="KPIs + per-subject table"
          />
        </div>
      </Section>

      {/* Drift Detection */}
      <Section title="Drift detection">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          When a schema evolves in the registry, the existing AsyncAPI spec may
          become outdated. event7 detects this automatically using a two-tier
          approach — no N+1 queries:
        </p>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <TierCard
            tier="Tier 1"
            title="Version check (fast)"
            color="cyan"
            desc="Compares the schema version stored at generation time with the current latest version from the provider. Different version = outdated. Zero extra fetches."
          />
          <TierCard
            tier="Tier 2"
            title="Hash check (precise)"
            color="teal"
            desc="If the version matches but a hash was stored, event7 computes SHA-256 of the current schema content and compares. Catches content changes within the same version (rare but possible with Apicurio)."
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          <SyncPill label="in_sync" color="emerald" desc="Spec matches current schema" />
          <Arrow />
          <SyncPill label="outdated" color="amber" desc="Schema evolved since last generate" />
          <Arrow />
          <SyncPill label="unknown" color="slate" desc="No hash stored (imported specs)" />
        </div>
        <p className="text-sm text-slate-500">
          The overview batches 4 data sources (subjects, enrichments, specs,
          bindings) to avoid N+1 queries — performance stays flat regardless of
          registry size.
        </p>
      </Section>

      {/* KPIs */}
      <Section title="Overview KPIs">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          The AsyncAPI overview page shows five KPI cards and a segmented
          coverage bar:
        </p>
        <div className="grid gap-3 sm:grid-cols-5 mb-6">
          <KPICard label="Total" desc="All subjects" color="slate" />
          <KPICard label="Documented" desc="Spec exists" color="emerald" />
          <KPICard label="Ready" desc="Enriched, no spec" color="amber" />
          <KPICard label="Raw" desc="Nothing yet" color="slate" />
          <KPICard label="Coverage" desc="documented / total" color="teal" />
        </div>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 mb-4">
          <p className="text-xs text-slate-500 mb-2">Coverage bar</p>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden flex">
            <div className="h-full bg-emerald-500" style={{ width: "45%" }} />
            <div className="h-full bg-amber-500" style={{ width: "25%" }} />
            <div className="h-full bg-slate-600" style={{ width: "30%" }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-slate-600">
            <span>documented</span>
            <span>ready</span>
            <span>raw</span>
          </div>
        </div>
      </Section>

      {/* Viewer */}
      <Section title="Spec viewer">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Clicking a documented subject opens a 75vw sheet with three tabs:
        </p>
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <ViewerTab
            icon={BookOpen}
            title="Docs"
            desc="Rendered AsyncAPI spec using the official AsyncAPI React component (CDN). Read-only, styled visualization."
          />
          <ViewerTab
            icon={Pencil}
            title="Edit"
            desc="Form editor for title, description, owner, server host, and tags. Save updates the spec and sets is_auto_generated=false."
          />
          <ViewerTab
            icon={Code2}
            title="JSON"
            desc="Raw JSON textarea with live validation. Status bar shows valid/invalid. Save persists the raw content."
          />
        </div>
        <p className="text-sm text-slate-500">
          Export as YAML is available from the sheet header. After saving,
          the overview refreshes automatically to reflect the updated spec.
        </p>
      </Section>

      {/* Multi-broker */}
      <Section title="Multi-broker support">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          AsyncAPI import auto-detects the broker protocol from the spec and
          creates channels with the correct broker_type:
        </p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Protocol</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Broker Type</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resource Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <BrokerRow protocol="kafka / kafka-secure" broker="kafka" resource="topic" />
              <BrokerRow protocol="amqp / amqps" broker="rabbitmq" resource="exchange / queue" />
              <BrokerRow protocol="redis" broker="redis_streams" resource="stream" />
              <BrokerRow protocol="pulsar / pulsar+ssl" broker="pulsar" resource="topic" />
              <BrokerRow protocol="nats" broker="nats" resource="subject" />
              <BrokerRow protocol="googlepubsub" broker="google_pubsub" resource="topic" />
              <BrokerRow protocol="sns / sqs" broker="aws_sns_sqs" resource="topic / queue" />
              <BrokerRow protocol="amqp (Azure)" broker="azure_servicebus" resource="topic / queue" />
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-500 mt-4">
          Smart registration routes schemas based on registry type: Apicurio
          accepts all formats, Confluent-like registries only receive
          Kafka/Redpanda schemas — others are skipped with a warning.
        </p>
      </Section>

      {/* Catalog integration */}
      <Section title="Catalog integration">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          The{" "}
          <Link href="/docs/catalog" className="text-teal-400 hover:text-teal-300">
            Catalog
          </Link>{" "}
          page displays AsyncAPI status inline for every schema:
        </p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <StatusBadge status="documented" />
            <span className="text-sm text-slate-400">
              Spec exists — click to open in the CatalogSheet viewer
              (Schema + AsyncAPI tabs)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status="ready" />
            <span className="text-sm text-slate-400">
              Enrichment or channel binding exists — one click to generate
            </span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status="raw" />
            <span className="text-sm text-slate-400">
              No documentation — start by enriching in the Catalog
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-4">
          The CatalogSheet replaced the old JSON drawer. It provides two tabs:
          Schema (raw content + field structure) and AsyncAPI (rendered spec
          with edit/export).
        </p>
      </Section>

      {/* Generation options */}
      <Section title="Generation options">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          When generating a spec, these optional parameters control the output:
        </p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Parameter</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Default</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <ParamRow name="topic_name" def="auto" desc="Override the deduced topic name (strips -value/-key suffix by default)" />
              <ParamRow name="partitions" def="—" desc="Kafka channel binding: number of partitions" />
              <ParamRow name="replication_factor" def="—" desc="Kafka channel binding: replication factor" />
              <ParamRow name="include_key_schema" def="true" desc="Auto-detect -key schema and include as separate message" />
              <ParamRow name="include_confluent_bindings" def="true" desc="Add Magic Byte (schemaIdLocation, schemaIdPayloadEncoding)" />
              <ParamRow name="include_examples" def="true" desc="Generate field examples from type heuristics" />
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-500 mt-4">
          All parameters are optional — zero breaking change from the default
          generation. Set{" "}
          <code className="text-xs text-slate-300">include_confluent_bindings=false</code>{" "}
          for provider-agnostic output.
        </p>
      </Section>

      {/* Quick start */}
      <Section title="Quick start">
        <div className="space-y-4">
          {[
            { step: "1", title: "Open the AsyncAPI page", desc: "Navigate to AsyncAPI in the sidebar. The Overview tab shows all subjects." },
            { step: "2", title: "Generate a spec", desc: "Click Generate on any subject. event7 fetches the schema, enrichments, and produces an AsyncAPI 3.0 spec." },
            { step: "3", title: "Review drift", desc: "After schema evolution, the sync status changes to outdated. Click Regen to update." },
            { step: "4", title: "Import a spec", desc: "Switch to the Import tab. Upload a YAML/JSON spec. Preview first, then Apply." },
            { step: "5", title: "Check coverage", desc: "The KPIs update in real-time. Target: 100% documented." },
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

      {/* Roadmap */}
      <Section title="Roadmap">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-800/40">
              {[
                { feature: "AsyncAPI 3.0 generation with Kafka bindings", status: "available" },
                { feature: "Import — preview + apply, multi-broker", status: "available" },
                { feature: "Smart schema registration (provider-aware)", status: "available" },
                { feature: "Dual mode overview with KPIs", status: "available" },
                { feature: "Drift detection (version + hash)", status: "available" },
                { feature: "Spec viewer (Docs / Edit / JSON)", status: "available" },
                { feature: "Catalog integration (column + sheet)", status: "available" },
                { feature: "Batch generate (all subjects at once)", status: "planned" },
                { feature: "Export Mode 3 — real channels → spec", status: "planned" },
                { feature: "CloudEvents envelope integration", status: "planned" },
              ].map((r) => (
                <tr key={r.feature}>
                  <td className="py-2.5 px-4 text-slate-400">{r.feature}</td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      r.status === "available"
                        ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                        : "bg-slate-800 text-slate-500 border border-slate-700"
                    }`}>
                      {r.status === "available" ? "✓ Available" : "Planned"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function AxisCard({ title, color, values, desc }: { title: string; color: string; values: string[]; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
      <div className={`text-xs font-bold text-${color}-400 mb-2`}>{title}</div>
      <div className="flex flex-wrap gap-1 mb-3">
        {values.map((v) => (
          <code key={v} className="text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
            {v}
          </code>
        ))}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function WorkflowCard({
  icon: Icon,
  title,
  color,
  desc,
  flow,
  result,
}: {
  icon: typeof FileJson;
  title: string;
  color: string;
  desc: string;
  flow: string[];
  result: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`h-7 w-7 rounded-lg bg-${color}-500/10 text-${color}-400 flex items-center justify-center`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed mb-3">{desc}</p>
      <div className="flex items-center gap-2 mb-2">
        {flow.map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {step}
            </span>
            {i < flow.length - 1 && <span className="text-slate-700">→</span>}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-600">
        Result: <code className="text-slate-400">{result}</code>
      </p>
    </div>
  );
}

function TierCard({ tier, title, color, desc }: { tier: string; title: string; color: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-bold text-${color}-400 bg-${color}-500/10 px-2 py-0.5 rounded`}>
          {tier}
        </span>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function SyncPill({ label, color, desc }: { label: string; color: string; desc: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg border border-${color}-500/20 bg-${color}-500/5 text-center`}>
      <div className={`text-xs font-bold text-${color}-400`}>{label}</div>
      <div className="text-[10px] text-slate-600 mt-0.5">{desc}</div>
    </div>
  );
}

function Arrow() {
  return <div className="flex items-center text-slate-700 px-1">→</div>;
}

function KPICard({ label, desc, color }: { label: string; desc: string; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-3 text-center">
      <div className={`text-xs font-bold text-${color}-400 mb-0.5`}>{label}</div>
      <div className="text-[10px] text-slate-600">{desc}</div>
    </div>
  );
}

function ViewerTab({ icon: Icon, title, desc }: { icon: typeof FileJson; title: string; desc: string }) {
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

function BrokerRow({ protocol, broker, resource }: { protocol: string; broker: string; resource: string }) {
  return (
    <tr>
      <td className="py-2.5 px-4 text-slate-400 font-mono text-xs">{protocol}</td>
      <td className="py-2.5 px-4 text-slate-300 text-xs">{broker}</td>
      <td className="py-2.5 px-4 text-slate-500 text-xs">{resource}</td>
    </tr>
  );
}

function ParamRow({ name, def, desc }: { name: string; def: string; desc: string }) {
  return (
    <tr>
      <td className="py-2.5 px-4 text-teal-400 font-mono text-xs">{name}</td>
      <td className="py-2.5 px-4 text-slate-500 text-xs">{def}</td>
      <td className="py-2.5 px-4 text-slate-400 text-xs">{desc}</td>
    </tr>
  );
}

function StatusBadge({ status }: { status: "documented" | "ready" | "raw" }) {
  const config = {
    documented: { icon: CheckCircle, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    ready: { icon: Minus, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    raw: { icon: Minus, color: "text-slate-500 bg-slate-800 border-slate-700" },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.color}`}>
      <c.icon className="h-3 w-3" />
      {status}
    </span>
  );
}