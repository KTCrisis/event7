"""
Authentication utilities — Supabase JWT verification.

Placement: backend/app/utils/auth.py

Deux modes:
- auth_enabled=False (dev): retourne un placeholder UserContext
- auth_enabled=True (prod): décode le JWT Bearer token depuis le header Authorization

Supporte deux algorithmes:
- HS256 (legacy): vérifié avec SUPABASE_JWT_SECRET
- ES256 (ECC, nouveau défaut Supabase): vérifié avec la clé publique JWKS
"""

from functools import lru_cache
from uuid import UUID

import httpx
import jwt
from jwt import PyJWK
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


@lru_cache(maxsize=1)
def _fetch_jwks(supabase_url: str) -> dict:
    """Fetch Supabase JWKS (cached — keys rarely change)."""
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        resp = httpx.get(jwks_url, timeout=10.0)
        resp.raise_for_status()
        jwks = resp.json()
        logger.info(f"Fetched JWKS from {jwks_url} ({len(jwks.get('keys', []))} keys)")
        return jwks
    except Exception as e:
        logger.error(f"Failed to fetch JWKS from {jwks_url}: {e}")
        return {"keys": []}


def _get_es256_key(token: str, supabase_url: str):
    """Extract the matching ES256 public key from JWKS for the given token."""
    jwks = _fetch_jwks(supabase_url)
    try:
        # Get the kid from token header
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        for key_data in jwks.get("keys", []):
            if key_data.get("kid") == kid:
                return PyJWK(key_data).key

        # If no kid match, try the first key
        if jwks.get("keys"):
            return PyJWK(jwks["keys"][0]).key
    except Exception as e:
        logger.warning(f"Failed to extract ES256 key from JWKS: {e}")

    return None


def _decode_supabase_jwt(token: str, settings: Settings) -> dict:
    """Decode and verify a Supabase Auth JWT.

    Tries ES256 (JWKS) first, falls back to HS256 (legacy secret).
    """
    # 1. Detect algorithm from token header
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
    except jwt.exceptions.DecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )

    # 2. ES256 — verify with JWKS public key
    if alg == "ES256" and settings.supabase_url:
        es256_key = _get_es256_key(token, settings.supabase_url)
        if es256_key:
            try:
                payload = jwt.decode(
                    token,
                    es256_key,
                    algorithms=["ES256"],
                    audience="authenticated",
                )
                return payload
            except jwt.ExpiredSignatureError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token expired",
                )
            except jwt.InvalidTokenError as e:
                logger.warning(f"ES256 JWT verification failed: {e}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token",
                )
        else:
            logger.warning("ES256 token but no JWKS key found, falling back to HS256")

    # 3. HS256 — verify with legacy secret
    if settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
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
            logger.warning(f"HS256 JWT verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

    # 4. No method worked
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to verify token (no valid key)",
    )


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> UserContext:
    """FastAPI dependency — extract authenticated user from request."""
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

    if not settings.supabase_jwt_secret and not settings.supabase_url:
        logger.error("Neither SUPABASE_JWT_SECRET nor SUPABASE_URL configured but auth_enabled=True")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication not configured",
        )

    payload = _decode_supabase_jwt(token, settings)

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