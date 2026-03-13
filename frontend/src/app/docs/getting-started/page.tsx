// src/app/docs/getting-started/page.tsx

import { Cloud, Container, Terminal, CheckCircle2, Upload, Network, Shield, ShieldCheck, Mail } from "lucide-react";
import Link from "next/link";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg bg-slate-900 border border-slate-800/60 p-4 overflow-x-auto">
      <code className="text-sm font-mono text-slate-300 leading-relaxed">
        {children}
      </code>
    </pre>
  );
}

function Step({
  number,
  title,
  isLast,
  children,
}: {
  number: number;
  title: string;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 text-sm font-bold border border-teal-500/20">
          {number}
        </div>
        {!isLast && <div className="flex-1 w-px bg-slate-800/60 mt-2" />}
      </div>
      <div className={`${isLast ? "" : "pb-8"} flex-1 min-w-0`}>
        <h3 className="text-base font-semibold text-white mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function GettingStartedPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
        Getting Started
      </h1>
      <p className="text-base text-slate-400 leading-relaxed mb-10 max-w-2xl">
        The fastest way to try event7 is the{" "}
        <strong className="text-slate-300">self-hosted Docker deployment</strong>{" "}
        — everything runs locally in 5 minutes. A hosted version is also
        available as a preview for early testers.
      </p>

      {/* Two options overview */}
      <div className="grid gap-4 sm:grid-cols-2 mb-12">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Container className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Recommended
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white mb-1.5">Self-Hosted (Docker)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Full stack on your machine — frontend, backend, Apicurio, PostgreSQL,
            Redis. No account needed, no limits, full control.
          </p>
          <Link
            href="/docs/installation"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Installation guide →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="h-4 w-4 text-cyan-400" />
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Preview
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white mb-1.5">SaaS (Hosted Demo)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Try event7 without installing anything. Currently in preview —
            accounts are created manually upon request. Multi-tenant isolation
            and self-service signup are in progress.
          </p>
          <a
            href="mailto:flux7art@gmail.com?subject=event7%20demo%20access"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Mail className="h-3 w-3" />
            Request demo access →
          </a>
        </div>
      </div>

      {/* Self-hosted quick start */}
      <section className="mb-14">
        <div className="flex items-center gap-2.5 mb-6">
          <Container className="h-5 w-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Self-Hosted Quick Start</h2>
        </div>

        <Step number={1} title="Clone and configure">
          <CodeBlock>
{`git clone https://github.com/KTCrisis/event7.git
cd event7

# Generate an encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Copy and edit the env file
cp backend/.env.example backend/.env`}
          </CodeBlock>
          <p className="text-xs text-slate-500 mt-2">
            Set{" "}
            <code className="text-cyan-400/80 bg-slate-800/50 px-1.5 py-0.5 rounded">
              ENCRYPTION_KEY
            </code>{" "}
            and{" "}
            <code className="text-cyan-400/80 bg-slate-800/50 px-1.5 py-0.5 rounded">
              DB_PROVIDER=postgresql
            </code>{" "}
            in{" "}
            <code className="text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">
              backend/.env
            </code>. See the{" "}
            <Link href="/docs/installation" className="text-teal-400 hover:text-teal-300">
              full installation guide
            </Link>{" "}
            for all options.
          </p>
        </Step>

        <Step number={2} title="Start the stack">
          <CodeBlock>
{`docker compose -f docker-compose.local.yml up -d --build

# Services started:
#   localhost:3000  → Frontend (Next.js)
#   localhost:8000  → Backend API (FastAPI)
#   localhost:8081  → Apicurio Registry v3
#   postgres:5432   → PostgreSQL 15
#   redis:6379      → Redis 7`}
          </CodeBlock>
        </Step>

        <Step number={3} title="Connect the registry">
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            Open{" "}
            <code className="text-teal-400 bg-teal-500/5 px-1.5 py-0.5 rounded text-xs">
              http://localhost:3000/settings
            </code>{" "}
            and connect the local Apicurio:{" "}
            <code className="text-slate-300 text-xs">http://apicurio:8080</code>{" "}
            (the Docker internal hostname).
          </p>
        </Step>

        <Step number={4} title="(Optional) Seed with sample data">
          <CodeBlock>
{`cd backend
pip install requests pyyaml   # if not already installed

# Seed Apicurio with 10 schemas + cross-references
python scripts/seed_apicurio.py --url http://localhost:8081

# Seed event7 with enrichments, channels, bindings, and rules
python scripts/seed_event7.py --url http://localhost:8000`}
          </CodeBlock>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            This creates 10 Avro + JSON Schema subjects with references, 9
            enrichments (4 data layers, 6 teams), 7 channels (Kafka + RabbitMQ +
            Redis Streams), 9 bindings, and 7 governance rules — a complete
            demo environment.
          </p>
        </Step>

        <Step number={5} title="Verify health" isLast>
          <CodeBlock>
{`curl http://localhost:8000/health

# Expected:
# {"status": "healthy", "services": {"redis": "ok", "database": "ok"},
#  "database_provider": "PostgreSQLDatabase", "version": "0.1.0"}`}
          </CodeBlock>
        </Step>
      </section>

      {/* SaaS preview */}
      <section className="mb-14">
        <div className="flex items-center gap-2.5 mb-6">
          <Cloud className="h-5 w-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">SaaS Preview</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            In progress
          </span>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            A hosted version of event7 is available at{" "}
            <code className="text-cyan-400/80 bg-slate-800/50 px-1.5 py-0.5 rounded text-xs">
              event7.pages.dev
            </code>{" "}
            for early testers. It runs on Cloudflare Pages + Railway + managed
            PostgreSQL.
          </p>
          <p>
            Self-service signup is not yet available. To get access, reach out
            and a demo account will be created for you with a connected
            registry to explore.
          </p>
          <p className="text-slate-500">
            Work in progress: multi-tenant isolation, self-service onboarding,
            and SSO integration.
          </p>
          <a
            href="mailto:flux7art@gmail.com?subject=event7%20demo%20access"
            className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg text-xs font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Request demo access
          </a>
        </div>
      </section>

      {/* Two paths: existing schemas vs fresh start */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Two starting paths
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-2">
              Existing registry with schemas
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Connect your registry and event7 discovers all subjects
              automatically. Then validate new versions before publishing,
              enrich them in the Catalog (tags, ownership, classification,
              data layers), create channels manually, and generate AsyncAPI
              specs.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Connect</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Explore</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Validate</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Enrich</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Govern</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">
              Empty registry — start with AsyncAPI
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Connect an empty registry (e.g. fresh Apicurio), then import an
              AsyncAPI spec. event7 creates schemas, channels, bindings, and
              enrichments in one operation. Everything populated from a single
              YAML/JSON file.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Connect</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Import</span>
              <span>→</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Done</span>
            </div>
          </div>
        </div>
      </section>

      {/* Next steps */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Next steps
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              icon: ShieldCheck,
              title: "Validate Schemas",
              desc: "Test a schema before publishing — SR compatibility + governance rules + diff in one report.",
              href: "/docs/validator",
            },
            {
              icon: Upload,
              title: "Import AsyncAPI",
              desc: "Import a spec to create channels, schemas, and enrichments at once.",
              href: "/docs/features",
            },
            {
              icon: Network,
              title: "Map Channels",
              desc: "Bind schemas to Kafka topics, RabbitMQ exchanges, Redis streams, and more.",
              href: "/docs/channels",
            },
            {
              icon: Shield,
              title: "Define Rules",
              desc: "Set governance rules — naming policies, field requirements, compliance checks.",
              href: "/docs/governance-rules",
            },
            {
              icon: Terminal,
              title: "Try the AI Agent",
              desc: "Type /schemas to get an AI-powered overview of your registry.",
              href: "/docs/features",
            },
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="group rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 hover:border-slate-700 hover:bg-slate-900/50 transition-all duration-200"
            >
              <item.icon className="h-4 w-4 text-teal-400 mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-teal-400 transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {item.desc}
              </p>
            </a>
          ))}
        </div>
      </section>
    </article>
  );
}