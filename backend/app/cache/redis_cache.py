"""
event7 - Redis Cache Layer
Cache les appels aux Schema Registries (TTL courte)
"""

import json

import redis.asyncio as redis
from loguru import logger

from app.config import get_settings


class RedisCache:
    DEFAULT_TTL = 300  # 5 minutes

    def __init__(self):
        self._client: redis.Redis | None = None

    async def connect(self):
        settings = get_settings()
        self._client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
        logger.info(f"Redis connected: {settings.redis_url}")

    async def disconnect(self):
        if self._client:
            await self._client.close()
            logger.info("Redis disconnected")

    async def ping(self) -> bool:
        try:
            if self._client:
                return await self._client.ping()
            return False
        except Exception:
            return False

    async def get(self, key: str) -> dict | list | None:
        """Récupère une valeur du cache"""
        if not self._client:
            return None
        try:
            value = await self._client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning(f"Redis GET error for {key}: {e}")
            return None

    async def set(self, key: str, value: dict | list, ttl: int = DEFAULT_TTL):
        """Stocke une valeur avec TTL"""
        if not self._client:
            return
        try:
            await self._client.set(key, json.dumps(value), ex=ttl)
        except Exception as e:
            logger.warning(f"Redis SET error for {key}: {e}")

    async def delete(self, key: str):
        """Supprime une clé"""
        if not self._client:
            return
        try:
            await self._client.delete(key)
        except Exception as e:
            logger.warning(f"Redis DELETE error for {key}: {e}")

    async def delete_pattern(self, pattern: str):
        """Supprime toutes les clés matchant un pattern"""
        if not self._client:
            return
        try:
            async for key in self._client.scan_iter(match=pattern):
                await self._client.delete(key)
        except Exception as e:
            logger.warning(f"Redis DELETE pattern error for {pattern}: {e}")

    def cache_key(self, registry_id: str, *parts: str) -> str:
        """Construit une clé de cache hiérarchique"""
        return f"event7:{registry_id}:{':'.join(parts)}"
