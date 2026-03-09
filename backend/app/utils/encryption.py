"""
event7 - Encryption Utility
Chiffrement AES des credentials registries via Fernet.
"""

from cryptography.fernet import Fernet, InvalidToken
from loguru import logger

from app.config import get_settings


def get_cipher() -> Fernet:
    settings = get_settings()
    if not settings.encryption_key:
        raise ValueError("ENCRYPTION_KEY not configured")
    return Fernet(settings.encryption_key.encode())


def encrypt_credentials(data: dict) -> bytes:
    """Chiffre un dict de credentials en bytes"""
    import json

    cipher = get_cipher()
    return cipher.encrypt(json.dumps(data).encode())


def decrypt_credentials(encrypted: bytes) -> dict:
    """Déchiffre des credentials"""
    import json

    cipher = get_cipher()
    try:
        return json.loads(cipher.decrypt(encrypted).decode())
    except InvalidToken:
        logger.error("Failed to decrypt credentials - invalid key")
        raise ValueError("Invalid encryption key or corrupted data")
