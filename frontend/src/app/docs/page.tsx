// src/app/docs/page.tsx
// Documentation — Introduction page
// v5: Scrollbar fix, branded event7 logo everywhere, responsive pipeline.
// Placement: frontend/src/app/docs/page.tsx

import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Layers,
  Search,
  Bot,
  Network,
  FileCode,
  Scale,
  Upload,
  ShieldCheck,
  BarChart3,
  BookOpen,
  Mail,
  Code2,
  GitCompare,
  Tags,
  Eye,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════
// Branded event7 inline component
// ════════════════════════════════════════════════════════════════════
function E7({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      event<span className="text-teal-400">7</span>
    </span>
  );
}

export default function DocsIntroPage() {
  return (
    <article>
      {/* ── Pipeline keyframes (server component safe) ── */}
      <style>{`
        @keyframes dot-flow-right {
          0%   { left: 0%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes dot-flow-left {
          0%   { right: 0%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { right: 100%; opacity: 0; }
        }
        .dot-right {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          animation: dot-flow-right 2.4s linear infinite;
        }
        .dot-left {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          animation: dot-flow-left 2.4s linear infinite;
        }
      `}</style>

      {/* ── Hero ── */}
      <div className="mb-12">
        {/* Logo */}
        <div className="mb-5">
          <span className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            event<span className="text-teal-400">7</span>
          </span>
        </div>

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
          Schema registries store schemas. They don&apos;t govern them.{" "}
          <E7 className="text-white font-medium" /> adds a provider-agnostic
          governance layer above your registries. Schemas stay in your registry.
          Everything else — enrichments, channels, rules, validation, AsyncAPI
          specs — lives in <E7 className="text-white font-medium" />.
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

      {/* ── Pipeline visual ── */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          How <E7 /> fits
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 overflow-hidden">
          {/* Desktop: full animated pipeline */}
          <div className="hidden md:flex items-center gap-0">
            <PipelineNode
              icon={Layers}
              label="Schema Registry"
              sub="Confluent · Apicurio · Karapace · Redpanda"
              color="slate"
            />
            <PipelineAnimatedArrow
              direction="bidi"
              labelRight="reads"
              labelLeft="syncs"
              colorRight="#94a3b8"
              colorLeft="#2dd4bf"
            />
            <PipelineNode
              icon={Shield}
              label="event7"
              sub="Explore · Validate · Govern"
              color="teal"
              highlight
              branded
            />
            <PipelineAnimatedArrow
              direction="bidi"
              labelRight="generates"
              labelLeft="imports"
              colorRight="#22d3ee"
              colorLeft="#a78bfa"
            />
            <PipelineNode
              icon={FileCode}
              label="AsyncAPI"
              sub="Specs · Channels · Bindings"
              color="cyan"
            />
            <PipelineAnimatedArrow
              direction="forward"
              labelRight="exports"
              colorRight="#a78bfa"
            />
            <PipelineNode
              icon={BookOpen}
              label="EventCatalog"
              sub="Docs · Domains · Teams"
              color="violet"
            />
          </div>

          {/* Mobile: stacked vertical pipeline */}
          <div className="flex md:hidden flex-col gap-2">
            <PipelineNodeMobile
              icon={Layers}
              label="Schema Registry"
              sub="Confluent · Apicurio · Karapace · Redpanda"
              color="slate"
            />
            <PipelineArrowMobile label="reads ↔ syncs" />
            <PipelineNodeMobile
              icon={Shield}
              label="event7"
              sub="Explore · Validate · Govern"
              color="teal"
              highlight
              branded
            />
            <PipelineArrowMobile label="generates ↔ imports" />
            <PipelineNodeMobile
              icon={FileCode}
              label="AsyncAPI"
              sub="Specs · Channels · Bindings"
              color="cyan"
            />
            <PipelineArrowMobile label="exports →" />
            <PipelineNodeMobile
              icon={BookOpen}
              label="EventCatalog"
              sub="Docs · Domains · Teams"
              color="violet"
            />
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-3 text-center">
          <E7 className="text-slate-500 font-medium" /> is not a registry.
          It&apos;s the governance layer your registries are missing.
        </p>
      </section>

      {/* ── Stat counters ── */}
      <section className="mb-14">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCounter value="17" label="features" />
          <StatCounter value="22" label="broker types" />
          <StatCounter value="5" label="SR providers" />
          <StatCounter value="4+" label="governance templates" />
          <StatCounter value="100%" label="open-source core" />
        </div>
      </section>

      {/* ── Three personas ── */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Built for three roles
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <PersonaCard
            color="cyan"
            title="Developers"
            subtitle="Version schemas with confidence"
            items={[
              { icon: Search, text: "Browse subjects, versions, and field structure" },
              { icon: GitCompare, text: "Visual diff with breaking change detection" },
              { icon: ShieldCheck, text: "Validate before publishing — PASS / WARN / FAIL" },
              { icon: Code2, text: "Generate AsyncAPI specs from schemas" },
            ]}
          />
          <PersonaCard
            color="teal"
            title="Platform Teams"
            subtitle="Govern events across brokers"
            items={[
              { icon: Network, text: "Map schemas to Kafka, RabbitMQ, Redis, Pulsar, NATS" },
              { icon: Upload, text: "Import AsyncAPI specs — channels + bindings in one click" },
              { icon: Eye, text: "Track AsyncAPI coverage and schema drift" },
              { icon: Tags, text: "Enrich with tags, ownership, classification, data layers" },
            ]}
          />
          <PersonaCard
            color="amber"
            title="Organizations"
            subtitle="Score and enforce compliance"
            items={[
              { icon: Shield, text: "Define rules and policies — built-in + custom templates" },
              { icon: BarChart3, text: "Three-axis governance scoring (A–F)" },
              { icon: Scale, text: "Provider-agnostic — no vendor lock-in" },
              { icon: BookOpen, text: "Export to EventCatalog for documentation" },
            ]}
          />
        </div>
      </section>

      {/* ── Three flows ── */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Three workflows
        </h2>
        <div className="space-y-4">
          <FlowCard
            number="1"
            color="cyan"
            title="Connect & Explore"
            description="Connect your registry (Confluent, Apicurio, or compatible). event7 discovers all subjects automatically. Browse schemas, view versions, inspect references, compare diffs."
            steps={["Connect registry", "Browse subjects", "Compare versions", "Inspect references"]}
          />
          <FlowCard
            number="2"
            color="teal"
            title="Validate & Ship"
            description="Before publishing a new schema version, paste it into the Validator. event7 checks SR compatibility, evaluates governance rules, and shows a field-level diff — all in one report."
            steps={["Paste schema", "Check compatibility", "Evaluate rules", "Review diff → PASS"]}
          />
          <FlowCard
            number="3"
            color="amber"
            title="Import & Govern"
            description="Import an AsyncAPI spec to bootstrap channels, bindings, and enrichments. Or enrich subjects manually in the Catalog. Apply governance templates and track scores across your registry."
            steps={["Import spec / Enrich", "Map channels", "Apply rules", "Track scores"]}
          />
        </div>
      </section>

      {/* ── Deployment modes ── */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Deployment
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-2">
              SaaS (Preview)
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Try <E7 className="text-slate-300 font-medium" /> without
              installing anything. Hosted on Cloudflare Pages + Railway +
              Supabase Cloud. Accounts created upon request.
            </p>
            <a
              href="mailto:flux7art@gmail.com?subject=event7%20demo%20access"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Mail className="h-3 w-3" />
              Request demo access →
            </a>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">
              Self-hosted (Recommended)
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Full stack on your machine in 5 minutes. Docker Compose with
              PostgreSQL, Redis, Apicurio, backend, and frontend. No limits.
            </p>
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Installation guide →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section>
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">
              Start governing your schemas
            </h3>
            <p className="text-sm text-slate-400">
              5-minute Docker setup, 10 sample schemas, instant governance
              visibility.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/docs/concepts"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-slate-300 border border-slate-700 hover:border-slate-600 hover:text-white transition-colors"
            >
              Core Concepts
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════

// ── Pipeline (Desktop) ──

const nodeColors: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  slate: { bg: "bg-slate-900/50", border: "border-slate-700", icon: "text-slate-400", text: "text-slate-400" },
  teal: { bg: "bg-teal-500/5", border: "border-teal-500/30", icon: "text-teal-400", text: "text-teal-400" },
  cyan: { bg: "bg-cyan-500/5", border: "border-cyan-500/20", icon: "text-cyan-400", text: "text-cyan-400" },
  violet: { bg: "bg-violet-500/5", border: "border-violet-500/20", icon: "text-violet-400", text: "text-violet-400" },
};

function PipelineNode({
  icon: Icon,
  label,
  sub,
  color,
  highlight,
  branded,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  color: string;
  highlight?: boolean;
  branded?: boolean;
}) {
  const c = nodeColors[color];
  return (
    <div
      className={`flex-1 rounded-xl border ${c.border} ${c.bg} p-4 text-center shrink-0 min-w-0 ${
        highlight ? "ring-1 ring-teal-500/20" : ""
      }`}
    >
      <div className={`flex justify-center mb-2 ${c.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className={`text-sm font-semibold ${highlight ? "text-white" : c.text}`}>
        {branded ? (
          <>event<span className="text-teal-400">7</span></>
        ) : (
          label
        )}
      </div>
      <div className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{sub}</div>
    </div>
  );
}

function PipelineAnimatedArrow({
  direction,
  labelRight,
  labelLeft,
  colorRight,
  colorLeft,
}: {
  direction: "forward" | "bidi";
  labelRight: string;
  labelLeft?: string;
  colorRight: string;
  colorLeft?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0 shrink-0 w-20 lg:w-24 mx-1">
      {/* Top label (→) */}
      <span className="text-[9px] text-slate-500 mb-1 leading-none">{labelRight}</span>

      {/* Track */}
      <div className="relative w-full h-3">
        {/* Track line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-800 -translate-y-1/2" />

        {/* Forward dots (→) */}
        <div
          className="dot-right h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: colorRight, animationDelay: "0s" }}
        />
        <div
          className="dot-right h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: colorRight, animationDelay: "0.8s" }}
        />
        <div
          className="dot-right h-1 w-1 rounded-full opacity-60"
          style={{ backgroundColor: colorRight, animationDelay: "1.6s" }}
        />

        {/* Backward dots (←) — only for bidi */}
        {direction === "bidi" && colorLeft && (
          <>
            <div
              className="dot-left h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colorLeft, animationDelay: "0.4s" }}
            />
            <div
              className="dot-left h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colorLeft, animationDelay: "1.2s" }}
            />
            <div
              className="dot-left h-1 w-1 rounded-full opacity-60"
              style={{ backgroundColor: colorLeft, animationDelay: "2.0s" }}
            />
          </>
        )}

        {/* Arrow tips */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
          style={{
            borderLeft: `5px solid ${colorRight}`,
            borderTop: "3px solid transparent",
            borderBottom: "3px solid transparent",
            opacity: 0.6,
          }}
        />
        {direction === "bidi" && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0"
            style={{
              borderRight: `5px solid ${colorLeft}`,
              borderTop: "3px solid transparent",
              borderBottom: "3px solid transparent",
              opacity: 0.6,
            }}
          />
        )}
      </div>

      {/* Bottom label (←) */}
      {direction === "bidi" && labelLeft ? (
        <span className="text-[9px] text-slate-500 mt-1 leading-none">{labelLeft}</span>
      ) : (
        <span className="text-[9px] text-transparent mt-1 leading-none select-none">—</span>
      )}
    </div>
  );
}

// ── Pipeline (Mobile) ──

function PipelineNodeMobile({
  icon: Icon,
  label,
  sub,
  color,
  highlight,
  branded,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  color: string;
  highlight?: boolean;
  branded?: boolean;
}) {
  const c = nodeColors[color];
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border ${c.border} ${c.bg} px-4 py-3 ${
        highlight ? "ring-1 ring-teal-500/20" : ""
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${c.icon}`} />
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${highlight ? "text-white" : c.text}`}>
          {branded ? (
            <>event<span className="text-teal-400">7</span></>
          ) : (
            label
          )}
        </div>
        <div className="text-[10px] text-slate-600 leading-relaxed truncate">{sub}</div>
      </div>
    </div>
  );
}

function PipelineArrowMobile({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-0.5">
      <span className="text-[10px] text-slate-600">{label}</span>
    </div>
  );
}

// ── Stats ──

function StatCounter({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 text-center">
      <div className="text-2xl font-bold text-white tabular-nums mb-0.5">{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

// ── Persona ──

const personaColors: Record<string, { accent: string; icon: string }> = {
  cyan: { accent: "text-cyan-400", icon: "text-cyan-400" },
  teal: { accent: "text-teal-400", icon: "text-teal-400" },
  amber: { accent: "text-amber-400", icon: "text-amber-400" },
};

function PersonaCard({
  color,
  title,
  subtitle,
  items,
}: {
  color: string;
  title: string;
  subtitle: string;
  items: { icon: React.ElementType; text: string }[];
}) {
  const c = personaColors[color];
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className={`text-xs font-bold uppercase tracking-widest ${c.accent} mb-1`}>
        {title}
      </div>
      <p className="text-sm text-slate-300 font-medium mb-4">{subtitle}</p>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5">
            <item.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${c.icon}`} />
            <span className="text-xs text-slate-400 leading-relaxed">
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Flow ──

function FlowCard({
  number,
  color,
  title,
  description,
  steps,
}: {
  number: string;
  color: string;
  title: string;
  description: string;
  steps: string[];
}) {
  const accentMap: Record<string, string> = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    teal: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  const accent = accentMap[color] || accentMap.teal;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
      <div className="flex items-start gap-4">
        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center text-sm font-bold shrink-0 ${accent}`}
        >
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {steps.map((step, i) => (
              <span key={step} className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {step}
                </span>
                {i < steps.length - 1 && (
                  <span className="text-slate-700 text-xs">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}