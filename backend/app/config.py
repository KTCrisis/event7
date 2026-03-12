"""
Configuration centralisée — Pydantic Settings.

Placement: backend/app/config.py
Modification: ajout settings Ollama AI (host, model, api_key)
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Supabase ---
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # --- Database ---
    db_provider: str = "supabase"  # "supabase" or "postgresql"
    database_url: str = ""

    # --- Redis ---
    redis_url: str = "redis://localhost:6379"
    redis_ttl: int = 300

    # --- Encryption ---
    encryption_key: str = ""

    # --- Auth ---
    auth_enabled: bool = False

    # --- AI / Ollama ---
    ollama_host: str = ""           # e.g. https://ollama.com or http://ollama:11434
    ollama_model: str = ""          # e.g. kimi-k2.5:cloud, llama3.1:8b
    ollama_api_key: str = ""        # empty = no auth (local Ollama)

    # --- App ---
    debug: bool = True
    app_env: str = "development"
    cors_origins: str = '["http://localhost:3000"]'

    @property
    def cors_origins_list(self) -> list[str]:
        import json
        try:
            return json.loads(self.cors_origins)
        except Exception:
            return ["http://localhost:3000"]

    @property
    def ai_enabled(self) -> bool:
        return bool(self.ollama_host and self.ollama_model)

    model_config = {
        "env_file": ("../.env", ".env"),
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()