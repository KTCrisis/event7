# event7 — Testing Guide

**Status:** 86 tests (75 pass, 11 pre-existing failures)
**Last updated:** 5 avril 2026

---

## Structure

```
backend/tests/
├── conftest.py                  # Shared fixtures (JWT helpers, mocks, constants)
├── helpers.py                   # Test utilities
├── test_auth.py                 # Auth JWT (21 tests)
├── test_lifecycle.py            # Provider lifecycle / close() (10 tests)
├── test_supabase_client.py      # Delete + mutations DB (15 tests)
├── test_registries_routes.py    # Integration: routes + auth + tenant (6 tests)
├── test_validator.py            # Schema validation + contextual severity (23 tests)
└── test_asyncapi_import.py      # AsyncAPI import, 7 fixtures (11 tests)
```

**Total: 86 tests**

---

## Commands

```bash
cd backend

# All tests
python -m pytest tests/ -v

# Single file
python -m pytest tests/test_auth.py -v

# Single test
python -m pytest tests/test_auth.py::TestDecodeJWT::test_expired_token_raises_401 -v

# With coverage
python -m pytest tests/ -v --cov=app --cov-report=term-missing
```

## Config (`pyproject.toml`)

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
pythonpath = ["."]
```

`asyncio_mode = "auto"` avoids `@pytest.mark.asyncio` everywhere.

---

## What each file covers

### test_auth.py (21 tests)

- UserContext model validation
- JWT decode: valid, expired, bad secret, garbage, bad audience
- get_current_user: dev mode (placeholder), prod mode (real JWT)
- Missing/malformed headers → 401
- Missing JWT secret → 500
- Missing claims (sub) or invalid (UUID) → 401
- Regression: placeholder user_id unchanged, two users = two contexts

### test_lifecycle.py (10 tests)

- close() exists on abstract interface
- close() default = no-op (doesn't crash)
- close() called after yield (success AND route error)
- close() itself failing → warning, not crash
- Registry not found → 404 before provider creation
- Inactive registry → 410
- No Supabase → 503

### test_supabase_client.py (15 tests)

- delete_registry → False when response.data empty/None
- delete_registry → True when row affected
- delete_registry filters by user_id
- create_registry → None when insert fails
- upsert_enrichment → None when upsert fails
- audit_log never raises (fire-and-forget)
- Signatures: user_id mandatory on delete, get_by_id, get_registries

### test_registries_routes.py (6 tests)

- DELETE non-existent → 404
- DELETE success → 204
- DELETE propagates user_id from JWT
- GET /registries scoped to user
- GET without auth → 401
- Two different users → two different DB queries

### test_validator.py (23 tests)

- Compatible + no rules → PASS
- Governance error violations → FAIL
- Governance warning violations → WARN
- Breaking change + strict mode → FAIL
- Require doc fields (pass/fail)
- Naming convention (pass/fail)
- Max fields (pass/fail)
- Field regex (pass/fail)
- New subject (no previous version)
- Contextual severity integration

### test_asyncapi_import.py (11 tests)

7 AsyncAPI v3 YAML fixtures covering 6 broker types:

| Fixture | Broker | Validates |
|---------|--------|-----------|
| `01_kafka_tns.yaml` | Kafka | TopicNameStrategy, 4 channels, data layers |
| `02_kafka_rns.yaml` | Kafka | RecordNameStrategy, 3 subjects on 1 topic |
| `03_rabbitmq.yaml` | RabbitMQ | AMQP, exchange types (topic/direct/fanout) |
| `04_pulsar.yaml` | Pulsar | Multi-tenant, namespace, persistence |
| `05_nats.yaml` | NATS | JetStream, queue group, 4 bindings |
| `06_google_pubsub.yaml` | Google Pub/Sub | Ordering, schema settings |
| `07_redis_streams.yaml` | Redis Streams | Consumer groups, retention |

Plus: protocol-broker mapping coverage, total Apicurio matches, missing servers default, v2 spec warning.

---

## Known pre-existing failures (11)

| File | Count | Cause |
|------|:-----:|-------|
| `test_auth.py` | 5 | `_decode_supabase_jwt` now expects Settings object, tests pass raw string |
| `test_lifecycle.py` | 1 | `test_close_called_on_route_exception` — RuntimeError propagates instead of HTTPException |
| `test_validator.py` | 1 | `test_validate_breaking_diff_strict_mode_fail` — FULL_TRANSITIVE + breaking → WARN instead of FAIL |

These failures are not caused by recent changes. They need test updates to match refactored signatures.

---

## Test patterns

- Mock provider: `AsyncMock` for all SR calls
- Mock DB: `MagicMock` for database client
- Mock cache: `AsyncMock` for Redis
- Shared fixtures in `conftest.py` (JWT helpers, sample schemas)
- AsyncAPI import tests use real YAML fixtures in `tests/fixtures/`

---

## Test coverage gaps

| Area | Current coverage | Gap |
|------|:----------------:|-----|
| Auth JWT | Good (21 tests) | 5 failing due to signature change |
| Provider lifecycle | Good (10 tests) | 1 failing edge case |
| DB mutations | Good (15 tests) | PostgreSQLDatabase not tested (only Supabase) |
| Registries routes | Basic (6 tests) | Missing: create, health check, provider types |
| Schema validator | Good (23 tests) | Missing: contextual severity edge cases |
| AsyncAPI import | Good (11 tests) | Missing: Tier 2 broker fixtures, round-trip |
| Governance rules service | **None** | Scoring, templates, CRUD |
| Channel service | **None** | CRUD, bindings, auto-detect |
| AsyncAPI generate | **None** | Multi-broker generation, key schemas |
| Contextual severity | **None** | Dedicated unit tests for resolver |
| AI agent | **None** | Context fetchers, action execution |
