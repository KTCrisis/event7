# event7 — Caching Strategy

**Status:** Implemented, stable
**Last updated:** 5 avril 2026

---

## Architecture

Single Redis instance (7 Alpine), async client via `redis.asyncio`. All cache operations are **fail-safe** — if Redis is down, the app continues without cache (GET returns `None`, SET/DELETE are no-ops).

```
Request → Service → Cache check (Redis)
                      |
                      +→ HIT → return cached data
                      +→ MISS → Provider (SR HTTP) → cache result → return
```

**File:** `backend/app/cache/redis_cache.py`

---

## Key format

```
event7:{registry_id}:{type}:{subject}
```

Built via `cache.cache_key(registry_id, *parts)`. Examples:

| Key | Data |
|-----|------|
| `event7:reg-001:subjects:enriched` | Subject list with enrichments |
| `event7:reg-001:subjects:raw` | Subject list without enrichments |
| `event7:reg-001:schema:com.event7.User:latest` | Schema detail |
| `event7:reg-001:versions:com.event7.User` | Version numbers |
| `event7:reg-001:versions_detail:com.event7.User` | Versions with content |
| `event7:reg-001:diff:com.event7.User:1-2` | Diff between v1 and v2 |
| `event7:reg-001:refs:com.event7.User` | Outgoing references |
| `event7:reg-001:dependents:com.event7.User` | Incoming dependents |
| `event7:reg-001:catalog` | Full catalog view |
| `event7:reg-001:channels:*` | Channel service cache |
| `event7:reg-001:governance:*` | Governance rules cache |
| `event7:reg-001:asyncapi:com.event7.User` | AsyncAPI spec |

---

## TTL

**Default: 300 seconds (5 minutes)** — hardcoded in `RedisCache.DEFAULT_TTL`.

Rationale: schemas change infrequently (minutes/hours, not seconds). 5 min balances freshness vs SR API call reduction. After a mutation (create/delete schema, update enrichment), cache is invalidated immediately — no stale data.

---

## What is cached

| Service | Cached operations | TTL |
|---------|-------------------|:---:|
| **SchemaService** | list_subjects, get_schema, get_versions, get_versions_detail, diff_versions, get_references, get_dependents | 5 min |
| **ChannelService** | (pattern-based invalidation only, no explicit GET cache) | — |
| **GovernanceRulesService** | (pattern-based invalidation only) | — |

## What is NOT cached

| Operation | Why |
|-----------|-----|
| **Governance scoring** | Recalculated from DB every call — ensures freshness after rule changes |
| **AI context** | Fresh fetch from providers + DB every `/ai/chat` — agent needs real-time data |
| **AsyncAPI overview** | Aggregates from multiple sources (provider + DB) — too complex to cache-key |
| **Validator** | Dry-run, stateless — no point caching results |
| **Enrichment reads** | Read from DB directly (fast, local) |

---

## Invalidation strategy

### On mutations

| Mutation | Invalidation |
|----------|-------------|
| Create schema | `delete_pattern(event7:{reg}:*)` — full registry cache flush |
| Delete subject | `delete_pattern(event7:{reg}:*)` — full registry cache flush |
| Update enrichment | Delete `catalog` + `subjects:enriched` keys (targeted) |
| AsyncAPI import/apply | Delete `catalog` + `subjects:enriched` + `subjects:raw` + per-subject `asyncapi:*` keys |
| Channel create/update/delete | `delete_pattern(event7:{reg}:channels:*)` — fire-and-forget via `create_task` |
| Governance rule changes | `delete_pattern(event7:{reg}:governance:*)` |

### Pattern deletion

Uses `SCAN` iterator (not `KEYS`) to avoid blocking Redis:
```python
async for key in self._client.scan_iter(match=pattern):
    await self._client.delete(key)
```

Sequential per-key deletion. Not atomic, but acceptable for cache (not critical data).

---

## Error handling

Every operation is wrapped in try/except:

```python
async def get(self, key):
    try:
        value = await self._client.get(key)
        return json.loads(value) if value else None
    except Exception as e:
        logger.warning(f"Redis GET error for {key}: {e}")
        return None
```

- **GET failure** → returns `None` (cache miss, falls through to provider)
- **SET failure** → silently ignored (data served fresh, just not cached)
- **DELETE failure** → logged as warning (cache will expire via TTL)
- **Redis down** → all operations no-op, app works without cache

---

## Data format

All cached values are JSON-serialized via `json.dumps()` / `json.loads()`. Pydantic models are converted via `.model_dump()` before caching.

Redis configured with `decode_responses=True` — all values are strings, no bytes handling needed.

---

## Performance characteristics

| Metric | Value |
|--------|-------|
| Typical GET latency | < 1ms (local Docker) |
| SR API call latency | 100-300ms (Confluent Cloud), 5-20ms (local Apicurio) |
| Cache hit ratio (steady state) | ~80-90% for Explorer/Catalog (repeated reads) |
| Memory per registry (estimate) | ~1-5 MB for 100 schemas |

---

## Future improvements

| Improvement | Priority | Effort |
|-------------|:--------:|:------:|
| **Pipeline/unlink for pattern delete** — batch delete instead of sequential | Low | S |
| **Cache governance scores** — short TTL (60s), invalidate on rule change | Low | M |
| **Configurable TTL via env var** — `CACHE_TTL=300` | Low | S |
| **Cache AI context** — per-registry, short TTL (30s) for `/health` and `/schemas` commands | Low | M |
| **Redis Cluster support** — for multi-node deployments | Future | L |
