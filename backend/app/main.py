"""
event7 - FastAPI Application
Point d'entrée principal
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import get_settings
from app.cache.redis_cache import RedisCache
from app.db.supabase_client import SupabaseClient

# Instances globales
settings = get_settings()
redis_cache = RedisCache()
supabase_client = SupabaseClient(url=settings.supabase_url, key=settings.supabase_service_role_key)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle"""
    logger.info(f"Starting event7 [debug={settings.debug}]")

    # Startup
    await redis_cache.connect()
    logger.info("All services connected")

    yield

    # Shutdown
    await redis_cache.disconnect()
    logger.info("event7 stopped")


app = FastAPI(
    title="event7",
    description="Universal Schema Registry Governance Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Register Routers ===
from app.api.registries import router as registries_router
from app.api.schemas import router as schemas_router
from app.api.governance import router as governance_router
from app.api.asyncapi import router as asyncapi_router

app.include_router(registries_router)
app.include_router(schemas_router)
app.include_router(governance_router)
app.include_router(asyncapi_router)


# === Health Check ===
@app.get("/health")
async def health():
    """Health check endpoint"""
    redis_ok = await redis_cache.ping()
    supabase_ok = supabase_client.ping()

    return {
        "status": "healthy" if (redis_ok and supabase_ok) else "degraded",
        "services": {
            "redis": "ok" if redis_ok else "error",
            "supabase": "ok" if supabase_ok else "error",
        },
        "version": "0.1.0",
    }


@app.get("/")
async def root():
    return {"name": "event7", "version": "0.1.0"}