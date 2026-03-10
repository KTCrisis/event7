"""
Shared pytest fixtures for P0 tests.

Placement: backend/tests/conftest.py
"""

import sys
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ================================================================
# PRE-PATCH: inject fake app.main before anything imports it
# ================================================================

_fake_main = ModuleType("app.main")
_fake_main.redis_cache = MagicMock()       # type: ignore
_fake_main.supabase_client = MagicMock()   # type: ignore
sys.modules.setdefault("app.main", _fake_main)

# NOW safe to import app modules
from app.models.auth import UserContext
from tests.helpers import TEST_USER_ID, TEST_USER_EMAIL, make_jwt_token


# ================================================================
# MOCK SETTINGS — prevents .env parsing during tests
# ================================================================

def _make_mock_settings():
    """Return a mock Settings object that doesn't touch .env files."""
    s = MagicMock()
    s.supabase_url = ""
    s.supabase_anon_key = ""
    s.supabase_service_role_key = ""
    s.supabase_jwt_secret = "test-jwt-secret-that-is-32-bytes!"
    s.redis_url = "redis://localhost:6379"
    s.redis_ttl = 300
    s.encryption_key = ""
    s.auth_enabled = False
    s.debug = True
    s.cors_origins = ["http://localhost:3000"]
    return s


@pytest.fixture(autouse=True)
def _mock_settings():
    """Autouse fixture: patches get_settings everywhere so tests
    never read the real .env file. This prevents SettingsError
    from cors_origins or missing env vars."""
    mock_s = _make_mock_settings()
    with patch("app.config.get_settings", return_value=mock_s), \
         patch("app.config.Settings", return_value=mock_s):
        yield mock_s


# ================================================================
# FIXTURES — Auth
# ================================================================

@pytest.fixture
def valid_token() -> str:
    return make_jwt_token()


@pytest.fixture
def expired_token() -> str:
    return make_jwt_token(expired=True)


@pytest.fixture
def user_context() -> UserContext:
    return UserContext(user_id=TEST_USER_ID, email=TEST_USER_EMAIL)


# ================================================================
# FIXTURES — Mocks
# ================================================================

@pytest.fixture
def mock_provider():
    provider = AsyncMock()
    provider.health_check.return_value = True
    provider.close.return_value = None
    provider.list_subjects.return_value = []
    return provider


@pytest.fixture
def mock_supabase():
    client = MagicMock()
    client.get_registries.return_value = []
    client.get_registry_by_id.return_value = None
    client.create_registry.return_value = None
    client.delete_registry.return_value = False
    client.log_audit.return_value = None
    client.get_enrichment.return_value = None
    client.upsert_enrichment.return_value = None
    return client


@pytest.fixture
def mock_cache():
    cache = AsyncMock()
    cache.get.return_value = None
    cache.set.return_value = None
    cache.delete.return_value = None
    cache.delete_pattern.return_value = None
    return cache


@pytest.fixture
def sample_registry_row():
    from tests.helpers import TEST_REGISTRY_ID
    return {
        "id": TEST_REGISTRY_ID,
        "user_id": str(TEST_USER_ID),
        "name": "Test Confluent",
        "provider_type": "confluent",
        "base_url": "https://psrc-test.europe-west9.gcp.confluent.cloud",
        "credentials_encrypted": "gAAAAABn...",
        "environment": "DEV",
        "is_active": True,
        "created_at": "2026-03-09T12:00:00Z",
    }