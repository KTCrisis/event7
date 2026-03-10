"""
Authentication utilities — Supabase JWT verification.

Placement: backend/app/utils/auth.py

Deux modes:
- auth_enabled=False (dev): retourne un placeholder UserContext
- auth_enabled=True (prod): décode le JWT Bearer token depuis le header Authorization

Le JWT Supabase Auth contient au minimum:
  { "sub": "<user_id UUID>", "email": "...", "role": "authenticated", ... }
"""

from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from loguru import logger

from app.config import Settings, get_settings
from app.models.auth import UserContext

# Placeholder user pour le mode dev (auth_enabled=False)
_DEV_USER = UserContext(
    user_id=UUID("00000000-0000-0000-0000-000000000000"),
    email="dev@event7.local",
    role="authenticated",
)


def _decode_supabase_jwt(token: str, secret: str) -> dict:
    """Decode and verify a Supabase Auth JWT.

    Supabase uses HS256 with the JWT secret from project settings.
    """
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> UserContext:
    """FastAPI dependency — extract authenticated user from request.

    Usage in routes:
        @router.get("/something")
        async def my_route(user: UserContext = Depends(get_current_user)):
            ...
    """
    # --- Dev mode: skip auth ---
    if not settings.auth_enabled:
        return _DEV_USER

    # --- Prod mode: verify JWT ---
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.removeprefix("Bearer ").strip()

    if not settings.supabase_jwt_secret:
        logger.error("SUPABASE_JWT_SECRET not configured but auth_enabled=True")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication not configured",
        )

    payload = _decode_supabase_jwt(token, settings.supabase_jwt_secret)

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
        )

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        )

    return UserContext(
        user_id=user_id,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
    )