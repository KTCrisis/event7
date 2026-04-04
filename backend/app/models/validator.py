"""
event7 - Schema Validator Models
Pydantic v2 models pour le Schema Validator.

Placement: backend/app/models/validator.py
Design doc: SCHEMA_VALIDATOR_DESIGN.md v1.0.0
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.models.schema import SchemaFormat


# ====================================================================
# Enums
# ====================================================================


class Verdict(str, Enum):
    """Résultat global de la validation."""
    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"


# ====================================================================
# Request
# ====================================================================


class SchemaValidateRequest(BaseModel):
    """Input pour le Schema Validator."""
    subject: str
    schema_content: str  # JSON string du schema candidat
    schema_type: SchemaFormat = SchemaFormat.AVRO
    references: list[dict] = Field(default_factory=list)
    compare_version: str = "latest"


# ====================================================================
# Sub-results
# ====================================================================


class CompatibilityResult(BaseModel):
    """Résultat du check de compatibilité SR."""
    is_compatible: bool = True
    mode: str = "UNKNOWN"
    messages: list[str] = Field(default_factory=list)
    provider_checked: bool = True


class RuleViolation(BaseModel):
    """Une rule event7 en violation."""
    rule_id: str
    rule_name: str
    rule_scope: str
    severity: str
    message: str
    category: str = "custom"
    base_severity: str | None = None
    context_applied: bool = False


class RuleSkipped(BaseModel):
    """Une rule event7 non évaluable (runtime, control_plane)."""
    rule_id: str
    rule_name: str
    rule_scope: str
    reason: str = "Scope not evaluable at validation time"


class GovernanceResult(BaseModel):
    """Résultat de l'évaluation des governance rules event7."""
    score: int = 100
    violations: list[RuleViolation] = Field(default_factory=list)
    skipped: list[RuleSkipped] = Field(default_factory=list)
    passed: int = 0
    failed: int = 0
    total: int = 0
    context: dict | None = None


class DiffResult(BaseModel):
    """Résultat du diff contre la version actuelle."""
    has_changes: bool = False
    fields_added: list[str] = Field(default_factory=list)
    fields_removed: list[str] = Field(default_factory=list)
    fields_modified: list[str] = Field(default_factory=list)
    is_breaking: bool = False
    total_changes: int = 0
    is_new_subject: bool = False


# ====================================================================
# Response
# ====================================================================


class SchemaValidateResponse(BaseModel):
    """Rapport de validation unifié."""
    subject: str
    schema_type: SchemaFormat
    compare_version: int | None = None
    timestamp: datetime

    # 3 checks
    compatibility: CompatibilityResult
    governance: GovernanceResult
    diff: DiffResult

    # Overall verdict
    verdict: Verdict