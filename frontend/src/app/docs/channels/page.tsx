// src/app/docs/channels/page.tsx
// Documentation page — Channel Model
// Uses the docs layout (sidebar + header) — just exports an <article>

import {
  Network, ArrowRight, Layers, Radio, Database,
  GitBranch, AlertTriangle, Upload, Workflow,
  Cable, Box, Zap,
} from "lucide-react";
import Link from "next/link";

export default function ChannelsPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Community
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            v1.1
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          Channel Model
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          Map your schemas to messaging channels across any broker — Kafka topics,
          RabbitMQ exchanges, Redis streams, Pulsar topics, NATS subjects, and
          cloud services. Channels are governance objects in event7, not read
          from the broker.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/channels"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            Open Channels
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/api-reference#channels"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 border border-slate-700 hover:border-slate-600 hover:text-white transition-colors"
          >
            API Reference
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-12" />

      {/* Core concepts */}
      <Section title="Core Concepts">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          The Channel Model introduces an explicit, broker-agnostic layer
          between your schemas (in the Schema Registry) and the messaging
          infrastructure they travel on.
        </p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 mb-6">
          <pre className="text-sm text-slate-400 font-mono leading-relaxed overflow-x-auto">
{`Registry (1) ─────── (N) Channel
                          │
                          │ N:N (via channel_subjects)
                          │
Registry (1) ─────── (N) Subject (= schema in the SR)

A Registry has both Subjects (from the SR) and Channels (declared in event7).
The mapping between them lives in the channel_subjects pivot table.`}
          </pre>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConceptCard
            icon={Network}
            title="Channel"
            desc="A named message exchange point tied to a broker and a messaging pattern. Models the producer-facing ingress, not the full broker topology."
            examples="Kafka topic, RabbitMQ exchange, NATS subject, Redis stream"
          />
          <ConceptCard
            icon={Cable}
            title="Binding"
            desc="The explicit N:N relationship between a channel and a subject, with a strategy, role, selector, and health status."
            examples="orders-value → orders-topic (channel_bound, value, active)"
          />
          <ConceptCard
            icon={Layers}
            title="Data Layer"
            desc="The maturity of the data flowing through a channel. The primary layer lives on the subject (via enrichments); the channel layer is a UX hint."
            examples="RAW → CORE → REFINED → APPLICATION"
          />
          <ConceptCard
            icon={Box}
            title="Resource Kind"
            desc="The physical nature of the broker resource behind a channel. A single broker_type can have multiple resource kinds."
            examples="topic, exchange, subject, queue, stream"
          />
        </div>
      </Section>

      {/* Messaging patterns */}
      <Section title="Messaging Patterns">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Every channel has a messaging pattern that describes its communication model:
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <PatternCard
            name="Topic Log"
            color="cyan"
            desc="Ordered, persistent, append-only log. Consumers read at their own pace. Replay is possible."
            brokers="Kafka, Redpanda, Pulsar, Redis Streams"
            characteristics={["Ordered", "Persistent", "Replayable", "Consumer groups"]}
          />
          <PatternCard
            name="Pub/Sub"
            color="amber"
            desc="Publish-subscribe with routing. Messages delivered to all matching subscribers. No replay."
            brokers="RabbitMQ, NATS, Google Pub/Sub"
            characteristics={["Fan-out", "Routing keys", "No replay", "Push delivery"]}
          />
          <PatternCard
            name="Queue"
            color="violet"
            desc="Competing consumers. Each message delivered to exactly one consumer. Load balancing built-in."
            brokers="AWS SQS, Azure Service Bus"
            characteristics={["Exactly-once", "FIFO optional", "Dead letter", "Load balanced"]}
          />
        </div>
      </Section>

      {/* Broker types */}
      <Section title="Supported Brokers">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          event7 supports 22 broker types. Each maps to a default resource kind
          and messaging pattern:
        </p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Broker</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resource Kind</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pattern</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Native SR</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">AsyncAPI Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <BrokerRow broker="Kafka" color="orange" kind="topic" pattern="Topic Log" sr="Confluent SR, Karapace, Redpanda" protocol="kafka, kafka-secure" />
              <BrokerRow broker="Redpanda" color="orange" kind="topic" pattern="Topic Log" sr="Redpanda SR" protocol="kafka" />
              <BrokerRow broker="RabbitMQ" color="amber" kind="exchange" pattern="Pub/Sub" sr="—" protocol="amqp, amqps" />
              <BrokerRow broker="Pulsar" color="purple" kind="topic" pattern="Topic Log" sr="Pulsar SR" protocol="pulsar" />
              <BrokerRow broker="NATS" color="green" kind="subject" pattern="Pub/Sub" sr="—" protocol="nats" />
              <BrokerRow broker="Google Pub/Sub" color="blue" kind="topic" pattern="Pub/Sub" sr="—" protocol="googlepubsub" />
              <BrokerRow broker="AWS SNS/SQS" color="yellow" kind="queue" pattern="Queue" sr="Glue SR" protocol="sns, sqs" />
              <BrokerRow broker="Azure Service Bus" color="sky" kind="queue" pattern="Queue" sr="Azure SR" protocol="servicebus" />
              <BrokerRow broker="Redis Streams" color="red" kind="stream" pattern="Topic Log" sr="—" protocol="redis" />
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-500 mt-4">
          Brokers without a native SR (RabbitMQ, NATS, Redis Streams, Google
          Pub/Sub) can use an Apicurio instance as a broker-agnostic registry.
          This is the foundation of the upcoming Hosted Registry feature.
        </p>
      </Section>

      {/* Binding strategies */}
      <Section title="Binding Strategies">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          The binding strategy describes the conceptual relationship between a
          subject and a channel — a generalization of Confluent&apos;s
          TopicNameStrategy / RecordNameStrategy:
        </p>
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <StrategyCard
            name="Channel Bound"
            color="cyan"
            tns="TopicNameStrategy"
            desc="1:1 coupling. The subject belongs to this specific channel. Typical for RAW layer ingestion topics."
            example="orders-value → orders topic"
          />
          <StrategyCard
            name="Domain Bound"
            color="emerald"
            tns="RecordNameStrategy"
            desc="N:1 decoupled. A domain schema shared across multiple channels. Typical for CORE layer canonical models."
            example="com.acme.Order → multiple topics"
          />
          <StrategyCard
            name="App Bound"
            color="violet"
            tns="—"
            desc="Application-specific view. A schema designed for a single consuming application. Typical for APPLICATION layer."
            example="dashboard.OrderView → dashboard topic"
          />
        </div>
        <p className="text-sm text-slate-500">
          The strategy is conceptual — it describes intent, not enforcement.
          event7 uses it for warnings (e.g. a channel_bound subject linked to
          5+ channels) and UX hints, not blocking.
        </p>
      </Section>

      {/* Data layers */}
      <Section title="Data Layers">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Inspired by the Schema Strategy pattern, data layers describe
          the maturity and purpose of data as it flows through the pipeline:
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <LayerCard
            name="RAW"
            color="cyan"
            coupling="Coupled to source"
            naming="<topic-name>-value"
            desc="Raw data collected from external sources. 1:1 with the ingestion channel. No transformation, no reuse."
          />
          <LayerCard
            name="CORE"
            color="emerald"
            coupling="Decoupled (domain model)"
            naming="<domain>.<entity>.<version>"
            desc="Canonical business model. Reusable across teams. Independent evolution. The backbone of your data platform."
          />
          <LayerCard
            name="REFINED"
            color="amber"
            coupling="References Core"
            naming="<domain>.<entity>.agg.<period>"
            desc="Aggregated and enriched data. Built from Core types. Time-windowed summaries, joined views."
          />
          <LayerCard
            name="APPLICATION"
            color="violet"
            coupling="Decoupled (app-specific)"
            naming="<app>.<domain>.<entity>"
            desc="Application-specific views. Optimized for a single consumer. Lightweight schemas."
          />
        </div>
        <p className="text-sm text-slate-500 mt-4">
          The primary layer lives on the <strong className="text-slate-300">subject</strong> (via
          enrichments) — it describes the semantic maturity of the data. The
          layer on a channel is a UX hint derived from its bindings.
        </p>
      </Section>

      {/* Binding details */}
      <Section title="Binding Properties">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Each binding (subject ↔ channel) carries metadata beyond the N:N
          relationship:
        </p>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Property</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Values</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <PropRow prop="schema_role" values="value, key, header, envelope" purpose="Which part of the message this schema covers" />
              <PropRow prop="binding_strategy" values="channel_bound, domain_bound, app_bound" purpose="Conceptual coupling model (see above)" />
              <PropRow prop="binding_origin" values="tns, trs, manual, heuristic, routing_key" purpose="How the binding was established" />
              <PropRow prop="binding_selector" values="routing key, attribute filter" purpose="Sub-channel filter (RabbitMQ routing, Pub/Sub attributes)" />
              <PropRow prop="binding_status" values="active, missing_subject, stale, unverified" purpose="Health of the binding (does the subject still exist?)" />
            </tbody>
          </table>
        </div>
      </Section>

      {/* AsyncAPI integration */}
      <Section title="AsyncAPI Integration">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Channels are the bridge between event7 and AsyncAPI. The integration
          works in both directions:
        </p>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <HighlightCard
            icon={Upload}
            title="Import (Spec → event7)"
            color="teal"
            items={[
              "servers.*.protocol → broker_type",
              "channels.* → channels (address, bindings, description)",
              "channels.*.messages → bindings (subject ↔ channel)",
              "channels.*.bindings.kafka → broker_config (partitions, replicas)",
              "operations.*.action → messaging_pattern hint",
              "x-owner, x-tags, x-data-layer → enrichments",
              "components.schemas → match SR / register if missing",
            ]}
          />
          <HighlightCard
            icon={Workflow}
            title="Generate (Subject → Spec)"
            color="slate"
            items={[
              "Schema + enrichments → AsyncAPI 3.0 spec",
              "Kafka bindings (topic, partitions, Magic Byte)",
              "Key schema auto-detection (-value → -key)",
              "Avro-to-JSON-Schema conversion",
              "Content type per format (Avro MIME, JSON)",
              "Examples generated from field names",
              "View in drawer or download YAML",
            ]}
          />
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-400 mb-0.5">Smart Schema Registration</div>
            <p className="text-xs text-slate-500">
              When importing with &quot;register schemas&quot; enabled, event7
              checks the registry type. Apicurio (broker-agnostic) accepts all
              schemas. Confluent-like registries only receive Kafka/Redpanda
              schemas — other broker schemas are skipped with a clear warning.
            </p>
          </div>
        </div>
      </Section>

      {/* Broker config */}
      <Section title="Broker Config (JSONB)">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Each channel can store broker-specific configuration in a flexible
          JSONB field. Extracted automatically during AsyncAPI import:
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigCard
            broker="Kafka"
            fields={[
              { key: "partitions", desc: "Number of topic partitions" },
              { key: "replication_factor", desc: "Replica count" },
              { key: "retention_ms", desc: "Message retention in milliseconds" },
              { key: "cleanup_policy", desc: "delete, compact, or compact,delete" },
            ]}
          />
          <ConfigCard
            broker="RabbitMQ"
            fields={[
              { key: "exchange_type", desc: "topic, direct, fanout, headers" },
              { key: "durable", desc: "Survive broker restart" },
            ]}
          />
        </div>
        <p className="text-sm text-slate-500 mt-4">
          Other brokers (Pulsar, NATS, Redis, cloud services) can store any
          key-value pairs in broker_config. The field is extensible by design.
        </p>
      </Section>

      {/* Quick Start */}
      <Section title="Quick Start">
        <div className="space-y-4">
          {[
            { step: "1", title: "Create channels manually", desc: "Go to /channels, click \"New Channel\", pick a broker type, set the address. Add bindings to link subjects." },
            { step: "2", title: "Or import from AsyncAPI", desc: "Go to /asyncapi → Import tab. Paste or upload a YAML/JSON spec. Preview, then apply. Channels, bindings, and enrichments are created in one click." },
            { step: "3", title: "Check the Catalog", desc: "The Event Catalog now shows broker badges for each subject. Filter by broker type to find Kafka vs RabbitMQ schemas." },
            { step: "4", title: "Generate AsyncAPI specs", desc: "Click the AsyncAPI icon on any catalog entry to generate or view a spec for that subject." },
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
                { feature: "Channel CRUD + Bindings", status: "available" },
                { feature: "Multi-broker support (22 broker types)", status: "available" },
                { feature: "AsyncAPI Import (preview + apply)", status: "available" },
                { feature: "Smart schema registration (provider-aware)", status: "available" },
                { feature: "Data layers on channels + enrichments", status: "available" },
                { feature: "Catalog integration (broker badges, filter)", status: "available" },
                { feature: "Broker config JSONB (partitions, exchange type…)", status: "available" },
                { feature: "Auto-detect TNS (heuristic from subject names)", status: "planned" },
                { feature: "AsyncAPI Export Mode 3 (real channels → spec)", status: "planned" },
                { feature: "Channel Map visualization (d3-force graph)", status: "planned" },
                { feature: "Hosted Registry (Apicurio for brokers without SR)", status: "planned" },
                { feature: "Multi-registry import routing", status: "planned" },
                { feature: "Channel health monitoring (lag, throughput)", status: "planned" },
                { feature: "Channel-level governance rules", status: "planned" },
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

function ConceptCard({
  icon: Icon,
  title,
  desc,
  examples,
}: {
  icon: typeof Network;
  title: string;
  desc: string;
  examples: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-7 w-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-sm text-slate-400 mb-2">{desc}</p>
      <p className="text-[11px] text-slate-600">{examples}</p>
    </div>
  );
}

function PatternCard({
  name,
  color,
  desc,
  brokers,
  characteristics,
}: {
  name: string;
  color: string;
  desc: string;
  brokers: string;
  characteristics: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className={`text-xs font-semibold uppercase tracking-widest text-${color}-400 mb-2`}>
        {name}
      </div>
      <p className="text-sm text-slate-400 leading-relaxed mb-3">{desc}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {characteristics.map((c) => (
          <span
            key={c}
            className={`text-[10px] px-2 py-0.5 rounded border border-${color}-500/20 bg-${color}-500/5 text-${color}-400`}
          >
            {c}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-600">{brokers}</p>
    </div>
  );
}

function StrategyCard({
  name,
  color,
  tns,
  desc,
  example,
}: {
  name: string;
  color: string;
  tns: string;
  desc: string;
  example: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-semibold text-${color}-400`}>{name}</span>
        {tns !== "—" && (
          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {tns}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 leading-relaxed mb-2">{desc}</p>
      <p className="text-[11px] text-slate-600 font-mono">{example}</p>
    </div>
  );
}

function LayerCard({
  name,
  color,
  coupling,
  naming,
  desc,
}: {
  name: string;
  color: string;
  coupling: string;
  naming: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold uppercase tracking-widest text-${color}-400`}>{name}</span>
        <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          {coupling}
        </span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed mb-2">{desc}</p>
      <code className="text-[11px] text-slate-600 font-mono">{naming}</code>
    </div>
  );
}

function BrokerRow({
  broker,
  color,
  kind,
  pattern,
  sr,
  protocol,
}: {
  broker: string;
  color: string;
  kind: string;
  pattern: string;
  sr: string;
  protocol: string;
}) {
  return (
    <tr>
      <td className="py-2.5 px-4">
        <span className={`text-${color}-400 font-medium text-sm`}>{broker}</span>
      </td>
      <td className="py-2.5 px-4 text-slate-400 text-xs font-mono">{kind}</td>
      <td className="py-2.5 px-4 text-slate-400 text-xs">{pattern}</td>
      <td className="py-2.5 px-4 text-slate-500 text-xs">{sr}</td>
      <td className="py-2.5 px-4 text-slate-600 text-xs font-mono">{protocol}</td>
    </tr>
  );
}

function PropRow({
  prop,
  values,
  purpose,
}: {
  prop: string;
  values: string;
  purpose: string;
}) {
  return (
    <tr>
      <td className="py-2.5 px-4 text-teal-400 font-mono text-xs">{prop}</td>
      <td className="py-2.5 px-4 text-slate-400 text-xs">{values}</td>
      <td className="py-2.5 px-4 text-slate-500 text-xs">{purpose}</td>
    </tr>
  );
}

function ConfigCard({
  broker,
  fields,
}: {
  broker: string;
  fields: { key: string; desc: string }[];
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="text-sm font-semibold text-white mb-3">{broker}</div>
      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.key} className="flex items-start gap-2">
            <code className="text-[11px] text-teal-400 font-mono shrink-0">{f.key}</code>
            <span className="text-[11px] text-slate-500">{f.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  title,
  color,
  items,
}: {
  icon: typeof Network;
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`h-7 w-7 rounded-lg bg-${color}-500/10 text-${color}-400 flex items-center justify-center`}>
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