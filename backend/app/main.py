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
from app.db.factory import create_database
from app.db.base import DatabaseProvider

# Instances globales
settings = get_settings()
redis_cache = RedisCache()
db_client: DatabaseProvider = create_database()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle"""
    logger.info(f"Starting event7 [debug={settings.debug}]")

    # Startup
    await redis_cache.connect()
    await db_client.connect()
    logger.info(f"All services connected [db={type(db_client).__name__}]")

    yield

    # Shutdown
    await db_client.disconnect()
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
    db_ok = db_client.ping()

    return {
        "status": "healthy" if (redis_ok and db_ok) else "degraded",
        "services": {
            "redis": "ok" if redis_ok else "error",
            "database": "ok" if db_ok else "error",
        },
        "database_provider": type(db_client).__name__,
        "version": "0.1.0",
    }


@app.get("/")
async def root():
    return {"name": "event7", "version": "0.1.0"}