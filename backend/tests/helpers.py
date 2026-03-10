"""
Shared test helpers and constants.

Placement: backend/tests/helpers.py
"""

import time
from uuid import UUID

import jwt


# ================================================================
# CONSTANTS
# ================================================================

TEST_USER_ID = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
TEST_USER_EMAIL = "marc@event7.dev"
TEST_JWT_SECRET = "super-secret-jwt-key-for-tests-32b"  # 34 chars → no PyJWT warning
TEST_REGISTRY_ID = "11111111-2222-3333-4444-555555555555"
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000000")


# ================================================================
# JWT HELPERS
# ================================================================

def make_jwt_token(
    user_id: str | UUID = TEST_USER_ID,
    email: str = TEST_USER_EMAIL,
    secret: str = TEST_JWT_SECRET,
    expired: bool = False,
    audience: str = "authenticated",
    role: str = "authenticated",
) -> str:
    """Generate a Supabase-like JWT token for tests."""
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "aud": audience,
        "iat": now,
        "exp": now - 3600 if expired else now + 3600,
    }
    return jwt.encode(payload, secret, algorithm="HS256")