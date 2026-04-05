// src/app/docs/ai-agent/page.tsx
// Documentation page — AI Agent

import {
  Bot,
  MessageSquare,
  Terminal,
  Zap,
  Shield,
  ArrowRight,
  Activity,
  Search,
  AlertTriangle,
  FileCode,
  GitBranch,
  Layers,
} from "lucide-react";
import Link from "next/link";

export default function AIAgentPage() {
  return (
    <article>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Community
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Ollama
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          AI Agent
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mb-8">
          An embedded AI assistant that understands your schemas, enrichments,
          and governance rules. Ask questions in natural language, run analysis
          commands, and perform write operations — all from a terminal-style
          interface with real-time streaming.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/ai"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors"
          >
            Open AI Agent <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-12" />

      {/* How it works */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          How it works
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            The AI Agent connects to Ollama (local or cloud) and has access to
            live data from all your connected registries. When you ask a question
            or run a command, event7 fetches real-time context (schemas,
            enrichments, AsyncAPI specs, governance scores) and injects it into
            the system prompt.
          </p>
          <p>
            Responses are streamed in real-time via Server-Sent Events (SSE).
            The agent can also perform write operations (enrich schemas, generate
            AsyncAPI specs, delete subjects) with explicit user confirmation.
          </p>
        </div>
      </section>

      {/* Commands */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Commands
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Type a command to fetch live context from your registries. The agent
          analyzes the data and responds with insights.
        </p>
        <div className="space-y-3">
          {[
            { cmd: "/health", desc: "Health check all connected registries — response times, subject counts, connectivity status", color: "text-teal-400" },
            { cmd: "/schemas", desc: "Schema overview — total count, format distribution (Avro/JSON/Protobuf), version statistics", color: "text-teal-400" },
            { cmd: "/drift", desc: "Detect breaking changes in the last 2 schema versions across all subjects", color: "text-rose-400" },
            { cmd: "/catalog", desc: "Enrichment coverage analysis — missing owners, descriptions, tags, classification gaps", color: "text-violet-400" },
            { cmd: "/refs", desc: "Reference graph analysis — orphan schemas, most depended-on subjects, dependency chains", color: "text-cyan-400" },
            { cmd: "/asyncapi", desc: "AsyncAPI spec status — documented vs undocumented subjects, coverage percentage", color: "text-amber-400" },
          ].map((item) => (
            <div key={item.cmd} className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
              <code className={`text-sm font-mono font-semibold ${item.color} shrink-0 w-24`}>{item.cmd}</code>
              <span className="text-sm text-slate-400">{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Write actions
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400 leading-relaxed space-y-3 mb-4">
          <p>
            The agent can perform write operations when you use action keywords
            like &ldquo;set owner&rdquo;, &ldquo;add tag&rdquo;,
            &ldquo;generate asyncapi&rdquo;, or &ldquo;delete subject&rdquo;.
            Write actions always require explicit confirmation — the agent shows
            an action card with parameters and you must click Confirm.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Layers, label: "Enrich Schema", desc: "Set owner, description, tags, or classification on a subject" },
            { icon: FileCode, label: "Generate AsyncAPI", desc: "Generate or regenerate an AsyncAPI spec from schema + enrichments" },
            { icon: AlertTriangle, label: "Delete Subject", desc: "Delete a schema subject from the registry (destructive, requires confirmation)" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
              <item.icon size={14} className="text-teal-400 mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">{item.label}</h3>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* UI */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Interface
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Terminal, label: "Terminal style", desc: "Dark terminal UI with timestamps, role labels (YOU, EVENT7), and a command prompt" },
            { icon: MessageSquare, label: "SSE streaming", desc: "Responses appear character by character in real-time, with a blinking cursor" },
            { icon: Zap, label: "Quick commands", desc: "Command buttons at the top for one-click access to /health, /schemas, /drift" },
            { icon: Shield, label: "Action cards", desc: "Write operations show an orange confirmation card — click Confirm or Cancel" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={14} className="text-teal-400" />
                <h3 className="text-sm font-semibold text-white">{item.label}</h3>
              </div>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Configuration
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            The AI Agent requires an Ollama-compatible endpoint. Set these
            environment variables on the backend:
          </p>
          <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs space-y-1">
            <div><span className="text-slate-500"># Local Ollama</span></div>
            <div><span className="text-teal-400">OLLAMA_HOST</span>=http://ollama:11434</div>
            <div><span className="text-teal-400">OLLAMA_MODEL</span>=llama3.1:8b</div>
            <div className="mt-2"><span className="text-slate-500"># Cloud (Ollama.com)</span></div>
            <div><span className="text-teal-400">OLLAMA_HOST</span>=https://ollama.com</div>
            <div><span className="text-teal-400">OLLAMA_MODEL</span>=kimi-k2.5:cloud</div>
            <div><span className="text-teal-400">OLLAMA_API_KEY</span>=sk-your-key</div>
          </div>
          <p>
            If <code className="text-teal-400">OLLAMA_HOST</code> is empty, the
            AI Agent is disabled and the page shows a configuration message.
          </p>
        </div>
      </section>

      {/* Status bar */}
      <section className="mb-14">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6">
          Status bar
        </h2>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-sm text-slate-400 leading-relaxed space-y-3">
          <p>
            The top bar shows the agent state (ONLINE or THINKING), the detected
            provider (ollama, claude, openai, gemini), and the model name. The
            provider is auto-detected from the <code className="text-teal-400">OLLAMA_HOST</code> hostname.
          </p>
        </div>
      </section>
    </article>
  );
}
