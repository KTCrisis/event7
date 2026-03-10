"""
Database factory.

Placement: backend/app/db/factory.py

Creates the appropriate DatabaseProvider based on DB_PROVIDER env var.
Pattern identical to providers/factory.py for Schema Registry.
"""

from loguru import logger

from app.config import get_settings
from app.db.base import DatabaseProvider


def create_database() -> DatabaseProvider:
    """Factory: instantiate the correct database provider.

    Reads DB_PROVIDER from settings:
      - "supabase" (default) → SupabaseDatabase
      - "postgresql"         → PostgreSQLDatabase

    Returns:
        DatabaseProvider instance (not yet connected — call await db.connect()).
    """
    settings = get_settings()
    provider = getattr(settings, "db_provider", "supabase").lower()

    if provider == "postgresql":
        from app.db.postgresql_client import PostgreSQLDatabase

        logger.info("Database provider: PostgreSQL (asyncpg)")
        return PostgreSQLDatabase(
            dsn=settings.database_url,
        )

    else:
        from app.db.supabase_client import SupabaseDatabase

        logger.info("Database provider: Supabase")
        return SupabaseDatabase(
            url=settings.supabase_url,
            key=settings.supabase_key,
        )