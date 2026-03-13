"""
event7 - AsyncAPI Import Service
Parses an AsyncAPI v3 spec and extracts channels, bindings, enrichments, schemas.
Supports preview (dry-run) and apply (persist).

Placement: backend/app/services/asyncapi_import_service.py
Design: Phase E — AsyncAPI bidirectional (import/export)

AsyncAPI v3 structure mapped to event7:
  info                    → spec metadata, enrichment descriptions
  servers.*               → broker_type, broker_config
  channels.*              → channels (address, bindings, description)
  channels.*.messages     → bindings (subject ↔ channel, schema_role)
  channels.*.bindings     → broker_config (kafka partitions, rabbitmq routing…)
  operations.*            → messaging_pattern (send/receive)
  components.schemas      → match against SR subjects / register if missing
  x-owner, x-tags, x-data-layer → enrichment extensions
"""

import re
from datetime import datetime, timezone

from loguru import logger

from app.cache.redis_cache import RedisCache
from app.db.base import DatabaseProvider
from app.models.asyncapi import (
    AsyncAPIImportRequest,
    AsyncAPIImportPreview,
    AsyncAPIImportResult,
    ImportedChannel,
    ImportedBinding,
    ImportedEnrichment,
    ImportedSchema,
    ImportEntityResult,
)
from app.providers.base import SchemaRegistryProvider


# ── Protocol → broker_type mapping ──

PROTOCOL_TO_BROKER: dict[str, str] = {
    "kafka": "kafka",
    "kafka-secure": "kafka",
    "amqp": "rabbitmq",
    "amqps": "rabbitmq",
    "mqtt": "custom",
    "mqtts": "custom",
    "nats": "nats",
    "pulsar": "pulsar",
    "redis": "redis_streams",
    "sns": "aws_sns_sqs",
    "sqs": "aws_sns_sqs",
    "googlepubsub": "google_pubsub",
    "servicebus": "azure_servicebus",
}

BROKER_TO_RESOURCE: dict[str, str] = {
    "kafka": "topic",
    "redpanda": "topic",
    "rabbitmq": "exchange",
    "pulsar": "topic",
    "nats": "subject",
    "google_pubsub": "topic",
    "aws_sns_sqs": "queue",
    "azure_servicebus": "queue",
    "redis_streams": "stream",
    "custom": "topic",
}

BROKER_TO_PATTERN: dict[str, str] = {
    "kafka": "topic_log",
    "redpanda": "topic_log",
    "rabbitmq": "pubsub",
    "pulsar": "topic_log",
    "nats": "pubsub",
    "google_pubsub": "pubsub",
    "aws_sns_sqs": "queue",
    "azure_servicebus": "queue",
    "redis_streams": "topic_log",
    "custom": "topic_log",
}


class AsyncAPIImportService:
    """
    Parses an AsyncAPI spec and extracts event7 entities.
    Two-phase: preview (dry-run) then apply (persist).
    """

    def __init__(
        self,
        provider: SchemaRegistryProvider,
        cache: RedisCache,
        db: DatabaseProvider,
        registry_id: str,
    ):
        self.provider = provider
        self.cache = cache
        self.db = db
        self.registry_id = registry_id

    # ================================================================
    # PREVIEW (dry-run)
    # ================================================================

    async def preview(self, request: AsyncAPIImportRequest) -> AsyncAPIImportPreview:
        """Parse the spec and return what would be created — nothing persisted."""
        spec = request.spec_content
        warnings: list[str] = []

        # ── Validate basic structure ──
        asyncapi_version = spec.get("asyncapi", "")
        if not asyncapi_version:
            warnings.append("Missing 'asyncapi' version field — assuming v3")
        elif not asyncapi_version.startswith("3"):
            warnings.append(f"Spec version is {asyncapi_version} — import optimized for v3, some fields may be missed")

        info = spec.get("info", {})
        servers = spec.get("servers", {})
        channels_spec = spec.get("channels", {})
        operations = spec.get("operations", {})
        components = spec.get("components", {})
        component_schemas = components.get("schemas", {})
        component_messages = components.get("messages", {})

        # ── Resolve default broker from servers ──
        default_broker = self._resolve_default_broker(servers)

        # ── Fetch existing subjects from SR ──
        try:
            existing_subjects = await self.provider.list_subjects()
            known_subjects = {s.subject for s in existing_subjects}
        except Exception as e:
            logger.warning(f"Could not list subjects from SR: {e}")
            known_subjects = set()
            warnings.append("Could not fetch subjects from registry — all schemas will show as 'unknown'")

        # ── Extract channels + bindings ──
        channels: list[ImportedChannel] = []
        bindings: list[ImportedBinding] = []
        enrichments: list[ImportedEnrichment] = []
        all_schema_refs: dict[str, dict] = {}  # subject_name → schema_content

        # Determine messaging pattern from operations
        channel_patterns = self._extract_patterns_from_operations(operations)

        for channel_id, channel_def in channels_spec.items():
            if not isinstance(channel_def, dict):
                continue

            address = channel_def.get("address", channel_id)
            description = channel_def.get("description")
            ch_bindings = channel_def.get("bindings", {})

            # Broker type from bindings or default server
            broker_type = self._detect_broker_from_bindings(ch_bindings) or default_broker
            resource_kind = BROKER_TO_RESOURCE.get(broker_type, "topic")
            messaging_pattern = BROKER_TO_PATTERN.get(broker_type, channel_patterns.get(channel_id, "topic_log"))

            # Broker config from channel bindings
            broker_config = self._extract_broker_config(ch_bindings, broker_type)

            # Extensions
            data_layer = channel_def.get("x-data-layer")
            owner = channel_def.get("x-owner")
            tags = channel_def.get("x-tags", [])

            # Channel name: prefer title, fallback to channel_id
            name = channel_def.get("title") or self._humanize(channel_id)

            channels.append(ImportedChannel(
                address=address,
                name=name,
                broker_type=broker_type,
                resource_kind=resource_kind,
                messaging_pattern=messaging_pattern,
                data_layer=data_layer,
                description=description,
                broker_config=broker_config,
            ))

            # ── Extract messages → bindings ──
            messages = channel_def.get("messages", {})
            for msg_id, msg_def in messages.items():
                if not isinstance(msg_def, dict):
                    continue

                subject_name, schema_content, schema_role, schema_format = self._resolve_message(
                    msg_id, msg_def, component_messages, component_schemas
                )
                if not subject_name:
                    warnings.append(f"Channel '{channel_id}' message '{msg_id}': could not resolve subject name")
                    continue

                found = subject_name in known_subjects
                bindings.append(ImportedBinding(
                    channel_address=address,
                    subject_name=subject_name,
                    schema_role=schema_role,
                    binding_strategy="channel_bound",
                    binding_origin="manual",
                    found_in_registry=found,
                ))

                if schema_content:
                    all_schema_refs[subject_name] = (schema_content, schema_format)

                # Enrichment from message-level extensions
                msg_desc = msg_def.get("description") or description
                msg_owner = msg_def.get("x-owner") or owner
                msg_tags = msg_def.get("x-tags", tags)
                msg_layer = msg_def.get("x-data-layer") or data_layer

                if msg_desc or msg_owner or msg_tags:
                    enrichments.append(ImportedEnrichment(
                        subject=subject_name,
                        description=msg_desc,
                        owner_team=msg_owner,
                        tags=msg_tags if isinstance(msg_tags, list) else [],
                        data_layer=msg_layer,
                    ))

        # ── Deduplicate enrichments (last wins per subject) ──
        enrichment_map: dict[str, ImportedEnrichment] = {}
        for e in enrichments:
            enrichment_map[e.subject] = e
        enrichments = list(enrichment_map.values())

        # ── Unknown schemas (in spec but not in SR) ──
        unknown_schemas: list[ImportedSchema] = []
        schemas_found = 0
        for subject_name, (schema_content, schema_format) in all_schema_refs.items():
            if subject_name in known_subjects:
                schemas_found += 1
            else:
                unknown_schemas.append(ImportedSchema(
                    subject_name=subject_name,
                    schema_content=schema_content,
                    format=schema_format,
                ))

        return AsyncAPIImportPreview(
            spec_title=info.get("title"),
            spec_version=info.get("version"),
            asyncapi_version=asyncapi_version,
            channels=channels,
            bindings=bindings,
            enrichments=enrichments,
            unknown_schemas=unknown_schemas,
            total_channels=len(channels),
            total_bindings=len(bindings),
            total_enrichments=len(enrichments),
            schemas_found=schemas_found,
            schemas_missing=len(unknown_schemas),
            warnings=warnings,
        )

    # ================================================================
    # APPLY (persist)
    # ================================================================

    async def apply(self, request: AsyncAPIImportRequest) -> AsyncAPIImportResult:
        """Parse and persist everything. Returns detailed results."""
        preview = await self.preview(request)
        spec = request.spec_content
        results: list[ImportEntityResult] = []
        warnings = list(preview.warnings)

        channels_created = 0
        bindings_created = 0
        enrichments_updated = 0
        schemas_registered = 0

        # ── 1. Register unknown schemas (if requested) ──
        if request.register_schemas and preview.unknown_schemas:
            for schema in preview.unknown_schemas:
                try:
                    content = schema.schema_content
                    # Ensure JSON Schema has $schema marker for provider format detection
                    if schema.format == "JSON" and isinstance(content, dict) and "$schema" not in content:
                        content = {"$schema": "http://json-schema.org/draft-07/schema#", **content}

                    await self.provider.create_schema(
                        subject=schema.subject_name,
                        schema=content,
                    )
                    schemas_registered += 1
                    results.append(ImportEntityResult(
                        entity_type="schema",
                        name=schema.subject_name,
                        status="created",
                        detail=f"Registered in SR ({schema.format})",
                    ))
                except Exception as e:
                    results.append(ImportEntityResult(
                        entity_type="schema",
                        name=schema.subject_name,
                        status="failed",
                        detail=str(e)[:200],
                    ))
                    warnings.append(f"Failed to register schema '{schema.subject_name}': {e}")

        # ── 2. Create channels ──
        channel_id_map: dict[str, str] = {}  # address → channel_id
        for ch in preview.channels:
            try:
                row = self.db.create_channel({
                    "registry_id": self.registry_id,
                    "name": ch.name,
                    "address": ch.address,
                    "broker_type": ch.broker_type,
                    "resource_kind": ch.resource_kind,
                    "messaging_pattern": ch.messaging_pattern,
                    "data_layer": ch.data_layer,
                    "description": ch.description,
                    "broker_config": ch.broker_config,
                    "is_auto_detected": False,
                })
                if row:
                    channel_id_map[ch.address] = str(row["id"])
                    channels_created += 1
                    results.append(ImportEntityResult(
                        entity_type="channel",
                        name=ch.address,
                        status="created",
                        detail=f"{ch.broker_type}/{ch.resource_kind}",
                    ))
                else:
                    results.append(ImportEntityResult(
                        entity_type="channel",
                        name=ch.address,
                        status="failed",
                        detail="DB returned null",
                    ))
            except Exception as e:
                err = str(e)
                if "unique" in err.lower() or "duplicate" in err.lower():
                    results.append(ImportEntityResult(
                        entity_type="channel",
                        name=ch.address,
                        status="skipped",
                        detail="Already exists",
                    ))
                else:
                    results.append(ImportEntityResult(
                        entity_type="channel",
                        name=ch.address,
                        status="failed",
                        detail=err[:200],
                    ))

        # ── 3. Create bindings ──
        for binding in preview.bindings:
            ch_id = channel_id_map.get(binding.channel_address)
            if not ch_id:
                results.append(ImportEntityResult(
                    entity_type="binding",
                    name=f"{binding.subject_name} → {binding.channel_address}",
                    status="skipped",
                    detail="Channel not created (may already exist)",
                ))
                continue

            # Skip if schema not in SR and register_schemas was not enabled
            if not binding.found_in_registry and not request.register_schemas:
                results.append(ImportEntityResult(
                    entity_type="binding",
                    name=f"{binding.subject_name} → {binding.channel_address}",
                    status="skipped",
                    detail="Subject not found in registry",
                ))
                warnings.append(f"Binding skipped: '{binding.subject_name}' not in SR")
                continue

            try:
                row = self.db.create_binding({
                    "channel_id": ch_id,
                    "subject_name": binding.subject_name,
                    "binding_strategy": binding.binding_strategy,
                    "schema_role": binding.schema_role,
                    "binding_origin": "manual",
                    "binding_status": "active" if binding.found_in_registry else "unverified",
                })
                if row:
                    bindings_created += 1
                    results.append(ImportEntityResult(
                        entity_type="binding",
                        name=f"{binding.subject_name} → {binding.channel_address}",
                        status="created",
                        detail=f"{binding.binding_strategy}/{binding.schema_role}",
                    ))
            except Exception as e:
                err = str(e)
                if "unique" in err.lower() or "duplicate" in err.lower():
                    results.append(ImportEntityResult(
                        entity_type="binding",
                        name=f"{binding.subject_name} → {binding.channel_address}",
                        status="skipped",
                        detail="Already exists",
                    ))
                else:
                    results.append(ImportEntityResult(
                        entity_type="binding",
                        name=f"{binding.subject_name} → {binding.channel_address}",
                        status="failed",
                        detail=err[:200],
                    ))

        # ── 4. Update enrichments ──
        for enr in preview.enrichments:
            try:
                payload: dict = {
                    "registry_id": self.registry_id,
                    "subject": enr.subject,
                }
                if enr.description:
                    payload["description"] = enr.description
                if enr.owner_team:
                    payload["owner_team"] = enr.owner_team
                if enr.tags:
                    payload["tags"] = enr.tags
                if enr.data_layer:
                    payload["data_layer"] = enr.data_layer

                self.db.upsert_enrichment(payload)
                enrichments_updated += 1
                results.append(ImportEntityResult(
                    entity_type="enrichment",
                    name=enr.subject,
                    status="updated",
                    detail=f"owner={enr.owner_team or '—'}, layer={enr.data_layer or '—'}",
                ))
            except Exception as e:
                results.append(ImportEntityResult(
                    entity_type="enrichment",
                    name=enr.subject,
                    status="failed",
                    detail=str(e)[:200],
                ))

        # ── 5. Store the full spec in asyncapi_specs (first subject or spec title) ──
        spec_stored = False
        spec_subject = preview.spec_title or "imported-spec"
        try:
            self.db.upsert_asyncapi_spec(
                registry_id=self.registry_id,
                subject=spec_subject,
                spec_content=spec,
                is_auto_generated=False,
            )
            spec_stored = True
            results.append(ImportEntityResult(
                entity_type="spec",
                name=spec_subject,
                status="created",
                detail="Full AsyncAPI spec stored",
            ))
        except Exception as e:
            results.append(ImportEntityResult(
                entity_type="spec",
                name=spec_subject,
                status="failed",
                detail=str(e)[:200],
            ))

        # ── 6. Surgical cache invalidation (keep warm cache intact) ──
        try:
            # Catalog view must be refreshed (enrichments changed)
            await self.cache.delete(
                self.cache.cache_key(self.registry_id, "catalog")
            )
            # Stored spec
            if spec_stored:
                await self.cache.delete(
                    self.cache.cache_key(self.registry_id, "asyncapi", spec_subject)
                )
            # Subject list only if new schemas were registered in SR
            if schemas_registered > 0:
                await self.cache.delete(
                    self.cache.cache_key(self.registry_id, "subjects")
                )
            logger.info(
                f"Cache invalidated: catalog"
                f"{' + asyncapi' if spec_stored else ''}"
                f"{' + subjects' if schemas_registered > 0 else ''}"
            )
        except Exception as e:
            logger.warning(f"Cache invalidation failed (non-blocking): {e}")
            warnings.append("Cache invalidation failed — data may take up to 5 min to refresh")
            
        logger.info(
            f"AsyncAPI import applied: {channels_created} channels, {bindings_created} bindings, "
            f"{enrichments_updated} enrichments, {schemas_registered} schemas"
        )

        return AsyncAPIImportResult(
            channels_created=channels_created,
            bindings_created=bindings_created,
            enrichments_updated=enrichments_updated,
            schemas_registered=schemas_registered,
            spec_stored=spec_stored,
            results=results,
            warnings=warnings,
        )

    # ================================================================
    # PARSING HELPERS
    # ================================================================

    def _resolve_default_broker(self, servers: dict) -> str:
        """Extract the default broker_type from the first server's protocol."""
        for server_id, server_def in servers.items():
            if not isinstance(server_def, dict):
                continue
            protocol = server_def.get("protocol", "").lower()
            if protocol in PROTOCOL_TO_BROKER:
                return PROTOCOL_TO_BROKER[protocol]
        return "kafka"  # safe default

    def _detect_broker_from_bindings(self, bindings: dict) -> str | None:
        """Detect broker_type from channel-level bindings keys."""
        for key in bindings:
            normalized = key.lower().replace("-", "")
            if "kafka" in normalized:
                return "kafka"
            if "amqp" in normalized or "rabbitmq" in normalized:
                return "rabbitmq"
            if "nats" in normalized:
                return "nats"
            if "pulsar" in normalized:
                return "pulsar"
            if "redis" in normalized:
                return "redis_streams"
            if "googlepubsub" in normalized:
                return "google_pubsub"
            if "sns" in normalized or "sqs" in normalized:
                return "aws_sns_sqs"
            if "servicebus" in normalized:
                return "azure_servicebus"
        return None

    def _extract_broker_config(self, bindings: dict, broker_type: str) -> dict:
        """Extract relevant broker config from channel bindings."""
        config: dict = {}

        kafka_binding = bindings.get("kafka", {})
        if kafka_binding:
            if "partitions" in kafka_binding:
                config["partitions"] = kafka_binding["partitions"]
            if "replicas" in kafka_binding:
                config["replication_factor"] = kafka_binding["replicas"]
            if "topicConfiguration" in kafka_binding:
                tc = kafka_binding["topicConfiguration"]
                if "retention.ms" in tc:
                    config["retention_ms"] = tc["retention.ms"]
                if "cleanup.policy" in tc:
                    config["cleanup_policy"] = tc["cleanup.policy"]

        amqp_binding = bindings.get("amqp", {})
        if amqp_binding:
            if "exchange" in amqp_binding:
                ex = amqp_binding["exchange"]
                config["exchange_type"] = ex.get("type", "topic")
                config["durable"] = ex.get("durable", True)

        return config

    def _extract_patterns_from_operations(self, operations: dict) -> dict[str, str]:
        """Map channel_id → messaging_pattern from operations."""
        patterns: dict[str, str] = {}
        for op_id, op_def in operations.items():
            if not isinstance(op_def, dict):
                continue
            action = op_def.get("action", "")
            channel_ref = op_def.get("channel", {})

            # Resolve channel_id from $ref
            if isinstance(channel_ref, dict):
                ref = channel_ref.get("$ref", "")
                channel_id = ref.split("/")[-1] if "/" in ref else ""
            elif isinstance(channel_ref, str):
                channel_id = channel_ref.split("/")[-1] if "/" in channel_ref else channel_ref
            else:
                continue

            if not channel_id:
                continue

            # Map action to pattern hint
            if action == "send":
                patterns.setdefault(channel_id, "topic_log")
            elif action == "receive":
                patterns.setdefault(channel_id, "topic_log")

        return patterns

    def _resolve_message(
        self,
        msg_id: str,
        msg_def: dict,
        component_messages: dict,
        component_schemas: dict,
    ) -> tuple[str | None, dict | None, str, str]:
        """
        Resolve a message definition to (subject_name, schema_content, schema_role, schema_format).
        Handles $ref resolution for both messages and schemas.
        """
        schema_role = "value"
        schema_format = "JSON"  # default

        # Resolve $ref if message is a reference
        if "$ref" in msg_def:
            ref_path = msg_def["$ref"]
            resolved = self._resolve_ref(ref_path, component_messages)
            if resolved:
                msg_def = resolved
            else:
                return None, None, schema_role, schema_format

        # Detect format from contentType
        content_type = (msg_def.get("contentType") or "").lower()
        if "avro" in content_type:
            schema_format = "AVRO"
        elif "protobuf" in content_type or "proto" in content_type:
            schema_format = "PROTOBUF"
        else:
            schema_format = "JSON"

        # Schema role from message ID convention
        if msg_id.endswith("Key") or msg_id.endswith("-key"):
            schema_role = "key"
        elif msg_id.endswith("Header") or msg_id.endswith("-header"):
            schema_role = "header"

        # Extract subject name
        subject_name = msg_def.get("x-subject") or msg_def.get("name")

        # Get payload schema
        payload = msg_def.get("payload", {})
        schema_content = None

        if "$ref" in payload:
            ref_path = payload["$ref"]
            schema_content = self._resolve_ref(ref_path, component_schemas)
            if not subject_name:
                subject_name = ref_path.split("/")[-1]
        elif isinstance(payload, dict) and payload:
            schema_content = payload
            if not subject_name:
                subject_name = payload.get("title") or payload.get("name") or msg_id

        return subject_name, schema_content, schema_role, schema_format

    def _resolve_ref(self, ref_path: str, components: dict) -> dict | None:
        """Resolve a $ref like '#/components/schemas/Order' to its definition."""
        if not ref_path.startswith("#/"):
            return None
        parts = ref_path.lstrip("#/").split("/")
        current: dict = components

        # Navigate from the last component (e.g., "schemas" dict → "Order")
        # $ref = #/components/schemas/Order → need just the key "Order" in component_schemas
        key = parts[-1] if parts else ""
        if key in components:
            return components[key]

        return None

    @staticmethod
    def _humanize(channel_id: str) -> str:
        """Convert channel ID to a human-readable name."""
        # "userSignupEvents" → "User Signup Events"
        # "order-created" → "Order Created"
        name = channel_id.replace("-", " ").replace("_", " ").replace(".", " ")
        # CamelCase split
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
        return name.title().strip()