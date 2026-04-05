"""
Tests for P0-LIFECYCLE: Provider HTTP client lifecycle.

Placement: backend/tests/test_lifecycle.py
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.models.auth import UserContext
from app.providers.base import SchemaRegistryProvider

from tests.helpers import TEST_USER_ID, TEST_REGISTRY_ID


# ================================================================
# SchemaRegistryProvider.close() contract
# ================================================================

class TestProviderBaseClose:

    @pytest.mark.asyncio
    async def test_close_exists_on_base(self):
        assert hasattr(SchemaRegistryProvider, "close")

    @pytest.mark.asyncio
    async def test_default_close_is_noop(self):
        class DummyProvider(SchemaRegistryProvider):
            async def health_check(self): return True
            async def list_subjects(self): return []
            async def get_schema(self, s, v="latest"): pass
            async def create_schema(self, s, schema): pass
            async def delete_subject(self, s): return True
            async def get_versions(self, s): return []
            async def diff_versions(self, s, v1, v2): pass
            async def get_references(self, s): return []
            async def get_dependents(self, s): return []
            async def get_compatibility(self, s): pass
            async def check_compatibility(self, s, schema): pass

        provider = DummyProvider()
        await provider.close()

    @pytest.mark.asyncio
    async def test_close_can_be_overridden(self):
        closed = False

        class CleanupProvider(SchemaRegistryProvider):
            async def close(self):
                nonlocal closed
                closed = True
            async def health_check(self): return True
            async def list_subjects(self): return []
            async def get_schema(self, s, v="latest"): pass
            async def create_schema(self, s, schema): pass
            async def delete_subject(self, s): return True
            async def get_versions(self, s): return []
            async def diff_versions(self, s, v1, v2): pass
            async def get_references(self, s): return []
            async def get_dependents(self, s): return []
            async def get_compatibility(self, s): pass
            async def check_compatibility(self, s, schema): pass

        provider = CleanupProvider()
        await provider.close()
        assert closed is True


# ================================================================
# Yield dependency lifecycle
# ================================================================

class TestDependencyLifecycle:

    def _make_user(self):
        return UserContext(user_id=TEST_USER_ID, email="test@event7.dev")

    def _make_registry_row(self):
        return {
            "id": TEST_REGISTRY_ID,
            "user_id": str(TEST_USER_ID),
            "name": "Test Registry",
            "provider_type": "confluent",
            "base_url": "https://test.confluent.cloud",
            "credentials_encrypted": "encrypted-data",
            "is_active": True,
        }

    @pytest.mark.asyncio
    async def test_close_called_on_success(self, mock_provider, mock_supabase, mock_cache):
        mock_supabase.get_registry_by_id.return_value = self._make_registry_row()

        with patch("app.api.dependencies.db_client", mock_supabase), \
             patch("app.api.dependencies.redis_cache", mock_cache), \
             patch("app.api.dependencies.create_provider", return_value=mock_provider):

            from app.api.dependencies import get_schema_service

            gen = get_schema_service(
                registry_id=UUID(TEST_REGISTRY_ID),
                user=self._make_user(),
            )
            service = await gen.__anext__()
            assert service is not None

            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass

            mock_provider.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_close_called_on_route_exception(self, mock_provider, mock_supabase, mock_cache):
        """When the route handler raises, the provider must still be closed.

        Note: dependencies.py catches non-HTTP exceptions and converts them
        to HTTPException 500. That's correct behavior. The key assertion is
        that close() was called regardless.
        """
        mock_supabase.get_registry_by_id.return_value = self._make_registry_row()

        with patch("app.api.dependencies.db_client", mock_supabase), \
             patch("app.api.dependencies.redis_cache", mock_cache), \
             patch("app.api.dependencies.create_provider", return_value=mock_provider):

            from app.api.dependencies import get_schema_service

            gen = get_schema_service(
                registry_id=UUID(TEST_REGISTRY_ID),
                user=self._make_user(),
            )
            service = await gen.__anext__()

            # Simulate route handler raising an exception
            # dependencies.py uses finally (not except) — exception propagates
            with pytest.raises(RuntimeError, match="route exploded"):
                await gen.athrow(RuntimeError("route exploded"))

            # CRITICAL: close() must still have been called (via finally block)
            mock_provider.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_registry_not_found_returns_404(self, mock_supabase, mock_cache):
        mock_supabase.get_registry_by_id.return_value = None

        with patch("app.api.dependencies.db_client", mock_supabase), \
             patch("app.api.dependencies.redis_cache", mock_cache):

            from app.api.dependencies import get_schema_service

            gen = get_schema_service(
                registry_id=UUID(TEST_REGISTRY_ID),
                user=self._make_user(),
            )

            with pytest.raises(HTTPException) as exc_info:
                await gen.__anext__()
            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_inactive_registry_returns_410(self, mock_supabase, mock_cache):
        row = self._make_registry_row()
        row["is_active"] = False
        mock_supabase.get_registry_by_id.return_value = row

        with patch("app.api.dependencies.db_client", mock_supabase), \
             patch("app.api.dependencies.redis_cache", mock_cache):

            from app.api.dependencies import get_schema_service

            gen = get_schema_service(
                registry_id=UUID(TEST_REGISTRY_ID),
                user=self._make_user(),
            )

            with pytest.raises(HTTPException) as exc_info:
                await gen.__anext__()
            assert exc_info.value.status_code == 410

    @pytest.mark.asyncio
    async def test_no_supabase_returns_503(self, mock_cache):
        with patch("app.api.dependencies.db_client", None), \
             patch("app.api.dependencies.redis_cache", mock_cache):

            from app.api.dependencies import get_schema_service

            gen = get_schema_service(
                registry_id=UUID(TEST_REGISTRY_ID),
                user=self._make_user(),
            )

            with pytest.raises(HTTPException) as exc_info:
                await gen.__anext__()
            assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_close_error_does_not_propagate(self, mock_provider, mock_supabase, mock_cache):
        mock_supabase.get_registry_by_id.return_value = self._make_registry_row()
        mock_provider.close.side_effect = ConnectionError("close failed")

        with patch("app.api.dependencies.db_client", mock_supabase), \
             patch("app.api.dependencies.redis_cache", mock_cache), \
             patch("app.api.dependencies.create_provider", return_value=mock_provider):

            from app.api.dependencies import get_schema_service

            gen = get_schema_service(
                registry_id=UUID(TEST_REGISTRY_ID),
                user=self._make_user(),
            )
            service = await gen.__anext__()

            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass

            mock_provider.close.assert_awaited_once()


# ================================================================
# Regression guards
# ================================================================

class TestLifecycleRegression:

    @pytest.mark.asyncio
    async def test_service_has_provider_reference(self, mock_provider, mock_supabase, mock_cache):
        mock_supabase.get_registry_by_id.return_value = {
            "id": TEST_REGISTRY_ID,
            "user_id": str(TEST_USER_ID),
            "name": "Test",
            "provider_type": "confluent",
            "base_url": "https://test.cloud",
            "credentials_encrypted": "data",
            "is_active": True,
        }

        with patch("app.api.dependencies.db_client", mock_supabase), \
             patch("app.api.dependencies.redis_cache", mock_cache), \
             patch("app.api.dependencies.create_provider", return_value=mock_provider):

            from app.api.dependencies import get_schema_service

            gen = get_schema_service(
                registry_id=UUID(TEST_REGISTRY_ID),
                user=UserContext(user_id=TEST_USER_ID),
            )
            service = await gen.__anext__()
            assert service.provider is mock_provider

            try:
                await gen.__anext__()
            except StopAsyncIteration:
                pass