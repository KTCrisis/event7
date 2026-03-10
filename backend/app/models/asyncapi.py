"""
event7 - AsyncAPI Models
Modèles pour la génération et le stockage des specs AsyncAPI.

Placement: backend/app/models/asyncapi.py

Changelog:
- v2: Added Kafka binding params (topic_name, partitions, replication_factor)
      Added include_key_schema flag for key/value separation
"""

from datetime import datetime

from pydantic import BaseModel


class AsyncAPIGenerateRequest(BaseModel):
    """Paramètres pour la génération d'une spec AsyncAPI."""

    # --- Existing params ---
    title: str | None = None
    description: str | None = None
    server_url: str | None = None
    include_examples: bool = True

    # --- Kafka binding params (new) ---
    topic_name: str | None = None           # Override topic name (default: inferred from subject)
    partitions: int | None = None           # Topic partition count (for channel binding)
    replication_factor: int | None = None   # Topic replication factor (for channel binding)
    include_key_schema: bool = True         # Try to fetch and include -key schema

    # --- Confluent-specific params (new) ---
    include_confluent_bindings: bool = True  # Add Magic Byte / schema encoding bindings


class AsyncAPISpec(BaseModel):
    """Spec AsyncAPI stockée."""

    subject: str
    spec_content: dict  # Contenu YAML sérialisé en dict
    is_auto_generated: bool = True
    updated_at: datetime | None = None