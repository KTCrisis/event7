# ASYNCAPI_GENERATOR_V2_DESIGN.md

> **event7 — AsyncAPI Generator v2: Protocol-Aware, Channel & Governance Enriched**
>
> Status: Implemented (core), test gaps on Tier 2/3 and round-trip
> Authors: Claude + Marc
> Date: 2026-03-14
> Last updated: 2026-04-05

---

## Implementation status

| Component | Status | Notes |
|-----------|:------:|-------|
| `BROKER_TO_PROTOCOL` (22 types) | **Done** | `asyncapi_service.py` |
| `BROKER_TO_BINDING_KEY` (22 types) | **Done** | `asyncapi_service.py` |
| `_build_servers()` protocol-aware | **Done** | Lines 513-560 |
| `_build_channel_bindings()` (22 branches) | **Done** | Lines 577-759 |
| `_fetch_governance_score()` + `x-governance` | **Done** | Lines 451-476 |
| Import: `PROTOCOL_TO_BROKER` (29 entries) | **Done** | `asyncapi_import_service.py` |
| Import: `_detect_broker_from_bindings()` Tier 2 | **Done** | Lines 628-643 |
| Import: `_extract_broker_config()` Tier 2 | **Done** | Lines 721-776 |
| Frontend: 22 broker type dropdown | **Done** | `frontend/src/types/channel.ts` |
| Tests Tier 1 (7 fixtures, 6 brokers) | **Done** | `test_asyncapi_import.py` |
| Tests Tier 2 (Solace, IBM MQ, MQTT, multi-protocol) | Planned | 4 fixtures in design |
| Tests round-trip (generate → import → compare) | Planned | |
| Tests Tier 3 (Kinesis, EventBridge) | Planned | Code support present, no fixtures |

---

## 1. Problem Statement

The current `asyncapi_service._build_spec()` generates AsyncAPI 3.0 specs from **schema + enrichments only**. It ignores channels, bindings, and governance rules — all of which exist in event7's DB. This produces specs with:

- **Hardcoded `kafka-secure` protocol** regardless of the actual broker
- **No channel bindings** from event7's channel model (partitions, exchange config, etc.)
- **No governance metadata** (score, grade, rules summary)
- **A single generic server** with no security scheme
- **No schema registry bindings** on the server

The import path (`asyncapi_import_service.py`) is the mirror: it reads servers, protocol, bindings, and maps them into event7 entities. The generator should produce specs that round-trip cleanly through import.

---

## 2. Design Principle: Symmetry with Import

```
Import:   spec.servers.*.protocol  → channel.broker_type    (PROTOCOL_TO_BROKER)
Generate: channel.broker_type      → spec.servers.*.protocol (BROKER_TO_PROTOCOL)

Import:   spec.channels.*.bindings → channel.broker_config   (_extract_broker_config)
Generate: channel.broker_config    → spec.channels.*.bindings (_build_channel_bindings)

Import:   spec.info.x-owner        → enrichment.owner_team
Generate: enrichment.owner_team    → spec.info.contact.name   (already done)
```

The new mappings (BROKER_TO_PROTOCOL, `_build_channel_bindings`) are **exact inverses** of the import mappings to ensure round-trip fidelity.

---

## 3. Protocol Matrix — Full Coverage

event7 supports **22 broker types** across 3 tiers, aligned with the AsyncAPI 3.0/3.1 binding specifications.

### 3.1 Tier 1 — Core

| broker_type | protocol | binding_key | Default Port | Category |
|-------------|----------|-------------|:------------|----------|
| `kafka` | `kafka-secure` | `kafka` | 9092 | Streaming |
| `redpanda` | `kafka-secure` | `kafka` | 9092 | Streaming |
| `rabbitmq` | `amqp` | `amqp` | 5672 | Messaging |
| `pulsar` | `pulsar+ssl` | `pulsar` | 6651 | Streaming |
| `nats` | `nats` | `nats` | 4222 | Messaging |
| `redis_streams` | `redis` | `redis` | 6379 | Streaming |
| `google_pubsub` | `googlepubsub` | `googlepubsub` | 443 | Cloud |
| `aws_sns_sqs` | `sns` | `sns` / `sqs` | 443 | Cloud |
| `azure_servicebus` | `amqp` | `amqp` | 5671 | Cloud |

### 3.2 Tier 2 — Enterprise Messaging & IoT

| broker_type | protocol | binding_key | Default Port | Category |
|-------------|----------|-------------|:------------|----------|
| `solace` | `solace` | `solace` | 55555 | Enterprise Messaging |
| `ibmmq` | `ibmmq` | `ibmmq` | 1414 | Enterprise Messaging |
| `activemq_artemis` | `jms` | `jms` | 61616 | Enterprise Messaging |
| `mqtt` | `mqtt` | `mqtt` | 1883 | IoT / Edge |
| `mqtt_secure` | `mqtts` | `mqtt` | 8883 | IoT / Edge |
| `websocket` | `ws` | `ws` | 80 | Real-time Web |
| `websocket_secure` | `wss` | `ws` | 443 | Real-time Web |
| `anypoint_mq` | `anypointmq` | `anypointmq` | 443 | MuleSoft / Salesforce |
| `mercure` | `mercure` | `mercure` | 443 | Server-Sent Events |
| `stomp` | `stomp` | `stomp` | 61613 | Legacy Middleware |

### 3.3 Tier 3 — AWS Serverless & Niche (No official AsyncAPI bindings)

| broker_type | protocol | binding_key | Default Port | Category |
|-------------|----------|-------------|:------------|----------|
| `amazon_kinesis` | `http` | — | 443 | AWS Streaming |
| `amazon_eventbridge` | `http` | — | 443 | AWS Event Bus |
| `custom` | `kafka` | — | 9092 | Fallback |

> **Note:** Tier 3 broker types have no official AsyncAPI bindings. event7 stores them in `broker_config` JSONB and generates specs with the protocol only (no binding block).

### 3.4 Import Protocol Mapping

Both `asyncapi_import_service.py` and `asyncapi_service.py` share the same protocol universe:

```python
PROTOCOL_TO_BROKER: dict[str, str] = {
    # Tier 1 — Core
    "kafka":            "kafka",
    "kafka-secure":     "kafka",
    "amqp":             "rabbitmq",
    "amqps":            "rabbitmq",
    "pulsar":           "pulsar",
    "pulsar+ssl":       "pulsar",
    "nats":             "nats",
    "redis":            "redis_streams",
    "googlepubsub":     "google_pubsub",
    "sns":              "aws_sns_sqs",
    "sqs":              "aws_sns_sqs",

    # Tier 2 — Enterprise & IoT
    "solace":           "solace",
    "secure-solace":    "solace",
    "ibmmq":            "ibmmq",
    "ibmmq-secure":     "ibmmq",
    "jms":              "activemq_artemis",
    "jms-secure":       "activemq_artemis",
    "mqtt":             "mqtt",
    "mqtts":            "mqtt_secure",
    "secure-mqtt":      "mqtt_secure",
    "ws":               "websocket",
    "wss":              "websocket_secure",
    "anypointmq":       "anypoint_mq",
    "mercure":          "mercure",
    "stomp":            "stomp",
    "stomps":           "stomp",

    # Tier 3 — Serverless / Niche
    "http":             "custom",
    "https":            "custom",
}
```

---

## 4. Reverse Mappings

These constants are in `asyncapi_service.py`:

```python
BROKER_TO_PROTOCOL: dict[str, str] = {
    # Tier 1
    "kafka":              "kafka-secure",
    "redpanda":           "kafka-secure",
    "rabbitmq":           "amqp",
    "pulsar":             "pulsar+ssl",
    "nats":               "nats",
    "redis_streams":      "redis",
    "google_pubsub":      "googlepubsub",
    "aws_sns_sqs":        "sns",
    "azure_servicebus":   "amqp",
    # Tier 2
    "solace":             "solace",
    "ibmmq":              "ibmmq",
    "activemq_artemis":   "jms",
    "mqtt":               "mqtt",
    "mqtt_secure":        "mqtts",
    "websocket":          "ws",
    "websocket_secure":   "wss",
    "anypoint_mq":        "anypointmq",
    "mercure":            "mercure",
    "stomp":              "stomp",
    # Tier 3
    "amazon_kinesis":     "http",
    "amazon_eventbridge": "http",
    "custom":             "kafka",
}

BROKER_TO_BINDING_KEY: dict[str, str | None] = {
    # Tier 1
    "kafka": "kafka", "redpanda": "kafka", "rabbitmq": "amqp",
    "pulsar": "pulsar", "nats": "nats", "redis_streams": "redis",
    "google_pubsub": "googlepubsub", "aws_sns_sqs": "sns", "azure_servicebus": "amqp",
    # Tier 2
    "solace": "solace", "ibmmq": "ibmmq", "activemq_artemis": "jms",
    "mqtt": "mqtt", "mqtt_secure": "mqtt", "websocket": "ws",
    "websocket_secure": "ws", "anypoint_mq": "anypointmq",
    "mercure": "mercure", "stomp": "stomp",
    # Tier 3 — no official binding
    "amazon_kinesis": None, "amazon_eventbridge": None, "custom": None,
}
```

Additional mappings: `BROKER_TO_RESOURCE` (topic/exchange/queue/stream per broker), `BROKER_TO_PATTERN` (topic_log/pubsub/queue per broker), `BROKER_SERVER_DESCRIPTION`, `DEFAULT_HOST`.

---

## 5. Data Flow

### v1 (before)

```
Schema (SR) + Enrichment (DB) → _build_spec() → AsyncAPI 3.0 spec
```

### v2 (current)

```
Schema (SR) + Key Schema (SR) + References (SR)
  + Enrichment (DB)
  + Channels + Bindings (DB)
  + Governance Score (DB)
  → _build_spec() → AsyncAPI 3.0 spec
```

### Fetch Order in `generate()`

```python
async def generate(self, subject, params, user_id):
    schema     = await self.provider.get_schema(subject, "latest")
    key_schema = await self._try_fetch_key_schema(subject)
    enrichment = self.db.get_enrichment(self.registry_id, subject)
    references = await self.provider.get_references(subject)
    channels   = self.db.get_channels_for_subject(self.registry_id, subject)
    gov_score  = self._fetch_governance_score(subject)

    spec_content = self._build_spec(
        schema, key_schema, subject, enrichment, references,
        channels, gov_score, params,
    )
```

---

## 6. Server Block Generation

```python
def _build_servers(self, channels, params, registry_name) -> dict:
    if not channels:
        # Fallback: single kafka-secure server (v1 behavior)
        return {"production": {
            "host": params.server_url or "localhost:9092",
            "protocol": "kafka-secure",
            "description": f"Kafka — via event7 registry {registry_name}",
        }}

    servers, seen = {}, set()
    for ch in channels:
        bt = ch.get("broker_type", "kafka")
        if bt in seen: continue
        seen.add(bt)

        server = {
            "host": params.server_url or DEFAULT_HOST.get(bt),
            "protocol": BROKER_TO_PROTOCOL.get(bt, "kafka"),
            "description": BROKER_SERVER_DESCRIPTION.get(bt, bt),
        }

        sb = _build_server_bindings(bt, self.registry_url)
        if sb: server["bindings"] = sb

        servers[bt.replace("_", "-")] = server
    return servers
```

Server bindings: schema registry URL for Kafka/Redpanda, `msgVpn` for Solace, `cleanSession`/`keepAlive` for MQTT, `tenant` for Pulsar.

---

## 7. Channel Bindings Generation

Inverse of `_extract_broker_config()` — one branch per broker type. Covers all 22 broker types:

**Tier 1:**
- **Kafka/Redpanda**: topic, partitions, replicas, topicConfiguration (retention.ms, cleanup.policy)
- **RabbitMQ**: exchange (name, type, durable, autoDelete), queue (name, durable, exclusive), vhost
- **Pulsar**: tenant, namespace, persistence, deduplication
- **NATS**: queue group, stream name
- **Redis Streams**: maxLen, consumer group
- **Google Pub/Sub**: ordering key, retention duration, schema settings
- **AWS SNS/SQS**: FIFO, content-based deduplication
- **Azure Service Bus**: subscription name, dead letter destination

**Tier 2:**
- **Solace**: queue (name, accessType), topic subscriptions, destination type
- **IBM MQ**: queue (objectName), destination type, max message length
- **ActiveMQ Artemis**: destination type
- **MQTT/MQTT-secure**: QoS, retain
- **WebSocket/WebSocket-secure**: method, query, headers
- **Anypoint MQ**: destination type
- **Mercure**: empty binding (presence marker)
- **STOMP**: destination

**Tier 3** (Kinesis, EventBridge, custom): no binding block generated.

---

## 8. Governance Metadata Injection

### Spec Output

```yaml
info:
  x-governance:
    score: 85
    grade: "B"
    rules:
      total: 12
      passing: 10
      warning: 1
      failing: 1
    assessed_at: "2026-03-14T10:30:00Z"
```

### Fetch Helper

```python
def _fetch_governance_score(self, subject: str) -> dict | None:
    try:
        service = GovernanceRulesService(cache=self.cache, db=self.db, registry_id=self.registry_id)
        score = service.get_score(subject=subject)
        return {
            "score": score.score, "grade": score.grade,
            "rules": {"total": score.total_rules, "passing": score.passing,
                      "warning": score.warning, "failing": score.failing},
            "assessed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        return None
```

---

## 9. Multi-Broker Spec Examples

### Cross-Broker: Kafka + Solace + MQTT

```yaml
servers:
  kafka:
    host: broker.confluent.cloud:9092
    protocol: kafka-secure
    bindings:
      kafka:
        schemaRegistryUrl: https://psrc-xyz.confluent.cloud
  solace:
    host: mr-abc.messaging.solace.cloud:55443
    protocol: solace
    bindings:
      solace:
        msgVpn: production
  mqtt:
    host: mqtt.iot-platform.internal:8883
    protocol: mqtts
    bindings:
      mqtt:
        cleanSession: true
        keepAlive: 60

channels:
  kafka-orders:
    address: orders.events.v1
    bindings:
      kafka:
        topic: orders.events.v1
        partitions: 12
  solace-orders:
    address: orders/events/v1
    bindings:
      solace:
        destinationType: topic
        topicSubscriptions: ["orders/events/>"]
  mqtt-orders-iot:
    address: devices/orders/events
    bindings:
      mqtt:
        qos: 1
        retain: false
```

### Enterprise: IBM MQ + ActiveMQ Artemis

```yaml
servers:
  ibmmq:
    host: mq.enterprise.corp:1414
    protocol: ibmmq
  activemq-artemis:
    host: artemis.middleware.corp:61616
    protocol: jms

channels:
  mq-order-queue:
    address: DEV.QUEUE.ORDER.EVENTS
    bindings:
      ibmmq:
        queue:
          objectName: DEV.QUEUE.ORDER.EVENTS
        destinationType: queue
        maxMsgLength: 4194304
  artemis-order-topic:
    address: jms.topic.orders
    bindings:
      jms:
        destinationType: topic
```

---

## 10. Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| No channels bound | v1 behavior: kafka-secure, params-based, no governance |
| Channels bound, no rules | Channel-aware servers + bindings, no `x-governance` |
| Channels + rules | Full: servers + bindings + governance |
| `params.server_url` set | `server_url` wins (explicit override) |
| Multi-broker channels | Multiple servers, one channel block per bound channel |
| Tier 3 broker (Kinesis) | Protocol `http` in server, no binding block |
| Import → re-generate | Round-trip fidelity via `x-broker-type` extension |

---

## 11. Test Coverage

### Implemented — Tier 1 (7 fixtures)

| Fixture | Broker | Validates |
|---------|--------|-----------|
| `01_kafka_tns.yaml` | Kafka | TopicNameStrategy, 4 channels, data layers |
| `02_kafka_rns.yaml` | Kafka | RecordNameStrategy, 3 subjects on 1 topic |
| `03_rabbitmq.yaml` | RabbitMQ | AMQP, exchange types (topic/direct/fanout) |
| `04_pulsar.yaml` | Pulsar | Multi-tenant, namespace, persistence |
| `05_nats.yaml` | NATS | JetStream, queue group, 4 bindings |
| `06_google_pubsub.yaml` | Google Pub/Sub | Ordering, schema settings |
| `07_redis_streams.yaml` | Redis Streams | Consumer groups, retention |

### Planned — Tier 2 (4 fixtures)

| Fixture | Broker | Validates |
|---------|--------|-----------|
| `09_solace_pubsub.yaml` | Solace | Queue + topic subscriptions |
| `10_ibmmq_enterprise.yaml` | IBM MQ | objectName + maxMsgLength |
| `11_mqtt_iot.yaml` | MQTT | QoS/retain + mqtts server |
| `12_multi_protocol.yaml` | Kafka + Solace + MQTT + IBM MQ | Multi-server, mixed bindings |

### Planned — Round-trip

```
For each fixture (01-12):
  import → create channels in DB → generate from bound subjects
  → verify servers.*.protocol matches original
```

---

## 12. Files

| File | Description |
|------|-------------|
| `backend/app/services/asyncapi_service.py` | 7 constant dicts, `_build_servers()`, `_build_server_bindings()`, `_build_channel_bindings()` (22 branches), `_fetch_governance_score()`. ~1100 lines. |
| `backend/app/services/asyncapi_import_service.py` | `PROTOCOL_TO_BROKER` (29 entries), `BROKER_TO_RESOURCE`, `BROKER_TO_PATTERN`, `_detect_broker_from_bindings()`, `_extract_broker_config()`. ~900 lines. |
| `frontend/src/types/channel.ts` | 22 broker type union + display helpers (icons, labels, defaults). ~248 lines. |
| `backend/tests/test_asyncapi_import.py` | 7 Tier 1 fixtures, 11 test methods. ~529 lines. |
