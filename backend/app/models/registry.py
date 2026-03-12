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
    KARAPACE = "karapace"
    REDPANDA = "redpanda"
    GLUE = "glue"
    PULSAR = "pulsar"

class AuthMode(str, Enum):
    """Authentication mode for registry connections."""
    API_KEY = "api_key"        # Confluent Cloud: API Key + API Secret
    BASIC = "basic"            # Confluent Platform (on-prem): Username + Password (LDAP/RBAC)

class RegistryCreate(BaseModel):
    """Payload pour connecter un nouveau registry"""
 
    name: str = Field(..., min_length=1, max_length=100, examples=["Production Confluent"])
    provider_type: ProviderType
    base_url: str = Field(..., examples=["https://psrc-xxxxx.europe-west1.gcp.confluent.cloud"])
    environment: str = Field(default="DEV", examples=["DEV", "STAGING", "PROD"])
 
    # Auth mode — only meaningful for Confluent (Cloud vs Self-Managed)
    auth_mode: AuthMode | None = None  # None = legacy default (api_key)
 
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
    registry_id: str
    is_healthy: bool
    response_time_ms: float | None = None
    error: str | None = None
    provider_type: str | None = None    