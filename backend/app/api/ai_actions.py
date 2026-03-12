"""
event7 - AI Action Executors
Write operations triggered by the AI agent after user confirmation.

Placement: backend/app/api/ai_actions.py
"""

from loguru import logger

from app.providers.factory import create_provider
from app.utils.encryption import decrypt_credentials


# --- Tool definitions for Ollama tool calling ---

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "enrich_schema",
            "description": "Add or update enrichment metadata on a schema subject (owner, description, tags, classification)",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {
                        "type": "string",
                        "description": "Schema subject name (e.g. Order-value)",
                    },
                    "field": {
                        "type": "string",
                        "enum": ["owner_team", "description", "tags", "classification"],
                        "description": "Which enrichment field to update",
                    },
                    "value": {
                        "type": "string",
                        "description": "New value for the field. For tags, comma-separated list.",
                    },
                },
                "required": ["subject", "field", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_asyncapi",
            "description": "Generate or regenerate an AsyncAPI spec for a schema subject",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {
                        "type": "string",
                        "description": "Schema subject name",
                    },
                },
                "required": ["subject"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_subject",
            "description": "Delete a schema subject from the registry. This is a destructive action.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {
                        "type": "string",
                        "description": "Schema subject name to delete",
                    },
                    "registry_name": {
                        "type": "string",
                        "description": "Name of the registry containing the subject",
                    },
                },
                "required": ["subject"],
            },
        },
    },
]

# Action keywords regex for routing detection in the main router
ACTION_KEYWORDS_PATTERN = (
    r"\b(enrich|set owner|set description|add tag|classify|"
    r"generate asyncapi|regen|delete subject|remove subject|"
    r"set compatibility|update enrichment)\b"
)


async def execute_action(
    action: str,
    params: dict,
    registries: list[dict],
    db_client,
    redis_cache,
    user_id: str = "",
) -> dict:
    """
    Execute a confirmed action.

    Returns:
        {"success": bool, "message": str}
    """
    try:
        if action == "enrich_schema":
            return await _action_enrich(params, registries, db_client, user_id)

        if action == "generate_asyncapi":
            return await _action_generate_asyncapi(params, registries, db_client, redis_cache, user_id)

        if action == "delete_subject":
            return await _action_delete_subject(params, registries)

        return {"success": False, "message": f"Unknown action: {action}"}

    except Exception as e:
        logger.error(f"AI action error [{action}]: {e}")
        return {"success": False, "message": str(e)}


async def _action_enrich(
    params: dict,
    registries: list[dict],
    db_client,
    user_id: str,
) -> dict:
    """Enrich a schema subject with metadata."""
    subject = params.get("subject", "")
    field = params.get("field", "")
    value = params.get("value", "")

    if not subject or not field:
        return {"success": False, "message": "Missing subject or field parameter"}

    # Find which registry has this subject
    registry_id = await _find_registry_for_subject(subject, registries)
    if not registry_id:
        return {"success": False, "message": f"Subject '{subject}' not found in any connected registry"}

    # Build enrichment update
    update_data: dict = {}
    if field == "owner_team":
        update_data["owner_team"] = value
    elif field == "description":
        update_data["description"] = value
    elif field == "tags":
        # Parse comma-separated tags
        tags = [t.strip() for t in value.split(",") if t.strip()]
        existing = db_client.get_enrichment(registry_id, subject)
        existing_tags = existing.get("tags", []) if existing else []
        merged = list(set(existing_tags + tags))
        update_data["tags"] = merged
    elif field == "classification":
        if value not in ("public", "internal", "confidential", "restricted"):
            return {"success": False, "message": f"Invalid classification: {value}"}
        update_data["classification"] = value
    else:
        return {"success": False, "message": f"Unknown field: {field}"}

    db_client.upsert_enrichment(
        registry_id=registry_id,
        subject=subject,
        update_data=update_data,
        user_id=user_id,
    )

    return {"success": True, "message": f"Updated {field} of '{subject}' to '{value}'"}


async def _action_generate_asyncapi(
    params: dict,
    registries: list[dict],
    db_client,
    redis_cache,
    user_id: str,
) -> dict:
    """Generate AsyncAPI spec for a subject."""
    from app.services.asyncapi_service import AsyncAPIService

    subject = params.get("subject", "")
    if not subject:
        return {"success": False, "message": "Missing subject parameter"}

    # Find registry
    registry_id, registry_row = await _find_registry_for_subject_full(subject, registries)
    if not registry_id:
        return {"success": False, "message": f"Subject '{subject}' not found in any connected registry"}

    provider = _make_provider(registry_row)
    try:
        service = AsyncAPIService(
            provider=provider,
            cache=redis_cache,
            db=db_client,
            registry_id=registry_id,
            registry_url=registry_row.get("base_url", ""),
        )
        spec = await service.generate(subject=subject, user_id=user_id)
        return {"success": True, "message": f"AsyncAPI spec generated for '{subject}'"}
    finally:
        await provider.close()


async def _action_delete_subject(
    params: dict,
    registries: list[dict],
) -> dict:
    """Delete a subject from its registry."""
    subject = params.get("subject", "")
    if not subject:
        return {"success": False, "message": "Missing subject parameter"}

    registry_id, registry_row = await _find_registry_for_subject_full(subject, registries)
    if not registry_id:
        return {"success": False, "message": f"Subject '{subject}' not found in any connected registry"}

    provider = _make_provider(registry_row)
    try:
        deleted = await provider.delete_subject(subject)
        if deleted:
            return {"success": True, "message": f"Subject '{subject}' deleted from {registry_row['name']}"}
        return {"success": False, "message": f"Failed to delete '{subject}'"}
    finally:
        await provider.close()


# --- Helpers ---

def _make_provider(reg: dict):
    creds = {}
    if reg.get("credentials_encrypted"):
        creds = decrypt_credentials(reg["credentials_encrypted"])
    return create_provider(
        provider_type=reg["provider_type"],
        base_url=reg["base_url"],
        credentials_plain=creds,
    )


async def _find_registry_for_subject(subject: str, registries: list[dict]) -> str | None:
    """Find which registry contains a given subject. Returns registry_id or None."""
    result = await _find_registry_for_subject_full(subject, registries)
    return result[0]


async def _find_registry_for_subject_full(
    subject: str, registries: list[dict]
) -> tuple[str | None, dict | None]:
    """Find which registry contains a given subject. Returns (registry_id, registry_row)."""
    for reg in registries:
        provider = _make_provider(reg)
        try:
            subjects = await provider.list_subjects()
            if any(s.subject == subject for s in subjects):
                return reg["id"], reg
        except Exception:
            pass
        finally:
            await provider.close()
    return None, None