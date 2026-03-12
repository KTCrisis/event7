-- ============================================
-- event7 - Migration 003: Governance Rules Engine
-- Version: 0.3.0
-- ============================================
-- Migration INCRÉMENTALE : à exécuter sur une DB v0.2.0 existante.
-- Ajoute les tables governance_rule_templates et governance_rules.
-- Idempotent : utilise IF NOT EXISTS / DO $$ blocks.
-- ============================================

-- ========================
-- 1. ENUM TYPES
-- ========================

DO $$ BEGIN
    CREATE TYPE rule_scope AS ENUM (
        'runtime',             -- S'exécute au produce/consume (CEL, JSONATA, encryption)
        'control_plane',       -- S'applique à l'enregistrement du schéma (compatibilité, validité)
        'declarative',         -- Convention organisationnelle, non exécutable
        'audit'                -- Vérification a posteriori, scoring uniquement
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE rule_category AS ENUM (
        'data_quality',        -- Conditions sur la donnée (champs requis, formats, plages)
        'schema_validation',   -- Compatibilité, validité, intégrité du schéma
        'data_transform',      -- Transformations au produce/consume (chiffrement, masking)
        'migration',           -- Rules de migration inter-versions (upgrade/downgrade)
        'access_control',      -- Contrôle d'accès à la donnée (déclaratif)
        'custom'               -- Libre (documentation, conventions internes)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE rule_kind AS ENUM (
        'CONDITION',           -- Évalue et accepte/rejette (booléen)
        'TRANSFORM',           -- Modifie la donnée
        'VALIDATION',          -- Valide le schéma (pas la donnée)
        'POLICY'               -- Standard organisationnel (non exécutable)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE rule_mode AS ENUM (
        'READ',                -- Au consume (désérialisation)
        'WRITE',               -- Au produce (sérialisation)
        'READWRITE',           -- Les deux
        'UPGRADE',             -- Migration vers version supérieure
        'DOWNGRADE',           -- Migration vers version inférieure
        'UPDOWN',              -- Les deux directions
        'REGISTER'             -- À l'enregistrement du schéma (control-plane)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE rule_severity AS ENUM (
        'info',                -- Informatif, pas d'impact sur le score
        'warning',             -- Dégradation mineure du score
        'error',               -- Dégradation majeure
        'critical'             -- Bloquant
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE enforcement_status AS ENUM (
        'declared',            -- Documentée, pas d'attente de vérification
        'expected',            -- Attendue/obligatoire, contribue au scoring
        'synced',              -- Existe dans le provider natif
        'verified',            -- Confirmée conforme entre event7 et provider
        'drifted'              -- Écart détecté entre event7 et provider
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- 2. TABLE: governance_rule_templates (créée AVANT governance_rules pour la FK)
-- ========================

CREATE TABLE IF NOT EXISTS governance_rule_templates (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name     TEXT NOT NULL UNIQUE,
    display_name      TEXT NOT NULL,
    description       TEXT,
    layer             TEXT,                                -- 'raw', 'core', 'refined', 'application'
    rules             JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_governance_templates_updated_at ON governance_rule_templates;
CREATE TRIGGER trg_governance_templates_updated_at
    BEFORE UPDATE ON governance_rule_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- 3. TABLE: governance_rules
-- ========================

CREATE TABLE IF NOT EXISTS governance_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id         UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject             TEXT,                                       -- NULL = rule globale (tout le registry)

    -- Identification
    rule_name           TEXT NOT NULL,
    description         TEXT,

    -- Classification (trois axes)
    rule_scope          rule_scope NOT NULL DEFAULT 'declarative',
    rule_category       rule_category NOT NULL,
    rule_kind           rule_kind NOT NULL DEFAULT 'CONDITION',

    -- Définition technique
    rule_type           TEXT NOT NULL DEFAULT 'CUSTOM',
    rule_mode           rule_mode NOT NULL DEFAULT 'WRITE',
    expression          TEXT,
    params              JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags                JSONB NOT NULL DEFAULT '[]'::jsonb,
    on_success          TEXT,
    on_failure          TEXT,

    -- Gouvernance
    severity            rule_severity NOT NULL DEFAULT 'warning',
    enforcement_status  enforcement_status NOT NULL DEFAULT 'declared',
    evaluation_source   TEXT NOT NULL DEFAULT 'declared_only',

    -- Portée étendue (V1 : seuls 'registry' et 'subject' implémentés)
    target_type         TEXT NOT NULL DEFAULT 'subject',
    target_ref          TEXT,

    -- Référence provider
    provider_rule_ref   JSONB,

    -- Traçabilité
    source              TEXT NOT NULL DEFAULT 'manual',
    origin_template_id  UUID REFERENCES governance_rule_templates(id) ON DELETE SET NULL,
    applies_to_version  INTEGER,
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- 4. CONSTRAINTS
-- ========================

-- Unique: (registry_id, subject, rule_name) pour les rules avec subject
ALTER TABLE governance_rules
    DROP CONSTRAINT IF EXISTS uq_governance_rules_subject;
ALTER TABLE governance_rules
    ADD CONSTRAINT uq_governance_rules_subject
    UNIQUE (registry_id, subject, rule_name);

-- Unique partiel: (registry_id, rule_name) quand subject IS NULL
DROP INDEX IF EXISTS uq_governance_rules_global;
CREATE UNIQUE INDEX uq_governance_rules_global
    ON governance_rules (registry_id, rule_name)
    WHERE subject IS NULL;

-- CHECK: enforcement synced/verified/drifted seulement pour runtime et control_plane
ALTER TABLE governance_rules
    DROP CONSTRAINT IF EXISTS chk_enforcement_scope;
ALTER TABLE governance_rules
    ADD CONSTRAINT chk_enforcement_scope
    CHECK (
        enforcement_status IN ('declared', 'expected')
        OR rule_scope IN ('runtime', 'control_plane')
    );

-- CHECK: POLICY ne peut pas être synced/verified/drifted
ALTER TABLE governance_rules
    DROP CONSTRAINT IF EXISTS chk_policy_no_sync;
ALTER TABLE governance_rules
    ADD CONSTRAINT chk_policy_no_sync
    CHECK (
        rule_kind != 'POLICY'
        OR enforcement_status IN ('declared', 'expected')
    );

-- CHECK: cohérence kind × scope
-- CONDITION/TRANSFORM → runtime (ou CONDITION → audit pour checks)
-- VALIDATION → control_plane
-- POLICY → any scope
ALTER TABLE governance_rules
    DROP CONSTRAINT IF EXISTS chk_kind_scope_coherence;
ALTER TABLE governance_rules
    ADD CONSTRAINT chk_kind_scope_coherence
    CHECK (
        (rule_kind IN ('CONDITION', 'TRANSFORM') AND rule_scope = 'runtime')
        OR (rule_kind = 'VALIDATION' AND rule_scope = 'control_plane')
        OR (rule_kind = 'POLICY')
        OR (rule_kind = 'CONDITION' AND rule_scope = 'audit')
    );

-- CHECK: evaluation_source valeurs connues
ALTER TABLE governance_rules
    DROP CONSTRAINT IF EXISTS chk_evaluation_source;
ALTER TABLE governance_rules
    ADD CONSTRAINT chk_evaluation_source
    CHECK (evaluation_source IN (
        'provider_config', 'schema_content', 'enrichment_metadata',
        'declared_only', 'not_evaluable'
    ));

-- CHECK: target_type valeurs connues
ALTER TABLE governance_rules
    DROP CONSTRAINT IF EXISTS chk_target_type;
ALTER TABLE governance_rules
    ADD CONSTRAINT chk_target_type
    CHECK (target_type IN (
        'registry', 'subject', 'group', 'namespace', 'layer', 'tag'
    ));

-- CHECK: source valeurs connues
ALTER TABLE governance_rules
    DROP CONSTRAINT IF EXISTS chk_source;
ALTER TABLE governance_rules
    ADD CONSTRAINT chk_source
    CHECK (source IN (
        'manual', 'template', 'imported_provider', 'system_generated'
    ));

-- ========================
-- 5. INDEXES
-- ========================

CREATE INDEX IF NOT EXISTS idx_governance_rules_category
    ON governance_rules (registry_id, rule_category);

CREATE INDEX IF NOT EXISTS idx_governance_rules_scope
    ON governance_rules (registry_id, rule_scope);

CREATE INDEX IF NOT EXISTS idx_governance_rules_kind
    ON governance_rules (registry_id, rule_kind);

CREATE INDEX IF NOT EXISTS idx_governance_rules_subject
    ON governance_rules (registry_id, subject)
    WHERE subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_governance_rules_tags
    ON governance_rules USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_governance_rules_scoring
    ON governance_rules (registry_id, severity, enforcement_status, evaluation_source);

CREATE INDEX IF NOT EXISTS idx_governance_rules_template
    ON governance_rules (origin_template_id)
    WHERE origin_template_id IS NOT NULL;

-- ========================
-- 6. TRIGGERS
-- ========================

DROP TRIGGER IF EXISTS trg_governance_rules_updated_at ON governance_rules;
CREATE TRIGGER trg_governance_rules_updated_at
    BEFORE UPDATE ON governance_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- 7. SEED DATA: Templates
-- ========================

INSERT INTO governance_rule_templates (template_name, display_name, description, layer, rules)
VALUES
-- RAW Layer
('raw_layer', 'RAW Layer Governance',
 'Couche de collecte — données brutes, fidélité à la source, peu de contraintes',
 'raw',
 '[
    {
        "rule_name": "backward-compat",
        "rule_scope": "control_plane",
        "rule_category": "schema_validation",
        "rule_kind": "VALIDATION",
        "rule_type": "COMPATIBILITY",
        "rule_mode": "REGISTER",
        "expression": "BACKWARD",
        "severity": "error",
        "evaluation_source": "provider_config",
        "default_enforcement": "expected",
        "description": "Compatibilité BACKWARD pour ne pas casser les consumers"
    },
    {
        "rule_name": "require-source-metadata",
        "rule_scope": "declarative",
        "rule_category": "data_quality",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "WRITE",
        "expression": null,
        "severity": "warning",
        "evaluation_source": "schema_content",
        "default_enforcement": "expected",
        "description": "Le schéma doit contenir des champs source_system et ingestion_timestamp"
    },
    {
        "rule_name": "no-transform-on-raw",
        "rule_scope": "declarative",
        "rule_category": "custom",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "READWRITE",
        "expression": null,
        "severity": "info",
        "evaluation_source": "declared_only",
        "default_enforcement": "declared",
        "description": "Les données RAW ne doivent pas être transformées — fidélité à la source"
    }
]'::jsonb),

-- CORE Layer
('core_layer', 'CORE Layer Governance',
 'Couche canonique — modèle métier central, contraintes fortes, réutilisable',
 'core',
 '[
    {
        "rule_name": "full-transitive-compat",
        "rule_scope": "control_plane",
        "rule_category": "schema_validation",
        "rule_kind": "VALIDATION",
        "rule_type": "COMPATIBILITY",
        "rule_mode": "REGISTER",
        "expression": "FULL_TRANSITIVE",
        "severity": "critical",
        "evaluation_source": "provider_config",
        "default_enforcement": "expected",
        "description": "Compatibilité FULL_TRANSITIVE — le modèle canonique ne doit jamais casser"
    },
    {
        "rule_name": "require-doc-fields",
        "rule_scope": "audit",
        "rule_category": "data_quality",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "REGISTER",
        "expression": null,
        "severity": "error",
        "evaluation_source": "schema_content",
        "default_enforcement": "expected",
        "description": "Tous les champs doivent avoir un attribut doc (Avro) ou description (JSON Schema)"
    },
    {
        "rule_name": "require-id-and-timestamp",
        "rule_scope": "runtime",
        "rule_category": "data_quality",
        "rule_kind": "CONDITION",
        "rule_type": "CEL",
        "rule_mode": "WRITE",
        "expression": "has(value.id) && has(value.timestamp)",
        "severity": "error",
        "evaluation_source": "provider_config",
        "default_enforcement": "expected",
        "description": "Chaque événement core doit contenir un id et un timestamp"
    },
    {
        "rule_name": "encrypt-pii",
        "rule_scope": "runtime",
        "rule_category": "data_transform",
        "rule_kind": "TRANSFORM",
        "rule_type": "CEL_FIELD",
        "rule_mode": "WRITE",
        "expression": "typeName == '\''string'\'' && tags.exists(t, t == '\''PII'\'')",
        "on_success": "ENCRYPT",
        "on_failure": "ERROR",
        "severity": "critical",
        "evaluation_source": "provider_config",
        "default_enforcement": "expected",
        "description": "Les champs tagués PII doivent être chiffrés (CSFLE)"
    },
    {
        "rule_name": "require-owner",
        "rule_scope": "declarative",
        "rule_category": "custom",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "REGISTER",
        "expression": null,
        "severity": "warning",
        "evaluation_source": "enrichment_metadata",
        "default_enforcement": "expected",
        "description": "Le schéma core doit avoir un owner_team défini dans les enrichments"
    }
]'::jsonb),

-- REFINED Layer
('refined_layer', 'REFINED Layer Governance',
 'Couche d''agrégation — réutilise les types Core, period-based',
 'refined',
 '[
    {
        "rule_name": "backward-transitive-compat",
        "rule_scope": "control_plane",
        "rule_category": "schema_validation",
        "rule_kind": "VALIDATION",
        "rule_type": "COMPATIBILITY",
        "rule_mode": "REGISTER",
        "expression": "BACKWARD_TRANSITIVE",
        "severity": "error",
        "evaluation_source": "provider_config",
        "default_enforcement": "expected",
        "description": "Compatibilité BACKWARD_TRANSITIVE — dashboards et rapports ne doivent pas casser"
    },
    {
        "rule_name": "must-reference-core",
        "rule_scope": "audit",
        "rule_category": "custom",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "REGISTER",
        "expression": null,
        "severity": "warning",
        "evaluation_source": "schema_content",
        "default_enforcement": "expected",
        "description": "Les schémas refined doivent référencer des types Core (pas de duplication)"
    },
    {
        "rule_name": "require-aggregation-period",
        "rule_scope": "declarative",
        "rule_category": "data_quality",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "WRITE",
        "expression": null,
        "severity": "info",
        "evaluation_source": "declared_only",
        "default_enforcement": "declared",
        "description": "Documenter la période d''agrégation dans les enrichments"
    }
]'::jsonb),

-- APPLICATION Layer
('application_layer', 'APPLICATION Layer Governance',
 'Couche applicative — vues simplifiées, consommation, évolution indépendante',
 'application',
 '[
    {
        "rule_name": "backward-compat",
        "rule_scope": "control_plane",
        "rule_category": "schema_validation",
        "rule_kind": "VALIDATION",
        "rule_type": "COMPATIBILITY",
        "rule_mode": "REGISTER",
        "expression": "BACKWARD",
        "severity": "warning",
        "evaluation_source": "provider_config",
        "default_enforcement": "expected",
        "description": "Compatibilité BACKWARD — les apps clientes ne doivent pas casser"
    },
    {
        "rule_name": "max-fields-limit",
        "rule_scope": "audit",
        "rule_category": "custom",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "REGISTER",
        "expression": null,
        "params": {"max_fields": 30},
        "severity": "info",
        "evaluation_source": "schema_content",
        "default_enforcement": "declared",
        "description": "Les schémas application doivent rester simples (max 30 champs)"
    }
]'::jsonb)
ON CONFLICT (template_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    layer = EXCLUDED.layer,
    rules = EXCLUDED.rules,
    updated_at = NOW();

-- ========================
-- 8. VERIFICATION
-- ========================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;