"""
event7 - AsyncAPI Models
Modèles pour la génération et le stockage des specs AsyncAPI.
"""

from datetime import datetime

from pydantic import BaseModel


class AsyncAPIGenerateRequest(BaseModel):
    """Paramètres pour la génération d'une spec AsyncAPI"""

    title: str | None = None
    description: str | None = None
    server_url: str | None = None
    include_examples: bool = True


class AsyncAPISpec(BaseModel):
    """Spec AsyncAPI stockée"""

    subject: str
    spec_content: dict  # Contenu YAML sérialisé en dict
    is_auto_generated: bool = True
    updated_at: datetime | None = None
