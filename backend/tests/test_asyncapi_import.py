#!/usr/bin/env python3
"""
event7 — AsyncAPI Import Test Suite
Placement: backend/tests/test_asyncapi_import.py

Loads the 7 AsyncAPI v3 fixture files, calls preview() on each,
and validates the expected channels, bindings, enrichments, broker types,
and schema matching against mocked Apicurio seed subjects.

Usage:
  cd backend
  python -m pytest tests/test_asyncapi_import.py -v
"""

import json
import os
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml

# ── Pre-patch app.main before any app import ──
_fake_main = ModuleType("app.main")
_fake_main.redis_cache = MagicMock()
_fake_main.db_client = MagicMock()
sys.modules.setdefault("app.main", _fake_main)

from app.models.asyncapi import AsyncAPIImportRequest
from app.services.asyncapi_import_service import (
    AsyncAPIImportService,
    PROTOCOL_TO_BROKER,
    BROKER_TO_RESOURCE,
    BROKER_TO_PATTERN,
)

# ── Apicurio seed subjects (from scripts/seed_apicurio.py) ──
APICURIO_SUBJECTS = {
    "com.event7.Address",
    "com.event7.User",
    "com.event7.Customer",
    "com.event7.Order",
    "com.event7.OrderLine",
    "com.event7.Shipment",
    "com.event7.Payment",
    "com.event7.Inventory",
    "com.event7.ProductCatalog",
}

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "asyncapi_import"


# ── Helpers ──

def _load_yaml(filename: str) -> dict:
    """Load a YAML fixture file."""
    filepath = FIXTURES_DIR / filename
    assert filepath.exists(), f"Fixture not found: {filepath}"
    with open(filepath, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _make_subject_info(subject: str):
    """Create a minimal SubjectInfo-like object for the mock."""
    mock = MagicMock()
    mock.subject = subject
    return mock


def _make_service() -> AsyncAPIImportService:
    """Create an AsyncAPIImportService with mocked dependencies."""
    provider = AsyncMock()
    provider.list_subjects.return_value = [
        _make_subject_info(s) for s in APICURIO_SUBJECTS
    ]

    cache = MagicMock()
    db = MagicMock()

    return AsyncAPIImportService(
        provider=provider,
        cache=cache,
        db=db,
        registry_id="test-registry-001",
    )


# ================================================================
# 01 — Kafka TNS (TopicNameStrategy)
# ================================================================

@pytest.mark.asyncio
async def test_01_kafka_tns():
    """Kafka TNS: 4 channels, 5 bindings (4 value + 1 key), 4 data layers."""
    spec = _load_yaml("01_kafka_tns.yaml")
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)

    preview = await service.preview(request)

    # Basic spec info
    assert preview.spec_title == "E-Commerce Platform — Kafka TNS"
    assert preview.asyncapi_version == "3.0.0"

    # Channels: 4 (raw, core, refined, application)
    assert preview.total_channels == 4
    channels_by_addr = {ch.address: ch for ch in preview.channels}

    # RAW channel
    raw = channels_by_addr["corp.dev.ecom.kafka.raw.orders.v1.log"]
    assert raw.broker_type == "kafka"
    assert raw.resource_kind == "topic"
    assert raw.messaging_pattern == "topic_log"
    assert raw.data_layer == "raw"
    assert raw.broker_config.get("partitions") == 12
    assert raw.broker_config.get("replication_factor") == 3
    assert raw.broker_config.get("retention_ms") == 604800000

    # CORE channel
    core = channels_by_addr["ecom.orders.OrderCreated.v1"]
    assert core.data_layer == "core"
    assert core.broker_config.get("cleanup_policy") == "compact"

    # REFINED channel
    refined = channels_by_addr["ecom.orders.OrderCreated.agg.daily.v1"]
    assert refined.data_layer == "refined"

    # APPLICATION channel
    app = channels_by_addr["dashboard.ecom.OrderSummary.v1"]
    assert app.data_layer == "application"

    # Bindings: 5 messages across 4 channels
    assert preview.total_bindings == 5

    binding_subjects = {b.subject_name for b in preview.bindings}

    # Key schema detection
    key_bindings = [b for b in preview.bindings if b.schema_role == "key"]
    assert len(key_bindings) == 1
    assert key_bindings[0].subject_name == "corp.dev.ecom.kafka.raw.orders.v1.log-key"

    # com.event7.Order should match Apicurio
    order_binding = [b for b in preview.bindings if b.subject_name == "com.event7.Order"]
    assert len(order_binding) == 1
    assert order_binding[0].found_in_registry is True

    # Unknown schemas (not in Apicurio): RawOrderEvent, RawOrderKey, OrderDailyAggregation, OrderSummaryView
    assert preview.schemas_found == 1  # com.event7.Order
    assert preview.schemas_missing == 4

    # Enrichments
    assert preview.total_enrichments >= 4

    # No warnings (clean spec)
    # (warnings may include info about unresolvable schemas — not errors)
    print(f"  [01] channels={preview.total_channels}, bindings={preview.total_bindings}, "
          f"enrichments={preview.total_enrichments}, found={preview.schemas_found}, "
          f"missing={preview.schemas_missing}, warnings={len(preview.warnings)}")


# ================================================================
# 02 — Kafka RNS (RecordNameStrategy)
# ================================================================

@pytest.mark.asyncio
async def test_02_kafka_rns():
    """Kafka RNS: 1 channel, 3 bindings (all existing in Apicurio)."""
    spec = _load_yaml("02_kafka_rns.yaml")
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)

    preview = await service.preview(request)

    assert preview.spec_title == "Customer Domain — Kafka RNS"

    # Single topic carries 3 schemas
    assert preview.total_channels == 1
    ch = preview.channels[0]
    assert ch.address == "corp.prod.customer.domain.events"
    assert ch.broker_type == "kafka"
    assert ch.data_layer == "core"

    # 3 bindings — all referencing existing Apicurio subjects
    assert preview.total_bindings == 3
    for binding in preview.bindings:
        assert binding.found_in_registry is True, f"{binding.subject_name} should be in Apicurio"

    binding_subjects = {b.subject_name for b in preview.bindings}
    assert binding_subjects == {"com.event7.Customer", "com.event7.Address", "com.event7.User"}

    # All schemas found, none missing
    assert preview.schemas_found == 3
    assert preview.schemas_missing == 0

    # Enrichments for all 3 subjects
    assert preview.total_enrichments == 3

    print(f"  [02] channels={preview.total_channels}, bindings={preview.total_bindings}, "
          f"enrichments={preview.total_enrichments}, found={preview.schemas_found}, "
          f"missing={preview.schemas_missing}")


# ================================================================
# 03 — RabbitMQ (AMQP)
# ================================================================

@pytest.mark.asyncio
async def test_03_rabbitmq():
    """RabbitMQ: 3 exchanges (topic/direct/fanout), AMQP bindings."""
    spec = _load_yaml("03_rabbitmq.yaml")
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)

    preview = await service.preview(request)

    assert preview.spec_title == "Notification Service — RabbitMQ"

    # 3 channels (exchanges)
    assert preview.total_channels == 3
    for ch in preview.channels:
        assert ch.broker_type == "rabbitmq"
        assert ch.resource_kind == "exchange"
        # BROKER_TO_PATTERN takes priority: rabbitmq → pubsub
        assert ch.messaging_pattern == "pubsub"

    # Check AMQP broker_config extraction
    channels_by_addr = {ch.address: ch for ch in preview.channels}
    email_ch = channels_by_addr["notifications.email"]
    assert email_ch.broker_config.get("exchange_type") == "topic"
    assert email_ch.broker_config.get("durable") is True

    sms_ch = channels_by_addr["notifications.sms"]
    assert sms_ch.broker_config.get("exchange_type") == "direct"

    # 3 bindings — all unknown schemas (not in Apicurio)
    assert preview.total_bindings == 3
    assert preview.schemas_found == 0
    assert preview.schemas_missing == 3

    print(f"  [03] channels={preview.total_channels}, bindings={preview.total_bindings}, "
          f"broker_configs={[ch.broker_config for ch in preview.channels]}, "
          f"missing={preview.schemas_missing}")


# ================================================================
# 04 — Pulsar
# ================================================================

@pytest.mark.asyncio
async def test_04_pulsar():
    """Pulsar: 3 persistent topics, multi-tenant namespace addressing."""
    spec = _load_yaml("04_pulsar.yaml")
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)

    preview = await service.preview(request)

    assert preview.spec_title == "IoT Telemetry Platform — Apache Pulsar"

    # 3 channels
    assert preview.total_channels == 3
    for ch in preview.channels:
        assert ch.broker_type == "pulsar"
        assert ch.resource_kind == "topic"
        assert ch.messaging_pattern == "topic_log"

    # Verify persistent topic addresses
    addresses = {ch.address for ch in preview.channels}
    assert "persistent://iot/telemetry/device-metrics" in addresses
    assert "persistent://iot/alerts/device-alerts" in addresses

    # 3 bindings — all unknown (no Apicurio match)
    assert preview.total_bindings == 3
    assert preview.schemas_found == 0
    assert preview.schemas_missing == 3

    # Enrichments with layers
    layers = {e.data_layer for e in preview.enrichments if e.data_layer}
    assert "raw" in layers
    assert "core" in layers

    print(f"  [04] channels={preview.total_channels}, bindings={preview.total_bindings}, "
          f"layers={layers}")


# ================================================================
# 05 — NATS
# ================================================================

@pytest.mark.asyncio
async def test_05_nats():
    """NATS: 3 channels, 2 subjects matching Apicurio (Payment, Inventory)."""
    spec = _load_yaml("05_nats.yaml")
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)

    preview = await service.preview(request)

    assert preview.spec_title == "Microservices Bus — NATS JetStream"

    # 3 channels
    assert preview.total_channels == 3
    for ch in preview.channels:
        assert ch.broker_type == "nats"
        assert ch.resource_kind == "subject"
        # BROKER_TO_PATTERN takes priority: nats → pubsub
        assert ch.messaging_pattern == "pubsub"

    # 4 bindings total (user-events has 2 messages)
    assert preview.total_bindings == 4

    # Payment and Inventory match Apicurio via x-subject
    found_subjects = {b.subject_name for b in preview.bindings if b.found_in_registry}
    assert "com.event7.Payment" in found_subjects
    assert "com.event7.Inventory" in found_subjects
    assert preview.schemas_found == 2
    assert preview.schemas_missing == 2  # UserCreated, UserUpdated

    print(f"  [05] channels={preview.total_channels}, bindings={preview.total_bindings}, "
          f"found={found_subjects}, missing={preview.schemas_missing}")


# ================================================================
# 06 — Google Pub/Sub
# ================================================================

@pytest.mark.asyncio
async def test_06_google_pubsub():
    """Google Pub/Sub: 3 topics, googlepubsub protocol detection."""
    spec = _load_yaml("06_google_pubsub.yaml")
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)

    preview = await service.preview(request)

    assert preview.spec_title == "Data Pipeline — Google Cloud Pub/Sub"

    # 3 channels
    assert preview.total_channels == 3
    for ch in preview.channels:
        assert ch.broker_type == "google_pubsub"
        assert ch.resource_kind == "topic"
        # BROKER_TO_PATTERN takes priority: google_pubsub → pubsub
        assert ch.messaging_pattern == "pubsub"

    # Data layers
    channels_by_addr = {ch.address: ch for ch in preview.channels}
    raw_ch = channels_by_addr["projects/my-company-prod/topics/raw-data-ingestion"]
    assert raw_ch.data_layer == "raw"

    refined_ch = channels_by_addr["projects/my-company-prod/topics/enriched-customer-data"]
    assert refined_ch.data_layer == "refined"

    # All schemas unknown (no Apicurio match)
    assert preview.total_bindings == 3
    assert preview.schemas_found == 0
    assert preview.schemas_missing == 3

    print(f"  [06] channels={preview.total_channels}, bindings={preview.total_bindings}, "
          f"broker={preview.channels[0].broker_type}")


# ================================================================
# 07 — Redis Streams
# ================================================================

@pytest.mark.asyncio
async def test_07_redis_streams():
    """Redis Streams: 4 channels, 1 Apicurio match (Shipment)."""
    spec = _load_yaml("07_redis_streams.yaml")
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)

    preview = await service.preview(request)

    assert preview.spec_title == "Real-Time Cache Sync — Redis Streams"

    # 4 channels
    assert preview.total_channels == 4
    for ch in preview.channels:
        assert ch.broker_type == "redis_streams"
        assert ch.resource_kind == "stream"
        assert ch.messaging_pattern == "topic_log"

    # Shipment matches Apicurio via x-subject
    shipment_binding = [b for b in preview.bindings if b.subject_name == "com.event7.Shipment"]
    assert len(shipment_binding) == 1
    assert shipment_binding[0].found_in_registry is True

    assert preview.schemas_found == 1  # Shipment
    assert preview.schemas_missing == 3  # ProductInvalidation, SessionEvent, PriceUpdate

    # 4 bindings
    assert preview.total_bindings == 4

    # Enrichments with diverse layers
    layers = {e.data_layer for e in preview.enrichments if e.data_layer}
    assert layers == {"application", "core", "refined"}

    print(f"  [07] channels={preview.total_channels}, bindings={preview.total_bindings}, "
          f"found={preview.schemas_found}, missing={preview.schemas_missing}, "
          f"layers={layers}")


# ================================================================
# Cross-cutting: protocol → broker_type mapping table
# ================================================================

@pytest.mark.asyncio
async def test_protocol_broker_mapping_coverage():
    """Verify all 7 fixtures cover different broker_types."""
    all_broker_types = set()
    service = _make_service()

    for filename in sorted(FIXTURES_DIR.glob("*.yaml")):
        spec = yaml.safe_load(filename.read_text())
        request = AsyncAPIImportRequest(spec_content=spec)
        preview = await service.preview(request)
        for ch in preview.channels:
            all_broker_types.add(ch.broker_type)

    expected = {"kafka", "rabbitmq", "pulsar", "nats", "google_pubsub", "redis_streams"}
    assert expected.issubset(all_broker_types), (
        f"Missing broker types: {expected - all_broker_types}"
    )

    print(f"\n  All broker_types covered: {sorted(all_broker_types)}")


# ================================================================
# Cross-cutting: total Apicurio matches across all specs
# ================================================================

@pytest.mark.asyncio
async def test_total_apicurio_matches():
    """Verify cumulative Apicurio subject matches across all specs."""
    all_found = set()
    all_missing = set()
    service = _make_service()

    for filename in sorted(FIXTURES_DIR.glob("*.yaml")):
        spec = yaml.safe_load(filename.read_text())
        request = AsyncAPIImportRequest(spec_content=spec)
        preview = await service.preview(request)
        for b in preview.bindings:
            if b.found_in_registry:
                all_found.add(b.subject_name)
            else:
                all_missing.add(b.subject_name)

    # Expected Apicurio matches across all specs:
    # 01: com.event7.Order
    # 02: com.event7.Customer, com.event7.Address, com.event7.User
    # 05: com.event7.Payment, com.event7.Inventory
    # 07: com.event7.Shipment
    expected_found = {
        "com.event7.Order",
        "com.event7.Customer",
        "com.event7.Address",
        "com.event7.User",
        "com.event7.Payment",
        "com.event7.Inventory",
        "com.event7.Shipment",
    }
    assert expected_found == all_found, (
        f"Found mismatch.\n  Expected: {expected_found}\n  Got: {all_found}"
    )

    print(f"\n  Apicurio matches: {len(all_found)} subjects = {sorted(all_found)}")
    print(f"  Unknown schemas:  {len(all_missing)} subjects = {sorted(all_missing)}")


# ================================================================
# Edge case: spec without servers block (defaults to kafka)
# ================================================================

@pytest.mark.asyncio
async def test_missing_servers_defaults_to_kafka():
    """Spec without servers block should default broker_type to kafka."""
    spec = {
        "asyncapi": "3.0.0",
        "info": {"title": "Minimal Spec", "version": "1.0.0"},
        "channels": {
            "test-channel": {
                "address": "test.topic",
                "messages": {
                    "testMsg": {
                        "name": "test.Message",
                        "payload": {"type": "object"},
                    }
                },
            }
        },
        "operations": {},
    }
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)
    preview = await service.preview(request)

    assert preview.total_channels == 1
    assert preview.channels[0].broker_type == "kafka"  # default
    assert preview.total_bindings == 1

    print(f"  [edge] default broker={preview.channels[0].broker_type}")


# ================================================================
# Edge case: AsyncAPI v2 spec (should produce warning)
# ================================================================

@pytest.mark.asyncio
async def test_v2_spec_warning():
    """AsyncAPI v2 spec should produce a version warning."""
    spec = {
        "asyncapi": "2.6.0",
        "info": {"title": "Legacy v2 Spec", "version": "1.0.0"},
        "channels": {},
        "operations": {},
    }
    service = _make_service()
    request = AsyncAPIImportRequest(spec_content=spec)
    preview = await service.preview(request)

    assert any("2.6.0" in w for w in preview.warnings)
    assert preview.total_channels == 0

    print(f"  [edge] v2 warnings={preview.warnings}")