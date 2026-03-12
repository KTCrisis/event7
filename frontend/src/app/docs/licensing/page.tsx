import { Scale, Check, Star, Building2 } from "lucide-react";

const tiers = [
  {
    name: "Community",
    icon: Scale,
    license: "Apache 2.0",
    color: "teal",
    description:
      "Free and open-source. The full governance core — explore, diff, catalog, enrich, and generate AsyncAPI specs across all supported providers.",
    features: [
      "Schema Explorer with field-level detail",
      "Visual Diff Viewer (LCS-based, Avro + JSON Schema)",
      "Event Catalog with search, filter, and CSV export",
      "Enrichments — tags, owner, description, classification",
      "AsyncAPI 3.0 generation and export",
      "References Graph with dependency visualization",
      "Dashboard with governance KPIs",
      "Multi-provider support (Confluent Cloud, Platform, Apicurio v3)",
      "Dual deployment — SaaS or self-hosted (Docker / Kubernetes)",
      "Redis caching, AES-256 credential encryption",
    ],
  },
  {
    name: "Pro",
    icon: Star,
    license: "Commercial",
    color: "amber",
    description:
      "For teams that want AI-powered governance and managed infrastructure. Everything in Community plus:",
    features: [
      "AI Agent — natural-language commands and automated enrichments",
      "Hosted Registry — fully managed Apicurio instance (no infra to maintain)",
      "Priority support via email",
    ],
  },
  {
    name: "Enterprise",
    icon: Building2,
    license: "Commercial",
    color: "violet",
    description:
      "For organizations running on-prem with security and compliance requirements. Everything in Pro plus:",
    features: [
      "OIDC / SSO integration (Okta, Azure AD, Keycloak)",
      "RBAC — role-based access control per registry and subject",
      "Audit log export",
      "SLA and dedicated support",
      "Custom provider integrations",
    ],
  },
];

const colorMap: Record<string, { badge: string; border: string; icon: string; check: string }> = {
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

export default function LicensingPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
        Licensing
      </h1>
      <p className="text-base text-slate-400 leading-relaxed mb-10 max-w-2xl">
        event7 follows an <strong className="text-slate-300">open-core</strong>{" "}
        model. The governance engine is free and open-source under Apache 2.0.
        Advanced features with infrastructure costs (AI, managed hosting) are
        available in paid tiers.
      </p>

      <div className="space-y-6">
        {tiers.map((tier) => {
          const colors = colorMap[tier.color];
          return (
            <div
              key={tier.name}
              className={`rounded-xl border bg-slate-900/30 p-6 transition-colors duration-200 ${colors.border}`}
            >
              {/* Header */}
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

              {/* Feature list */}
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