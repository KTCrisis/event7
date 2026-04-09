"""
event7 - Schema Models
Modèles Pydantic unifiés pour les schemas, versions et diffs.
Ces modèles sont le contrat entre le backend et le frontend.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SchemaFormat(str, Enum):
    AVRO = "AVRO"
    JSON_SCHEMA = "JSON"
    PROTOBUF = "PROTOBUF"


class SubjectInfo(BaseModel):
    """Vue résumée d'un subject (pour les listes)"""

    subject: str
    format: SchemaFormat = SchemaFormat.AVRO
    latest_version: int = 1
    version_count: int = 1
    schema_id: int | None = None

    # Enrichissement (optionnel, depuis Supabase)
    description: str | None = None
    owner_team: str | None = None
    tags: list[str] = Field(default_factory=list)
    data_layer: str | None = None

class SchemaDetail(BaseModel):
    """Détail complet d'un schema à une version donnée"""

    subject: str
    version: int
    schema_id: int
    format: SchemaFormat
    schema_content: dict  # Le schema brut (Avro, JSON Schema...)
    references: list["SchemaReference"] = Field(default_factory=list)
    registered_at: datetime | None = None

    # Confluent Data Contracts (optional — only populated by Confluent provider)
    rule_set: dict | None = None  # {"domainRules": [...], "migrationRules": [...]}
    metadata: dict | None = None  # {"properties": {...}, "tags": {...}}


class SchemaVersion(BaseModel):
    """Une version dans l'historique"""

    version: int
    schema_id: int
    format: SchemaFormat
    schema_content: dict
    registered_at: datetime | None = None


class SchemaReference(BaseModel):
    """Référence entre schemas"""

    name: str  # Nom de la référence
    subject: str  # Subject référencé
    version: int  # Version référencée


class DiffChangeType(str, Enum):
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    UNCHANGED = "unchanged"


class FieldDiff(BaseModel):
    """Diff d'un champ individuel"""

    field_path: str  # Ex: "order.items[].price"
    change_type: DiffChangeType
    old_value: str | dict | None = None
    new_value: str | dict | None = None
    details: str | None = None  # Ex: "type changed from int to long"


class SchemaDiff(BaseModel):
    """Résultat complet d'un diff entre deux versions"""

    subject: str
    version_from: int
    version_to: int
    format: SchemaFormat
    changes: list[FieldDiff] = Field(default_factory=list)
    is_breaking: bool = False
    summary: str = ""  # Ex: "3 fields added, 1 removed, 2 modified"
