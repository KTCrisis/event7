// src/app/docs/governance-rules/page.tsx
// Documentation page — Governance Rules & Policies
// Uses the docs layout (sidebar + header) — just exports an <article>

import {
  Shield, Zap, ShieldCheck, ClipboardList, Search,
  AlertTriangle, CheckCircle, Layers, Lock, Code2,
  Rocket, ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function GovernanceRulesPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Community
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            v1.2
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          Governance Rules
          <br />
          & Policies
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          Define, track, and score governance standards across all your schema
          registries — regardless of the provider. Rules are stored in event7,
          not in your registry, making governance truly provider-agnostic.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/rules"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            Open Rules
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

      {/* Rules vs Policies */}
      <Section title="Rules vs Policies">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          event7 manages two types of governance entries in the same engine:
        </p>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <HighlightCard
            icon={Zap}
            title="Rules"
            color="teal"
            items={[
              "Technically verifiable constraints",
              "Have an expression (CEL, JSONATA, regex)",
              "Can be synced to providers",
              "Kinds: CONDITION, TRANSFORM, VALIDATION",
              "Higher weight in scoring",
            ]}
          />
          <HighlightCard
            icon={ClipboardList}
            title="Policies"
            color="slate"
            items={[
              "Organizational standards",
              "Describe what should be true",
              "Not enforced by any provider",
              "Kind: POLICY",
              "Verified via enrichments or schema inspection",
            ]}
          />
        </div>
        <p className="text-sm text-slate-500">
          Both contribute to the governance score, but rules carry more weight
          because they are objectively verifiable.
        </p>
      </Section>

      {/* Scopes */}
      <Section title="Rule Scopes">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Every rule has a scope that defines its technical nature:
        </p>
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <ScopeCard
            icon={Zap}
            scope="Runtime"
            color="cyan"
            desc="Executed by the serializer/deserializer at produce/consume time."
            examples="CEL condition, encryption transform, JSONATA migration"
          />
          <ScopeCard
            icon={ShieldCheck}
            scope="Control Plane"
            color="amber"
            desc="Applied when registering a schema in the registry."
            examples="Compatibility level, validity check, integrity check"
          />
          <ScopeCard
            icon={ClipboardList}
            scope="Declarative"
            color="slate"
            desc="Organizational standard, not automatically enforced."
            examples="Owner required, no transforms on RAW data"
          />
          <ScopeCard
            icon={Search}
            scope="Audit"
            color="violet"
            desc="Checked after the fact for scoring and reporting."
            examples="Naming convention, max field count, doc presence"
          />
        </div>
        <p className="text-sm text-slate-500">
          Runtime and Control Plane rules can be synced to providers. Declarative
          and Audit rules live only in event7.
        </p>
      </Section>

      {/* Enforcement */}
      <Section title="Enforcement Lifecycle">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Rules go through a lifecycle that tracks their enforcement status:
        </p>
        <div className="flex flex-wrap gap-2 mb-6">
          <StatusPill label="Declared" color="slate" desc="Documented, no expectation" />
          <Arrow />
          <StatusPill label="Expected" color="yellow" desc="Required, affects score" />
          <Arrow />
          <StatusPill label="Synced" color="green" desc="Exists in provider" />
          <Arrow />
          <StatusPill label="Verified" color="emerald" desc="Confirmed identical" />
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-red-400 mb-0.5">Drifted</div>
            <p className="text-xs text-slate-500">
              A mismatch was detected between event7 and the provider. The rule
              exists in both places but with different expressions or parameters.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Declarative and Audit rules can only be Declared or Expected. The
          Synced/Verified/Drifted states require a corresponding entry in the
          provider.
        </p>
      </Section>

      {/* Severity */}
      <Section title="Severity Levels">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Severity</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Score Impact</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Use for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <SeverityRow severity="Critical" color="red" impact="Major" example="Compliance: encryption, PII protection" />
              <SeverityRow severity="Error" color="orange" impact="Significant" example="Important standards: compatibility, required fields" />
              <SeverityRow severity="Warning" color="yellow" impact="Moderate" example="Best practices: documentation, ownership" />
              <SeverityRow severity="Info" color="slate" impact="No penalty" example="Recommendations and guidelines" />
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 text-sm text-slate-400 leading-relaxed">
          <span className="font-medium text-teal-400">Contextual severity: </span>
          Rule severity can be automatically escalated or de-escalated based on
          schema enrichment context. A warning on a <code className="text-teal-400">restricted</code> schema
          with 10+ channel bindings may become an error. Factors: classification
          (restricted +1, confidential +1 for error+), binding count (&ge;5 +1,
          &ge;10 +2), and data layer (RAW &minus;1, APPLICATION +1).
          Escalations stack and are capped at critical / floored at info.
        </div>
      </Section>

      {/* Templates */}
      <Section title="Templates">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          event7 ships with four governance templates based on classic data layers.
          Apply them to a subject or to your entire registry in one click.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TemplateCard
            name="RAW Layer"
            rules={3}
            desc="Minimal constraints for data collection. Backward compatibility, source metadata, no transforms."
          />
          <TemplateCard
            name="CORE Layer"
            rules={5}
            desc="Strict governance for the canonical model. Full transitive compatibility, mandatory fields, PII encryption, ownership."
          />
          <TemplateCard
            name="REFINED Layer"
            rules={3}
            desc="For aggregated data. Backward transitive compatibility, must reference Core types, aggregation period."
          />
          <TemplateCard
            name="APPLICATION Layer"
            rules={2}
            desc="Lightweight for consumption views. Backward compatibility, keep schemas simple (max 30 fields)."
          />
        </div>
        <p className="text-sm text-slate-400 leading-relaxed mt-6">
          You can also <strong className="text-slate-300">create your own templates</strong>{" "}
          for any governance model — Data Mesh domains, compliance frameworks (GDPR, PCI-DSS),
          criticality levels, or any custom category. Clone a builtin template as a starting
          point, or build from scratch.
        </p>
        <p className="text-sm text-slate-500 mt-4">
          Templates don&apos;t overwrite existing rules unless you explicitly choose
          to. You can apply multiple templates to the same registry.
        </p>
      </Section>


      {/* Scoring */}
      <Section title="Governance Score">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          The score gives a quick health check across three axes, calculated on
          the fly:
        </p>
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <ScoreAxis
            title="Enrichments"
            points={20}
            color="#22d3ee"
            items={["Description (5)", "Owner (5)", "Tags (5)", "Classification (5)"]}
          />
          <ScoreAxis
            title="Rules & Policies"
            points={50}
            color="#a78bfa"
            items={["Weighted by severity", "Verifiable > declared", "Runtime weighs more"]}
          />
          <ScoreAxis
            title="Schema Quality"
            points={30}
            color="#34d399"
            items={["Compatibility (10)", "Documentation (5)", "References (5)", "Versioning (10)"]}
          />
        </div>

        <div className="flex items-center gap-4 mb-6">
          {[
            { grade: "A", range: "90-100", color: "emerald" },
            { grade: "B", range: "75-89", color: "cyan" },
            { grade: "C", range: "60-74", color: "yellow" },
            { grade: "D", range: "40-59", color: "orange" },
            { grade: "F", range: "0-39", color: "red" },
          ].map((g) => (
            <div key={g.grade} className="text-center">
              <div className={`w-10 h-10 rounded-lg bg-${g.color}-400/10 text-${g.color}-400 flex items-center justify-center text-lg font-bold mb-1`}>
                {g.grade}
              </div>
              <div className="text-[10px] text-slate-600">{g.range}</div>
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-500">
          A <strong className="text-slate-300">confidence indicator</strong>{" "}
          (high / medium / low) reflects how many rules are objectively verifiable
          vs. self-declared.
        </p>
      </Section>

      {/* Provider Compatibility */}
      <Section title="Provider Compatibility">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capability</th>
                <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Confluent</th>
                <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Apicurio</th>
                <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Glue</th>
                <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Azure</th>
                <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pulsar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <ProviderRow cap="Compatibility" vals={["✅", "✅", "✅", "✅", "✅"]} />
              <ProviderRow cap="Validity" vals={["✅", "✅", "—", "—", "—"]} />
              <ProviderRow cap="Data Rules (CEL)" vals={["✅", "—", "—", "—", "—"]} />
              <ProviderRow cap="Migration Rules" vals={["✅", "—", "—", "—", "—"]} />
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-500">
          For providers without native rule support, event7 stores rules as
          declarative entries. They still contribute to scoring and governance
          visibility — they&apos;re just not enforced at the provider level.
        </p>
      </Section>

      {/* Quick Start */}
      <Section title="Quick Start">
        <div className="space-y-4">
          {[
            { step: "1", title: "Apply a template", desc: "Go to Rules, click \"Apply Template\", choose the layer that matches your schema." },
            { step: "2", title: "Review the rules", desc: "The template creates rules with Expected enforcement. Adjust severity or add custom rules." },
            { step: "3", title: "Check the score", desc: "Go to Dashboard or Catalog to see governance scores appear." },
            { step: "4", title: "Add enrichments", desc: "Go to Catalog, fill in description, owner, tags, and classification." },
            { step: "5", title: "Create custom rules", desc: "Use the rule editor for naming conventions, required fields, compliance requirements." },
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
                { feature: "Rules & Policies CRUD", status: "available" },
                { feature: "Templates (RAW/CORE/REFINED/APP)", status: "available" },
                { feature: "Custom templates", status: "available" },
                { feature: "Governance Score (3-axis + confidence)", status: "available" },
                { feature: "Dashboard & Catalog integration", status: "available" },
                { feature: "Provider sync — import from Confluent", status: "planned" },
                { feature: "Provider sync — push to Confluent", status: "planned" },
                { feature: "Drift detection", status: "planned" },

                { feature: "Automated policy evaluation", status: "planned" },
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

function HighlightCard({
  icon: Icon,
  title,
  color,
  items,
}: {
  icon: typeof Shield;
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

function ScopeCard({
  icon: Icon,
  scope,
  color,
  desc,
  examples,
}: {
  icon: typeof Shield;
  scope: string;
  color: string;
  desc: string;
  examples: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-6 w-6 rounded-md bg-${color}-500/10 text-${color}-400 flex items-center justify-center`}>
          <Icon className="h-3 w-3" />
        </div>
        <span className={`text-xs font-semibold text-${color}-400`}>{scope}</span>
      </div>
      <p className="text-sm text-slate-400 mb-2">{desc}</p>
      <p className="text-[11px] text-slate-600">{examples}</p>
    </div>
  );
}

function StatusPill({ label, color, desc }: { label: string; color: string; desc: string }) {
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

function SeverityRow({ severity, color, impact, example }: { severity: string; color: string; impact: string; example: string }) {
  return (
    <tr>
      <td className="py-2.5 px-4">
        <span className={`text-${color}-400 font-medium text-sm`}>{severity}</span>
      </td>
      <td className="py-2.5 px-4 text-slate-400">{impact}</td>
      <td className="py-2.5 px-4 text-slate-500 text-xs">{example}</td>
    </tr>
  );
}

function TemplateCard({ name, rules, desc }: { name: string; rules: number; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{name}</span>
        <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          {rules} rules
        </span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function ScoreAxis({ title, points, color, items }: { title: string; points: number; color: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="text-xs font-bold" style={{ color }}>{points} pts</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full mb-3">
        <div className="h-full rounded-full" style={{ width: `${(points / 100) * 100}%`, background: color }} />
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-[11px] text-slate-500">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ProviderRow({ cap, vals }: { cap: string; vals: string[] }) {
  return (
    <tr>
      <td className="py-2.5 px-4 text-slate-400 font-medium">{cap}</td>
      {vals.map((v, i) => (
        <td key={i} className="py-2.5 px-4 text-center text-slate-400">{v}</td>
      ))}
    </tr>
  );
}