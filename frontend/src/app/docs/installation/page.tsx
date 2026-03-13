// src/app/docs/installation/page.tsx
// Documentation page — Self-hosted Installation Guide
// Focused on Docker Compose community deployment

import { Container, CheckCircle2, Terminal, Settings, AlertTriangle, Database, Network } from "lucide-react";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg bg-slate-900 border border-slate-800/60 p-4 overflow-x-auto">
      <code className="text-sm font-mono text-slate-300 leading-relaxed">
        {children}
      </code>
    </pre>
  );
}

function EnvVar({
  name,
  defaultVal,
  required,
  description,
}: {
  name: string;
  defaultVal?: string;
  required?: boolean;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-900/40 transition-colors">
      <code className="text-xs font-mono text-cyan-400 shrink-0 mt-0.5 min-w-[200px]">
        {name}
      </code>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400">{description}</p>
        {defaultVal && (
          <p className="text-[10px] text-slate-600 mt-0.5">
            Default: <code className="text-slate-500">{defaultVal}</code>
          </p>
        )}
      </div>
      {required && (
        <span className="text-[10px] font-semibold text-amber-400 shrink-0">required</span>
      )}
    </div>
  );
}

export default function InstallationPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
        Self-Hosted Install
      </h1>
      <p className="text-base text-slate-400 leading-relaxed mb-10 max-w-2xl">
        Get event7 running on your machine in 5 minutes. This guide covers the
        self-hosted Docker deployment — everything runs locally, no external
        dependencies.
      </p>

      {/* Prerequisites */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Prerequisites
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
          <ul className="space-y-2">
            {[
              "Docker and Docker Compose (v2)",
              "Git",
              "Python 3.12+ (only for seed scripts — not needed to run event7)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-teal-500/60" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Quick install */}
      <section className="mb-12">
        <div className="flex items-center gap-2.5 mb-6">
          <Container className="h-5 w-5 text-teal-400" />
          <h2 className="text-xl font-bold text-white">Quick install</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-400 mb-3 font-medium">
              1. Clone the repository
            </p>
            <CodeBlock>
{`git clone https://github.com/KTCrisis/event7.git
cd event7`}
            </CodeBlock>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-3 font-medium">
              2. Generate an encryption key and configure
            </p>
            <CodeBlock>
{`# Generate a Fernet encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Copy the env file and edit it
cp backend/.env.example backend/.env`}
            </CodeBlock>
            <p className="text-xs text-slate-500 mt-2">
              Open{" "}
              <code className="text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">
                backend/.env
              </code>{" "}
              and set{" "}
              <code className="text-cyan-400/80 bg-slate-800/50 px-1.5 py-0.5 rounded">
                ENCRYPTION_KEY
              </code>{" "}
              with the key you just generated. Set{" "}
              <code className="text-cyan-400/80 bg-slate-800/50 px-1.5 py-0.5 rounded">
                DB_PROVIDER=postgresql
              </code>{" "}
              for self-hosted mode.
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-3 font-medium">
              3. Start everything
            </p>
            <CodeBlock>
{`docker compose -f docker-compose.local.yml up -d --build`}
            </CodeBlock>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-3 font-medium">
              4. Verify
            </p>
            <CodeBlock>
{`curl http://localhost:8000/health
# → {"status":"healthy","services":{"redis":"ok","database":"ok"}}`}
            </CodeBlock>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500">Service</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500">URL</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { service: "Frontend", url: "http://localhost:3000", desc: "Next.js UI" },
                { service: "Backend", url: "http://localhost:8000", desc: "FastAPI + Swagger (/docs)" },
                { service: "Apicurio", url: "http://localhost:8081", desc: "Schema Registry (empty)" },
                { service: "PostgreSQL", url: "localhost:5432", desc: "Database (auto-migrated)" },
                { service: "Redis", url: "localhost:6379", desc: "Cache" },
              ].map((row) => (
                <tr key={row.service} className="border-b border-slate-800/30">
                  <td className="py-2.5 px-4 text-xs font-medium text-slate-300">{row.service}</td>
                  <td className="py-2.5 px-4">
                    <code className="text-xs text-cyan-400/80">{row.url}</code>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-500">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Connect your registry */}
      <section className="mb-12">
        <div className="flex items-center gap-2.5 mb-6">
          <Network className="h-5 w-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Connect your registry</h2>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed mb-5">
          Open{" "}
          <code className="text-cyan-400/80 bg-slate-800/50 px-1.5 py-0.5 rounded text-xs">
            http://localhost:3000/settings
          </code>{" "}
          and click <strong className="text-slate-300">Connect Registry</strong>.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <p className="text-xs font-semibold text-slate-300 mb-2">Local Apicurio (included)</p>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Provider: <strong className="text-slate-400">Apicurio</strong>
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              URL:{" "}
              <code className="text-cyan-400/80 text-[11px]">http://apicurio:8080</code>
            </p>
            <p className="text-[10px] text-slate-600 mt-2">
              Use the Docker service name, not localhost:8081. The backend connects from inside the Docker network.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <p className="text-xs font-semibold text-slate-300 mb-2">Confluent Cloud</p>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Provider: <strong className="text-slate-400">Confluent Cloud</strong>
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              URL:{" "}
              <code className="text-cyan-400/80 text-[11px]">https://psrc-xxxxx.region.aws.confluent.cloud</code>
            </p>
            <p className="text-[10px] text-slate-600 mt-2">
              API Key + Secret from Confluent Cloud → Schema Registry → API credentials.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
            <p className="text-xs font-semibold text-slate-300 mb-2">Confluent Platform</p>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Provider: <strong className="text-slate-400">Confluent Self-Managed</strong>
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              URL:{" "}
              <code className="text-cyan-400/80 text-[11px]">http://your-sr-host:8081</code>
            </p>
            <p className="text-[10px] text-slate-600 mt-2">
              Username + Password for LDAP/RBAC auth. No auth if open.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-800/50 bg-slate-900/40 p-4 text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Karapace &amp; Redpanda</strong> use the Confluent-compatible API —
          connect them as &quot;Confluent Cloud&quot; or &quot;Confluent Self-Managed&quot; with their SR URL.
          No additional configuration needed.
        </div>
      </section>

      {/* Seed with demo data */}
      <section className="mb-12">
        <div className="flex items-center gap-2.5 mb-6">
          <Database className="h-5 w-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Seed with demo data (optional)</h2>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed mb-5">
          The seed scripts create a realistic e-commerce domain — perfect for evaluation.
          Skip this if you want to connect your own registry.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-400 mb-3 font-medium">
              Seed schemas into Apicurio
            </p>
            <CodeBlock>
{`cd backend
pip install requests pyyaml   # if not already installed
python scripts/seed_apicurio.py --url http://localhost:8081`}
            </CodeBlock>
            <p className="text-xs text-slate-500 mt-2">
              Creates 10 Avro + JSON Schema subjects with cross-references and multiple versions.
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-3 font-medium">
              Seed event7 governance data
            </p>
            <CodeBlock>
{`python scripts/seed_event7.py --url http://localhost:8000`}
            </CodeBlock>
            <p className="text-xs text-slate-500 mt-2">
              Creates 9 enrichments, 7 channels (Kafka + RabbitMQ + Redis), 9 bindings, and 7 governance rules.
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-3 font-medium">
              Skip specific sections
            </p>
            <CodeBlock>
{`python scripts/seed_event7.py --skip-enrichments    # channels + rules only
python scripts/seed_event7.py --skip-channels        # enrichments + rules only
python scripts/seed_event7.py --skip-rules           # enrichments + channels only`}
            </CodeBlock>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800/40">
            <p className="text-xs font-semibold text-slate-400">What you should see after seeding</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {[
                { page: "Dashboard", desc: "Schema count, enrichment coverage %, compatibility chart, governance score funnel" },
                { page: "Explorer", desc: "10 subjects, multiple versions, Avro + JSON Schema formats" },
                { page: "Diff Viewer", desc: "com.event7.User → diff v1 vs v2 → role field added" },
                { page: "References", desc: "Order → Customer → Address chain, orphan detection" },
                { page: "Catalog", desc: "Broker badges (Kafka/RabbitMQ/Redis), data layers, ownership" },
                { page: "Channels", desc: "7 channels across 3 broker types, with bindings" },
                { page: "Rules", desc: "7 governance rules — global + per-subject, with severity levels" },
                { page: "Validate", desc: "Paste a modified schema → PASS/WARN/FAIL verdict" },
              ].map((row) => (
                <tr key={row.page} className="border-b border-slate-800/30">
                  <td className="py-2 px-4 text-xs font-medium text-slate-300 w-28">{row.page}</td>
                  <td className="py-2 px-4 text-xs text-slate-500">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Configuration reference */}
      <section className="mb-12">
        <div className="flex items-center gap-2.5 mb-6">
          <Settings className="h-5 w-5 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Configuration reference</h2>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed mb-5">
          All configuration is done via environment variables in{" "}
          <code className="text-slate-300 bg-slate-800/50 px-1.5 py-0.5 rounded text-xs">
            backend/.env
          </code>. The Docker Compose file passes them to the backend container.
        </p>

        {/* Backend env vars */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 divide-y divide-slate-800/30 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-slate-900/40">
            <p className="text-xs font-semibold text-slate-400">Backend environment variables</p>
          </div>
          <EnvVar name="ENCRYPTION_KEY" required description="Fernet key for encrypting registry credentials at rest. Generate with the python command shown in the Quick Install section above." />
          <EnvVar name="DB_PROVIDER" defaultVal="supabase" required description="Database mode. Set to 'postgresql' for self-hosted, 'supabase' for SaaS." />
          <EnvVar name="DATABASE_URL" defaultVal="(set by docker-compose)" description="PostgreSQL connection string. Docker Compose sets this automatically. For manual setup: postgresql://user:pass@host:5432/event7" />
          <EnvVar name="REDIS_URL" defaultVal="redis://localhost:6379" description="Redis connection URL. Docker Compose sets this automatically." />
          <EnvVar name="AUTH_ENABLED" defaultVal="false" description="Enable JWT authentication. Set to 'false' for local evaluation, 'true' for production with Supabase Auth." />
          <EnvVar name="CORS_ORIGINS" defaultVal='["http://localhost:3000"]' description="Allowed CORS origins as a JSON array. Add your frontend URL if not localhost." />
          <EnvVar name="OLLAMA_HOST" description="Ollama API URL for the AI Agent. Example: http://ollama:11434 (local) or https://ollama.com (cloud). Leave empty to disable AI Agent." />
          <EnvVar name="OLLAMA_MODEL" description="LLM model name. Example: llama3.1:8b (local) or kimi-k2.5:cloud (cloud). Required if OLLAMA_HOST is set." />
          <EnvVar name="OLLAMA_API_KEY" description="API key for Ollama Cloud or OpenAI-compatible providers. Leave empty for local Ollama." />
          <EnvVar name="APP_ENV" defaultVal="development" description="Environment name. 'development' enables debug mode." />
          <EnvVar name="APP_DEBUG" defaultVal="true" description="Enable debug logging (loguru)." />
        </div>

        {/* Frontend env vars */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 divide-y divide-slate-800/30 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-slate-900/40">
            <p className="text-xs font-semibold text-slate-400">Frontend environment variables</p>
            <p className="text-[10px] text-slate-600 mt-1">
              File:{" "}
              <code className="text-slate-500">frontend/.env.local</code> — only needed for manual setup. Docker Compose injects these automatically.
            </p>
          </div>
          <EnvVar name="NEXT_PUBLIC_API_URL" defaultVal="http://localhost:8000" description="Backend API URL. Docker Compose overrides this to the internal service name." />
          <EnvVar name="NEXT_PUBLIC_SUPABASE_URL" description="Supabase project URL. Only needed for SaaS mode with Supabase Auth." />
          <EnvVar name="NEXT_PUBLIC_SUPABASE_ANON_KEY" description="Supabase anon key (the long JWT, not the short publishable key). Only needed for SaaS mode." />
        </div>

        {/* Docker Compose note */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/40 p-4 text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Docker Compose handles most of this.</strong> For
          a standard local deployment, you only need to set{" "}
          <code className="text-cyan-400/80">ENCRYPTION_KEY</code> and{" "}
          <code className="text-cyan-400/80">DB_PROVIDER=postgresql</code> in{" "}
          <code className="text-slate-400">backend/.env</code>. Everything else has working defaults.
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-12">
        <div className="flex items-center gap-2.5 mb-6">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Troubleshooting</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              problem: "Backend crashes with \"ENCRYPTION_KEY not set\"",
              solution: "Generate a Fernet key and add it to backend/.env. The key must be a valid Fernet base64 string — don't invent one, use the generate command.",
            },
            {
              problem: "Frontend shows \"Failed to fetch\" on every page",
              solution: "Check that the backend is running (curl localhost:8000/health). If you're running manually (not Docker), make sure NEXT_PUBLIC_API_URL points to localhost:8000 in frontend/.env.local.",
            },
            {
              problem: "Cannot connect Apicurio — \"Connection failed\"",
              solution: "Use http://apicurio:8080 (the Docker service name), not localhost:8081. The backend connects from inside the Docker network.",
            },
            {
              problem: "CORS errors in browser console",
              solution: "CORS_ORIGINS in backend/.env must be a JSON array: [\"http://localhost:3000\"]. Not a plain string, not missing the quotes.",
            },
            {
              problem: "Database migration errors on startup",
              solution: "The bootstrap SQL runs automatically on first start via docker-entrypoint-initdb.d. If you're re-creating the database, use docker compose down -v to remove the volume, then up again.",
            },
            {
              problem: "Schemas show in Apicurio (localhost:8081) but not in event7",
              solution: "Make sure you connected the registry in event7 Settings using the Docker hostname (apicurio:8080), and that the provider type is set to \"Apicurio\".",
            },
            {
              problem: "AI Agent shows \"Not configured\"",
              solution: "Set OLLAMA_HOST and OLLAMA_MODEL in backend/.env. For local Ollama: OLLAMA_HOST=http://host.docker.internal:11434 and OLLAMA_MODEL=llama3.1:8b.",
            },
            {
              problem: "Seed scripts fail with \"Connection refused\"",
              solution: "The seed scripts connect from your host machine, not from inside Docker. Use localhost URLs: --url http://localhost:8081 for Apicurio, --url http://localhost:8000 for event7.",
            },
          ].map((item) => (
            <div
              key={item.problem}
              className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5"
            >
              <p className="text-sm font-medium text-slate-300 mb-2">
                {item.problem}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                {item.solution}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Manual setup */}
      <section>
        <div className="flex items-center gap-2.5 mb-6">
          <Terminal className="h-5 w-5 text-slate-400" />
          <h2 className="text-xl font-bold text-white">Manual setup (without Docker)</h2>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed mb-5">
          If you prefer to run the services manually, you&apos;ll need PostgreSQL 15+,
          Redis 7+, and optionally an Apicurio instance running separately.
        </p>

        <CodeBlock>
{`# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, ENCRYPTION_KEY, DB_PROVIDER=postgresql
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install && npm run dev`}
        </CodeBlock>
      </section>
    </article>
  );
}