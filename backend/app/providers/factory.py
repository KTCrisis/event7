"""
event7 - Provider Factory
Instancie le bon provider en fonction du type de registry.

Placement: backend/app/providers/factory.py
Modification: ajout branche Apicurio + fallback username/password pour Confluent on-prem
"""

from app.models.registry import ProviderType
from app.providers.base import SchemaRegistryProvider
from app.providers.confluent import ConfluentProvider
from app.providers.apicurio import ApicurioProvider
from app.utils.encryption import decrypt_credentials


def create_provider(
    provider_type: ProviderType,
    base_url: str,
    credentials_encrypted: bytes | None = None,
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

    # --- Ensure provider_type is enum ---
    if isinstance(provider_type, str):
        provider_type = ProviderType(provider_type)

    # --- Confluent ---
    if provider_type == ProviderType.CONFLUENT:
        # Cloud mode: api_key + api_secret (Basic Auth with API credentials)
        # Self-managed mode: username + password (Basic Auth with LDAP/RBAC)
        # Both use httpx Basic Auth under the hood — same ConfluentProvider
        auth_user = creds.get("api_key") or creds.get("username")
        auth_pass = creds.get("api_secret") or creds.get("password")
        return ConfluentProvider(
            base_url=base_url,
            api_key=auth_user,
            api_secret=auth_pass,
        )

    # --- Apicurio ---
    if provider_type == ProviderType.APICURIO:
        return ApicurioProvider(
            base_url=base_url,
            username=creds.get("username"),
            password=creds.get("password"),
            token=creds.get("token"),
        )

    raise ValueError(f"Unsupported provider type: {provider_type}")