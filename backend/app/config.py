"""
Configuration centralisée — Pydantic Settings.

Placement: backend/app/config.py
Modification: ajout de supabase_jwt_secret et auth_enabled

Ce fichier remplace l'existant. Les ajouts sont marqués # P0-AUTH
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Supabase ---
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""  # P0-AUTH: secret pour vérifier les JWT Supabase Auth

    # --- Redis ---
    redis_url: str = "redis://localhost:6379"
    redis_ttl: int = 300  # 5 min default

    # --- Encryption ---
    encryption_key: str = ""

    # --- Auth ---
    auth_enabled: bool = False  # P0-AUTH: False en dev (placeholder user), True en prod

    # --- App ---
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    model_config = {
        "env_file": ("../.env", ".env"),
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()