"""
Tests for channel_service — CRUD, bindings, coherence warnings, channel-map.

Covers: list_channels, get_channel, create_channel, update_channel, delete_channel,
        create_binding, delete_binding, list_bindings, get_channels_for_subject,
        get_channel_map, binding coherence warnings, map warnings.
"""

from unittest.mock import MagicMock

import pytest

from app.models.channel import ChannelCreate, ChannelUpdate, ChannelSubjectCreate
from app.services.channel_service import ChannelService


# ================================================================
# Helpers
# ================================================================

REGISTRY_ID = "reg-001"
CHANNEL_ID = "ch-001"


def _make_service(
    channels: list[dict] | None = None,
    channel_by_id: dict | None = None,
    bindings: list[dict] | None = None,
    channels_for_subject: list[dict] | None = None,
    create_result: dict | None = None,
    update_result: dict | None = None,
    delete_result: bool = True,
    create_binding_result: dict | None = None,
    delete_binding_result: bool = True,
) -> ChannelService:
    cache = MagicMock()
    cache.cache_key = MagicMock(side_effect=lambda *parts: ":".join(str(p) for p in parts))
    cache.delete_pattern = MagicMock()

    db = MagicMock()
    db.get_channels.return_value = channels or []
    db.get_channel_by_id.return_value = channel_by_id
    db.get_bindings_for_channel.return_value = bindings or []
    db.get_channels_for_subject.return_value = channels_for_subject or []
    db.create_channel.return_value = create_result
    db.update_channel.return_value = update_result
    db.delete_channel.return_value = delete_result
    db.create_binding.return_value = create_binding_result
    db.delete_binding.return_value = delete_binding_result

    return ChannelService(cache=cache, db=db, registry_id=REGISTRY_ID)


def _channel_row(
    channel_id: str = CHANNEL_ID,
    name: str = "billing-events",
    address: str = "prod.billing.events.v1",
    broker_type: str = "kafka",
    resource_kind: str = "topic",
    pattern: str = "topic_log",
    data_layer: str | None = "core",
    registry_id: str = REGISTRY_ID,
) -> dict:
    return {
        "id": channel_id,
        "registry_id": registry_id,
        "name": name,
        "address": address,
        "broker_type": broker_type,
        "resource_kind": resource_kind,
        "messaging_pattern": pattern,
        "broker_config": {},
        "data_layer": data_layer,
        "description": None,
        "owner": None,
        "tags": [],
        "is_auto_detected": False,
        "auto_detect_source": None,
        "created_at": "2026-03-14T10:00:00Z",
        "updated_at": "2026-03-14T10:00:00Z",
    }


def _binding_row(
    binding_id: str = "bind-001",
    channel_id: str = CHANNEL_ID,
    subject: str = "com.event7.Order-value",
    strategy: str = "channel_bound",
    role: str = "value",
    origin: str = "tns",
    status: str = "active",
) -> dict:
    return {
        "id": binding_id,
        "channel_id": channel_id,
        "subject_name": subject,
        "binding_strategy": strategy,
        "schema_role": role,
        "binding_origin": origin,
        "binding_selector": None,
        "binding_status": status,
        "last_verified_at": None,
        "is_auto_detected": False,
        "created_at": "2026-03-14T10:00:00Z",
    }


# ================================================================
# list_channels
# ================================================================


class TestListChannels:

    def test_empty_returns_empty(self):
        svc = _make_service(channels=[])
        result = svc.list_channels()
        assert result == []

    def test_returns_summaries_with_binding_info(self):
        svc = _make_service(
            channels=[_channel_row()],
            bindings=[_binding_row(role="value"), _binding_row(binding_id="b2", role="key")],
        )
        result = svc.list_channels()
        assert len(result) == 1
        assert result[0].has_value_schema is True
        assert result[0].has_key_schema is True
        assert result[0].subject_count == 2

    def test_filter_by_broker_type(self):
        svc = _make_service(channels=[
            _channel_row(channel_id="ch1", broker_type="kafka"),
            _channel_row(channel_id="ch2", broker_type="rabbitmq"),
        ])
        result = svc.list_channels(broker_type="kafka")
        assert len(result) == 1
        assert result[0].broker_type == "kafka"

    def test_filter_by_data_layer(self):
        svc = _make_service(channels=[
            _channel_row(channel_id="ch1", data_layer="core"),
            _channel_row(channel_id="ch2", data_layer="raw"),
        ])
        result = svc.list_channels(data_layer="core")
        assert len(result) == 1

    def test_filter_by_search(self):
        svc = _make_service(channels=[
            _channel_row(channel_id="ch1", name="billing-events", address="prod.billing.v1"),
            _channel_row(channel_id="ch2", name="shipping-events", address="prod.shipping.v1"),
        ])
        result = svc.list_channels(search="shipping")
        assert len(result) == 1
        assert result[0].name == "shipping-events"

    def test_binding_health_healthy(self):
        svc = _make_service(
            channels=[_channel_row()],
            bindings=[_binding_row(status="active")],
        )
        result = svc.list_channels()
        assert result[0].binding_health == "healthy"

    def test_binding_health_degraded(self):
        svc = _make_service(
            channels=[_channel_row()],
            bindings=[_binding_row(status="active"), _binding_row(binding_id="b2", status="missing_subject")],
        )
        result = svc.list_channels()
        assert result[0].binding_health == "degraded"

    def test_binding_health_unknown_no_bindings(self):
        svc = _make_service(channels=[_channel_row()], bindings=[])
        result = svc.list_channels()
        assert result[0].binding_health == "unknown"


# ================================================================
# get_channel
# ================================================================


class TestGetChannel:

    def test_not_found_returns_none(self):
        svc = _make_service(channel_by_id=None)
        assert svc.get_channel("nonexistent") is None

    def test_wrong_registry_returns_none(self):
        """Scope guard: channel belongs to different registry."""
        svc = _make_service(channel_by_id=_channel_row(registry_id="other-reg"))
        assert svc.get_channel(CHANNEL_ID) is None

    def test_returns_channel_with_bindings(self):
        svc = _make_service(
            channel_by_id=_channel_row(),
            bindings=[_binding_row()],
        )
        result = svc.get_channel(CHANNEL_ID)
        assert result is not None
        assert result.name == "billing-events"
        assert len(result.subjects) == 1
        assert result.subjects[0].subject_name == "com.event7.Order-value"


# ================================================================
# create_channel
# ================================================================


class TestCreateChannel:

    def test_create_success(self):
        row = _channel_row()
        svc = _make_service(create_result=row, channel_by_id=row)
        payload = ChannelCreate(
            name="billing-events",
            address="prod.billing.events.v1",
            broker_type="kafka",
            resource_kind="topic",
            messaging_pattern="topic_log",
        )
        channel, warnings = svc.create_channel(payload)
        assert channel is not None
        assert channel.name == "billing-events"
        assert warnings == []

    def test_create_db_failure(self):
        svc = _make_service(create_result=None)
        payload = ChannelCreate(
            name="test", address="test", broker_type="kafka",
            resource_kind="topic", messaging_pattern="topic_log",
        )
        channel, warnings = svc.create_channel(payload)
        assert channel is None
        assert len(warnings) == 1


# ================================================================
# delete_channel
# ================================================================


class TestDeleteChannel:

    def test_delete_success(self):
        svc = _make_service(channel_by_id=_channel_row(), delete_result=True)
        assert svc.delete_channel(CHANNEL_ID) is True

    def test_delete_not_found(self):
        svc = _make_service(channel_by_id=None)
        assert svc.delete_channel("nonexistent") is False

    def test_delete_wrong_registry(self):
        svc = _make_service(channel_by_id=_channel_row(registry_id="other"))
        assert svc.delete_channel(CHANNEL_ID) is False


# ================================================================
# Bindings
# ================================================================


class TestBindings:

    def test_list_bindings_scope_guard(self):
        """Bindings for a channel in another registry return empty."""
        svc = _make_service(channel_by_id=_channel_row(registry_id="other"))
        assert svc.list_bindings(CHANNEL_ID) == []

    def test_create_binding_success(self):
        svc = _make_service(
            channel_by_id=_channel_row(),
            create_binding_result=_binding_row(),
            channels_for_subject=[],
        )
        payload = ChannelSubjectCreate(
            subject_name="com.event7.Order-value",
            binding_strategy="channel_bound",
        )
        binding, warnings = svc.create_binding(CHANNEL_ID, payload)
        assert binding is not None
        assert binding.subject_name == "com.event7.Order-value"

    def test_delete_binding(self):
        svc = _make_service(delete_binding_result=True)
        assert svc.delete_binding("bind-001") is True

    def test_reverse_lookup(self):
        expected = [{"id": "ch1", "name": "billing"}]
        svc = _make_service(channels_for_subject=expected)
        result = svc.get_channels_for_subject("com.event7.Order-value")
        assert result == expected


# ================================================================
# Coherence warnings
# ================================================================


class TestCoherenceWarnings:

    def test_channel_bound_many_channels_warns(self):
        """channel_bound subject linked to 4+ channels triggers warning."""
        svc = _make_service(
            channel_by_id=_channel_row(),
            channels_for_subject=[{}, {}, {}, {}],  # 4 existing
        )
        payload = ChannelSubjectCreate(
            subject_name="com.event7.Order-value",
            binding_strategy="channel_bound",
        )
        warnings = svc._check_binding_coherence(CHANNEL_ID, payload)
        assert any("domain_bound" in w for w in warnings)

    def test_raw_layer_domain_bound_warns(self):
        svc = _make_service(
            channel_by_id=_channel_row(data_layer="raw"),
            channels_for_subject=[],
        )
        payload = ChannelSubjectCreate(
            subject_name="raw.billing.v1-value",
            binding_strategy="domain_bound",
        )
        warnings = svc._check_binding_coherence(CHANNEL_ID, payload)
        assert any("RAW" in w for w in warnings)

    def test_app_bound_short_name_warns(self):
        svc = _make_service(
            channel_by_id=_channel_row(),
            channels_for_subject=[],
        )
        payload = ChannelSubjectCreate(
            subject_name="Order",
            binding_strategy="app_bound",
        )
        warnings = svc._check_binding_coherence(CHANNEL_ID, payload)
        assert any("convention" in w.lower() for w in warnings)

    def test_no_warnings_normal_case(self):
        svc = _make_service(
            channel_by_id=_channel_row(data_layer="core"),
            channels_for_subject=[],
        )
        payload = ChannelSubjectCreate(
            subject_name="com.event7.Order-value",
            binding_strategy="channel_bound",
        )
        warnings = svc._check_binding_coherence(CHANNEL_ID, payload)
        assert warnings == []


# ================================================================
# Channel map warnings
# ================================================================


class TestChannelMapWarnings:

    @staticmethod
    def _summary(**overrides) -> "ChannelSummary":
        from app.models.channel import ChannelSummary
        defaults = dict(
            id="ch-test", name="test-channel", address="test.topic",
            broker_type="kafka", resource_kind="topic",
            messaging_pattern="topic_log",
        )
        defaults.update(overrides)
        return ChannelSummary(**defaults)

    def test_missing_subject_warning(self):
        from app.models.channel import ChannelMapEntry, ChannelSubjectResponse
        entry = ChannelMapEntry(
            channel=self._summary(),
            bindings=[ChannelSubjectResponse(**_binding_row(status="missing_subject"))],
        )
        svc = _make_service()
        warnings = svc._compute_map_warnings([entry])
        assert any("not found" in w for w in warnings)

    def test_empty_channel_warning(self):
        from app.models.channel import ChannelMapEntry
        entry = ChannelMapEntry(channel=self._summary(name="orphan-channel"), bindings=[])
        svc = _make_service()
        warnings = svc._compute_map_warnings([entry])
        assert any("no subject bindings" in w for w in warnings)

    def test_no_warnings_clean_state(self):
        from app.models.channel import ChannelMapEntry, ChannelSubjectResponse
        entry = ChannelMapEntry(
            channel=self._summary(),
            bindings=[ChannelSubjectResponse(**_binding_row(status="active"))],
        )
        svc = _make_service()
        warnings = svc._compute_map_warnings([entry])
        assert warnings == []
