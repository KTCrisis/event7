"""
Tests for P0-AUTH: JWT authentication and user context.

Placement: backend/tests/test_auth.py
"""

import time
from unittest.mock import AsyncMock
from uuid import UUID

import jwt
import pytest
from fastapi import HTTPException

from app.models.auth import UserContext
from app.utils.auth import _decode_supabase_jwt, get_current_user

from tests.helpers import (
    DEV_USER_ID,
    TEST_JWT_SECRET,
    TEST_USER_EMAIL,
    TEST_USER_ID,
    make_jwt_token,
)


# ================================================================
# UserContext model
# ================================================================

class TestUserContext:

    def test_create_with_all_fields(self):
        ctx = UserContext(
            user_id=TEST_USER_ID,
            email="test@example.com",
            role="authenticated",
        )
        assert ctx.user_id == TEST_USER_ID
        assert ctx.email == "test@example.com"
        assert ctx.role == "authenticated"

    def test_create_with_defaults(self):
        ctx = UserContext(user_id=TEST_USER_ID)
        assert ctx.email is None
        assert ctx.role == "authenticated"

    def test_user_id_is_uuid(self):
        ctx = UserContext(user_id=TEST_USER_ID)
        assert isinstance(ctx.user_id, UUID)

    def test_rejects_invalid_uuid(self):
        with pytest.raises(Exception):
            UserContext(user_id="not-a-uuid")


# ================================================================
# _decode_supabase_jwt
# ================================================================

class TestDecodeJWT:

    def test_valid_token(self):
        token = make_jwt_token()
        payload = _decode_supabase_jwt(token, TEST_JWT_SECRET)
        assert payload["sub"] == str(TEST_USER_ID)
        assert payload["email"] == TEST_USER_EMAIL
        assert payload["role"] == "authenticated"

    def test_expired_token_raises_401(self):
        token = make_jwt_token(expired=True)
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_jwt(token, TEST_JWT_SECRET)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_wrong_secret_raises_401(self):
        token = make_jwt_token(secret="correct-secret-that-is-32-bytes!")
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_jwt(token, "wrong-secret-that-is-32-bytes!!x")
        assert exc_info.value.status_code == 401

    def test_garbage_token_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_jwt("this.is.garbage", TEST_JWT_SECRET)
        assert exc_info.value.status_code == 401

    def test_wrong_audience_raises_401(self):
        token = make_jwt_token(audience="wrong-audience")
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_jwt(token, TEST_JWT_SECRET)
        assert exc_info.value.status_code == 401


# ================================================================
# get_current_user
# ================================================================

class TestGetCurrentUser:

    def _make_request(self, token: str | None = None):
        request = AsyncMock()
        if token:
            request.headers = {"Authorization": f"Bearer {token}"}
        else:
            request.headers = {}
        return request

    def _make_settings(self, auth_enabled: bool = True, jwt_secret: str = TEST_JWT_SECRET):
        settings = AsyncMock()
        settings.auth_enabled = auth_enabled
        settings.supabase_jwt_secret = jwt_secret
        return settings

    @pytest.mark.asyncio
    async def test_dev_mode_returns_placeholder(self):
        request = self._make_request()
        settings = self._make_settings(auth_enabled=False)
        user = await get_current_user(request, settings)
        assert user.user_id == DEV_USER_ID
        assert user.email == "dev@event7.local"

    @pytest.mark.asyncio
    async def test_dev_mode_ignores_token(self):
        token = make_jwt_token()
        request = self._make_request(token=token)
        settings = self._make_settings(auth_enabled=False)
        user = await get_current_user(request, settings)
        assert user.user_id == DEV_USER_ID

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self):
        token = make_jwt_token()
        request = self._make_request(token=token)
        settings = self._make_settings(auth_enabled=True)
        user = await get_current_user(request, settings)
        assert user.user_id == TEST_USER_ID
        assert user.email == TEST_USER_EMAIL
        assert user.role == "authenticated"

    @pytest.mark.asyncio
    async def test_missing_header_raises_401(self):
        request = self._make_request(token=None)
        settings = self._make_settings(auth_enabled=True)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request, settings)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_non_bearer_header_raises_401(self):
        request = AsyncMock()
        request.headers = {"Authorization": "Basic dXNlcjpwYXNz"}
        settings = self._make_settings(auth_enabled=True)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request, settings)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_raises_401(self):
        token = make_jwt_token(expired=True)
        request = self._make_request(token=token)
        settings = self._make_settings(auth_enabled=True)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request, settings)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_tampered_token_raises_401(self):
        token = make_jwt_token() + "tampered"
        request = self._make_request(token=token)
        settings = self._make_settings(auth_enabled=True)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request, settings)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_jwt_secret_raises_500(self):
        token = make_jwt_token()
        request = self._make_request(token=token)
        settings = self._make_settings(auth_enabled=True, jwt_secret="")
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request, settings)
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_missing_sub_claim_raises_401(self):
        now = int(time.time())
        payload = {
            "email": "nope@test.com",
            "role": "authenticated",
            "aud": "authenticated",
            "iat": now,
            "exp": now + 3600,
        }
        token = jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")
        request = self._make_request(token=token)
        settings = self._make_settings(auth_enabled=True)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request, settings)
        assert exc_info.value.status_code == 401
        assert "sub" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_invalid_uuid_in_sub_raises_401(self):
        now = int(time.time())
        payload = {
            "sub": "not-a-valid-uuid",
            "email": "bad@test.com",
            "role": "authenticated",
            "aud": "authenticated",
            "iat": now,
            "exp": now + 3600,
        }
        token = jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")
        request = self._make_request(token=token)
        settings = self._make_settings(auth_enabled=True)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request, settings)
        assert exc_info.value.status_code == 401


# ================================================================
# Regression guards
# ================================================================

class TestAuthRegression:

    def test_dev_user_id_matches_old_placeholder(self):
        assert DEV_USER_ID == UUID("00000000-0000-0000-0000-000000000000")

    @pytest.mark.asyncio
    async def test_different_users_get_different_contexts(self):
        user_a = UUID("aaaaaaaa-0000-0000-0000-000000000001")
        user_b = UUID("bbbbbbbb-0000-0000-0000-000000000002")

        token_a = make_jwt_token(user_id=user_a, email="a@test.com")
        token_b = make_jwt_token(user_id=user_b, email="b@test.com")

        settings = AsyncMock()
        settings.auth_enabled = True
        settings.supabase_jwt_secret = TEST_JWT_SECRET

        req_a = AsyncMock()
        req_a.headers = {"Authorization": f"Bearer {token_a}"}
        req_b = AsyncMock()
        req_b.headers = {"Authorization": f"Bearer {token_b}"}

        ctx_a = await get_current_user(req_a, settings)
        ctx_b = await get_current_user(req_b, settings)

        assert ctx_a.user_id == user_a
        assert ctx_b.user_id == user_b
        assert ctx_a.user_id != ctx_b.user_id