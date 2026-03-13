// src/app/docs/licensing/page.tsx

import { Cloud, Scale, Check, Star, Building2, X } from "lucide-react";

type TierColor = "cyan" | "teal" | "amber" | "violet";

const tiers = [
  {
    name: "Free",
    icon: Cloud,
    license: "SaaS terms",
    color: "cyan" as TierColor,
    description:
      "Try event7 instantly — no install, no credit card. Connect one registry and start governing in minutes.",
    features: [
      "Full governance core (Explorer, Diff, Validator, Catalog, Enrichments, AsyncAPI, Graph, Dashboard)",
      "Governance Rules & Policies — templates, scoring, enforcement tracking",
      "Channel Model — map schemas to Kafka, RabbitMQ, Redis Streams, Pulsar, NATS, and cloud brokers",
      "AsyncAPI Import — create channels, bindings, and enrichments from a spec in one click",
      "Smart schema registration — provider-aware routing (Apicurio=all, Confluent=Kafka only)",
      "Schema Validator — SR compatibility + governance rules + diff preview before publishing",
      "1 registry connection",
      "Up to 50 schemas",
      "AI Agent — bring your own model (Ollama, OpenAI, etc.)",
      "Hosted on event7 SaaS",
    ],
  },
  {
    name: "Community",
    icon: Scale,
    license: "Apache 2.0",
    color: "teal" as TierColor,
    description:
      "Free and open-source. The full governance engine on your own infrastructure — no limits, no dependencies on event7.",
    features: [
      "Full governance core (Explorer, Diff, Validator, Catalog, Enrichments, AsyncAPI, Graph, Dashboard)",
      "Governance Rules & Policies — templates, scoring, enforcement tracking",
      "Channel Model — multi-broker channels with N:N bindings, data layers, broker config",
      "AsyncAPI Import & Generation — bidirectional spec ↔ event7 with smart registration",
      "Schema Validator — validate before publishing with SR compatibility + governance rules + diff (PASS/WARN/FAIL)",
      "Unlimited registries and schemas",
      "AI Agent — bring your own model (Ollama, OpenAI, etc.)",
      "Multi-provider support (Confluent Cloud, Platform, Apicurio v3, Karapace, Redpanda)",
      "Self-hosted — Docker, Kubernetes, or bare metal",
      "PostgreSQL + Redis, no external dependencies",
      "Credentials encrypted at rest (AES-256 Fernet)",
    ],
  },
  {
    name: "Pro",
    icon: Star,
    license: "Commercial",
    color: "amber" as TierColor,
    description:
      "For teams that want zero-config AI, provider sync, and managed infrastructure. Everything in Community plus:",
    features: [
      "Provider Rule Sync — import from Confluent ruleSet, push rules to provider, drift detection",
      "AsyncAPI Export Mode 3 — export real event7 channels as multi-broker AsyncAPI specs",
      "Multi-registry import routing — auto-route schemas to the right registry by broker type",
      "AI Agent Managed — hosted LLM with tokens included, zero config",
      "Hosted Registry — fully managed Apicurio instance for brokers without native SR",
      "Unlimited registries and schemas on event7 SaaS",
      "Email support",
    ],
  },
  {
    name: "Enterprise",
    icon: Building2,
    license: "Commercial",
    color: "violet" as TierColor,
    description:
      "For organizations with security, compliance, and on-prem requirements. Everything in Pro plus:",
    features: [
      "OIDC / SSO integration (Okta, Azure AD, Keycloak)",
      "RBAC — role-based access control per registry and subject",
      "Channel health monitoring (lag, throughput, consumer groups)",
      "Channel-level governance rules",
      "Audit log export",
      "On-prem / private cloud deployment",
      "SLA and dedicated support",
      "Custom provider integrations",
    ],
  },
];

const colorMap: Record<TierColor, { badge: string; border: string; icon: string; check: string }> = {
  cyan: {
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    icon: "text-cyan-400",
    check: "text-cyan-500/60",
  },
  teal: {
    badge: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    border: "border-teal-500/20 hover:border-teal-500/40",
    icon: "text-teal-400",
    check: "text-teal-500/60",
  },
  amber: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    border: "border-amber-500/20 hover:border-amber-500/40",
    icon: "text-amber-400",
    check: "text-amber-500/60",
  },
  violet: {
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    border: "border-violet-500/20 hover:border-violet-500/40",
    icon: "text-violet-400",
    check: "text-violet-500/60",
  },
};

const comparisonRows = [
  { label: "Deployment", free: "event7 SaaS", community: "Self-hosted", pro: "event7 SaaS", enterprise: "On-prem / private" },
  { label: "License", free: "SaaS terms", community: "Apache 2.0", pro: "Commercial", enterprise: "Commercial" },
  { label: "Registries", free: "1", community: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "Schemas", free: "50", community: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "Governance core", free: true, community: true, pro: true, enterprise: true },
  { label: "Governance Rules & Policies", free: true, community: true, pro: true, enterprise: true },
  { label: "Governance Templates", free: true, community: true, pro: true, enterprise: true },
  { label: "Governance Scoring", free: true, community: true, pro: true, enterprise: true },
  { label: "Schema Validator", free: true, community: true, pro: true, enterprise: true },
  { label: "Channel Model", free: true, community: true, pro: true, enterprise: true },
  { label: "AsyncAPI Import/Generate", free: true, community: true, pro: true, enterprise: true },
  { label: "Smart Schema Registration", free: true, community: true, pro: true, enterprise: true },
  { label: "Provider Rule Sync", free: false, community: false, pro: true, enterprise: true },
  { label: "Drift Detection", free: false, community: false, pro: true, enterprise: true },
  { label: "AsyncAPI Export Mode 3", free: false, community: false, pro: true, enterprise: true },
  { label: "Multi-registry routing", free: false, community: false, pro: true, enterprise: true },
  { label: "AI Agent (BYOM)", free: true, community: true, pro: true, enterprise: true },
  { label: "AI Managed (hosted LLM)", free: false, community: false, pro: true, enterprise: true },
  { label: "Hosted Registry", free: false, community: false, pro: true, enterprise: true },
  { label: "SSO / OIDC", free: false, community: false, pro: false, enterprise: true },
  { label: "RBAC", free: false, community: false, pro: false, enterprise: true },
  { label: "Channel health monitoring", free: false, community: false, pro: false, enterprise: true },
  { label: "Channel-level rules", free: false, community: false, pro: false, enterprise: true },
  { label: "Audit logs", free: false, community: false, pro: false, enterprise: true },
  { label: "Support", free: "Community", community: "Community", pro: "Email", enterprise: "SLA" },
  { label: "Best for", free: "Evaluation", community: "Labs / self-hosting", pro: "Teams", enterprise: "Regulated orgs" },
];

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="h-4 w-4 text-teal-400 mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-slate-700 mx-auto" />;
  return <span className="text-xs text-slate-400">{value}</span>;
}

export default function LicensingPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
        Plans & Licensing
      </h1>
      <p className="text-base text-slate-400 leading-relaxed mb-10 max-w-2xl">
        event7 follows an <strong className="text-slate-300">open-core</strong>{" "}
        model. The governance engine — including rules, policies, channels, validation,
        AsyncAPI import, and scoring — is free and open-source under Apache 2.0.
        Provider sync, advanced exports, and managed infrastructure are offered in
        paid tiers.
      </p>

      {/* Tier cards */}
      <div className="space-y-5">
        {tiers.map((tier) => {
          const colors = colorMap[tier.color];
          return (
            <div
              key={tier.name}
              className={`rounded-xl border bg-slate-900/30 p-6 transition-colors duration-200 ${colors.border}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <tier.icon className={`h-5 w-5 ${colors.icon}`} />
                <h2 className="text-lg font-bold text-white">{tier.name}</h2>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${colors.badge}`}
                >
                  {tier.license}
                </span>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed mb-5 max-w-xl">
                {tier.description}
              </p>

              <ul className="space-y-2">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm text-slate-300"
                  >
                    <Check
                      className={`h-4 w-4 mt-0.5 shrink-0 ${colors.check}`}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Compare plans
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/5"></th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-cyan-400 uppercase tracking-wider">Free</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-teal-400 uppercase tracking-wider">Community</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-amber-400 uppercase tracking-wider">Pro</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-violet-400 uppercase tracking-wider">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.label}
                  className={i < comparisonRows.length - 1 ? "border-b border-slate-800/30" : ""}
                >
                  <td className="py-2.5 px-4 text-xs font-medium text-slate-300">{row.label}</td>
                  <td className="py-2.5 px-3 text-center"><CellValue value={row.free} /></td>
                  <td className="py-2.5 px-3 text-center"><CellValue value={row.community} /></td>
                  <td className="py-2.5 px-3 text-center"><CellValue value={row.pro} /></td>
                  <td className="py-2.5 px-3 text-center"><CellValue value={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Apache 2.0 details */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">
          About Apache 2.0
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            The Apache License 2.0 grants you permission to use, modify, and
            distribute event7&apos;s Community edition for any purpose — including
            commercial use. The license includes an explicit patent grant,
            protecting you from patent claims by contributors.
          </p>
          <p>
            You may self-host, fork, and extend the Community edition. Attribution
            is required: include the license notice in redistributed copies.
          </p>
          <p>
            Pro and Enterprise features are licensed separately under commercial
            terms. Contact us for details.
          </p>
        </div>
      </section>

      {/* Third-party */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Third-party registries
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            event7 connects to schema registries via their public REST APIs. No
            registry code is embedded, redistributed, or modified.
          </p>
          <p>
            <strong className="text-slate-300">Confluent Schema Registry</strong>{" "}
            is licensed under the Confluent Community License. event7 is an API
            consumer, not a derivative work.
          </p>
          <p>
            <strong className="text-slate-300">Apicurio Registry</strong> is
            licensed under Apache 2.0. When used as a Hosted Registry, event7
            deploys the official Docker image — fully permitted by the license.
          </p>
        </div>
      </section>
    </article>
  );
}