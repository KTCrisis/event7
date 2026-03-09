-- ============================================
-- event7 - Supabase Database Setup
-- Version: 0.1.0
-- ============================================
-- Exécuter dans Supabase Dashboard > SQL Editor
-- ============================================

-- ========================
-- 1. EXTENSIONS
-- ========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- 2. ENUM TYPES
-- ========================
CREATE TYPE provider_type AS ENUM ('confluent', 'apicurio', 'glue', 'pulsar');
CREATE TYPE schema_format AS ENUM ('AVRO', 'JSON', 'PROTOBUF');
CREATE TYPE data_classification AS ENUM ('public', 'internal', 'confidential', 'restricted');

-- ========================
-- 3. TABLES
-- ========================

-- --- Registries (connexions aux Schema Registries) ---
CREATE TABLE registries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider_type provider_type NOT NULL,
    base_url TEXT NOT NULL,
    credentials_encrypted BYTEA,
    environment TEXT NOT NULL DEFAULT 'DEV',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un user ne peut pas avoir deux registries avec le même nom
    CONSTRAINT uq_registries_user_name UNIQUE (user_id, name)
);

-- --- Enrichments (metadata business ajoutée par-dessus le registry) ---
CREATE TABLE enrichments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT,
    owner_team TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    classification data_classification NOT NULL DEFAULT 'internal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un enrichissement par subject par registry
    CONSTRAINT uq_enrichments_registry_subject UNIQUE (registry_id, subject)
);

-- --- Schema Snapshots (photo périodique pour diff historique / offline) ---
CREATE TABLE schema_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    version INTEGER NOT NULL,
    schema_id INTEGER,
    schema_content JSONB NOT NULL,
    format schema_format NOT NULL DEFAULT 'AVRO',
    references JSONB NOT NULL DEFAULT '[]'::jsonb,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Une seule snapshot par subject/version/registry
    CONSTRAINT uq_snapshots_registry_subject_version UNIQUE (registry_id, subject, version)
);

-- --- AsyncAPI Specs (générées ou éditées manuellement) ---
CREATE TABLE asyncapi_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    spec_content JSONB NOT NULL,
    is_auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Une spec par subject par registry
    CONSTRAINT uq_asyncapi_registry_subject UNIQUE (registry_id, subject)
);

-- --- Audit Logs ---
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    registry_id UUID REFERENCES registries(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- 4. INDEXES
-- ========================

-- Registries
CREATE INDEX idx_registries_user_id ON registries(user_id);
CREATE INDEX idx_registries_user_active ON registries(user_id, is_active);

-- Enrichments
CREATE INDEX idx_enrichments_registry_id ON enrichments(registry_id);
CREATE INDEX idx_enrichments_subject ON enrichments(subject);
CREATE INDEX idx_enrichments_owner_team ON enrichments(owner_team);
CREATE INDEX idx_enrichments_tags ON enrichments USING GIN (tags);

-- Snapshots
CREATE INDEX idx_snapshots_registry_id ON schema_snapshots(registry_id);
CREATE INDEX idx_snapshots_registry_subject ON schema_snapshots(registry_id, subject);
CREATE INDEX idx_snapshots_captured_at ON schema_snapshots(captured_at DESC);

-- AsyncAPI
CREATE INDEX idx_asyncapi_registry_id ON asyncapi_specs(registry_id);

-- Audit
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_registry_id ON audit_logs(registry_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- ========================
-- 5. UPDATED_AT TRIGGER
-- ========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registries_updated_at
    BEFORE UPDATE ON registries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_enrichments_updated_at
    BEFORE UPDATE ON enrichments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_asyncapi_updated_at
    BEFORE UPDATE ON asyncapi_specs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- 6. ROW LEVEL SECURITY
-- ========================

-- Enable RLS on all tables
ALTER TABLE registries ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE asyncapi_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper : récupère le user_id depuis le JWT Supabase
-- auth.uid() est built-in dans Supabase

-- --- Registries : un user voit/modifie uniquement SES registries ---
CREATE POLICY "registries_select_own"
    ON registries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "registries_insert_own"
    ON registries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "registries_update_own"
    ON registries FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "registries_delete_own"
    ON registries FOR DELETE
    USING (auth.uid() = user_id);

-- --- Enrichments : via le registry owner ---
CREATE POLICY "enrichments_select_own"
    ON enrichments FOR SELECT
    USING (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "enrichments_insert_own"
    ON enrichments FOR INSERT
    WITH CHECK (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "enrichments_update_own"
    ON enrichments FOR UPDATE
    USING (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "enrichments_delete_own"
    ON enrichments FOR DELETE
    USING (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

-- --- Snapshots : via le registry owner ---
CREATE POLICY "snapshots_select_own"
    ON schema_snapshots FOR SELECT
    USING (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "snapshots_insert_own"
    ON schema_snapshots FOR INSERT
    WITH CHECK (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "snapshots_delete_own"
    ON schema_snapshots FOR DELETE
    USING (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

-- --- AsyncAPI : via le registry owner ---
CREATE POLICY "asyncapi_select_own"
    ON asyncapi_specs FOR SELECT
    USING (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "asyncapi_insert_own"
    ON asyncapi_specs FOR INSERT
    WITH CHECK (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "asyncapi_update_own"
    ON asyncapi_specs FOR UPDATE
    USING (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "asyncapi_delete_own"
    ON asyncapi_specs FOR DELETE
    USING (
        registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    );

-- --- Audit Logs : un user voit uniquement SES logs ---
CREATE POLICY "audit_select_own"
    ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "audit_insert_own"
    ON audit_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ========================
-- 7. SERVICE ROLE BYPASS
-- ========================
-- Le backend utilise la service_role key pour bypasser le RLS
-- quand nécessaire (ex: audit logs, snapshots batch)
-- C'est le comportement par défaut de Supabase avec service_role

-- ========================
-- 8. VERIFICATION
-- ========================
-- Vérifier que tout est créé
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
