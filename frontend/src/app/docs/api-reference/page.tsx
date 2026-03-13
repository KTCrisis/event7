// src/app/docs/api-reference/page.tsx

import { Server, Database, BookOpen, FileJson, Bot, Shield, ScrollText, Network, Upload } from "lucide-react";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
}

interface EndpointGroup {
  name: string;
  icon: React.ElementType;
  prefix: string;
  description: string;
  endpoints: Endpoint[];
}

const groups: EndpointGroup[] = [
  {
    name: "Registries",
    icon: Server,
    prefix: "/api/v1/registries",
    description: "Connect, list, health-check, and remove schema registries.",
    endpoints: [
      { method: "POST", path: "/", description: "Connect a registry (validates connection, encrypts credentials, stores in DB)" },
      { method: "GET", path: "/", description: "List all registries for the authenticated user" },
      { method: "GET", path: "/{id}/health", description: "Health check a specific registry" },
      { method: "DELETE", path: "/{id}", description: "Soft-delete (deactivate) a registry" },
    ],
  },
  {
    name: "Schemas",
    icon: Database,
    prefix: "/api/v1/registries/{id}",
    description: "Browse subjects, versions, diff, references, and compatibility.",
    endpoints: [
      { method: "GET", path: "/subjects", description: "List all subjects with optional enrichments" },
      { method: "GET", path: "/subjects/{subject}", description: "Get latest version of a subject" },
      { method: "GET", path: "/subjects/{subject}/versions", description: "List version numbers" },
      { method: "GET", path: "/subjects/{subject}/versions/{v}", description: "Get a specific version" },
      { method: "GET", path: "/subjects/{subject}/versions-detail", description: "All versions with full content" },
      { method: "POST", path: "/subjects/{subject}", description: "Register a new schema" },
      { method: "DELETE", path: "/subjects/{subject}", description: "Delete a subject" },
      { method: "GET", path: "/subjects/{subject}/diff?v1=X&v2=Y", description: "Field-level diff between two versions" },
      { method: "GET", path: "/subjects/{subject}/references", description: "Outgoing schema references" },
      { method: "GET", path: "/subjects/{subject}/dependents", description: "Schemas that depend on this subject" },
      { method: "GET", path: "/subjects/{subject}/compatibility", description: "Current compatibility mode" },
      { method: "POST", path: "/subjects/{subject}/compatibility/check", description: "Check schema compatibility" },
    ],
  },
  {
    name: "Governance",
    icon: BookOpen,
    prefix: "/api/v1/registries/{id}",
    description: "Event catalog with broker bindings, enrichments (tags, owner, description, classification, data layer).",
    endpoints: [
      { method: "GET", path: "/catalog", description: "Full event catalog with enrichments, broker_types, channel_count, updated_at" },
      { method: "GET", path: "/catalog/export?format=csv", description: "Export catalog as CSV or JSON" },
      { method: "GET", path: "/subjects/{subject}/enrichment", description: "Get enrichment for a subject" },
      { method: "PUT", path: "/subjects/{subject}/enrichment", description: "Update enrichment (tags, owner, description, classification, data_layer)" },
    ],
  },
  {
    name: "Channels",
    icon: Network,
    prefix: "/api/v1/registries/{id}",
    description: "Messaging channels (Kafka topics, RabbitMQ exchanges, Redis streams, etc.) and subject bindings. Supports multi-broker with broker_config JSONB.",
    endpoints: [
      { method: "POST", path: "/channels", description: "Create a channel (address, broker_type, resource_kind, messaging_pattern, broker_config)" },
      { method: "GET", path: "/channels", description: "List channels with optional filters (?broker_type=kafka&data_layer=core)" },
      { method: "GET", path: "/channels/{channel_id}", description: "Get a single channel with its bindings" },
      { method: "PUT", path: "/channels/{channel_id}", description: "Update a channel" },
      { method: "DELETE", path: "/channels/{channel_id}", description: "Delete a channel and its bindings" },
      { method: "POST", path: "/channels/{channel_id}/bindings", description: "Create a subject binding (subject_name, binding_strategy, schema_role)" },
      { method: "DELETE", path: "/channels/{channel_id}/bindings/{binding_id}", description: "Remove a subject binding" },
      { method: "GET", path: "/channels/reverse/{subject}", description: "Find all channels bound to a subject" },
      { method: "GET", path: "/channels/channel-map", description: "Aggregated channel map (channels + bindings + status)" },
    ],
  },
  {
    name: "Governance Rules",
    icon: ScrollText,
    prefix: "/api/v1/registries/{id}",
    description: "Rules & policies CRUD, governance templates, and scoring. Filter list with query params: subject, scope, kind, category, severity, enforcement_status, source.",
    endpoints: [
      { method: "POST", path: "/rules", description: "Create a governance rule or policy" },
      { method: "GET", path: "/rules", description: "List rules with optional filters (also returns global rules when filtering by subject)" },
      { method: "GET", path: "/rules/{rule_id}", description: "Get a single rule by ID" },
      { method: "PUT", path: "/rules/{rule_id}", description: "Update a rule (partial update, only non-null fields)" },
      { method: "DELETE", path: "/rules/{rule_id}", description: "Delete a rule" },
      { method: "POST", path: "/rules/templates/{template_id}/apply", description: "Apply a governance template to registry or subject" },
      { method: "GET", path: "/governance/score", description: "Governance score for registry or subject (?subject=...)" },
    ],
  },
  {
    name: "Governance Templates",
    icon: Shield,
    prefix: "/api/v1/governance",
    description: "Built-in rule templates (RAW, CORE, REFINED, APPLICATION layers). Read-only — templates are seed data.",
    endpoints: [
      { method: "GET", path: "/templates", description: "List all governance templates" },
      { method: "GET", path: "/templates/{id}", description: "Get a single template with rule definitions" },
    ],
  },
  {
    name: "AsyncAPI",
    icon: FileJson,
    prefix: "/api/v1/registries/{id}",
    description: "Generate, retrieve, edit, and export AsyncAPI 3.0 specs from schemas + enrichments.",
    endpoints: [
      { method: "POST", path: "/subjects/{subject}/asyncapi/generate", description: "Generate spec from schema + enrichments (Kafka bindings, key schema, examples)" },
      { method: "GET", path: "/subjects/{subject}/asyncapi", description: "Retrieve existing spec (cache → DB)" },
      { method: "PUT", path: "/subjects/{subject}/asyncapi", description: "Manually update a spec (sets is_auto_generated=false)" },
      { method: "DELETE", path: "/subjects/{subject}/asyncapi", description: "Delete a stored spec" },
      { method: "GET", path: "/subjects/{subject}/asyncapi/yaml", description: "Export spec as YAML" },
    ],
  },
  {
    name: "AsyncAPI Import",
    icon: Upload,
    prefix: "/api/v1/registries/{id}",
    description: "Import an AsyncAPI v3 spec to create channels, bindings, enrichments, and optionally register schemas. Two-phase: preview (dry-run) then apply. Smart registration routes schemas based on registry type (Apicurio=all, Confluent-like=Kafka only).",
    endpoints: [
      { method: "POST", path: "/asyncapi/import/preview", description: "Parse spec and preview what would be created (channels, bindings, enrichments, unknown schemas)" },
      { method: "POST", path: "/asyncapi/import/apply", description: "Parse and persist all entities. Set register_schemas=true to push compatible schemas to SR." },
    ],
  },
  {
    name: "AI Agent",
    icon: Bot,
    prefix: "/api/v1/ai",
    description: "LLM-powered commands and actions. Requires OLLAMA_HOST configured. SSE streaming responses.",
    endpoints: [
      { method: "GET", path: "/status", description: "AI agent status (enabled, model, provider)" },
      { method: "POST", path: "/chat", description: "Send a command — returns SSE stream (/health, /schemas, /drift, /catalog, /refs, /asyncapi)" },
      { method: "POST", path: "/execute", description: "Execute a confirmed action (enrich, generate, delete) with confirmation UI" },
    ],
  },
  {
    name: "Hosted Registry",
    icon: Server,
    prefix: "/api/v1/registries/hosted",
    description: "Managed Apicurio instances for brokers without a native SR (Redis, RabbitMQ, NATS). Coming soon (currently returns 501).",
    endpoints: [
      { method: "POST", path: "/", description: "Provision a hosted registry" },
      { method: "DELETE", path: "/{id}", description: "Deprovision a hosted registry" },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function ApiReferencePage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
        API Reference
      </h1>
      <p className="text-base text-slate-400 leading-relaxed mb-4 max-w-2xl">
        The event7 backend exposes a REST API on FastAPI. All endpoints under{" "}
        <code className="text-teal-400 bg-teal-500/5 px-1.5 py-0.5 rounded text-xs">
          /api/v1
        </code>{" "}
        require a valid JWT in the{" "}
        <code className="text-teal-400 bg-teal-500/5 px-1.5 py-0.5 rounded text-xs">
          Authorization: Bearer &lt;token&gt;
        </code>{" "}
        header (except when{" "}
        <code className="text-slate-300 text-xs">AUTH_ENABLED=false</code>).
      </p>
      <p className="text-sm text-slate-500 mb-10">
        Interactive Swagger UI available at{" "}
        <code className="text-slate-400 text-xs">/docs</code> on your backend
        instance.
      </p>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.name} id={group.name.toLowerCase().replace(/\s/g, "-")}>
            {/* Group header */}
            <div className="flex items-center gap-2.5 mb-2">
              <group.icon className="h-4.5 w-4.5 text-teal-400" />
              <h2 className="text-lg font-bold text-white">{group.name}</h2>
            </div>
            <p className="text-sm text-slate-400 mb-4">{group.description}</p>
            <p className="text-xs text-slate-600 font-mono mb-4">
              {group.prefix}
            </p>

            {/* Endpoints */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 divide-y divide-slate-800/40 overflow-hidden">
              {group.endpoints.map((ep, i) => (
                <div
                  key={`${group.name}-${i}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-900/40 transition-colors"
                >
                  <span
                    className={`mt-0.5 inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 w-14 text-center ${methodColors[ep.method]}`}
                  >
                    {ep.method}
                  </span>
                  <code className="text-xs font-mono text-slate-300 mt-0.5 shrink-0 min-w-0">
                    {ep.path}
                  </code>
                  <span className="text-xs text-slate-500 mt-0.5 ml-auto text-right">
                    {ep.description}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}