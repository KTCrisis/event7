// Placement: frontend/src/components/ai/ai-content.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRegistry } from "@/providers/registry-provider";
import { createClient } from "@/lib/supabase/client";

// --- Types ---

type MsgRole = "system" | "user" | "agent" | "error" | "action";
interface Msg {
  role: MsgRole;
  content: string;
  ts: number;
}
interface PendingAction {
  action: string;
  params: Record<string, string>;
}
interface AIStatus {
  enabled: boolean;
  model: string | null;
  provider: string;
}

// --- Commands ---

interface Cmd {
  id: string;
  label: string;
  desc: string;
  color: string;
}

const COMMANDS: Cmd[] = [
  { id: "/health", label: "health", desc: "Health check all connected registries", color: "#2dd4bf" },
  { id: "/schemas", label: "schemas", desc: "Overview of all schemas — formats, versions, registries", color: "#2dd4bf" },
  { id: "/drift", label: "drift", desc: "Detect breaking changes and compatibility issues", color: "#f43f5e" },
  { id: "/catalog", label: "catalog", desc: "Enrichment coverage — missing owners, descriptions, tags", color: "#a78bfa" },
  { id: "/refs", label: "refs", desc: "Reference graph — orphans, most depended-on schemas", color: "#38bdf8" },
  { id: "/asyncapi", label: "asyncapi", desc: "AsyncAPI specs status — generated vs missing", color: "#facc15" },
];

// --- Helpers ---

function extractCmd(text: string) {
  const m = text.match(/^(\/[\w.]+)/);
  return m ? m[1] : "";
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en", { hour12: false });
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-100">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="text-teal-400 font-mono text-xs">$1</code>')
    .replace(/\n/g, "<br/>");
}

// --- Provider badge colors ---

const PROVIDER_COLORS: Record<string, string> = {
  "ollama-cloud": "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "ollama": "text-blue-400 border-blue-500/30 bg-blue-500/10",
  "claude": "text-amber-400 border-amber-500/30 bg-amber-500/10",
  "gemini": "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  "openai": "text-green-400 border-green-500/30 bg-green-500/10",
  "none": "text-zinc-500 border-zinc-700 bg-zinc-800",
};

// --- CmdMenu ---

function CmdMenu({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (cmd: Cmd) => void;
}) {
  const filtered = COMMANDS.filter(
    (c) => query === "/" || c.id.includes(query.slice(1))
  );
  if (!filtered.length) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden z-50">
      <div className="px-3 py-1.5 text-[10px] text-zinc-500 font-mono border-b border-zinc-800">
        // commands · ↑↓ navigate · ↵ select · esc close
      </div>
      {filtered.map((cmd, i) => (
        <button
          key={cmd.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors"
          style={{
            borderBottom:
              i < filtered.length - 1 ? "1px solid rgb(39 39 42)" : "none",
          }}
        >
          <span className="font-mono text-sm font-medium" style={{ color: cmd.color }}>
            {cmd.id}
          </span>
          <span className="text-xs text-zinc-400 flex-1">{cmd.desc}</span>
        </button>
      ))}
    </div>
  );
}

// --- Action labels ---

const ACTION_LABELS: Record<string, string> = {
  enrich_schema: "Enrich schema metadata",
  generate_asyncapi: "Generate AsyncAPI spec",
  delete_subject: "Delete schema subject",
};


async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const supabase = createClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      headers["Authorization"] = `Bearer ${data.session.access_token}`;
    }
  }
  return headers;
}
// --- Main component ---

export function AIContent() {
  const searchParams = useSearchParams();
  const { selected: registry } = useRegistry();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Init messages (hydration-safe, no Date.now() during SSR) ---
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "system",
          content: `EVENT7_AGENT · ${registry?.name ?? "no registry"} · AI_ENABLED`,
          ts: Date.now(),
        },
        {
          role: "agent",
          content: "Ready. Ask anything about your schemas or type `/` to browse commands.",
          ts: Date.now(),
        },
      ]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch AI status (model, provider) ---
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/status`)
      .then((r) => r.json())
      .then((data) => setAiStatus(data))
      .catch(() => setAiStatus({ enabled: false, model: null, provider: "none" }));
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Deep-link ?q=
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setInput(q);
      inputRef.current?.focus();
      if (q.startsWith("/")) setShowMenu(true);
    }
  }, [searchParams]);

  // Update system message when registry changes
  useEffect(() => {
    if (messages.length > 0) {
      setMessages((prev) => [
        {
          role: "system",
          content: `EVENT7_AGENT · ${registry?.name ?? "no registry"} · AI_ENABLED`,
          ts: Date.now(),
        },
        ...prev.slice(1),
      ]);
    }
  }, [registry]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (val: string) => {
    setInput(val);
    setShowMenu(val.startsWith("/") && val.length >= 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowMenu(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showMenu) {
        setShowMenu(false);
        return;
      }
      handleSend(input);
    }
  };

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      const cmd = extractCmd(text);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, ts: Date.now() },
      ]);
      setInput("");
      setShowMenu(false);
      setStreaming(true);
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: text },
      ];

      const ts = Date.now();
      setMessages((prev) => [...prev, { role: "agent", content: "▋", ts }]);

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/chat`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              messages: historyRef.current,
              cmd,
              registry_id: registry?.id ?? null,
            }),
          }
        );

        if (!res.ok) {
          const err = await res.text();
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "error", content: `HTTP ${res.status}: ${err}`, ts },
          ]);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.action) {
                setPendingAction({
                  action: parsed.action,
                  params: parsed.params ?? {},
                });
                setMessages((prev) => [
                  ...prev.slice(0, -1),
                  {
                    role: "action",
                    content: JSON.stringify({
                      action: parsed.action,
                      params: parsed.params ?? {},
                    }),
                    ts,
                  },
                ]);
                return;
              }
              if (parsed.text) {
                fullText += parsed.text;
                setMessages((prev) => [
                  ...prev.slice(0, -1),
                  { role: "agent", content: fullText + "▋", ts },
                ]);
              }
            } catch {
              /* skip */
            }
          }
        }

        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "agent", content: fullText || "(no response)", ts },
        ]);
        historyRef.current = [
          ...historyRef.current,
          { role: "assistant", content: fullText },
        ];
      } catch (e) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "error", content: `Connection error: ${String(e)}`, ts },
        ]);
      } finally {
        setStreaming(false);
        inputRef.current?.focus();
      }
    },
    [streaming, registry]
  );

  const handleExecute = useCallback(
    async (action: string, params: Record<string, string>) => {
      setPendingAction(null);
      setStreaming(true);
      const ts = Date.now();
      setMessages((prev) => [...prev, { role: "agent", content: "▋", ts }]);

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/execute`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ action, params }),
          }
        );
        const result = await res.json();
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: result.success ? "agent" : "error",
            content: result.message,
            ts,
          },
        ]);
        historyRef.current = [
          ...historyRef.current,
          { role: "assistant", content: result.message },
        ];
      } catch (e) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "error", content: `Execution error: ${String(e)}`, ts },
        ]);
      } finally {
        setStreaming(false);
        inputRef.current?.focus();
      }
    },
    []
  );

  const handleCancelAction = useCallback(() => {
    setPendingAction(null);
    setMessages((prev) => [
      ...prev.slice(0, -1),
      { role: "system", content: "// action cancelled", ts: Date.now() },
    ]);
  }, []);

  // --- Role styling ---
  const roleColor: Record<MsgRole, string> = {
    system: "text-zinc-500",
    user: "text-zinc-200",
    agent: "text-teal-400",
    error: "text-rose-400",
    action: "text-amber-400",
  };
  const roleLabel: Record<MsgRole, string> = {
    system: "SYS",
    user: "YOU",
    agent: "EVENT7",
    error: "ERR",
    action: "ACTION",
  };

  const providerStyle = PROVIDER_COLORS[aiStatus?.provider ?? "none"] ?? PROVIDER_COLORS["none"];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-zinc-950">
      {/* Agent status bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0 flex-wrap">
        {/* Agent status */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${streaming ? "text-amber-400 animate-pulse" : "text-teal-400"}`}
          >
            ●
          </span>
          <span className="text-xs font-mono text-zinc-400">
            Schema Agent
          </span>
          <span className="text-[10px] font-mono text-zinc-600">
            [{streaming ? "THINKING" : "ONLINE"}]
          </span>
        </div>

        {/* Model + Provider badge */}
        {aiStatus && (
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${providerStyle}`}>
              {aiStatus.provider}
            </span>
            {aiStatus.model && (
              <span className="text-[10px] font-mono text-zinc-500">
                {aiStatus.model}
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Quick command hints */}
        <div className="hidden md:flex items-center gap-1.5">
          {COMMANDS.slice(0, 3).map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setInput(c.id + " ");
                setShowMenu(false);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 text-[10px] font-mono rounded border transition-colors"
              style={{
                color: c.color,
                borderColor: `${c.color}33`,
                background: `${c.color}08`,
              }}
            >
              {c.id}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setMessages((msgs) => msgs.length > 0 ? [msgs[0]] : []);
            historyRef.current = [];
          }}
          className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded border border-zinc-800 hover:border-zinc-600"
        >
          ⌫ clear
        </button>
      </div>

      {/* Terminal */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1 font-mono text-sm cursor-text"
      >
        {messages.map((m, i) => {
          // Action card
          if (m.role === "action") {
            let parsed: PendingAction | null = null;
            try {
              parsed = JSON.parse(m.content);
            } catch {
              /* skip */
            }
            if (!parsed) return null;
            const isLast = i === messages.length - 1;
            const label = ACTION_LABELS[parsed.action] ?? parsed.action;
            const isDanger = parsed.action.includes("delete");

            return (
              <div key={i} className="flex gap-2 py-1">
                <span className="text-[10px] text-zinc-600 w-16 shrink-0 pt-0.5">
                  {fmtTime(m.ts)}
                </span>
                <span className="text-amber-400 w-16 shrink-0 text-xs">
                  ACTION&gt;
                </span>
                <div className="flex-1 min-w-0">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 max-w-lg">
                    <div className="text-xs font-bold text-amber-400 mb-2">
                      ⚠ {label}
                    </div>
                    <div className="space-y-0.5 text-xs">
                      {Object.entries(parsed.params).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-zinc-500">{k}: </span>
                          <span className="text-zinc-200">{v}</span>
                        </div>
                      ))}
                    </div>
                    {isLast && pendingAction && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() =>
                            handleExecute(parsed!.action, parsed!.params)
                          }
                          className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                            isDanger
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30"
                              : "bg-teal-500/20 text-teal-400 border border-teal-500/40 hover:bg-teal-500/30"
                          }`}
                        >
                          CONFIRM
                        </button>
                        <button
                          onClick={handleCancelAction}
                          className="px-3 py-1 text-xs text-zinc-400 border border-zinc-700 rounded hover:border-zinc-500 transition-colors"
                        >
                          CANCEL
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Normal message
          return (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="text-[10px] text-zinc-600 w-16 shrink-0 pt-0.5">
                {fmtTime(m.ts)}
              </span>
              <span className={`w-16 shrink-0 text-xs ${roleColor[m.role]}`}>
                {roleLabel[m.role]}&gt;
              </span>
              <span
                className={`flex-1 min-w-0 text-xs leading-relaxed break-words ${roleColor[m.role]}`}
                dangerouslySetInnerHTML={{
                  __html:
                    m.role === "agent"
                      ? renderMarkdown(m.content)
                      : m.content,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/50">
        <div className="relative px-4 py-3">
          {showMenu && (
            <CmdMenu
              query={input}
              onSelect={(cmd) => {
                setInput(cmd.id + " ");
                setShowMenu(false);
                inputRef.current?.focus();
              }}
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-teal-400 font-mono text-sm">&gt;_</span>
            <input
              ref={inputRef}
              value={input}
              disabled={streaming}
              autoFocus
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                streaming
                  ? "Agent thinking…"
                  : "Ask anything or type / for commands"
              }
              className="flex-1 bg-transparent text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={streaming || !input.trim()}
              className="px-3 py-1 text-xs font-bold font-mono text-teal-400 border border-teal-500/40 rounded hover:bg-teal-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {streaming ? "···" : "EXEC"}
            </button>
          </div>
        </div>
        <div className="px-4 pb-2 text-[10px] font-mono text-zinc-600">
          ↵ send · / commands · esc close menu · registry:{" "}
          {registry?.name ?? "none"}
        </div>
      </div>
    </div>
  );
}