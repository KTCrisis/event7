"""
event7 - Registry Models
Modèles pour les connexions aux Schema Registries.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ProviderType(str, Enum):
    CONFLUENT = "confluent"
    APICURIO = "apicurio"
    GLUE = "glue"
    PULSAR = "pulsar"


class RegistryCreate(BaseModel):
    """Payload pour connecter un nouveau registry"""

    name: str = Field(..., min_length=1, max_length=100, examples=["Production Confluent"])
    provider_type: ProviderType
    base_url: str = Field(..., examples=["https://psrc-xxxxx.europe-west1.gcp.confluent.cloud"])
    environment: str = Field(default="DEV", examples=["DEV", "STAGING", "PROD"])

    # Credentials (chiffrés avant stockage)
    api_key: str | None = None
    api_secret: str | None = None
    # Pour les providers avec d'autres modes d'auth
    username: str | None = None
    password: str | None = None
    token: str | None = None


class RegistryResponse(BaseModel):
    """Registry retourné par l'API (sans credentials)"""

    id: str
    name: str
    provider_type: ProviderType
    base_url: str
    environment: str
    is_active: bool = True
    created_at: datetime | None = None

    # Status calculé
    is_connected: bool = False
    subject_count: int | None = None


class RegistryHealth(BaseModel):
    """Résultat du health check d'un registry"""

    registry_id: str
    is_healthy: bool
    response_time_ms: float | None = None
    error: str | None = None
