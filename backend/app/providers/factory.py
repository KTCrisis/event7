"""
event7 - Provider Factory

Placement: backend/app/providers/factory.py

Instancie le bon provider en fonction du type de registry.
Updated: Added ApicurioProvider support.
"""

from app.models.registry import ProviderType
from app.providers.base import SchemaRegistryProvider
from app.providers.confluent import ConfluentProvider
from app.providers.apicurio import ApicurioProvider
from app.utils.encryption import decrypt_credentials


def create_provider(
    provider_type: ProviderType | str,
    base_url: str,
    credentials_encrypted: bytes | str | None = None,
    credentials_plain: dict | None = None,
) -> SchemaRegistryProvider:
    """
    Factory pour créer un provider.
    Accepte soit des credentials chiffrés (depuis la DB) soit en clair (pour les tests).
    """
    if credentials_encrypted:
        creds = decrypt_credentials(credentials_encrypted)
    elif credentials_plain:
        creds = credentials_plain
    else:
        creds = {}

    # Normalize string to enum if needed
    if isinstance(provider_type, str):
        provider_type = ProviderType(provider_type)

    if provider_type == ProviderType.CONFLUENT:
        return ConfluentProvider(
            base_url=base_url,
            api_key=creds.get("api_key"),
            api_secret=creds.get("api_secret"),
        )

    if provider_type == ProviderType.APICURIO:
        return ApicurioProvider(
            base_url=base_url,
            username=creds.get("username"),
            password=creds.get("password"),
            token=creds.get("token"),
        )

    # Futurs providers
    # if provider_type == ProviderType.GLUE:
    #     return GlueProvider(...)
    # if provider_type == ProviderType.PULSAR:
    #     return PulsarProvider(...)

    raise ValueError(f"Unsupported provider type: {provider_type}")