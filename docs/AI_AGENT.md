# event7 — AI Agent

**Status:** Implemented
**Last updated:** 5 avril 2026

---

## Architecture

Two-path streaming system embedded in the governance layer:

- **Query Agent**: Free-form schema questions → SSE streaming responses from Ollama
- **Action Agent**: Write operations (enrich, generate, delete) → tool calling → user confirmation → execution

```
Frontend (ai-content.tsx)
    |
    | POST /api/v1/ai/chat {messages, cmd, registry_id}
    v
ai.py: detect query vs action
    |
    +---> [Query Path] _query_agent()
    |     |
    |     +---> ai_context.fetch_context(cmd, registries, db, redis)
    |     |     +---> For each registry: decrypt creds, create provider
    |     |     +---> Query SR + event7 DB for enrichments/specs
    |     |     +---> Return JSON context string
    |     |
    |     +---> Inject context into system prompt
    |     +---> Stream POST to Ollama /api/chat (stream=true)
    |     +---> Yield SSE events: data: {"text": "chunk"}
    |
    +---> [Action Path] _action_agent()
          |
          +---> POST to Ollama /api/chat (stream=false, tools=TOOLS)
          +---> Yield SSE event: data: {"action": "...", "params": {...}}
                                    |
                        Frontend shows action card (CONFIRM/CANCEL)
                                    |
          POST /api/v1/ai/execute {action, params}
          +---> execute_action() --> db.upsert / provider.delete / asyncapi.generate
```

---

## Files

### Backend

| File | Role |
|------|------|
| `api/ai.py` (~328 lines) | Main router, SSE streaming, query/action routing |
| `api/ai_context.py` (~322 lines) | Live context fetchers (6 commands) |
| `api/ai_actions.py` (~260 lines) | Tool definitions (3 tools) & executors |
| `config.py` | `ollama_host`, `ollama_model`, `ollama_api_key`, `ai_enabled` property |

### Frontend

| File | Role |
|------|------|
| `app/(dashboard)/ai/page.tsx` | Page wrapper (Suspense) |
| `components/ai/ai-content.tsx` (~650 lines) | Full chat UI, SSE parsing, action cards, command menu |

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/ai/chat` | Query or action agent (SSE stream) |
| POST | `/api/v1/ai/execute` | Execute confirmed action |
| GET | `/api/v1/ai/status` | Returns `{enabled, model, provider}` |

---

## Configuration

```env
# AI Agent (optional — empty = disabled)
OLLAMA_HOST=https://ollama.com          # or http://ollama:11434 for local
OLLAMA_MODEL=kimi-k2.5:cloud           # or llama3.1:8b for local
OLLAMA_API_KEY=sk-your-key-here         # empty for local Ollama
```

Provider auto-detected from hostname: `ollama.com` → ollama-cloud, `anthropic`/`claude` → claude, `openai` → openai, `gemini` → gemini, else → ollama.

---

## Context Commands

| Command | Context fetcher | Data injected |
|---------|-----------------|---------------|
| `/health` | `_ctx_health()` | Registry health, response times, subject counts |
| `/schemas` | `_ctx_schemas()` | Schema overview (count, formats, versions) |
| `/drift` | `_ctx_drift()` | Breaking changes in last 2 versions |
| `/catalog` | `_ctx_catalog()` | Enrichment coverage (missing owners, tags) |
| `/refs` | `_ctx_refs()` | Reference graph (orphans, most depended-on) |
| `/asyncapi` | `_ctx_asyncapi()` | AsyncAPI spec status |

Each context function iterates user's registries, decrypts credentials, queries providers + event7 DB, returns JSON summary injected into the system prompt.

---

## Tools (Action Agent)

Three OpenAI-format tool definitions sent to Ollama:

| Tool | Parameters | Execution |
|------|-----------|-----------|
| `enrich_schema` | `subject`, `field` (owner_team/description/tags/classification), `value` | `db.upsert_enrichment()` |
| `generate_asyncapi` | `subject` | `AsyncAPIService.generate()` → `db.upsert_asyncapi_spec()` |
| `delete_subject` | `subject`, `registry_name` (optional) | `provider.delete_subject()` — destructive |

**Action detection**: regex pattern matching French verb stems (`enrich`, `set owner`, `classify`, `generate asyncapi`, `delete subject`, etc.)

**Execution flow**: AI returns tool call → frontend shows orange action card → user clicks CONFIRM → `POST /execute` → action runs → result displayed.

---

## Frontend UI

### Zones

1. **Status Bar** — Agent state (ONLINE/THINKING), provider badge, model name, command buttons
2. **Terminal** — Message history with timestamps, role labels (YOU, EVENT7, ERR, ACTION)
3. **Action Card** — Orange-bordered box with params, CONFIRM/CANCEL buttons
4. **Input** — Terminal-style `>_` prompt, multiline (Shift+Enter), `/command` autocomplete

### Command Menu

Auto-opens when input starts with `/`. Keyboard navigation (arrows, enter, escape). Commands color-coded: teal (health, schemas), rose (drift), violet (catalog), cyan (refs), yellow (asyncapi).

### Streaming

SSE events parsed and displayed character-by-character with cursor `▋`. Simple markdown rendering (`**bold**`, `` `code` ``).

### Deep-linking

`?q=/schemas` URL parameter auto-fills input and focuses.

---

## SSE Protocol

```
data: {"text": "response chunk"}\n\n
data: {"text": "more chunks"}\n\n
data: [DONE]\n\n
```

Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

Error handling: Ollama unreachable → error SSE event. Malformed JSON → skip. HTTP 4xx/5xx → error text + stop.

---

## Auth

- Backend: JWT from Supabase via `Authorization: Bearer {token}`. User's registries scoped by `user_id`.
- Frontend: Calls `createClient().auth.getSession()` before each request.

---

## Known limitations

| Limitation | Detail |
|------------|--------|
| No streaming actions | Action agent is non-streamed (tool calling) |
| No action history | Ollama doesn't see previous actions (stateless) |
| No cached context | Fresh from registries each query (can be slow for large registries) |
| Single tool call | Only first tool in Ollama response is executed |
| No full schema content | Only metadata injected (schema content too large) |
| No rate limiting | No built-in throttling on Ollama calls |
| Subject matching | Exact match required in action params |
| Multi-registry fallback | Subject lookup iterates all registries until found |
| `action-agent.ts` bug | Missing `ollamaRes.ok` check — errors silently fall through (noted in CLAUDE.md) |

---

## Docker (optional, air-gapped)

```yaml
ollama:
  image: ollama/ollama:latest
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
  restart: unless-stopped
```

Backend environment: `OLLAMA_HOST=http://ollama:11434`, `OLLAMA_MODEL=llama3.1:8b`, `OLLAMA_API_KEY=""`.
