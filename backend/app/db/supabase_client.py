"""
event7 - Supabase Client
Wrapper autour de supabase-py pour l'accès data
"""

from supabase import create_client, Client
from loguru import logger

from app.config import get_settings


class SupabaseClient:
    def __init__(self):
        self._client: Client | None = None

    def connect(self):
        settings = get_settings()
        if not settings.supabase_url:
            logger.warning("Supabase not configured - running without database")
            return
        # Utilise service_role en dev (bypass RLS), anon en prod
        key = settings.supabase_service_role_key or settings.supabase_anon_key
        if not key:
            logger.warning("No Supabase key configured")
            return
        self._client = create_client(settings.supabase_url, key)
        logger.info("Supabase connected")

    def ping(self) -> bool:
        """Vérifie la connexion Supabase"""
        if not self._client:
            return False
        try:
            self._client.table("registries").select("id", count="exact").limit(0).execute()
            return True
        except Exception as e:
            error_msg = str(e)
            # Table pas encore créée = connexion OK, schema pas prêt
            if "does not exist" in error_msg or "42P01" in error_msg:
                logger.warning("Supabase connected but tables not created yet")
                return True
            logger.error(f"Supabase ping failed: {e}")
            return False

    @property
    def client(self) -> Client | None:
        return self._client

    # === Registries ===

    def get_registries(self, user_id: str) -> list[dict]:
        if not self._client:
            return []
        response = (
            self._client.table("registries")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        return response.data

    def create_registry(self, data: dict) -> dict:
        if not self._client:
            return {}
        response = self._client.table("registries").insert(data).execute()
        return response.data[0] if response.data else {}

    def delete_registry(self, registry_id: str, user_id: str) -> bool:
        if not self._client:
            return False
        self._client.table("registries").update({"is_active": False}).eq(
            "id", registry_id
        ).eq("user_id", user_id).execute()
        return True

    # === Enrichments ===

    def get_enrichment(self, registry_id: str, subject: str) -> dict | None:
        if not self._client:
            return None
        response = (
            self._client.table("enrichments")
            .select("*")
            .eq("registry_id", registry_id)
            .eq("subject", subject)
            .execute()
        )
        return response.data[0] if response.data else None

    def upsert_enrichment(self, data: dict) -> dict:
        if not self._client:
            return {}
        response = (
            self._client.table("enrichments")
            .upsert(data, on_conflict="registry_id,subject")
            .execute()
        )
        return response.data[0] if response.data else {}

    # === Audit ===

    def log_audit(self, user_id: str, registry_id: str, action: str, details: dict):
        if not self._client:
            return
        self._client.table("audit_logs").insert(
            {
                "user_id": user_id,
                "registry_id": registry_id,
                "action": action,
                "details": details,
            }
        ).execute()
