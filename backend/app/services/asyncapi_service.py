"""
event7 - AsyncAPI Service
Génère des specs AsyncAPI 3.0 à partir des schemas + enrichments.
Supporte Avro et JSON Schema.

Placement: backend/app/services/asyncapi_service.py

Corrections P1 vs version précédente:
- Cache Redis sur get_spec() et generate()
- Accès DB délégué à SupabaseClient (plus d'accès direct .client.table())
- user_id propagé dans les mutations (cohérence P0 auth)
- Méthodes get_spec / update_spec passées en async pour cohérence
"""

import json
from datetime import datetime, timezone

from loguru import logger

from app.cache.redis_cache import RedisCache
from app.db.supabase_client import SupabaseClient
from app.models.asyncapi import AsyncAPISpec, AsyncAPIGenerateRequest
from app.models.schema import SchemaDetail, SchemaFormat
from app.providers.base import SchemaRegistryProvider


class AsyncAPIService:
    """
    Génère et gère les specs AsyncAPI.
    Combine les données du provider (schema) avec les enrichissements Supabase.
    """

    CACHE_TTL = 300  # 5 minutes, cohérent avec le reste de l'app

    def __init__(
        self,
        provider: SchemaRegistryProvider,
        cache: RedisCache,
        db: SupabaseClient,
        registry_id: str,
        registry_url: str = "",
    ):
        self.provider = provider
        self.cache = cache
        self.db = db
        self.registry_id = registry_id
        self.registry_url = registry_url

    # === Cache helpers ===

    def _cache_key(self, subject: str) -> str:
        return f"event7:{self.registry_id}:asyncapi:{subject}"

    # === Generate ===

    async def generate(
        self,
        subject: str,
        params: AsyncAPIGenerateRequest | None = None,
        user_id: str = "",
    ) -> AsyncAPISpec:
        """
        Génère une spec AsyncAPI 3.0 complète depuis un schema + enrichments.
        """
        params = params or AsyncAPIGenerateRequest()

        # 1. Fetch schema from provider
        schema = await self.provider.get_schema(subject, "latest")

        # 2. Fetch enrichment from Supabase (méthode dédiée du client)
        enrichment = self.db.get_enrichment(self.registry_id, subject)

        # 3. Fetch references
        references = await self.provider.get_references(subject)

        # 4. Build spec
        spec_content = self._build_spec(
            schema=schema,
            subject=subject,
            enrichment=enrichment,
            references=references,
            params=params,
        )

        # 5. Store in Supabase via méthode dédiée
        self.db.upsert_asyncapi_spec(
            registry_id=self.registry_id,
            subject=subject,
            spec_content=spec_content,
            is_auto_generated=True,
            user_id=user_id,
        )

        # 6. Invalide le cache pour ce subject
        await self.cache.delete(self._cache_key(subject))

        result = AsyncAPISpec(
            subject=subject,
            spec_content=spec_content,
            is_auto_generated=True,
            updated_at=datetime.now(timezone.utc),
        )

        # 7. Met en cache le résultat frais
        await self.cache.set(
            self._cache_key(subject),
            result.model_dump(mode="json"),
            ttl=self.CACHE_TTL,
        )

        logger.info(f"AsyncAPI spec generated for {subject}")
        return result

    # === Get ===

    async def get_spec(self, subject: str) -> AsyncAPISpec | None:
        """Récupère une spec existante (cache → Supabase)."""

        # 1. Check cache
        cached = await self.cache.get(self._cache_key(subject))
        if cached:
            logger.debug(f"AsyncAPI cache hit for {subject}")
            return AsyncAPISpec(**cached)

        # 2. Fetch from Supabase
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

    # === Update ===

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

        # Invalide + remet en cache
        await self.cache.set(
            self._cache_key(subject),
            spec.model_dump(mode="json"),
            ttl=self.CACHE_TTL,
        )

        logger.info(f"AsyncAPI spec manually updated for {subject}")
        return spec

    # =========================================================================
    # Spec Builder
    # =========================================================================

    def _build_spec(
        self,
        schema: SchemaDetail,
        subject: str,
        enrichment: dict | None,
        references: list,
        params: AsyncAPIGenerateRequest,
    ) -> dict:
        """Construit la spec AsyncAPI 3.0."""

        # Extract info from enrichment
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

        # Channel name from subject
        channel_name = self._subject_to_channel(subject)

        # Convert schema to AsyncAPI-compatible format
        message_payload = self._convert_schema(schema)

        # Build the spec
        spec = {
            "asyncapi": "3.0.0",
            "info": {
                "title": title,
                "version": f"{schema.version}.0.0",
                "description": description,
                "contact": {
                    "name": owner,
                },
                "tags": [{"name": tag} for tag in tags],
                "x-classification": classification,
                "x-schema-registry": {
                    "subject": subject,
                    "format": schema.format.value,
                    "schema_id": schema.schema_id,
                    "version": schema.version,
                },
            },
            "servers": {
                "production": {
                    "host": params.server_url or self.registry_url or "kafka:9092",
                    "protocol": "kafka",
                    "description": "Kafka broker",
                }
            },
            "channels": {
                channel_name: {
                    "address": channel_name,
                    "description": description,
                    "messages": {
                        self._subject_to_message_name(subject): {
                            "$ref": f"#/components/messages/{self._subject_to_message_name(subject)}"
                        }
                    },
                }
            },
            "operations": {
                f"publish_{channel_name}": {
                    "action": "send",
                    "channel": {"$ref": f"#/channels/{channel_name}"},
                    "summary": f"Publish {title} events",
                    "messages": [
                        {
                            "$ref": f"#/channels/{channel_name}/messages/{self._subject_to_message_name(subject)}"
                        }
                    ],
                },
                f"subscribe_{channel_name}": {
                    "action": "receive",
                    "channel": {"$ref": f"#/channels/{channel_name}"},
                    "summary": f"Consume {title} events",
                    "messages": [
                        {
                            "$ref": f"#/channels/{channel_name}/messages/{self._subject_to_message_name(subject)}"
                        }
                    ],
                },
            },
            "components": {
                "messages": {
                    self._subject_to_message_name(subject): {
                        "name": self._subject_to_message_name(subject),
                        "title": title,
                        "summary": description,
                        "contentType": self._format_to_content_type(schema.format),
                        "payload": {
                            "$ref": f"#/components/schemas/{self._subject_to_schema_name(subject)}"
                        },
                    }
                },
                "schemas": {
                    self._subject_to_schema_name(subject): message_payload,
                },
            },
        }

        # Add referenced schemas to components
        if references:
            spec["components"]["schemas"]["_references"] = {
                "description": "Referenced schemas",
                "x-references": [
                    {
                        "name": ref.name,
                        "subject": ref.subject,
                        "version": ref.version,
                    }
                    for ref in references
                ],
            }

        # Add examples if requested
        if params.include_examples:
            example = self._generate_example(schema)
            if example:
                spec["components"]["messages"][self._subject_to_message_name(subject)][
                    "examples"
                ] = [{"name": "sample", "payload": example}]

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
        else:
            return content

    def _avro_to_jsonschema(self, avro_schema: dict) -> dict:
        """Convertit un schema Avro en JSON Schema (pour le payload AsyncAPI)."""
        if isinstance(avro_schema, str):
            return {"type": self._avro_type_to_json(avro_schema)}

        if isinstance(avro_schema, list):
            # Union type
            types = [self._avro_to_jsonschema(t) for t in avro_schema if t != "null"]
            is_nullable = "null" in avro_schema
            if len(types) == 1:
                result = types[0]
                if is_nullable:
                    result["nullable"] = True
                return result
            return {"oneOf": types}

        avro_type = avro_schema.get("type")

        if avro_type == "record":
            properties = {}
            required = []
            for field in avro_schema.get("fields", []):
                field_name = field["name"]
                field_schema = self._avro_to_jsonschema(field.get("type", "string"))

                if field.get("doc"):
                    field_schema["description"] = field["doc"]
                if "default" in field and field["default"] is not None:
                    field_schema["default"] = field["default"]

                properties[field_name] = field_schema

                # Required if no default and not nullable
                field_type = field.get("type")
                is_nullable = isinstance(field_type, list) and "null" in field_type
                has_default = "default" in field
                if not is_nullable and not has_default:
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
        if isinstance(avro_type, str):
            return self._primitive_example(avro_type, field_name)
        if isinstance(avro_type, list):
            non_null = [t for t in avro_type if t != "null"]
            if non_null:
                return self._example_value_avro(non_null[0], field_name)
            return None
        if isinstance(avro_type, dict):
            t = avro_type.get("type")
            if t == "enum":
                symbols = avro_type.get("symbols", [])
                return symbols[0] if symbols else "UNKNOWN"
            if t == "array":
                return [self._example_value_avro(avro_type.get("items", "string"))]
            if t == "record":
                return self._avro_example(avro_type)
            if avro_type.get("logicalType") in ("timestamp-millis", "timestamp-micros"):
                return "2026-01-15T10:30:00Z"
            if avro_type.get("logicalType") == "decimal":
                return 99.99
            return self._primitive_example(t or "string", field_name)
        return "example"

    @staticmethod
    def _primitive_example(avro_type: str, field_name: str = ""):
        examples_by_name = {
            "email": "john.doe@example.com",
            "phone": "+33612345678",
            "first_name": "John",
            "last_name": "Doe",
            "name": "Example Product",
            "city": "Paris",
            "country": "FR",
            "street": "42 rue de Rivoli",
            "zip_code": "75001",
            "currency": "EUR",
            "product_name": "Widget Pro",
        }
        if field_name in examples_by_name:
            return examples_by_name[field_name]

        if "_id" in field_name:
            return "550e8400-e29b-41d4-a716-446655440000"

        mapping = {
            "string": "example_string",
            "int": 42,
            "long": 1234567890,
            "float": 3.14,
            "double": 3.14159,
            "boolean": True,
            "bytes": "base64data",
            "null": None,
        }
        return mapping.get(avro_type, "example")

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
        mapping = {
            SchemaFormat.AVRO: "application/vnd.apache.avro+json",
            SchemaFormat.JSON_SCHEMA: "application/json",
            SchemaFormat.PROTOBUF: "application/protobuf",
        }
        return mapping.get(fmt, "application/json")