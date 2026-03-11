"""
Integration tests for registry routes with auth.

Placement: backend/tests/test_registries_routes.py

Uses FastAPI dependency_overrides to inject mock auth context,
because Depends() captures function references at import time
and patching after import has no effect.
"""

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient

from app.models.auth import UserContext
from app.utils.auth import get_current_user

from tests.helpers import (
    TEST_JWT_SECRET,
    TEST_REGISTRY_ID,
    TEST_USER_ID,
    make_jwt_token,
)


# ================================================================
# Helpers
# ================================================================

def _make_test_app(user_override: UserContext | None = None):
    """Create a minimal FastAPI app with registry routes.

    If user_override is provided, inject it via dependency_overrides
    (bypasses real JWT verification entirely).
    If None, keep the real get_current_user (for testing 401).
    """
    from fastapi import FastAPI
    from app.api.registries import router

    app = FastAPI()
    app.include_router(router)

    if user_override is not None:
        async def _fake_user():
            return user_override
        app.dependency_overrides[get_current_user] = _fake_user

    return app


def _user(user_id: UUID = TEST_USER_ID) -> UserContext:
    return UserContext(user_id=user_id, email="test@event7.dev")


# ================================================================
# DELETE /api/v1/registries/{id}
# ================================================================

class TestDeleteRegistryRoute:

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(self):
        mock_db = MagicMock()
        mock_db.delete_registry.return_value = False

        with patch("app.api.registries.db_client", mock_db):
            app = _make_test_app(user_override=_user())
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.delete(
                    f"/api/v1/registries/{TEST_REGISTRY_ID}",
                )

            assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_success_returns_204(self):
        mock_db = MagicMock()
        mock_db.delete_registry.return_value = True
        mock_db.log_audit.return_value = None

        with patch("app.api.registries.db_client", mock_db):
            app = _make_test_app(user_override=_user())
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.delete(
                    f"/api/v1/registries/{TEST_REGISTRY_ID}",
                )

            assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_passes_user_id_to_db(self):
        mock_db = MagicMock()
        mock_db.delete_registry.return_value = True
        mock_db.log_audit.return_value = None

        with patch("app.api.registries.db_client", mock_db):
            app = _make_test_app(user_override=_user())
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                await client.delete(
                    f"/api/v1/registries/{TEST_REGISTRY_ID}",
                )

            # Verify the JWT user_id was forwarded to the DB call
            mock_db.delete_registry.assert_called_once_with(
                registry_id=TEST_REGISTRY_ID,
                user_id=str(TEST_USER_ID),
            )


# ================================================================
# GET /api/v1/registries
# ================================================================

class TestListRegistriesRoute:

    @pytest.mark.asyncio
    async def test_list_passes_user_id(self):
        mock_db = MagicMock()
        mock_db.get_registries.return_value = []

        with patch("app.api.registries.db_client", mock_db):
            app = _make_test_app(user_override=_user())
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/v1/registries")

            assert resp.status_code == 200
            mock_db.get_registries.assert_called_once_with(user_id=str(TEST_USER_ID))

    @pytest.mark.asyncio
    async def test_list_without_auth_returns_401(self, _mock_settings):
        """No dependency override + auth_enabled=True → real auth runs → 401."""
        mock_db = MagicMock()

        # Override the autouse fixture to enable auth
        _mock_settings.auth_enabled = True
        _mock_settings.supabase_jwt_secret = TEST_JWT_SECRET

        with patch("app.api.registries.db_client", mock_db):
            # NO user_override → real get_current_user runs
            app = _make_test_app(user_override=None)
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/v1/registries")  # no auth header

            assert resp.status_code == 401


# ================================================================
# Multi-tenant isolation
# ================================================================

class TestMultiTenantIsolation:

    @pytest.mark.asyncio
    async def test_different_users_see_different_registries(self):
        user_a = UUID("aaaaaaaa-0000-0000-0000-000000000001")
        user_b = UUID("bbbbbbbb-0000-0000-0000-000000000002")

        calls = []
        mock_db = MagicMock()
        def capture_get_registries(user_id):
            calls.append(user_id)
            return []
        mock_db.get_registries.side_effect = capture_get_registries

        with patch("app.api.registries.db_client", mock_db):
            # Request as user A
            app_a = _make_test_app(user_override=_user(user_a))
            transport_a = ASGITransport(app=app_a)
            async with AsyncClient(transport=transport_a, base_url="http://test") as client:
                await client.get("/api/v1/registries")

            # Request as user B
            app_b = _make_test_app(user_override=_user(user_b))
            transport_b = ASGITransport(app=app_b)
            async with AsyncClient(transport=transport_b, base_url="http://test") as client:
                await client.get("/api/v1/registries")

        assert len(calls) == 2
        assert calls[0] == str(user_a)
        assert calls[1] == str(user_b)
        assert calls[0] != calls[1]