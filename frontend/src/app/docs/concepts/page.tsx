// src/app/docs/concepts/page.tsx
// Documentation page — Core Concepts
// Explains the subject-centric model: Subject, Schema, Enrichment, Spec, Channel, Rule, Score.
// Placement: frontend/src/app/docs/concepts/page.tsx

import Link from "next/link";
import {
  Layers,
  Database,
  Tags,
  FileJson,
  Network,
  Shield,
  BarChart3,
  ArrowRight,
  Search,
  BookOpen,
} from "lucide-react";

export default function ConceptsPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          Core Concepts
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          event7 is <strong className="text-slate-300">subject-centric</strong>.
          Every feature — enrichments, specs, channels, rules, scores — is
          attached to a <em>subject</em>, not to a schema version. Understanding
          this model is the key to using event7 effectively.
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-12" />

      {/* The Subject */}
      <Section title="The subject — event7's central entity">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          A <strong className="text-slate-200">subject</strong> is the unique
          identifier of a schema in your registry (e.g.{" "}
          <code className="text-teal-400 text-xs bg-teal-500/5 px-1.5 py-0.5 rounded">
            com.event7.Order-value
          </code>
          ). It&apos;s the entity that event7 governs. Everything hangs off the
          subject:
        </p>

        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 mb-6 font-mono text-sm text-slate-400">
          <div className="text-slate-200 font-bold mb-3">Subject <span className="text-teal-400">(identity)</span></div>
          <div className="ml-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-cyan-400 shrink-0" />
              <span>Schema versions — <span className="text-slate-500">v1, v2, v3... (in the SR)</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Tags size={14} className="text-teal-400 shrink-0" />
              <span>Enrichment — <span className="text-slate-500">description, owner, tags, classification, data_layer (in event7)</span></span>
            </div>
            <div className="flex items-center gap-2">
              <FileJson size={14} className="text-cyan-400 shrink-0" />
              <span>AsyncAPI spec — <span className="text-slate-500">origin, status, sync_status, spec_version (in event7)</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Network size={14} className="text-emerald-400 shrink-0" />
              <span>Channel bindings — <span className="text-slate-500">N channels, with role (value/key) (in event7)</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-amber-400 shrink-0" />
              <span>Governance rules — <span className="text-slate-500">per-subject or global (in event7)</span></span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-violet-400 shrink-0" />
              <span>Governance score — <span className="text-slate-500">3-axis, computed on the fly (in event7)</span></span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          The Schema Registry is the source of truth for{" "}
          <strong className="text-slate-300">schema content</strong>. event7 is
          the source of truth for{" "}
          <strong className="text-slate-300">everything else</strong>.
        </p>
      </Section>

      {/* Entity cards */}
      <Section title="The six entities">
        <div className="space-y-4">
          <EntityCard
            icon={Database}
            color="cyan"
            name="Schema"
            stored="Schema Registry (Confluent, Apicurio, etc.)"
            scope="Per version"
            description="The technical content of a subject at a specific version. Avro record, JSON Schema, or Protobuf (planned). Schemas are versioned, immutable once registered. event7 reads them from the registry — it never modifies them."
            example="com.event7.Order v3 — Avro record with 12 fields"
            pages={[
              { name: "Explorer", href: "/docs/features" },
              { name: "Diff Viewer", href: "/docs/features" },
            ]}
          />

          <EntityCard
            icon={Tags}
            color="teal"
            name="Enrichment"
            stored="event7 database"
            scope="Per subject (not per version)"
            description="Business metadata that the registry doesn't store: description, owner team, tags, data classification (public/internal/confidential/restricted), and data layer (RAW/CORE/REFINED/APPLICATION). Provider-agnostic — enrichments survive registry migrations."
            example="owner: payments-team, tags: [pii, gdpr], classification: restricted, layer: CORE"
            pages={[
              { name: "Catalog", href: "/docs/catalog" },
            ]}
          />

          <EntityCard
            icon={FileJson}
            color="cyan"
            name="AsyncAPI Spec"
            stored="event7 database"
            scope="Per subject (one active spec)"
            description="An AsyncAPI 3.0 document describing the subject's messaging contract. Can be generated from the schema + enrichments, or imported from an external spec. Tracks origin (imported/generated), status (documented/ready/raw), and sync_status (in_sync/outdated) for drift detection."
            example="Generated from com.event7.Order — AsyncAPI 3.0, Kafka bindings, key schema included"
            pages={[
              { name: "AsyncAPI", href: "/docs/asyncapi" },
            ]}
          />

          <EntityCard
            icon={Network}
            color="emerald"
            name="Channel"
            stored="event7 database"
            scope="Per registry (N:N with subjects via bindings)"
            description="A messaging channel — a Kafka topic, RabbitMQ exchange, Redis stream, etc. Channels have an address, broker type, resource kind, data layer, and broker-specific config (partitions, routing keys). Subjects are bound to channels via bindings with a role (value, key, header) and strategy (channel_bound, domain_bound, app_bound)."
            example="prod.payments.billing.v1 — Kafka topic, 12 partitions, 3 replicas, CORE layer"
            pages={[
              { name: "Channels", href: "/docs/channels" },
            ]}
          />

          <EntityCard
            icon={Shield}
            color="amber"
            name="Governance Rule"
            stored="event7 database"
            scope="Per subject or global (registry-wide)"
            description="A governance constraint — either a technically verifiable rule (CEL condition, compatibility check, encryption transform) or an organizational policy (naming convention, ownership requirement). Rules have severity (critical/error/warning/info), scope (runtime/control-plane/declarative/audit), and an enforcement lifecycle (declared → expected → synced → verified)."
            example="FULL_TRANSITIVE compatibility required on all CORE subjects — severity: critical"
            pages={[
              { name: "Rules", href: "/docs/governance-rules" },
            ]}
          />

          <EntityCard
            icon={BarChart3}
            color="violet"
            name="Governance Score"
            stored="Computed on the fly"
            scope="Per subject"
            description="A 0–100 score with grade (A–F) computed from three axes: enrichments (20 pts — description, owner, tags, classification), rules compliance (50 pts — weighted by severity and verifiability), and schema quality (30 pts — compatibility, documentation, references, versioning). A confidence indicator (high/medium/low) reflects how many rules are objectively verifiable."
            example="Score: 85/100 (B) — Enrichment 18/20, Rules 42/50, Quality 25/30 — confidence: high"
            pages={[
              { name: "Rules", href: "/docs/governance-rules" },
              { name: "Catalog", href: "/docs/catalog" },
            ]}
          />
        </div>
      </Section>

      {/* Where things are stored */}
      <Section title="Where things live">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Entity</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stored in</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <StorageRow entity="Schema versions" stored="Schema Registry" why="The SR is the source of truth for schema content. event7 reads, never writes (except on import)." />
              <StorageRow entity="Enrichments" stored="event7 DB" why="Registries have limited metadata support. Enrichments are provider-agnostic." />
              <StorageRow entity="AsyncAPI specs" stored="event7 DB" why="Specs are governance artifacts, not registry data. Tracks drift independently." />
              <StorageRow entity="Channels + bindings" stored="event7 DB" why="The channel model is multi-broker. No registry stores cross-broker channel mappings." />
              <StorageRow entity="Rules + policies" stored="event7 DB" why="Rules are provider-agnostic. Can be synced to providers (Pro), but source of truth is event7." />
              <StorageRow entity="Scores" stored="Computed" why="Calculated on the fly from enrichments + rules + schema metadata. Never persisted." />
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-500">
          This separation is deliberate. Schemas stay in your registry —
          event7 never creates vendor lock-in on schema storage. Everything else
          is portable and survives registry migrations.
        </p>
      </Section>

      {/* UI mapping */}
      <Section title="How the UI maps to concepts">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          The event7 UI is organized around what you&apos;re doing, not around
          data entities. Here&apos;s how the sidebar sections map to the
          underlying model:
        </p>
        <div className="space-y-3">
          <UIMapping
            group="Schemas"
            desc="Browse the technical side of subjects"
            items={[
              "Explorer — browse subjects, view schema content and versions",
              "Diff Viewer — compare two versions of the same subject",
              "References — dependency graph between subjects",
            ]}
          />
          <UIMapping
            group="Governance"
            desc="Enrich and govern subjects"
            items={[
              "Catalog — business view of all subjects (enrichments, scores, AsyncAPI status)",
              "Rules — governance rules and policies (per-subject or global)",
              "Validate — pre-publish check (SR compatibility + rules + diff preview)",
            ]}
          />
          <UIMapping
            group="Documentation"
            desc="Document subjects and their messaging contracts"
            items={[
              "AsyncAPI — specs overview, generate, import, drift detection",
              "Channels — messaging channels and subject bindings across brokers",
            ]}
          />
        </div>
      </Section>

      {/* Common confusion */}
      <Section title="Common questions">
        <div className="space-y-4">
          <FAQ
            q="Why is the enrichment on the subject, not on a specific schema version?"
            a="Because business metadata (who owns it, what it's for) doesn't change with every schema version. When you add a field to Order v4, the owner team is still the same. Enrichments describe the subject as a concept, not a specific version."
          />
          <FAQ
            q="What's the difference between the Catalog and the Explorer?"
            a="The Explorer shows schema content — fields, types, versions, format. It's for developers looking at the technical structure. The Catalog shows enrichments — owner, tags, classification, data layer, governance score, AsyncAPI status. It's for platform teams doing governance work. Both show the same subjects, from different angles."
          />
          <FAQ
            q="Is event7's Catalog the same as EventCatalog?"
            a="No. event7's Catalog is a governance workspace inside the app — you enrich subjects, track scores, manage documentation status. EventCatalog (by David Boyne) is a separate documentation portal. event7 exports to EventCatalog via the generator-event7 plugin."
          />
          <FAQ
            q="Why are channels in Documentation, not in Governance?"
            a="Channels describe the messaging topology — where schemas flow (Kafka topic, RabbitMQ exchange, etc.). That's documentation of your architecture, not a governance constraint. Governance rules can reference channels, but the channel model itself is about documenting your infrastructure."
          />
          <FAQ
            q="Can a subject have both an imported and a generated AsyncAPI spec?"
            a="No. One active spec per subject. If you import a spec for a subject that already has a generated spec, the import overwrites it. The origin field tracks where the current spec came from."
          />
        </div>
      </Section>

      {/* Next */}
      <Section title="Next steps">
        <div className="grid gap-3 sm:grid-cols-3">
          <NextLink
            icon={Search}
            title="Explore Schemas"
            desc="Browse subjects and versions in the Explorer."
            href="/docs/features"
          />
          <NextLink
            icon={BookOpen}
            title="Enrich in Catalog"
            desc="Add business metadata to your subjects."
            href="/docs/catalog"
          />
          <NextLink
            icon={FileJson}
            title="Document with AsyncAPI"
            desc="Generate or import specs for your subjects."
            href="/docs/asyncapi"
          />
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

function EntityCard({
  icon: Icon,
  color,
  name,
  stored,
  scope,
  description,
  example,
  pages,
}: {
  icon: typeof Database;
  color: string;
  name: string;
  stored: string;
  scope: string;
  description: string;
  example: string;
  pages: { name: string; href: string }[];
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-8 w-8 rounded-lg bg-${color}-500/10 text-${color}-400 flex items-center justify-center`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500">Stored: {stored}</span>
            <span className="text-slate-700">·</span>
            <span className="text-[10px] text-slate-500">Scope: {scope}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed mb-2">{description}</p>
      <div className="rounded-lg bg-slate-800/30 px-3 py-2 mb-3">
        <span className="text-[11px] text-slate-500">Example: </span>
        <span className="text-[11px] text-slate-300">{example}</span>
      </div>
      <div className="flex gap-2">
        {pages.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="text-[10px] text-teal-400 hover:text-teal-300 transition-colors"
          >
            {p.name} →
          </Link>
        ))}
      </div>
    </div>
  );
}

function StorageRow({ entity, stored, why }: { entity: string; stored: string; why: string }) {
  return (
    <tr>
      <td className="py-2.5 px-4 text-slate-300 font-medium text-sm">{entity}</td>
      <td className="py-2.5 px-4 text-teal-400 text-xs">{stored}</td>
      <td className="py-2.5 px-4 text-slate-500 text-xs">{why}</td>
    </tr>
  );
}

function UIMapping({ group, desc, items }: { group: string; desc: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-teal-400">{group}</span>
        <span className="text-[11px] text-slate-600">— {desc}</span>
      </div>
      <ul className="space-y-1">
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

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <h3 className="text-sm font-semibold text-white mb-2">{q}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
    </div>
  );
}

function NextLink({ icon: Icon, title, desc, href }: { icon: typeof Search; title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 hover:border-slate-700 hover:bg-slate-900/50 transition-all duration-200"
    >
      <Icon className="h-4 w-4 text-teal-400 mb-2" />
      <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-teal-400 transition-colors">
        {title}
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </Link>
  );
}