"""
event7 - AI Context Fetcher
Builds live context for the AI agent by calling internal event7 services.

Placement: backend/app/api/ai_context.py
"""

import json
import time

from loguru import logger

from app.providers.factory import create_provider
from app.utils.encryption import decrypt_credentials


async def fetch_context(
    cmd: str,
    registries: list[dict],
    db_client,
    redis_cache,
) -> str:
    """
    Fetch live context for the AI agent based on command.
    Calls internal event7 services — works identically in SaaS and on-prem.

    Args:
        cmd: Command prefix (/health, /schemas, /drift, /catalog, /refs, /asyncapi)
        registries: List of registry rows for the current user
        db_client: DatabaseProvider instance
        redis_cache: RedisCache instance
    """
    try:
        if cmd.startswith("/health"):
            return await _ctx_health(registries)

        if cmd.startswith("/schemas"):
            return await _ctx_schemas(registries)

        if cmd.startswith("/drift"):
            return await _ctx_drift(registries)

        if cmd.startswith("/catalog"):
            return await _ctx_catalog(registries, db_client)

        if cmd.startswith("/refs"):
            return await _ctx_refs(registries)

        if cmd.startswith("/asyncapi"):
            return await _ctx_asyncapi(registries, db_client)

        # Default: overview of all registries
        return await _ctx_health(registries)

    except Exception as e:
        logger.error(f"AI context fetch error: {e}")
        return json.dumps({"error": str(e)})


# --- Helpers ---

def _make_provider(reg: dict):
    """Create a provider from a registry row."""
    from app.models.registry import ProviderType

    creds = {}
    if reg.get("credentials_encrypted"):
        creds = decrypt_credentials(reg["credentials_encrypted"])

    return create_provider(
        provider_type=reg["provider_type"],
        base_url=reg["base_url"],
        credentials_plain=creds,
    )


async def _ctx_health(registries: list[dict]) -> str:
    """Health check all registries."""
    results = []
    for reg in registries:
        provider = _make_provider(reg)
        try:
            start = time.monotonic()
            healthy = await provider.health_check()
            ms = round((time.monotonic() - start) * 1000)
            subjects = await provider.list_subjects() if healthy else []
            results.append({
                "name": reg["name"],
                "provider": reg["provider_type"],
                "environment": reg.get("environment", "DEV"),
                "healthy": healthy,
                "response_ms": ms,
                "subject_count": len(subjects),
            })
        except Exception as e:
            results.append({
                "name": reg["name"],
                "provider": reg["provider_type"],
                "healthy": False,
                "error": str(e),
            })
        finally:
            await provider.close()

    return json.dumps({"registries": results, "total": len(results)})


async def _ctx_schemas(registries: list[dict]) -> str:
    """Schemas overview across all registries."""
    all_subjects = []
    for reg in registries:
        provider = _make_provider(reg)
        try:
            subjects = await provider.list_subjects()
            for s in subjects:
                all_subjects.append({
                    "registry": reg["name"],
                    "subject": s.subject,
                    "format": s.format.value,
                    "latest_version": s.latest_version,
                    "version_count": s.version_count,
                })
        except Exception as e:
            logger.warning(f"AI ctx schemas: {reg['name']} error: {e}")
        finally:
            await provider.close()

    # Summary stats
    formats = {}
    for s in all_subjects:
        formats[s["format"]] = formats.get(s["format"], 0) + 1

    return json.dumps({
        "subjects": all_subjects,
        "summary": {
            "total_subjects": len(all_subjects),
            "registries": len(registries),
            "by_format": formats,
        },
    })


async def _ctx_drift(registries: list[dict]) -> str:
    """Detect potential drift: diff latest 2 versions of each multi-version subject."""
    from app.services.diff_service import compute_schema_diff

    drift_items = []
    for reg in registries:
        provider = _make_provider(reg)
        try:
            subjects = await provider.list_subjects()
            multi_version = [s for s in subjects if s.version_count >= 2]

            for s in multi_version[:20]:  # Cap at 20 to avoid timeout
                try:
                    versions = await provider.get_versions(s.subject)
                    if len(versions) >= 2:
                        v_prev = versions[-2].version
                        v_last = versions[-1].version
                        diff = await provider.diff_versions(s.subject, v_prev, v_last)
                        if diff.changes:
                            drift_items.append({
                                "registry": reg["name"],
                                "subject": s.subject,
                                "from_version": v_prev,
                                "to_version": v_last,
                                "is_breaking": diff.is_breaking,
                                "change_count": len(diff.changes),
                                "summary": diff.summary,
                                "changes": [
                                    {
                                        "field": c.field_path,
                                        "type": c.change_type.value,
                                        "details": c.details,
                                    }
                                    for c in diff.changes[:5]
                                ],
                            })
                except Exception:
                    pass  # Skip individual subject errors
        except Exception as e:
            logger.warning(f"AI ctx drift: {reg['name']} error: {e}")
        finally:
            await provider.close()

    breaking = [d for d in drift_items if d["is_breaking"]]
    return json.dumps({
        "drift_items": drift_items,
        "summary": {
            "total_with_changes": len(drift_items),
            "breaking_changes": len(breaking),
        },
    })


async def _ctx_catalog(registries: list[dict], db_client) -> str:
    """Catalog enrichment coverage analysis."""
    all_entries = []
    for reg in registries:
        provider = _make_provider(reg)
        try:
            subjects = await provider.list_subjects()
            for s in subjects:
                enrichment = db_client.get_enrichment(reg["id"], s.subject)
                has_owner = bool(enrichment and enrichment.get("owner_team"))
                has_desc = bool(enrichment and enrichment.get("description"))
                tags = enrichment.get("tags", []) if enrichment else []
                classification = enrichment.get("classification", "internal") if enrichment else "internal"

                all_entries.append({
                    "registry": reg["name"],
                    "subject": s.subject,
                    "format": s.format.value,
                    "has_owner": has_owner,
                    "owner": enrichment.get("owner_team") if enrichment else None,
                    "has_description": has_desc,
                    "tags": tags,
                    "classification": classification,
                })
        except Exception as e:
            logger.warning(f"AI ctx catalog: {reg['name']} error: {e}")
        finally:
            await provider.close()

    total = len(all_entries)
    no_owner = [e for e in all_entries if not e["has_owner"]]
    no_desc = [e for e in all_entries if not e["has_description"]]
    no_tags = [e for e in all_entries if not e["tags"]]

    return json.dumps({
        "entries": all_entries,
        "summary": {
            "total": total,
            "without_owner": len(no_owner),
            "without_description": len(no_desc),
            "without_tags": len(no_tags),
            "coverage_pct": round(
                ((total - len(no_owner)) / total * 100) if total else 0, 1
            ),
            "top_untagged": [e["subject"] for e in no_tags[:10]],
        },
    })


async def _ctx_refs(registries: list[dict]) -> str:
    """References analysis: most referenced schemas, orphans."""
    ref_data = []
    for reg in registries:
        provider = _make_provider(reg)
        try:
            subjects = await provider.list_subjects()
            for s in subjects[:30]:  # Cap
                try:
                    refs = await provider.get_references(s.subject)
                    deps = await provider.get_dependents(s.subject)
                    ref_data.append({
                        "registry": reg["name"],
                        "subject": s.subject,
                        "references_count": len(refs),
                        "dependents_count": len(deps),
                        "references": [r.referenced_subject for r in refs],
                        "dependents": [d.subject for d in deps],
                    })
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"AI ctx refs: {reg['name']} error: {e}")
        finally:
            await provider.close()

    orphans = [r for r in ref_data if r["references_count"] == 0 and r["dependents_count"] == 0]
    most_depended = sorted(ref_data, key=lambda r: r["dependents_count"], reverse=True)[:5]

    return json.dumps({
        "references": ref_data,
        "summary": {
            "total_subjects": len(ref_data),
            "orphans": len(orphans),
            "orphan_names": [o["subject"] for o in orphans[:10]],
            "most_depended_on": [
                {"subject": m["subject"], "dependents": m["dependents_count"]}
                for m in most_depended
            ],
        },
    })


async def _ctx_asyncapi(registries: list[dict], db_client) -> str:
    """AsyncAPI specs status: generated vs missing."""
    status = []
    for reg in registries:
        provider = _make_provider(reg)
        try:
            subjects = await provider.list_subjects()
            for s in subjects:
                spec = db_client.get_asyncapi_spec(reg["id"], s.subject) \
                    if hasattr(db_client, "get_asyncapi_spec") else None
                status.append({
                    "registry": reg["name"],
                    "subject": s.subject,
                    "has_spec": spec is not None,
                    "is_auto": spec.get("is_auto_generated", True) if spec else None,
                })
        except Exception as e:
            logger.warning(f"AI ctx asyncapi: {reg['name']} error: {e}")
        finally:
            await provider.close()

    total = len(status)
    with_spec = [s for s in status if s["has_spec"]]
    missing = [s for s in status if not s["has_spec"]]

    return json.dumps({
        "specs": status,
        "summary": {
            "total_subjects": total,
            "with_spec": len(with_spec),
            "missing_spec": len(missing),
            "coverage_pct": round((len(with_spec) / total * 100) if total else 0, 1),
            "top_missing": [s["subject"] for s in missing[:10]],
        },
    })