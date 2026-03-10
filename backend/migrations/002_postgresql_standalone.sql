-- ============================================
-- event7 - PostgreSQL Standalone Schema
-- Version: 0.2.0 (GKE / on-prem compatible)
-- ============================================
-- Compatible with both Supabase Cloud and plain PostgreSQL.
-- Differences from 001_initial_schema.sql:
--   - No REFERENCES auth.users (no Supabase Auth)
--   - No RLS policies using auth.uid()
--   - user_id is plain UUID (managed by application layer)
--   - credentials_encrypted is TEXT (not BYTEA, for Fernet compat)
-- ============================================

-- ========================
-- 1. EXTENSIONS
-- ========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- 2. ENUM TYPES
-- ========================
DO $$ BEGIN
    CREATE TYPE provider_type AS ENUM ('confluent', 'apicurio', 'glue', 'pulsar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE schema_format AS ENUM ('AVRO', 'JSON', 'PROTOBUF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE data_classification AS ENUM ('public', 'internal', 'confidential', 'restricted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- 3. TABLES
-- ========================

CREATE TABLE IF NOT EXISTS registries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,  -- No FK to auth.users (app-managed)
    name TEXT NOT NULL,
    provider_type provider_type NOT NULL,
    base_url TEXT NOT NULL,
    credentials_encrypted TEXT,  -- TEXT for Fernet base64 compat
    environment TEXT NOT NULL DEFAULT 'DEV',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_registries_user_name UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS enrichments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT,
    owner_team TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    classification data_classification NOT NULL DEFAULT 'internal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrichments_registry_subject UNIQUE (registry_id, subject)
);

CREATE TABLE IF NOT EXISTS schema_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    version INTEGER NOT NULL,
    schema_id INTEGER,
    schema_content JSONB NOT NULL,
    format schema_format NOT NULL DEFAULT 'AVRO',
    schema_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_snapshots_registry_subject_version UNIQUE (registry_id, subject, version)
);

CREATE TABLE IF NOT EXISTS asyncapi_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    spec_content JSONB NOT NULL,
    is_auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asyncapi_registry_subject UNIQUE (registry_id, subject)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,  -- No FK to auth.users
    registry_id UUID REFERENCES registries(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- 4. INDEXES
-- ========================

CREATE INDEX IF NOT EXISTS idx_registries_user_id ON registries(user_id);
CREATE INDEX IF NOT EXISTS idx_registries_user_active ON registries(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_enrichments_registry_id ON enrichments(registry_id);
CREATE INDEX IF NOT EXISTS idx_enrichments_subject ON enrichments(subject);
CREATE INDEX IF NOT EXISTS idx_enrichments_owner_team ON enrichments(owner_team);
CREATE INDEX IF NOT EXISTS idx_enrichments_tags ON enrichments USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_snapshots_registry_id ON schema_snapshots(registry_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_registry_subject ON schema_snapshots(registry_id, subject);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON schema_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_asyncapi_registry_id ON asyncapi_specs(registry_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_registry_id ON audit_logs(registry_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);

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

DROP TRIGGER IF EXISTS trg_registries_updated_at ON registries;
CREATE TRIGGER trg_registries_updated_at
    BEFORE UPDATE ON registries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_enrichments_updated_at ON enrichments;
CREATE TRIGGER trg_enrichments_updated_at
    BEFORE UPDATE ON enrichments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_asyncapi_updated_at ON asyncapi_specs;
CREATE TRIGGER trg_asyncapi_updated_at
    BEFORE UPDATE ON asyncapi_specs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- 6. NO RLS (app-level auth)
-- ========================
-- Security is handled at the application layer (FastAPI middleware).
-- For Supabase deployment, use 001_initial_schema.sql with RLS policies.

-- ========================
-- 7. VERIFICATION
-- ========================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
