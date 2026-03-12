import { Cloud, Container, Terminal, CheckCircle2 } from "lucide-react";

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
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 text-sm font-bold border border-teal-500/20">
          {number}
        </div>
        <div className="flex-1 w-px bg-slate-800/60 mt-2" />
      </div>
      <div className="pb-8 flex-1 min-w-0">
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
        Get event7 running in minutes. Choose between the hosted SaaS or
        self-hosted with Docker.
      </p>

      {/* Prerequisites */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Prerequisites
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
          <ul className="space-y-2">
            {[
              "A schema registry (Confluent Cloud, Confluent Platform, or Apicurio v3)",
              "Registry credentials (API Key + Secret for Confluent Cloud, or username/password for on-prem)",
              "For self-hosted: Docker + Docker Compose installed",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-teal-500/60" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Option A: SaaS */}
      <section className="mb-14">
        <div className="flex items-center gap-2.5 mb-6">
          <Cloud className="h-5 w-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Option A — SaaS</h2>
        </div>

        <Step number={1} title="Create an account">
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            Sign up at{" "}
            <code className="text-teal-400 bg-teal-500/5 px-1.5 py-0.5 rounded text-xs">
              app.event7.dev
            </code>{" "}
            with email and password. You&apos;ll land on an empty dashboard.
          </p>
        </Step>

        <Step number={2} title="Connect your first registry">
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            Go to <strong className="text-slate-300">Settings</strong> and click{" "}
            <strong className="text-slate-300">Connect Registry</strong>. Pick your provider, paste
            your URL and credentials — event7 encrypts them AES-256 at rest.
          </p>
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/50 p-4 text-sm text-slate-500">
            <p className="font-medium text-slate-400 mb-1">Confluent Cloud example</p>
            <p>
              URL:{" "}
              <code className="text-slate-300 text-xs">
                https://psrc-xxxxx.region.aws.confluent.cloud
              </code>
            </p>
            <p>
              API Key / Secret: from Confluent Cloud → Schema Registry → API credentials
            </p>
          </div>
        </Step>

        <Step number={3} title="Explore your schemas">
          <p className="text-sm text-slate-400 leading-relaxed">
            Once connected, the{" "}
            <strong className="text-slate-300">Schema Explorer</strong> shows all
            subjects and versions. Click any schema to view its fields, diff
            versions, or jump to the Event Catalog to add tags and ownership.
          </p>
        </Step>
      </section>

      {/* Option B: Self-hosted */}
      <section className="mb-14">
        <div className="flex items-center gap-2.5 mb-6">
          <Container className="h-5 w-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Option B — Self-hosted (Docker)</h2>
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
        </Step>

        <Step number={2} title="Start the stack">
          <CodeBlock>
{`docker compose -f docker-compose.gke.yml up -d

# Services started:
#   localhost:3000  → Frontend (Next.js)
#   localhost:8000  → Backend API (FastAPI)
#   localhost:8081  → Apicurio Registry (optional)
#   postgres:5432   → PostgreSQL 15
#   redis:6379      → Redis 7`}
          </CodeBlock>
        </Step>

        <Step number={3} title="(Optional) Seed Apicurio with test data">
          <CodeBlock>
{`# Populate Apicurio with sample schemas + references
python scripts/seed_apicurio.py --clean`}
          </CodeBlock>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            Creates 9 Avro + JSON Schema subjects with cross-references — perfect
            for testing the References Graph and Diff Viewer.
          </p>
        </Step>

        <Step number={4} title="Verify health">
          <CodeBlock>
{`curl http://localhost:8000/health

# Expected response:
# {"status": "healthy", "services": {"redis": "ok", "database": "ok"},
#  "database_provider": "PostgreSQLDatabase", "version": "0.1.0"}`}
          </CodeBlock>
        </Step>
      </section>

      {/* Next steps */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Next steps
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: Terminal,
              title: "Try the AI Agent",
              desc: "Open /ai and type /schemas to get an AI-powered overview of your registry.",
              href: "/docs/features",
            },
            {
              icon: Container,
              title: "API Reference",
              desc: "Browse the full REST API — registries, schemas, enrichments, AsyncAPI.",
              href: "/docs/api-reference",
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