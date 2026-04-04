"""
event7 - AsyncAPI Service
Génère des specs AsyncAPI 3.0 à partir des schemas + enrichments.
Supporte Avro et JSON Schema.

Placement: backend/app/services/asyncapi_service.py

Changelog v2 — Kafka Bindings Enhancement:
- Kafka message bindings (Magic Byte / Confluent encoding)
- Key schema detection and separation (-key / -value)
- Channel bindings (topic name, partitions, replication_factor)
- x-confluent-schema-id on components/schemas
- Correct contentType per schema format (Avro MIME type)
- Backward compatible: all new features are opt-in via AsyncAPIGenerateRequest params
"""

import json
from datetime import datetime, timezone
import hashlib
from loguru import logger

from app.cache.redis_cache import RedisCache
from app.db.base import DatabaseProvider
from app.models.asyncapi import AsyncAPISpec, AsyncAPIGenerateRequest
from app.models.schema import SchemaDetail, SchemaFormat
from app.providers.base import SchemaRegistryProvider

BROKER_TO_PROTOCOL: dict[str, str] = {
    # Tier 1 — Core
    "kafka": "kafka-secure", "redpanda": "kafka-secure",
    "rabbitmq": "amqp", "pulsar": "pulsar+ssl", "nats": "nats",
    "redis_streams": "redis", "google_pubsub": "googlepubsub",
    "aws_sns_sqs": "sns", "azure_servicebus": "amqps",
    # Tier 2 — Enterprise & IoT
    "solace": "solace", "ibmmq": "ibmmq", "activemq_artemis": "jms",
    "mqtt": "mqtt", "mqtt_secure": "mqtts",
    "websocket": "ws", "websocket_secure": "wss",
    "anypoint_mq": "anypointmq", "mercure": "mercure", "stomp": "stomp",
    # Tier 3 — Fallback
    "amazon_kinesis": "http", "amazon_eventbridge": "http", "custom": "kafka",
}

BROKER_TO_BINDING_KEY: dict[str, str | None] = {
    "kafka": "kafka", "redpanda": "kafka",
    "rabbitmq": "amqp", "pulsar": "pulsar", "nats": "nats",
    "redis_streams": "redis", "google_pubsub": "googlepubsub",
    "aws_sns_sqs": "sns", "azure_servicebus": "amqp",
    "solace": "solace", "ibmmq": "ibmmq", "activemq_artemis": "jms",
    "mqtt": "mqtt", "mqtt_secure": "mqtt",
    "websocket": "ws", "websocket_secure": "ws",
    "anypoint_mq": "anypointmq", "mercure": "mercure", "stomp": "stomp",
    "amazon_kinesis": None, "amazon_eventbridge": None, "custom": None,
}

BROKER_SERVER_DESCRIPTION: dict[str, str] = {
    "kafka": "Apache Kafka broker", "redpanda": "Redpanda broker (Kafka-compatible)",
    "rabbitmq": "RabbitMQ broker (AMQP 0.9.1)", "pulsar": "Apache Pulsar broker",
    "nats": "NATS messaging server", "redis_streams": "Redis Streams",
    "google_pubsub": "Google Cloud Pub/Sub", "aws_sns_sqs": "AWS SNS/SQS",
    "azure_servicebus": "Azure Service Bus (AMQP 1.0)",
    "solace": "Solace PubSub+ Event Broker", "ibmmq": "IBM MQ (MQ Series)",
    "activemq_artemis": "ActiveMQ Artemis (JMS / AMQP 1.0)",
    "mqtt": "MQTT broker", "mqtt_secure": "MQTT broker (TLS)",
    "websocket": "WebSocket server", "websocket_secure": "WebSocket server (TLS)",
    "anypoint_mq": "Anypoint MQ (MuleSoft)", "mercure": "Mercure Hub (SSE)",
    "stomp": "STOMP broker",
    "amazon_kinesis": "Amazon Kinesis Data Streams",
    "amazon_eventbridge": "Amazon EventBridge", "custom": "Custom broker",
}

DEFAULT_HOST: dict[str, str] = {
    "kafka": "localhost:9092", "redpanda": "localhost:9092",
    "rabbitmq": "localhost:5672", "pulsar": "localhost:6651",
    "nats": "localhost:4222", "redis_streams": "localhost:6379",
    "google_pubsub": "pubsub.googleapis.com:443",
    "aws_sns_sqs": "sns.us-east-1.amazonaws.com:443",
    "azure_servicebus": "mybus.servicebus.windows.net:5671",
    "solace": "localhost:55555", "ibmmq": "localhost:1414",
    "activemq_artemis": "localhost:61616",
    "mqtt": "localhost:1883", "mqtt_secure": "localhost:8883",
    "websocket": "localhost:80", "websocket_secure": "localhost:443",
    "anypoint_mq": "mq-us-east-1.anypoint.mulesoft.com:443",
    "mercure": "localhost:3000/.well-known/mercure",
    "stomp": "localhost:61613",
    "amazon_kinesis": "kinesis.us-east-1.amazonaws.com:443",
    "amazon_eventbridge": "events.us-east-1.amazonaws.com:443",
    "custom": "localhost:9092",
}

# =========================================================================
# Hash helpers
# =========================================================================
def _compute_schema_hash(schema_content: dict | str) -> str:
    """Compute a stable SHA-256 hash of schema content."""
    if isinstance(schema_content, dict):
        raw = json.dumps(schema_content, sort_keys=True, separators=(",", ":"))
    else:
        raw = str(schema_content)
    return hashlib.sha256(raw.encode()).hexdigest()

class AsyncAPIService:
    """
    Génère et gère les specs AsyncAPI.
    Combine les données du provider (schema) avec les enrichissements DB.
    """

    CACHE_TTL = 300  # 5 minutes

    def __init__(
        self,
        provider: SchemaRegistryProvider,
        cache: RedisCache,
        db: DatabaseProvider,
        registry_id: str,
        registry_url: str = "",
    ):
        self.provider = provider
        self.cache = cache
        self.db = db
        self.registry_id = registry_id
        self.registry_url = registry_url

    # =========================================================================
    # Cache helpers
    # =========================================================================

    def _cache_key(self, subject: str) -> str:
        return f"event7:{self.registry_id}:asyncapi:{subject}"

    # =========================================================================
    # Generate
    # =========================================================================

    async def generate(
        self,
        subject: str,
        params: AsyncAPIGenerateRequest | None = None,
        user_id: str = "",
    ) -> AsyncAPISpec:
        """Génère une spec AsyncAPI 3.0 complète depuis schema + enrichments + channels + governance."""
        params = params or AsyncAPIGenerateRequest()

        # 1. Fetch value schema from provider
        schema = await self.provider.get_schema(subject, "latest")
        source_hash = _compute_schema_hash(schema.schema_content)
        source_version = schema.version if hasattr(schema, "version") else None

        # 2. Fetch key schema (if enabled)
        key_schema = None
        if params.include_key_schema:
            key_schema = await self._try_fetch_key_schema(subject)

        # 3. Fetch enrichment from DB
        enrichment = self.db.get_enrichment(self.registry_id, subject)

        # 4. Fetch references
        references = await self.provider.get_references(subject)

        # 5. Fetch channels bound to this subject — NEW
        channels = self.db.get_channels_for_subject(self.registry_id, subject)

        # 6. Fetch governance score — NEW
        gov_score = await self._fetch_governance_score(subject)

        # 7. Build spec — ENHANCED
        spec_content = self._build_spec(
            schema=schema,
            key_schema=key_schema,
            subject=subject,
            enrichment=enrichment,
            references=references,
            channels=channels,
            gov_score=gov_score,
            params=params,
        )

        # 8. Store in DB
        self.db.upsert_asyncapi_spec(
            registry_id=self.registry_id,
            subject=subject,
            spec_content=spec_content,
            is_auto_generated=True,
            user_id=user_id,
            source_schema_hash=source_hash,
            source_schema_version=source_version,
        )

        # 9. Invalidate + populate cache
        await self.cache.delete(self._cache_key(subject))

        result = AsyncAPISpec(
            subject=subject,
            spec_content=spec_content,
            is_auto_generated=True,
            updated_at=datetime.now(timezone.utc),
        )

        await self.cache.set(
            self._cache_key(subject),
            result.model_dump(mode="json"),
            ttl=self.CACHE_TTL,
        )

        logger.info(f"AsyncAPI spec generated for {subject}")
        return result

    # =========================================================================
    # Get
    # =========================================================================

    async def get_spec(self, subject: str) -> AsyncAPISpec | None:
        """Récupère une spec existante (cache → DB)."""

        # 1. Check cache
        cached = await self.cache.get(self._cache_key(subject))
        if cached:
            logger.debug(f"AsyncAPI cache hit for {subject}")
            return AsyncAPISpec(**cached)

        # 2. Fetch from DB
        data = self.db.get_asyncapi_spec(self.registry_id, subject)
        if not data:
            return None

        spec = AsyncAPISpec(
            subject=data["subject"],
            spec_content=data["spec_content"],
            is_auto_generated=data["is_auto_generated"],
            updated_at=data.get("updated_at"),
        )

        # 3. Populate cache
        await self.cache.set(
            self._cache_key(subject),
            spec.model_dump(mode="json"),
            ttl=self.CACHE_TTL,
        )

        return spec

    # =========================================================================
    # Update
    # =========================================================================

    async def update_spec(
        self,
        subject: str,
        spec_content: dict,
        user_id: str = "",
    ) -> AsyncAPISpec:
        """Met à jour manuellement une spec (passe is_auto_generated à False)."""

        result = self.db.upsert_asyncapi_spec(
            registry_id=self.registry_id,
            subject=subject,
            spec_content=spec_content,
            is_auto_generated=False,
            user_id=user_id,
        )

        if not result:
            raise ValueError("Failed to update AsyncAPI spec in database")

        spec = AsyncAPISpec(
            subject=subject,
            spec_content=spec_content,
            is_auto_generated=False,
            updated_at=datetime.now(timezone.utc),
        )

        await self.cache.set(
            self._cache_key(subject),
            spec.model_dump(mode="json"),
            ttl=self.CACHE_TTL,
        )

        logger.info(f"AsyncAPI spec manually updated for {subject}")
        return spec

    # =========================================================================
    # Overview (Dual Mode)
    # =========================================================================
    async def get_overview(self) -> "AsyncAPIOverviewResponse":
        """
        Build the AsyncAPI overview with two-tier drift detection.
        Tier 1: schema version comparison (fast, no extra fetch)
        Tier 2: hash comparison (only for version-matching documented subjects)
        """
        from app.models.asyncapi_overview import (
            AsyncAPIOverviewResponse,
            AsyncAPIOverviewKPIs,
            SubjectAsyncAPIStatus,
        )
 
        # ── 1. All subjects from provider ──
        try:
            subject_infos = await self.provider.list_subjects()
        except Exception as e:
            logger.error(f"Failed to list subjects from provider: {e}")
            subject_infos = []
 
        # Build lookup: subject → latest_version
        subject_versions: dict[str, int | None] = {}
        subjects: list[str] = []
        for si in subject_infos:
            subjects.append(si.subject)
            subject_versions[si.subject] = getattr(si, "latest_version", None)
 
        # ── 2. All enrichments (batch) ──
        enrichments_list = self.db.get_enrichments_for_registry(self.registry_id)
        enrichments_map: dict[str, dict] = {e["subject"]: e for e in enrichments_list}
 
        # ── 3. All AsyncAPI specs (batch) ──
        specs_list = self.db.get_asyncapi_specs_for_registry(self.registry_id)
        specs_map: dict[str, dict] = {s["subject"]: s for s in specs_list}
 
        # ── 4. All bound subject names (batch) ──
        bound_subjects: set[str] = self.db.get_bound_subjects_for_registry(self.registry_id)
 
        # ── 5. Tier 2: hash check for subjects where version matches ──
        # Only fetch schemas for documented subjects where we need hash verification
        subjects_needing_hash: list[str] = []
        for subject in subjects:
            spec = specs_map.get(subject)
            if not spec or not spec.get("source_schema_hash"):
                continue
            stored_version = spec.get("source_schema_version")
            current_version = subject_versions.get(subject)
            # Version matches (or no version info) but we have a hash → verify
            if stored_version is not None and current_version is not None:
                if stored_version == current_version:
                    subjects_needing_hash.append(subject)
 
        # Batch-fetch schemas for hash verification (only the few that need it)
        hash_results: dict[str, str] = {}
        for subject in subjects_needing_hash:
            try:
                schema_detail = await self.provider.get_schema(subject, "latest")
                hash_results[subject] = _compute_schema_hash(schema_detail.schema_content)
            except Exception as e:
                logger.warning(f"Failed to fetch schema for hash check: {subject}: {e}")
 
        # ── 6. Build per-subject status ──
        results: list[SubjectAsyncAPIStatus] = []
 
        for subject in subjects:
            enrichment = enrichments_map.get(subject)
            spec = specs_map.get(subject)
            has_bindings = subject in bound_subjects
 
            # — Origin —
            origin = None
            if spec:
                origin = "generated" if spec.get("is_auto_generated", True) else "imported"
 
            # — Status —
            if spec:
                status = "documented"
            elif enrichment and (enrichment.get("description") or has_bindings):
                status = "ready"
            else:
                status = "raw"
 
            # — Sync status (two-tier) —
            sync_status = None
            if spec:
                stored_version = spec.get("source_schema_version")
                current_version = subject_versions.get(subject)
                stored_hash = spec.get("source_schema_hash")
 
                if stored_version is not None and current_version is not None:
                    if stored_version != current_version:
                        # Tier 1: version mismatch → outdated
                        sync_status = "outdated"
                    elif subject in hash_results and stored_hash:
                        # Tier 2: version matches, compare hash
                        if hash_results[subject] == stored_hash:
                            sync_status = "in_sync"
                        else:
                            sync_status = "outdated"
                    elif stored_hash:
                        sync_status = "in_sync"  # version match, no hash to compare further
                    else:
                        sync_status = "unknown"
                else:
                    sync_status = "unknown"
 
            # — Spec metadata —
            spec_title = None
            asyncapi_version = None
            spec_updated_at = None
            spec_version = None
 
            if spec:
                spec_version = spec.get("spec_version")
                if spec.get("spec_content"):
                    content = spec["spec_content"]
                    if isinstance(content, dict):
                        asyncapi_version = content.get("asyncapi")
                        info = content.get("info", {})
                        if isinstance(info, dict):
                            spec_title = info.get("title")
                spec_updated_at = str(spec["updated_at"]) if spec.get("updated_at") else None
 
            results.append(
                SubjectAsyncAPIStatus(
                    subject=subject,
                    origin=origin,
                    status=status,
                    sync_status=sync_status,
                    asyncapi_version=asyncapi_version,
                    spec_title=spec_title,
                    spec_updated_at=spec_updated_at,
                    spec_version=spec_version,
                    has_enrichment=enrichment is not None,
                    has_description=bool(enrichment and enrichment.get("description")),
                    has_channels=has_bindings,
                    has_bindings=has_bindings,
                    description=enrichment.get("description") if enrichment else None,
                    owner_team=enrichment.get("owner_team") if enrichment else None,
                    data_layer=enrichment.get("data_layer") if enrichment else None,
                )
            )
 
        # ── 7. Compute KPIs ──
        total = len(results)
        documented = sum(1 for r in results if r.status == "documented")
        ready = sum(1 for r in results if r.status == "ready")
        raw = sum(1 for r in results if r.status == "raw")
        imported_count = sum(1 for r in results if r.origin == "imported")
        generated_count = sum(1 for r in results if r.origin == "generated")
        coverage_pct = round(documented / total * 100, 1) if total > 0 else 0.0
 
        return AsyncAPIOverviewResponse(
            kpis=AsyncAPIOverviewKPIs(
                total_subjects=total,
                documented=documented,
                ready=ready,
                raw=raw,
                imported=imported_count,
                generated=generated_count,
                coverage_pct=coverage_pct,
            ),
            subjects=results,
        )

    # =========================================================================
    # Governance Score Fetch
    # =========================================================================

    async def _fetch_governance_score(self, subject: str) -> dict | None:
        """Fetch governance score for a subject. Returns None if no rules configured."""
        try:
            from app.services.governance_rules_service import GovernanceRulesService
            service = GovernanceRulesService(
                cache=self.cache,
                db=self.db,
                registry_id=self.registry_id,
            )
            score = await service.compute_score(subject=subject)
            if not score or score.total_rules == 0:
                return None
            return {
                "score": score.score,
                "grade": score.grade,
                "rules": {
                    "total": score.total_rules,
                    "passing": score.passing,
                    "warning": score.warning,
                    "failing": score.failing,
                },
                "assessed_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.debug(f"No governance score for {subject}: {e}")
            return None

    # =========================================================================
    # Key Schema Detection
    # =========================================================================

    async def _try_fetch_key_schema(self, subject: str) -> SchemaDetail | None:
        """
        Tente de fetcher le key schema associé à un subject.

        Stratégie:
        - Si le subject se termine par -value → essaye -key
        - Si pas de suffixe → essaye subject-key
        - Si erreur (404) → retourne None silencieusement
        """
        key_subject = None

        if subject.endswith("-value"):
            key_subject = subject.replace("-value", "-key")
        elif not subject.endswith("-key"):
            key_subject = f"{subject}-key"

        if not key_subject:
            return None

        try:
            key_schema = await self.provider.get_schema(key_subject, "latest")
            logger.debug(f"Key schema found: {key_subject}")
            return key_schema
        except Exception:
            logger.debug(f"No key schema found for {key_subject} (expected for most topics)")
            return None

# =========================================================================
    # Server & Channel Bindings Builders (v2 — protocol-aware)
    # =========================================================================

    def _build_servers(
        self,
        channels: list[dict],
        params: AsyncAPIGenerateRequest,
        registry_name: str,
    ) -> dict:
        """Build servers section. One server per unique broker_type. Fallback: kafka."""
        if not channels:
            return {
                "production": {
                    "host": params.server_url or self.registry_url or "kafka:9092",
                    "protocol": "kafka-secure",
                    "description": f"Apache Kafka broker — via event7 registry {registry_name}",
                }
            }

        servers: dict = {}
        seen: set[str] = set()

        for ch in channels:
            bt = ch.get("broker_type", "kafka")
            if bt in seen:
                continue
            seen.add(bt)

            host = (
                params.server_url
                or ch.get("broker_config", {}).get("bootstrap_servers")
                or DEFAULT_HOST.get(bt, "localhost:9092")
            )

            server: dict = {
                "host": host,
                "protocol": BROKER_TO_PROTOCOL.get(bt, "kafka"),
                "description": (
                    f"{BROKER_SERVER_DESCRIPTION.get(bt, bt)} "
                    f"— via event7 registry {registry_name}"
                ),
                "x-broker-type": bt,  # Round-trip fidelity: protocol alone is ambiguous
            }

            sb = self._build_server_bindings(bt)
            if sb:
                server["bindings"] = sb

            servers[bt.replace("_", "-")] = server

        return servers

    def _build_server_bindings(self, broker_type: str) -> dict | None:
        """Server-level bindings per broker type."""
        if broker_type in ("kafka", "redpanda"):
            b: dict = {}
            if self.registry_url:
                b["schemaRegistryUrl"] = self.registry_url
            return {"kafka": b} if b else None
        if broker_type == "solace":
            return {"solace": {"msgVpn": "default"}}
        if broker_type in ("mqtt", "mqtt_secure"):
            return {"mqtt": {"cleanSession": True, "keepAlive": 60}}
        if broker_type == "pulsar":
            return {"pulsar": {"tenant": "public"}}
        return None

    def _build_channel_bindings_from_channel(self, channel: dict) -> dict:
        """
        Build AsyncAPI channel bindings from event7 channel data.
        Inverse of asyncapi_import_service._extract_broker_config().
        """
        bt = channel.get("broker_type", "kafka")
        bc = channel.get("broker_config", {})
        bk = BROKER_TO_BINDING_KEY.get(bt)

        if not bk:
            return {}

        bindings: dict = {}

        # ── Tier 1 ──

        if bt in ("kafka", "redpanda"):
            kb: dict = {"topic": channel.get("address", "")}
            if bc.get("partitions"):
                kb["partitions"] = bc["partitions"]
            if bc.get("replication_factor"):
                kb["replicas"] = bc["replication_factor"]
            tc: dict = {}
            if bc.get("retention_ms"):
                tc["retention.ms"] = bc["retention_ms"]
            if bc.get("cleanup_policy"):
                tc["cleanup.policy"] = bc["cleanup_policy"]
            if tc:
                kb["topicConfiguration"] = tc
            bindings["kafka"] = kb

        elif bt == "rabbitmq":
            ab: dict = {}
            if bc.get("exchange_type"):
                ab["exchange"] = {
                    "name": channel.get("address", ""),
                    "type": bc.get("exchange_type", "topic"),
                    "durable": bc.get("durable", True),
                    "autoDelete": bc.get("auto_delete", False),
                }
            if bc.get("queue_name"):
                ab["queue"] = {
                    "name": bc["queue_name"],
                    "durable": bc.get("queue_durable", True),
                    "exclusive": bc.get("queue_exclusive", False),
                }
            if bc.get("vhost"):
                ab["vhost"] = bc["vhost"]
            if ab:
                bindings["amqp"] = ab

        elif bt == "pulsar":
            pb: dict = {}
            if bc.get("tenant"):
                pb["tenant"] = bc["tenant"]
            if bc.get("namespace"):
                pb["namespace"] = bc["namespace"]
            if bc.get("persistence") is not None:
                pb["persistence"] = bc["persistence"]
            if bc.get("deduplication") is not None:
                pb["deduplication"] = bc["deduplication"]
            if pb:
                bindings["pulsar"] = pb

        elif bt == "nats":
            nb: dict = {}
            if bc.get("queue_group"):
                nb["queue"] = bc["queue_group"]
            if bc.get("stream_name"):
                nb["streamName"] = bc["stream_name"]
            if nb:
                bindings["nats"] = nb

        elif bt == "redis_streams":
            rb: dict = {}
            if bc.get("max_len"):
                rb["maxLen"] = bc["max_len"]
            if bc.get("consumer_group"):
                rb["groupName"] = bc["consumer_group"]
            if rb:
                bindings["redis"] = rb

        elif bt == "google_pubsub":
            gb: dict = {}
            if bc.get("ordering_key"):
                gb["orderingKey"] = bc["ordering_key"]
            if bc.get("retention_duration"):
                gb["messageRetentionDuration"] = bc["retention_duration"]
            if bc.get("schema_settings"):
                gb["schemaSettings"] = bc["schema_settings"]
            if gb:
                bindings["googlepubsub"] = gb

        elif bt == "aws_sns_sqs":
            sb: dict = {}
            if bc.get("fifo") is not None:
                sb["fifo"] = bc["fifo"]
            if bc.get("content_based_dedup") is not None:
                sb["contentBasedDeduplication"] = bc["content_based_dedup"]
            if sb:
                bindings["sns"] = sb

        elif bt == "azure_servicebus":
            asb: dict = {}
            if bc.get("subscription_name"):
                asb["subscriptionName"] = bc["subscription_name"]
            if bc.get("dead_letter") is not None:
                asb["deadLetterDestination"] = bc["dead_letter"]
            if asb:
                bindings["amqp"] = asb

        # ── Tier 2 — Enterprise & IoT ──

        elif bt == "solace":
            sol: dict = {}
            if bc.get("queue_name"):
                sol["queue"] = {
                    "name": bc["queue_name"],
                    "accessType": bc.get("access_type", "exclusive"),
                }
            if bc.get("topic_subscriptions"):
                sol["topicSubscriptions"] = bc["topic_subscriptions"]
            if bc.get("destination_type"):
                sol["destinationType"] = bc["destination_type"]
            if sol:
                bindings["solace"] = sol

        elif bt == "ibmmq":
            ib: dict = {}
            if bc.get("queue_name"):
                ib["queue"] = {"objectName": bc["queue_name"]}
            if bc.get("destination_type"):
                ib["destinationType"] = bc["destination_type"]
            if bc.get("max_msg_length"):
                ib["maxMsgLength"] = bc["max_msg_length"]
            if ib:
                bindings["ibmmq"] = ib

        elif bt == "activemq_artemis":
            jb: dict = {}
            if bc.get("destination_type"):
                jb["destinationType"] = bc.get("destination_type", "queue")
            if jb:
                bindings["jms"] = jb

        elif bt in ("mqtt", "mqtt_secure"):
            mb: dict = {}
            if bc.get("qos") is not None:
                mb["qos"] = bc["qos"]
            if bc.get("retain") is not None:
                mb["retain"] = bc["retain"]
            if mb:
                bindings["mqtt"] = mb

        elif bt in ("websocket", "websocket_secure"):
            wb: dict = {}
            if bc.get("method"):
                wb["method"] = bc["method"]
            if bc.get("query"):
                wb["query"] = bc["query"]
            if bc.get("headers"):
                wb["headers"] = bc["headers"]
            if wb:
                bindings["ws"] = wb

        elif bt == "anypoint_mq":
            aq: dict = {}
            if bc.get("destination_type"):
                aq["destinationType"] = bc.get("destination_type", "queue")
            if aq:
                bindings["anypointmq"] = aq

        elif bt == "mercure":
            bindings["mercure"] = {}

        elif bt == "stomp":
            st: dict = {}
            if bc.get("destination"):
                st["destination"] = bc["destination"]
            if st:
                bindings["stomp"] = st

        return bindings

    # =========================================================================
    # Spec Builder
    # =========================================================================

    def _build_spec(
        self,
        schema: SchemaDetail,
        key_schema: SchemaDetail | None,
        subject: str,
        enrichment: dict | None,
        references: list,
        channels: list[dict],
        gov_score: dict | None,
        params: AsyncAPIGenerateRequest,
    ) -> dict:
        """Construit la spec AsyncAPI 3.0 — protocol-aware, channel+governance enriched."""

        # --- Extract info from enrichment ---
        description = (
            params.description
            or (enrichment.get("description") if enrichment else None)
            or f"Events for {subject}"
        )
        title = params.title or self._subject_to_title(subject)
        owner = enrichment.get("owner_team", "unknown") if enrichment else "unknown"
        tags = enrichment.get("tags", []) if enrichment else []
        classification = (
            enrichment.get("classification", "internal") if enrichment else "internal"
        )

        # --- Derive names ---
        message_name = self._subject_to_message_name(subject)
        schema_name = self._subject_to_schema_name(subject)

        # --- Registry name for server descriptions ---
        registry_name = self.registry_url.split("//")[-1].split(".")[0] if self.registry_url else "event7"

        # --- Convert value schema ---
        message_payload = self._convert_schema(schema)
        message_payload["x-confluent-schema-id"] = schema.schema_id

        # --- Build message object ---
        message_obj: dict = {
            "name": message_name,
            "title": title,
            "summary": description,
            "contentType": self._format_to_content_type(schema.format),
            "payload": {
                "$ref": f"#/components/schemas/{schema_name}"
            },
        }

        # --- Determine dominant broker for message bindings ---
        dominant_broker = "kafka"
        if channels:
            broker_counts: dict[str, int] = {}
            for ch in channels:
                bt = ch.get("broker_type", "kafka")
                broker_counts[bt] = broker_counts.get(bt, 0) + 1
            dominant_broker = max(broker_counts, key=broker_counts.get)

        # --- Message bindings (Kafka Confluent Magic Byte — only for kafka/redpanda) ---
        if params.include_confluent_bindings and dominant_broker in ("kafka", "redpanda"):
            kafka_msg_binding: dict = {
                "schemaIdLocation": "payload",
                "schemaIdPayloadEncoding": "confluent",
            }
            if key_schema:
                key_schema_name = f"{message_name}Key"
                kafka_msg_binding["key"] = {
                    "$ref": f"#/components/schemas/{key_schema_name}"
                }
            else:
                kafka_msg_binding["key"] = {"type": "string"}
            message_obj["bindings"] = {"kafka": kafka_msg_binding}

        # --- Build info block ---
        info: dict = {
            "title": title,
            "version": f"{schema.version}.0.0",
            "description": description,
            "contact": {"name": owner},
            **({"tags": [{"name": str(tag)} for tag in tags if tag]} if tags else {}),
            "x-classification": classification,
            "x-schema-registry": {
                "subject": subject,
                "format": schema.format.value,
                "schema_id": schema.schema_id,
                "version": schema.version,
            },
        }

        # Governance metadata (only if rules exist)
        if gov_score:
            info["x-governance"] = gov_score

        # --- Build servers (protocol-aware from channels) ---
        servers = self._build_servers(channels, params, registry_name)

        # --- Build channels section ---
        channels_spec: dict = {}
        operations_spec: dict = {}

        if channels:
            # Channel-aware: one channel block per bound channel
            for ch in channels:
                ch_name = ch.get("name", "").lower().replace(" ", "-") or ch.get("address", "channel")
                ch_address = ch.get("address", "")
                ch_bindings = self._build_channel_bindings_from_channel(ch)

                channels_spec[ch_name] = {
                    "address": ch_address,
                    "description": ch.get("description") or description,
                    "messages": {
                        message_name: {
                            "$ref": f"#/components/messages/{message_name}"
                        }
                    },
                }
                if ch_bindings:
                    channels_spec[ch_name]["bindings"] = ch_bindings

                # Operations
                operations_spec[f"publish_{ch_name}"] = {
                    "action": "send",
                    "channel": {"$ref": f"#/channels/{ch_name}"},
                    "summary": f"Publish {title} events",
                    "messages": [{"$ref": f"#/channels/{ch_name}/messages/{message_name}"}],
                }
                operations_spec[f"subscribe_{ch_name}"] = {
                    "action": "receive",
                    "channel": {"$ref": f"#/channels/{ch_name}"},
                    "summary": f"Consume {title} events",
                    "messages": [{"$ref": f"#/channels/{ch_name}/messages/{message_name}"}],
                }
        else:
            # Fallback: v1 behavior (params-based Kafka)
            channel_name = self._subject_to_channel(subject)
            topic_name = params.topic_name or self._subject_to_topic(subject)

            fallback_bindings: dict = {"kafka": {"topic": topic_name}}
            if params.partitions is not None:
                fallback_bindings["kafka"]["partitions"] = params.partitions
            if params.replication_factor is not None:
                fallback_bindings["kafka"]["replicas"] = params.replication_factor

            channels_spec[channel_name] = {
                "address": topic_name,
                "description": description,
                "messages": {
                    message_name: {"$ref": f"#/components/messages/{message_name}"}
                },
                "bindings": fallback_bindings,
            }
            operations_spec[f"publish_{channel_name}"] = {
                "action": "send",
                "channel": {"$ref": f"#/channels/{channel_name}"},
                "summary": f"Publish {title} events",
                "messages": [{"$ref": f"#/channels/{channel_name}/messages/{message_name}"}],
            }
            operations_spec[f"subscribe_{channel_name}"] = {
                "action": "receive",
                "channel": {"$ref": f"#/channels/{channel_name}"},
                "summary": f"Consume {title} events",
                "messages": [{"$ref": f"#/channels/{channel_name}/messages/{message_name}"}],
            }

        # --- Assemble spec ---
        spec: dict = {
            "asyncapi": "3.0.0",
            "info": info,
            "servers": servers,
            "channels": channels_spec,
            "operations": operations_spec,
            "components": {
                "messages": {message_name: message_obj},
                "schemas": {schema_name: message_payload},
            },
        }

        # --- Add key schema to components ---
        if key_schema and params.include_confluent_bindings and dominant_broker in ("kafka", "redpanda"):
            key_schema_name = f"{message_name}Key"
            key_payload = self._convert_schema(key_schema)
            key_payload["x-confluent-schema-id"] = key_schema.schema_id
            spec["components"]["schemas"][key_schema_name] = key_payload

        # --- Add referenced schemas ---
        if references:
            spec["components"]["schemas"]["_references"] = {
                "description": "Referenced schemas",
                "x-references": [
                    {"name": ref.name, "subject": ref.subject, "version": ref.version}
                    for ref in references
                ],
            }

        # --- Add examples ---
        if params.include_examples:
            example = self._generate_example(schema)
            if example:
                spec["components"]["messages"][message_name]["examples"] = [
                    {"name": "sample", "payload": example}
                ]

        return spec
        
    # =========================================================================
    # Schema Conversion (Avro → JSON Schema, JSON Schema passthrough)
    # =========================================================================

    def _convert_schema(self, schema: SchemaDetail) -> dict:
        """Convertit un schema Avro ou JSON Schema en format AsyncAPI components/schemas."""
        content = schema.schema_content

        if schema.format == SchemaFormat.AVRO:
            return self._avro_to_jsonschema(content)
        elif schema.format == SchemaFormat.JSON_SCHEMA:
            return content
        elif schema.format == SchemaFormat.PROTOBUF:
            # Protobuf .proto definitions are not JSON Schema — wrap in a
            # multi-format schema object per AsyncAPI 3.0 spec
            return {
                "type": "object",
                "description": f"Protobuf schema (see x-raw-schema for .proto definition)",
                "x-schema-format": "protobuf",
                "x-raw-schema": content if isinstance(content, str) else str(content),
            }
        else:
            return content if isinstance(content, dict) else {"type": "object", "x-raw-schema": str(content)}

    def _avro_to_jsonschema(self, avro_schema: dict | str | list) -> dict:
        """Convertit un schema Avro en JSON Schema (pour le payload AsyncAPI)."""

        # Handle string primitive types
        if isinstance(avro_schema, str):
            return {"type": self._avro_type_to_json(avro_schema)}

        # Handle union types (e.g., ["null", "string"])
        if isinstance(avro_schema, list):
            non_null = [t for t in avro_schema if t != "null"]
            has_null = len(non_null) < len(avro_schema)

            if len(non_null) == 1:
                result = self._avro_to_jsonschema(non_null[0])
                if has_null:
                    result["x-avro-nullable"] = True
                return result
            else:
                return {
                    "oneOf": [self._avro_to_jsonschema(t) for t in non_null],
                    **({"x-avro-nullable": True} if has_null else {}),
                }

        # Handle dict types (record, enum, array, map, etc.)
        avro_type = avro_schema.get("type")

        if avro_type == "record":
            properties = {}
            required = []

            for field in avro_schema.get("fields", []):
                field_name = field["name"]
                field_type = field.get("type", "string")

                # Check if nullable (union with null)
                is_nullable = False
                if isinstance(field_type, list) and "null" in field_type:
                    is_nullable = True

                field_schema = self._avro_to_jsonschema(field_type)

                if field.get("doc"):
                    field_schema["description"] = field["doc"]
                if "default" in field:
                    field_schema["default"] = field["default"]

                properties[field_name] = field_schema

                if not is_nullable and "default" not in field:
                    required.append(field_name)

            result = {
                "type": "object",
                "properties": properties,
            }
            if required:
                result["required"] = required
            if avro_schema.get("doc"):
                result["description"] = avro_schema["doc"]
            if avro_schema.get("name"):
                result["x-avro-name"] = avro_schema["name"]
            if avro_schema.get("namespace"):
                result["x-avro-namespace"] = avro_schema["namespace"]
            return result

        if avro_type == "enum":
            return {
                "type": "string",
                "enum": avro_schema.get("symbols", []),
                "x-avro-name": avro_schema.get("name", ""),
            }

        if avro_type == "array":
            return {
                "type": "array",
                "items": self._avro_to_jsonschema(avro_schema.get("items", "string")),
            }

        if avro_type == "map":
            return {
                "type": "object",
                "additionalProperties": self._avro_to_jsonschema(
                    avro_schema.get("values", "string")
                ),
            }

        # Logical types
        logical_type = avro_schema.get("logicalType")
        if logical_type:
            return self._avro_logical_to_json(avro_type, logical_type)

        return {"type": self._avro_type_to_json(avro_type or "string")}

    @staticmethod
    def _avro_type_to_json(avro_type: str) -> str:
        mapping = {
            "null": "null",
            "boolean": "boolean",
            "int": "integer",
            "long": "integer",
            "float": "number",
            "double": "number",
            "bytes": "string",
            "string": "string",
        }
        return mapping.get(avro_type, "string")

    @staticmethod
    def _avro_logical_to_json(avro_type: str, logical_type: str) -> dict:
        if logical_type in ("timestamp-millis", "timestamp-micros"):
            return {"type": "string", "format": "date-time"}
        if logical_type == "date":
            return {"type": "string", "format": "date"}
        if logical_type in ("time-millis", "time-micros"):
            return {"type": "string", "format": "time"}
        if logical_type == "decimal":
            return {"type": "number", "format": "decimal"}
        if logical_type == "uuid":
            return {"type": "string", "format": "uuid"}
        return {"type": "string"}

    # =========================================================================
    # Example Generation
    # =========================================================================

    def _generate_example(self, schema: SchemaDetail) -> dict | None:
        """Génère un exemple basique depuis le schema."""
        content = schema.schema_content

        if schema.format == SchemaFormat.AVRO and content.get("type") == "record":
            return self._avro_example(content)
        elif schema.format == SchemaFormat.JSON_SCHEMA:
            return self._json_schema_example(content)
        return None

    def _avro_example(self, schema: dict) -> dict:
        """Génère un exemple depuis un schema Avro record."""
        example = {}
        for field in schema.get("fields", []):
            name = field["name"]
            if "default" in field and field["default"] is not None:
                example[name] = field["default"]
            else:
                example[name] = self._example_value_avro(field.get("type", "string"), name)
        return example

    def _example_value_avro(self, avro_type, field_name: str = ""):
        """Produit une valeur d'exemple pour un type Avro."""
        if isinstance(avro_type, list):
            # Union: pick first non-null
            non_null = [t for t in avro_type if t != "null"]
            if non_null:
                return self._example_value_avro(non_null[0], field_name)
            return None

        if isinstance(avro_type, dict):
            t = avro_type.get("type", "string")
            logical = avro_type.get("logicalType")
            if logical == "uuid":
                return "550e8400-e29b-41d4-a716-446655440000"
            if logical in ("timestamp-millis", "timestamp-micros"):
                return "2025-01-15T10:30:00Z"
            if logical == "date":
                return "2025-01-15"
            if logical in ("time-millis", "time-micros"):
                return "10:30:00"
            if t == "record":
                return self._avro_example(avro_type)
            if t == "enum":
                symbols = avro_type.get("symbols", [])
                return symbols[0] if symbols else "UNKNOWN"
            if t == "array":
                return []
            if t == "map":
                return {}
            return self._example_value_avro(t, field_name)

        return self._primitive_example(avro_type, field_name)

    def _json_schema_example(self, schema: dict) -> dict:
        """Génère un exemple depuis un JSON Schema."""
        example = {}
        for name, prop in schema.get("properties", {}).items():
            if "default" in prop:
                example[name] = prop["default"]
            elif "enum" in prop:
                example[name] = prop["enum"][0]
            elif prop.get("type") == "string":
                example[name] = self._primitive_example("string", name)
            elif prop.get("type") == "number":
                example[name] = 99.99
            elif prop.get("type") == "integer":
                example[name] = 42
            elif prop.get("type") == "boolean":
                example[name] = True
            elif prop.get("type") == "array":
                example[name] = []
            elif prop.get("type") == "object":
                example[name] = {}
            else:
                example[name] = "example"
        return example

    @staticmethod
    def _primitive_example(avro_type: str, field_name: str = "") -> object:
        """Valeur d'exemple pour un type primitif."""
        name_lower = field_name.lower()

        # Smart examples based on field name
        if "email" in name_lower:
            return "user@example.com"
        if "phone" in name_lower:
            return "+33612345678"
        if "name" in name_lower:
            return "John Doe"
        if "id" in name_lower:
            return "abc-123"
        if "url" in name_lower or "uri" in name_lower:
            return "https://example.com"
        if "country" in name_lower:
            return "FR"
        if "amount" in name_lower or "price" in name_lower:
            return 99.99
        if "count" in name_lower or "quantity" in name_lower:
            return 5

        mapping = {
            "string": "example-value",
            "int": 42,
            "long": 1234567890,
            "float": 3.14,
            "double": 3.14159,
            "boolean": True,
            "bytes": "base64data==",
            "null": None,
        }
        return mapping.get(avro_type, "example")

    # =========================================================================
    # Naming Helpers
    # =========================================================================

    @staticmethod
    def _subject_to_title(subject: str) -> str:
        """com.event7.orders.OrderPlaced-value → Order Placed"""
        name = subject.split(".")[-1]
        name = name.replace("-value", "").replace("-key", "")
        result = ""
        for i, c in enumerate(name):
            if c.isupper() and i > 0 and name[i - 1].islower():
                result += " "
            result += c
        return result

    @staticmethod
    def _subject_to_channel(subject: str) -> str:
        """com.event7.orders.OrderPlaced-value → orders.order-placed"""
        parts = subject.split(".")
        if len(parts) >= 3:
            domain = parts[-2]
            name = parts[-1].replace("-value", "").replace("-key", "")
            kebab = ""
            for i, c in enumerate(name):
                if c.isupper() and i > 0:
                    kebab += "-"
                kebab += c.lower()
            return f"{domain}.{kebab}"
        return subject.replace("-value", "").replace("-key", "")

    @staticmethod
    def _subject_to_topic(subject: str) -> str:
        """
        Infer the Kafka topic name from the subject.

        Standard Confluent TopicNameStrategy: topic name = subject without -value/-key suffix.
        For RecordNameStrategy subjects (no suffix), the subject itself is the best guess.
        """
        if subject.endswith("-value"):
            return subject[: -len("-value")]
        if subject.endswith("-key"):
            return subject[: -len("-key")]
        return subject

    @staticmethod
    def _subject_to_message_name(subject: str) -> str:
        """com.event7.orders.OrderPlaced-value → OrderPlaced"""
        name = subject.split(".")[-1]
        return name.replace("-value", "").replace("-key", "")

    @staticmethod
    def _subject_to_schema_name(subject: str) -> str:
        """com.event7.orders.OrderPlaced-value → OrderPlacedPayload"""
        name = subject.split(".")[-1]
        return name.replace("-value", "").replace("-key", "") + "Payload"

    @staticmethod
    def _format_to_content_type(fmt: SchemaFormat) -> str:
        """
        Returns the correct MIME content type for the schema format.
        Avro uses the standard Confluent content type with version.
        """
        mapping = {
            SchemaFormat.AVRO: "application/vnd.apache.avro+json;version=1.9.0",
            SchemaFormat.JSON_SCHEMA: "application/json",
            SchemaFormat.PROTOBUF: "application/protobuf",
        }
        return mapping.get(fmt, "application/json")