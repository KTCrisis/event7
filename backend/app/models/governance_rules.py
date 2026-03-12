"""
event7 - Governance Rules Models
Modèles Pydantic v2 pour le moteur de governance rules & policies.

Placement: backend/app/models/governance_rules.py

Enums mappés sur les types PostgreSQL du bootstrap.sql v0.3.0.
Modèles Create/Update/Response pour l'API CRUD.
Modèles Score/Breakdown pour le scoring endpoint.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================
# Enums (mappés sur les types PostgreSQL)
# ============================================================


class RuleScope(str, Enum):
    """Nature technique de la rule."""
    RUNTIME = "runtime"
    CONTROL_PLANE = "control_plane"
    DECLARATIVE = "declarative"
    AUDIT = "audit"


class RuleCategory(str, Enum):
    """Catégorie fonctionnelle."""
    DATA_QUALITY = "data_quality"
    SCHEMA_VALIDATION = "schema_validation"
    DATA_TRANSFORM = "data_transform"
    MIGRATION = "migration"
    ACCESS_CONTROL = "access_control"
    CUSTOM = "custom"


class RuleKind(str, Enum):
    """Type d'opération."""
    CONDITION = "CONDITION"
    TRANSFORM = "TRANSFORM"
    VALIDATION = "VALIDATION"
    POLICY = "POLICY"


class RuleMode(str, Enum):
    """Mode d'exécution."""
    READ = "READ"
    WRITE = "WRITE"
    READWRITE = "READWRITE"
    UPGRADE = "UPGRADE"
    DOWNGRADE = "DOWNGRADE"
    UPDOWN = "UPDOWN"
    REGISTER = "REGISTER"


class RuleSeverity(str, Enum):
    """Sévérité / impact sur le score."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class EnforcementStatus(str, Enum):
    """Cycle de vie de l'enforcement."""
    DECLARED = "declared"
    EXPECTED = "expected"
    SYNCED = "synced"
    VERIFIED = "verified"
    DRIFTED = "drifted"


class EvaluationSource(str, Enum):
    """Comment event7 peut vérifier la rule."""
    PROVIDER_CONFIG = "provider_config"
    SCHEMA_CONTENT = "schema_content"
    ENRICHMENT_METADATA = "enrichment_metadata"
    DECLARED_ONLY = "declared_only"
    NOT_EVALUABLE = "not_evaluable"


class RuleSource(str, Enum):
    """Origine de la rule."""
    MANUAL = "manual"
    TEMPLATE = "template"
    IMPORTED_PROVIDER = "imported_provider"
    SYSTEM_GENERATED = "system_generated"


class TargetType(str, Enum):
    """Portée de la rule (V1: seuls registry et subject implémentés)."""
    REGISTRY = "registry"
    SUBJECT = "subject"
    GROUP = "group"
    NAMESPACE = "namespace"
    LAYER = "layer"
    TAG = "tag"


# ============================================================
# Governance Rule — CRUD Models
# ============================================================


class GovernanceRuleCreate(BaseModel):
    """Payload pour créer une governance rule."""

    # Identification
    subject: str | None = None  # NULL = rule globale
    rule_name: str
    description: str | None = None

    # Classification
    rule_scope: RuleScope = RuleScope.DECLARATIVE
    rule_category: RuleCategory
    rule_kind: RuleKind = RuleKind.POLICY

    # Définition technique
    rule_type: str = "CUSTOM"
    rule_mode: RuleMode = RuleMode.WRITE
    expression: str | None = None
    params: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    on_success: str | None = None
    on_failure: str | None = None

    # Gouvernance
    severity: RuleSeverity = RuleSeverity.WARNING
    enforcement_status: EnforcementStatus = EnforcementStatus.DECLARED
    evaluation_source: EvaluationSource = EvaluationSource.DECLARED_ONLY

    # Portée étendue
    target_type: TargetType = TargetType.SUBJECT
    target_ref: str | None = None


class GovernanceRuleUpdate(BaseModel):
    """Payload pour mettre à jour une governance rule (tous les champs optionnels)."""

    description: str | None = None

    # Classification
    rule_scope: RuleScope | None = None
    rule_category: RuleCategory | None = None
    rule_kind: RuleKind | None = None

    # Définition technique
    rule_type: str | None = None
    rule_mode: RuleMode | None = None
    expression: str | None = None
    params: dict | None = None
    tags: list[str] | None = None
    on_success: str | None = None
    on_failure: str | None = None

    # Gouvernance
    severity: RuleSeverity | None = None
    enforcement_status: EnforcementStatus | None = None
    evaluation_source: EvaluationSource | None = None

    # Portée étendue
    target_type: TargetType | None = None
    target_ref: str | None = None


class GovernanceRuleResponse(BaseModel):
    """Réponse complète d'une governance rule."""

    id: UUID
    registry_id: UUID
    subject: str | None = None

    # Identification
    rule_name: str
    description: str | None = None

    # Classification
    rule_scope: RuleScope
    rule_category: RuleCategory
    rule_kind: RuleKind

    # Définition technique
    rule_type: str
    rule_mode: RuleMode
    expression: str | None = None
    params: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    on_success: str | None = None
    on_failure: str | None = None

    # Gouvernance
    severity: RuleSeverity
    enforcement_status: EnforcementStatus
    evaluation_source: EvaluationSource

    # Portée étendue
    target_type: TargetType
    target_ref: str | None = None

    # Référence provider
    provider_rule_ref: dict | None = None

    # Traçabilité
    source: RuleSource
    origin_template_id: UUID | None = None
    applies_to_version: int | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class GovernanceRuleListResponse(BaseModel):
    """Réponse paginée/agrégée de la liste des rules."""

    rules: list[GovernanceRuleResponse]
    total: int
    by_kind: dict[str, int] = Field(default_factory=dict)
    by_scope: dict[str, int] = Field(default_factory=dict)
    by_enforcement: dict[str, int] = Field(default_factory=dict)
    global_rules: int = 0
    subject_rules: int = 0


# ============================================================
# Governance Rule Templates
# ============================================================


class GovernanceTemplateRule(BaseModel):
    """Définition d'une rule dans un template (subset des champs)."""

    rule_name: str
    rule_scope: RuleScope
    rule_category: RuleCategory
    rule_kind: RuleKind
    rule_type: str = "CUSTOM"
    rule_mode: RuleMode = RuleMode.REGISTER
    expression: str | None = None
    params: dict = Field(default_factory=dict)
    on_success: str | None = None
    on_failure: str | None = None
    severity: RuleSeverity = RuleSeverity.WARNING
    evaluation_source: EvaluationSource = EvaluationSource.DECLARED_ONLY
    default_enforcement: EnforcementStatus = EnforcementStatus.DECLARED
    description: str | None = None


class GovernanceTemplateResponse(BaseModel):
    """Réponse d'un template de governance rules."""

    id: UUID
    template_name: str
    display_name: str
    description: str | None = None
    layer: str | None = None
    rules: list[GovernanceTemplateRule]
    created_at: datetime
    updated_at: datetime


class ApplyTemplateRequest(BaseModel):
    """Payload pour appliquer un template à un registry/subject."""

    registry_id: UUID
    subject: str | None = None  # NULL = rules globales
    overwrite: bool = False


class ApplyTemplateResponse(BaseModel):
    """Résultat de l'application d'un template."""

    template_name: str
    rules_created: int
    rules_skipped: int  # Déjà existantes et overwrite=false
    rules_updated: int  # Overwrite=true
    rule_ids: list[UUID]


# ============================================================
# Governance Scoring
# ============================================================


class EnrichmentScoreBreakdown(BaseModel):
    """Détail du scoring enrichments."""

    has_description: bool = False
    has_owner: bool = False
    has_tags: bool = False
    has_classification: bool = False
    points: int = 0
    max_points: int = 20


class RuleScopeCount(BaseModel):
    """Compteur met/total pour un scope."""

    met: int = 0
    total: int = 0


class RuleScoreBreakdown(BaseModel):
    """Détail du scoring rules & policies."""

    total_rules: int = 0
    total_policies: int = 0
    by_scope: dict[str, RuleScopeCount] = Field(default_factory=dict)
    by_evaluation_source: dict[str, int] = Field(default_factory=dict)
    critical_met: int = 0
    critical_total: int = 0
    error_met: int = 0
    error_total: int = 0
    warning_met: int = 0
    warning_total: int = 0
    points: int = 0
    max_points: int = 50


class SchemaQualityBreakdown(BaseModel):
    """Détail du scoring qualité schema."""

    has_doc: bool = False
    has_references: bool = False
    version_count: int = 0
    compatibility_set: bool = False
    points: int = 0
    max_points: int = 30


class ScoreBreakdown(BaseModel):
    """Breakdown complet des 3 axes."""

    enrichments: EnrichmentScoreBreakdown
    rules: RuleScoreBreakdown
    schema_quality: SchemaQualityBreakdown


class ScoreConfidence(str, Enum):
    """Niveau de confiance du score."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class GovernanceScore(BaseModel):
    """Score de gouvernance d'un subject ou d'un registry."""

    registry_id: UUID
    subject: str | None = None  # NULL = score registry-level
    score: int = 0
    max_score: int = 100
    grade: str = "F"  # A, B, C, D, F
    confidence: ScoreConfidence = ScoreConfidence.LOW
    breakdown: ScoreBreakdown