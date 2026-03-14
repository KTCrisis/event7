-- ============================================
-- event7 - Supabase Database Bootstrap
-- Version: 0.3.0 (Channel Model)
-- ============================================
-- Script DESTRUCTIF: DROP toutes les tables puis recrée.
-- Utiliser pour un init propre en dev/test.
-- Exécuter dans Supabase Dashboard > SQL Editor
-- ============================================
-- ⚠️  NE PAS EXÉCUTER EN PRODUCTION AVEC DES DONNÉES
-- ============================================

-- ========================
-- 0. CLEANUP (ordre inverse des FK)
-- ========================

-- Drop policies first (sinon DROP TABLE échoue si RLS est actif)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'registries', 'enrichments', 'schema_snapshots',
              'asyncapi_specs', 'audit_logs',
              'channels', 'channel_subjects'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_registries_updated_at ON registries;
DROP TRIGGER IF EXISTS trg_enrichments_updated_at ON enrichments;
DROP TRIGGER IF EXISTS trg_asyncapi_updated_at ON asyncapi_specs;
DROP TRIGGER IF EXISTS trg_channels_updated_at ON channels;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at();

-- Drop tables (ordre: enfants → parents)
DROP TABLE IF EXISTS channel_subjects CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS asyncapi_specs CASCADE;
DROP TABLE IF EXISTS schema_snapshots CASCADE;
DROP TABLE IF EXISTS enrichments CASCADE;
DROP TABLE IF EXISTS registries CASCADE;

-- Drop enums
DROP TYPE IF EXISTS provider_type CASCADE;
DROP TYPE IF EXISTS schema_format CASCADE;
DROP TYPE IF EXISTS data_classification CASCADE;

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
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    provider_type provider_type NOT NULL,
    base_url TEXT NOT NULL,
    credentials_encrypted TEXT,             -- TEXT (pas BYTEA) : Fernet produit du base64
    environment TEXT NOT NULL DEFAULT 'DEV',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_registries_user_name UNIQUE (user_id, name)
);

-- --- Enrichments (metadata business par-dessus le registry) ---
CREATE TABLE enrichments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT,
    owner_team TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    classification data_classification NOT NULL DEFAULT 'internal',
    data_layer VARCHAR(50) CHECK (
        data_layer IN ('raw', 'core', 'refined', 'application') OR data_layer IS NULL
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

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
    "references" JSONB NOT NULL DEFAULT '[]'::jsonb,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_snapshots_registry_subject_version UNIQUE (registry_id, subject, version)
);

-- --- AsyncAPI Specs (générées ou éditées manuellement) ---
CREATE TABLE IF NOT EXISTS asyncapi_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    spec_content JSONB NOT NULL,
    is_auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    source_schema_hash TEXT,                    -- SHA-256 du schema source (pour sync_status futur),
    source_schema_version INTEGER,
    spec_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asyncapi_registry_subject UNIQUE (registry_id, subject)
    );

-- --- Audit Logs ---
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    registry_id UUID REFERENCES registries(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Channels (abstraction multi-broker) ---
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,

    name VARCHAR(500) NOT NULL,
    address VARCHAR(1000) NOT NULL,

    broker_type VARCHAR(50) NOT NULL CHECK (broker_type IN (
        'kafka', 'redpanda', 'rabbitmq', 'pulsar', 'nats',
        'google_pubsub', 'aws_sns_sqs', 'azure_servicebus', 'redis_streams', 'custom'
    )),
    resource_kind VARCHAR(50) NOT NULL CHECK (resource_kind IN (
        'topic', 'exchange', 'subject', 'queue', 'stream'
    )),
    messaging_pattern VARCHAR(50) NOT NULL CHECK (messaging_pattern IN (
        'topic_log', 'pubsub', 'queue'
    )),

    broker_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    data_layer VARCHAR(50) CHECK (
        data_layer IN ('raw', 'core', 'refined', 'application') OR data_layer IS NULL
    ),

    description TEXT,
    owner VARCHAR(200),
    tags TEXT[] DEFAULT '{}',

    is_auto_detected BOOLEAN NOT NULL DEFAULT FALSE,
    auto_detect_source VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_channels_registry_address_broker UNIQUE (registry_id, address, broker_type)
);

-- --- Channel-Subject Bindings (pivot N:N) ---
CREATE TABLE channel_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,

    subject_name VARCHAR(500) NOT NULL,

    binding_strategy VARCHAR(50) NOT NULL CHECK (binding_strategy IN (
        'channel_bound', 'domain_bound', 'app_bound'
    )),
    schema_role VARCHAR(50) NOT NULL DEFAULT 'value' CHECK (schema_role IN (
        'value', 'key', 'header', 'envelope'
    )),

    binding_origin VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (binding_origin IN (
        'tns', 'trs', 'rns_heuristic', 'kafka_api', 'routing_key', 'attribute_filter', 'manual'
    )),

    binding_selector VARCHAR(500),

    binding_status VARCHAR(50) NOT NULL DEFAULT 'unverified' CHECK (binding_status IN (
        'active', 'missing_subject', 'stale', 'unverified'
    )),
    last_verified_at TIMESTAMPTZ,

    is_auto_detected BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_channel_subjects_binding UNIQUE (channel_id, subject_name, schema_role)
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

-- Channels
CREATE INDEX idx_channels_registry ON channels(registry_id);
CREATE INDEX idx_channels_broker ON channels(broker_type);
CREATE INDEX idx_channels_layer ON channels(data_layer);
CREATE INDEX idx_channels_resource ON channels(resource_kind);

-- Channel Subjects
CREATE INDEX idx_channel_subjects_channel ON channel_subjects(channel_id);
CREATE INDEX idx_channel_subjects_subject ON channel_subjects(subject_name);
CREATE INDEX idx_channel_subjects_strategy ON channel_subjects(binding_strategy);
CREATE INDEX idx_channel_subjects_status ON channel_subjects(binding_status);

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

CREATE TRIGGER trg_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- 6. ROW LEVEL SECURITY
-- ========================
-- Désactivé en dev (le backend utilise service_role key).
-- Décommenter la section ci-dessous quand Supabase Auth sera activé.

/*
-- Enable RLS
ALTER TABLE registries ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE asyncapi_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_subjects ENABLE ROW LEVEL SECURITY;

-- Registries
CREATE POLICY "registries_select_own" ON registries FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "registries_insert_own" ON registries FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "registries_update_own" ON registries FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "registries_delete_own" ON registries FOR DELETE
    USING (auth.uid() = user_id);

-- Enrichments (via registry owner)
CREATE POLICY "enrichments_select_own" ON enrichments FOR SELECT
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "enrichments_insert_own" ON enrichments FOR INSERT
    WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "enrichments_update_own" ON enrichments FOR UPDATE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "enrichments_delete_own" ON enrichments FOR DELETE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

-- Snapshots (via registry owner)
CREATE POLICY "snapshots_select_own" ON schema_snapshots FOR SELECT
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "snapshots_insert_own" ON schema_snapshots FOR INSERT
    WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "snapshots_delete_own" ON schema_snapshots FOR DELETE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

-- AsyncAPI (via registry owner)
CREATE POLICY "asyncapi_select_own" ON asyncapi_specs FOR SELECT
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "asyncapi_insert_own" ON asyncapi_specs FOR INSERT
    WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "asyncapi_update_own" ON asyncapi_specs FOR UPDATE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "asyncapi_delete_own" ON asyncapi_specs FOR DELETE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

-- Channels (via registry owner)
CREATE POLICY "channels_select_own" ON channels FOR SELECT
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_insert_own" ON channels FOR INSERT
    WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_update_own" ON channels FOR UPDATE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_delete_own" ON channels FOR DELETE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

-- Channel Subjects (via channel → registry owner)
CREATE POLICY "channel_subjects_select_own" ON channel_subjects FOR SELECT
    USING (channel_id IN (
        SELECT id FROM channels WHERE registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "channel_subjects_insert_own" ON channel_subjects FOR INSERT
    WITH CHECK (channel_id IN (
        SELECT id FROM channels WHERE registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    ));
CREATE POLICY "channel_subjects_delete_own" ON channel_subjects FOR DELETE
    USING (channel_id IN (
        SELECT id FROM channels WHERE registry_id IN (
            SELECT id FROM registries WHERE user_id = auth.uid()
        )
    ));

-- Audit Logs
CREATE POLICY "audit_select_own" ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "audit_insert_own" ON audit_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
*/

-- ========================
-- 7. VERIFICATION
-- ========================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;