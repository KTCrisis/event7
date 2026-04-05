"""
event7 - AI Agent Router
SSE streaming chat + action execution.

Placement: backend/app/api/ai.py

Endpoints:
  POST /api/v1/ai/chat    → Query agent (SSE stream) or Action detection
  POST /api/v1/ai/execute  → Execute confirmed action
"""

import re
import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel

from app.config import get_settings
from app.models.auth import UserContext
from app.utils.auth import get_current_user
from app.api.ai_context import fetch_context
from app.api.ai_actions import (
    TOOLS,
    ACTION_KEYWORDS_PATTERN,
    execute_action,
)

# Global instances — lazy imports to avoid circular dependency with main.py
def _get_redis():
    from app.main import redis_cache
    return redis_cache

def _get_db():
    from app.main import db_client
    return db_client

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

# --- System prompt ---

SYSTEM_PROMPT = """You are EVENT7_AGENT, an embedded AI assistant inside event7 — a universal schema registry governance platform.
You have access to real-time context from connected registries (injected below).

Rules:
- Be direct, analytical, no fluff. Format numbers clearly. Use **bold** for key data.
- Respond in the user's language (FR or EN). Never invent data — only use what's in the context.
- When data is missing, say so and suggest the right command.
- Use tables (markdown) for structured data when helpful.

Available commands:
- /health — health check all connected registries
- /schemas — overview of all schemas across registries (count, formats, versions)
- /drift — detect breaking changes and compatibility issues in recent versions
- /catalog — enrichment coverage analysis (missing owners, descriptions, tags)
- /refs — reference graph analysis (orphans, most depended-on schemas)
- /asyncapi — AsyncAPI spec status (generated vs missing)

You can also answer free-form questions about schemas, governance best practices, Avro/JSON Schema, compatibility modes, etc.

When the user wants to perform a write action (enrich, generate, delete), use tool calling."""

ACTION_SYSTEM_PROMPT = """You are an action executor for event7, a schema registry governance platform.
The user wants to perform a write operation.

Available operations:
- enrich_schema: add or update metadata on a schema (owner_team, description, tags, classification)
- generate_asyncapi: generate an AsyncAPI spec for a subject
- delete_subject: delete a schema subject (destructive)

Instructions:
- Extract the action and parameters from the user message.
- Always call the matching tool — never respond with plain text.
- Match subject names flexibly (with or without -value suffix).
- If parameters are ambiguous, still call the best matching tool with what you have."""


# --- Request/Response models ---

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    cmd: str = ""
    registry_id: str | None = None  # Optional: filter to specific registry


class ActionExecuteRequest(BaseModel):
    action: str
    params: dict


# --- SSE helpers ---

def _sse_text(text: str) -> str:
    return f"data: {json.dumps({'text': text})}\n\n"


def _sse_action(action: str, params: dict) -> str:
    return f"data: {json.dumps({'action': action, 'params': params})}\n\n"


def _sse_done() -> str:
    return "data: [DONE]\n\n"


# --- Routes ---

@router.get("/status")
async def ai_status():
    """Return AI agent configuration (model, provider, enabled)."""
    settings = get_settings()
    provider = "none"
    if settings.ollama_host:
        host = settings.ollama_host.lower()
        if "ollama.com" in host:
            provider = "ollama-cloud"
        elif "anthropic" in host or "claude" in host:
            provider = "claude"
        elif "googleapis" in host or "gemini" in host:
            provider = "gemini"
        elif "openai" in host:
            provider = "openai"
        else:
            provider = "ollama"
    return {
        "enabled": settings.ai_enabled,
        "model": settings.ollama_model or None,
        "provider": provider,
    }


@router.post("/chat")
async def ai_chat(
    body: ChatRequest,
    user: UserContext = Depends(get_current_user),
):
    """
    AI chat endpoint with SSE streaming.
    Routes to query agent or action agent based on message content.
    """
    settings = get_settings()

    if not settings.ai_enabled:
        async def _disabled():
            yield _sse_text("⚠ AI agent not configured. Set OLLAMA_HOST and OLLAMA_MODEL in your .env")
            yield _sse_done()
        return StreamingResponse(_disabled(), media_type="text/event-stream")

    # Fetch user's registries
    db = _get_db()
    registries = db.get_registries(str(user.user_id))
    if body.registry_id:
        registries = [r for r in registries if r["id"] == body.registry_id]

    last_msg = body.messages[-1].content if body.messages else ""

    # Route: action or query?
    if re.search(ACTION_KEYWORDS_PATTERN, last_msg, re.IGNORECASE):
        return await _action_agent(body, settings, registries)

    # Query agent with streaming
    return await _query_agent(body, settings, registries)


@router.post("/execute")
async def ai_execute(
    body: ActionExecuteRequest,
    user: UserContext = Depends(get_current_user),
):
    """Execute a confirmed AI action."""
    db = _get_db()
    registries = db.get_registries(str(user.user_id))

    result = await execute_action(
        action=body.action,
        params=body.params,
        registries=registries,
        db_client=db,
        redis_cache=_get_redis(),
        user_id=str(user.user_id),
    )

    return result


# --- Query agent (SSE stream) ---

async def _query_agent(
    body: ChatRequest,
    settings,
    registries: list[dict],
) -> StreamingResponse:
    """Stream a response from Ollama with injected event7 context."""

    # Determine context command
    cmd = body.cmd or ""
    if not cmd:
        last = body.messages[-1].content if body.messages else ""
        match = re.match(r"^(\/[\w.]+)", last)
        cmd = match.group(1) if match else "/health"

    context_key = cmd.split(".")[0]  # /schemas.avro → /schemas
    context = await fetch_context(context_key, registries, _get_db(), _get_redis())

    # Build messages for Ollama
    ollama_messages = [
        {
            "role": "system",
            "content": f"{SYSTEM_PROMPT}\n\n--- LIVE DATA ---\n{context}\n--- END ---",
        },
    ]
    for msg in body.messages:
        if msg.role in ("user", "assistant"):
            ollama_messages.append({"role": msg.role, "content": msg.content})

    # Build headers
    headers = {"Content-Type": "application/json"}
    if settings.ollama_api_key:
        headers["Authorization"] = f"Bearer {settings.ollama_api_key}"

    async def _stream():
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_host}/api/chat",
                    headers=headers,
                    json={
                        "model": settings.ollama_model,
                        "messages": ollama_messages,
                        "stream": True,
                    },
                ) as response:
                    if response.status_code >= 400:
                        body = await response.aread()
                        yield _sse_text(f"⚠ Ollama error ({response.status_code}): {body.decode(errors='replace')[:200]}")
                        return
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            text = chunk.get("message", {}).get("content", "") or chunk.get("response", "")
                            if text:
                                yield _sse_text(text)
                        except json.JSONDecodeError:
                            pass
        except httpx.ConnectError as e:
            yield _sse_text(f"⚠ Cannot reach Ollama at {settings.ollama_host}: {e}")
        except Exception as e:
            yield _sse_text(f"⚠ Streaming error: {e}")
        finally:
            yield _sse_done()

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --- Action agent (tool calling, non-stream) ---

async def _action_agent(
    body: ChatRequest,
    settings,
    registries: list[dict],
) -> StreamingResponse:
    """Detect action via Ollama tool calling, return action event for UI confirmation."""

    last_msg = body.messages[-1].content if body.messages else ""

    headers = {"Content-Type": "application/json"}
    if settings.ollama_api_key:
        headers["Authorization"] = f"Bearer {settings.ollama_api_key}"

    async def _respond():
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.ollama_host}/api/chat",
                    headers=headers,
                    json={
                        "model": settings.ollama_model,
                        "stream": False,
                        "tools": TOOLS,
                        "options": {"temperature": 0},
                        "messages": [
                            {"role": "system", "content": ACTION_SYSTEM_PROMPT},
                            {"role": "user", "content": last_msg},
                        ],
                    },
                )
                if response.status_code >= 400:
                    yield _sse_text(f"⚠ Ollama error ({response.status_code}): {response.text[:200]}")
                    return
                try:
                    raw = response.json()
                except Exception:
                    yield _sse_text("⚠ Ollama returned invalid JSON response")
                    return

            tool_calls = raw.get("message", {}).get("tool_calls", [])

            if not tool_calls:
                # Fallback: no tool call detected
                text = raw.get("message", {}).get("content", "")
                yield _sse_text(text or "I couldn't identify a specific action. Try being more explicit.")
            else:
                call = tool_calls[0]
                action = call["function"]["name"]
                params = call["function"]["arguments"]
                yield _sse_action(action, params)

        except httpx.ConnectError as e:
            yield _sse_text(f"⚠ Cannot reach Ollama: {e}")
        except Exception as e:
            yield _sse_text(f"⚠ Action detection error: {e}")
        finally:
            yield _sse_done()

    return StreamingResponse(
        _respond(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )