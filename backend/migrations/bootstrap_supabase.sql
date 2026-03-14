-- ============================================
-- event7 - Supabase Database Bootstrap
-- Version: 0.5.0 (Custom Templates)
-- ============================================
-- DESTRUCTIVE: DROP all tables then recreate.
-- Use for clean init in dev/test.
-- Execute in Supabase Dashboard > SQL Editor
-- ============================================
-- ⚠️  DO NOT RUN IN PRODUCTION WITH DATA
-- ============================================
-- Replaces: 001_initial_schema.sql + bootstrap.sql (root)
-- Aligned with: bootstrap_postgresql.sql (same schema, different deploy)
-- Differences from PG version:
--   - DESTRUCTIVE (DROP + CREATE, no IF NOT EXISTS)
--   - RLS policies included (commented out for dev)
--   - schema_snapshots uses "references" (quoted, PG reserved word)
-- ============================================

-- ========================
-- 0. CLEANUP (reverse FK order)
-- ========================

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'registries', 'enrichments', 'schema_snapshots',
              'asyncapi_specs', 'audit_logs',
              'governance_rules', 'governance_rule_templates',
              'channels', 'channel_subjects'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

DO $$ BEGIN DROP TRIGGER IF EXISTS trg_registries_updated_at ON registries; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS trg_enrichments_updated_at ON enrichments; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS trg_asyncapi_updated_at ON asyncapi_specs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS trg_governance_rules_updated_at ON governance_rules; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS trg_governance_templates_updated_at ON governance_rule_templates; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS trg_channels_updated_at ON channels; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DROP FUNCTION IF EXISTS update_updated_at();

DROP TABLE IF EXISTS channel_subjects CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS asyncapi_specs CASCADE;
DROP TABLE IF EXISTS schema_snapshots CASCADE;
DROP TABLE IF EXISTS governance_rules CASCADE;
DROP TABLE IF EXISTS governance_rule_templates CASCADE;
DROP TABLE IF EXISTS enrichments CASCADE;
DROP TABLE IF EXISTS registries CASCADE;

DROP TYPE IF EXISTS provider_type CASCADE;
DROP TYPE IF EXISTS schema_format CASCADE;
DROP TYPE IF EXISTS data_classification CASCADE;
DROP TYPE IF EXISTS rule_scope CASCADE;
DROP TYPE IF EXISTS rule_category CASCADE;
DROP TYPE IF EXISTS rule_kind CASCADE;
DROP TYPE IF EXISTS rule_mode CASCADE;
DROP TYPE IF EXISTS rule_severity CASCADE;
DROP TYPE IF EXISTS enforcement_status CASCADE;

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
CREATE TYPE rule_scope AS ENUM ('runtime', 'control_plane', 'declarative', 'audit');
CREATE TYPE rule_category AS ENUM ('data_quality', 'schema_validation', 'data_transform', 'migration', 'access_control', 'custom');
CREATE TYPE rule_kind AS ENUM ('CONDITION', 'TRANSFORM', 'VALIDATION', 'POLICY');
CREATE TYPE rule_mode AS ENUM ('READ', 'WRITE', 'READWRITE', 'UPGRADE', 'DOWNGRADE', 'UPDOWN', 'REGISTER');
CREATE TYPE rule_severity AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE enforcement_status AS ENUM ('declared', 'expected', 'synced', 'verified', 'drifted');

-- ========================
-- 3. TABLES
-- ========================

CREATE TABLE registries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    provider_type provider_type NOT NULL,
    base_url TEXT NOT NULL,
    credentials_encrypted TEXT,
    environment TEXT NOT NULL DEFAULT 'DEV',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_registries_user_name UNIQUE (user_id, name)
);

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

CREATE TABLE asyncapi_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    spec_content JSONB NOT NULL,
    is_auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    source_schema_hash TEXT,
    source_schema_version INTEGER,
    spec_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asyncapi_registry_subject UNIQUE (registry_id, subject)
);

CREATE TABLE governance_rule_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    layer TEXT,
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE governance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    subject TEXT,
    rule_name TEXT NOT NULL,
    description TEXT,
    rule_scope rule_scope NOT NULL DEFAULT 'declarative',
    rule_category rule_category NOT NULL,
    rule_kind rule_kind NOT NULL DEFAULT 'CONDITION',
    rule_type TEXT NOT NULL DEFAULT 'CUSTOM',
    rule_mode rule_mode NOT NULL DEFAULT 'WRITE',
    expression TEXT,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    on_success TEXT,
    on_failure TEXT,
    severity rule_severity NOT NULL DEFAULT 'warning',
    enforcement_status enforcement_status NOT NULL DEFAULT 'declared',
    evaluation_source TEXT NOT NULL DEFAULT 'declared_only',
    target_type TEXT NOT NULL DEFAULT 'subject',
    target_ref TEXT,
    provider_rule_ref JSONB,
    source TEXT NOT NULL DEFAULT 'manual',
    origin_template_id UUID REFERENCES governance_rule_templates(id) ON DELETE SET NULL,
    applies_to_version INTEGER,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_governance_rules_subject UNIQUE (registry_id, subject, rule_name),
    CONSTRAINT chk_enforcement_scope CHECK (
        enforcement_status IN ('declared', 'expected') OR rule_scope IN ('runtime', 'control_plane')
    ),
    CONSTRAINT chk_policy_no_sync CHECK (
        rule_kind != 'POLICY' OR enforcement_status IN ('declared', 'expected')
    ),
    CONSTRAINT chk_kind_scope_coherence CHECK (
        (rule_kind IN ('CONDITION', 'TRANSFORM') AND rule_scope = 'runtime')
        OR (rule_kind = 'VALIDATION' AND rule_scope = 'control_plane')
        OR (rule_kind = 'POLICY')
        OR (rule_kind = 'CONDITION' AND rule_scope = 'audit')
    ),
    CONSTRAINT chk_evaluation_source CHECK (evaluation_source IN (
        'provider_config', 'schema_content', 'enrichment_metadata', 'declared_only', 'not_evaluable'
    )),
    CONSTRAINT chk_target_type CHECK (target_type IN (
        'registry', 'subject', 'group', 'namespace', 'layer', 'tag'
    )),
    CONSTRAINT chk_source CHECK (source IN (
        'manual', 'template', 'imported_provider', 'system_generated'
    ))
);

CREATE UNIQUE INDEX uq_governance_rules_global
    ON governance_rules (registry_id, rule_name) WHERE subject IS NULL;

CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    address VARCHAR(1000) NOT NULL,
    broker_type VARCHAR(50) NOT NULL CHECK (broker_type IN (
        'kafka', 'redpanda', 'rabbitmq', 'pulsar', 'nats',
        'google_pubsub', 'aws_sns_sqs', 'azure_servicebus', 'redis_streams',
        'solace', 'ibmmq', 'activemq_artemis',
        'mqtt', 'mqtt_secure',
        'websocket', 'websocket_secure',
        'anypoint_mq', 'mercure', 'stomp',
        'amazon_kinesis', 'amazon_eventbridge',
        'custom'
    )),
    resource_kind VARCHAR(50) NOT NULL CHECK (resource_kind IN (
        'topic', 'exchange', 'subject', 'queue', 'stream',
        'channel', 'destination', 'event_bus'
    )),
    messaging_pattern VARCHAR(50) NOT NULL CHECK (messaging_pattern IN (
        'topic_log', 'pubsub', 'queue',
        'request_reply', 'broadcast', 'event_bus'
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

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    registry_id UUID REFERENCES registries(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- 4. INDEXES
-- ========================

CREATE INDEX idx_registries_user_id ON registries(user_id);
CREATE INDEX idx_registries_user_active ON registries(user_id, is_active);
CREATE INDEX idx_enrichments_registry_id ON enrichments(registry_id);
CREATE INDEX idx_enrichments_subject ON enrichments(subject);
CREATE INDEX idx_enrichments_owner_team ON enrichments(owner_team);
CREATE INDEX idx_enrichments_tags ON enrichments USING GIN (tags);
CREATE INDEX idx_snapshots_registry_id ON schema_snapshots(registry_id);
CREATE INDEX idx_snapshots_registry_subject ON schema_snapshots(registry_id, subject);
CREATE INDEX idx_snapshots_captured_at ON schema_snapshots(captured_at DESC);
CREATE INDEX idx_asyncapi_registry_id ON asyncapi_specs(registry_id);
CREATE INDEX idx_governance_rules_category ON governance_rules(registry_id, rule_category);
CREATE INDEX idx_governance_rules_scope ON governance_rules(registry_id, rule_scope);
CREATE INDEX idx_governance_rules_kind ON governance_rules(registry_id, rule_kind);
CREATE INDEX idx_governance_rules_subject ON governance_rules(registry_id, subject) WHERE subject IS NOT NULL;
CREATE INDEX idx_governance_rules_tags ON governance_rules USING GIN (tags);
CREATE INDEX idx_governance_rules_scoring ON governance_rules(registry_id, severity, enforcement_status, evaluation_source);
CREATE INDEX idx_governance_rules_template ON governance_rules(origin_template_id) WHERE origin_template_id IS NOT NULL;
CREATE INDEX idx_channels_registry ON channels(registry_id);
CREATE INDEX idx_channels_broker ON channels(broker_type);
CREATE INDEX idx_channels_layer ON channels(data_layer);
CREATE INDEX idx_channels_resource ON channels(resource_kind);
CREATE INDEX idx_channel_subjects_channel ON channel_subjects(channel_id);
CREATE INDEX idx_channel_subjects_subject ON channel_subjects(subject_name);
CREATE INDEX idx_channel_subjects_strategy ON channel_subjects(binding_strategy);
CREATE INDEX idx_channel_subjects_status ON channel_subjects(binding_status);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_registry_id ON audit_logs(registry_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- ========================
-- 5. UPDATED_AT TRIGGER
-- ========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registries_updated_at BEFORE UPDATE ON registries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_enrichments_updated_at BEFORE UPDATE ON enrichments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_asyncapi_updated_at BEFORE UPDATE ON asyncapi_specs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_governance_templates_updated_at BEFORE UPDATE ON governance_rule_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_governance_rules_updated_at BEFORE UPDATE ON governance_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- 6. SEED DATA: Governance Templates (builtin)
-- ========================

INSERT INTO governance_rule_templates (template_name, display_name, description, layer, is_builtin, rules)
VALUES
('raw_layer', 'RAW Layer Governance',
 'Collection layer — raw data, fidelity to the source, few constraints',
 'raw', true,
 '[
    {"rule_name":"backward-compat","rule_scope":"control_plane","rule_category":"schema_validation","rule_kind":"VALIDATION","rule_type":"COMPATIBILITY","rule_mode":"REGISTER","expression":"BACKWARD","severity":"error","evaluation_source":"provider_config","default_enforcement":"expected","description":"Backward compatibility to avoid disrupting consumers"},
    {"rule_name":"require-source-metadata","rule_scope":"declarative","rule_category":"data_quality","rule_kind":"POLICY","rule_type":"CUSTOM","rule_mode":"WRITE","expression":null,"severity":"warning","evaluation_source":"schema_content","default_enforcement":"expected","description":"Schema must contain source_system and ingestion_timestamp fields"},
    {"rule_name":"no-transform-on-raw","rule_scope":"declarative","rule_category":"custom","rule_kind":"POLICY","rule_type":"CUSTOM","rule_mode":"READWRITE","expression":null,"severity":"info","evaluation_source":"declared_only","default_enforcement":"declared","description":"RAW data must not be transformed — fidelity to the source"}
]'::jsonb),
('core_layer', 'CORE Layer Governance',
 'Canonical layer — core business model, strong constraints, reusable',
 'core', true,
 '[
    {"rule_name":"full-transitive-compat","rule_scope":"control_plane","rule_category":"schema_validation","rule_kind":"VALIDATION","rule_type":"COMPATIBILITY","rule_mode":"REGISTER","expression":"FULL_TRANSITIVE","severity":"critical","evaluation_source":"provider_config","default_enforcement":"expected","description":"FULL_TRANSITIVE — the canonical model should never break"},
    {"rule_name":"require-doc-fields","rule_scope":"audit","rule_category":"data_quality","rule_kind":"POLICY","rule_type":"CUSTOM","rule_mode":"REGISTER","expression":null,"severity":"error","evaluation_source":"schema_content","default_enforcement":"expected","description":"All fields must have a doc (Avro) or description (JSON Schema) attribute"},
    {"rule_name":"require-id-and-timestamp","rule_scope":"runtime","rule_category":"data_quality","rule_kind":"CONDITION","rule_type":"CEL","rule_mode":"WRITE","expression":"has(value.id) && has(value.timestamp)","severity":"error","evaluation_source":"provider_config","default_enforcement":"expected","description":"Each core event must contain an ID and a timestamp"},
    {"rule_name":"encrypt-pii","rule_scope":"runtime","rule_category":"data_transform","rule_kind":"TRANSFORM","rule_type":"CEL_FIELD","rule_mode":"WRITE","expression":"typeName == ''string'' && tags.exists(t, t == ''PII'')","on_success":"ENCRYPT","on_failure":"ERROR","severity":"critical","evaluation_source":"provider_config","default_enforcement":"expected","description":"Fields tagged PII must be encrypted (CSFLE)"},
    {"rule_name":"require-owner","rule_scope":"declarative","rule_category":"custom","rule_kind":"POLICY","rule_type":"CUSTOM","rule_mode":"REGISTER","expression":null,"severity":"warning","evaluation_source":"enrichment_metadata","default_enforcement":"expected","description":"Core schema must have an owner_team defined in enrichments"}
]'::jsonb),
('refined_layer', 'REFINED Layer Governance',
 'Aggregation layer — reuses Core, period-based types',
 'refined', true,
 '[
    {"rule_name":"backward-transitive-compat","rule_scope":"control_plane","rule_category":"schema_validation","rule_kind":"VALIDATION","rule_type":"COMPATIBILITY","rule_mode":"REGISTER","expression":"BACKWARD_TRANSITIVE","severity":"error","evaluation_source":"provider_config","default_enforcement":"expected","description":"BACKWARD_TRANSITIVE — dashboards and reports must not break"},
    {"rule_name":"must-reference-core","rule_scope":"audit","rule_category":"custom","rule_kind":"POLICY","rule_type":"CUSTOM","rule_mode":"REGISTER","expression":null,"severity":"warning","evaluation_source":"schema_content","default_enforcement":"expected","description":"Refined schemas must reference Core types (no duplication)"},
    {"rule_name":"require-aggregation-period","rule_scope":"declarative","rule_category":"data_quality","rule_kind":"POLICY","rule_type":"CUSTOM","rule_mode":"WRITE","expression":null,"severity":"info","evaluation_source":"declared_only","default_enforcement":"declared","description":"Document the aggregation period in enrichments"}
]'::jsonb),
('application_layer', 'APPLICATION Layer Governance',
 'Application layer — simplified views, consumption, independent evolution',
 'application', true,
 '[
    {"rule_name":"backward-compat","rule_scope":"control_plane","rule_category":"schema_validation","rule_kind":"VALIDATION","rule_type":"COMPATIBILITY","rule_mode":"REGISTER","expression":"BACKWARD","severity":"warning","evaluation_source":"provider_config","default_enforcement":"expected","description":"Backward compatibility — client apps must not break"},
    {"rule_name":"max-fields-limit","rule_scope":"audit","rule_category":"custom","rule_kind":"POLICY","rule_type":"CUSTOM","rule_mode":"REGISTER","expression":null,"params":{"max_fields":30},"severity":"info","evaluation_source":"schema_content","default_enforcement":"declared","description":"Application schemas should remain simple (max 30 fields)"}
]'::jsonb);

-- ========================
-- 7. ROW LEVEL SECURITY (disabled for dev)
-- ========================
-- Uncomment when Supabase Auth is configured.

/*
ALTER TABLE registries ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE asyncapi_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_rule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registries_select_own" ON registries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "registries_insert_own" ON registries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "registries_update_own" ON registries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "registries_delete_own" ON registries FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "enrichments_select_own" ON enrichments FOR SELECT USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "enrichments_insert_own" ON enrichments FOR INSERT WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "enrichments_update_own" ON enrichments FOR UPDATE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "enrichments_delete_own" ON enrichments FOR DELETE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

CREATE POLICY "snapshots_select_own" ON schema_snapshots FOR SELECT USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "snapshots_insert_own" ON schema_snapshots FOR INSERT WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "snapshots_delete_own" ON schema_snapshots FOR DELETE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

CREATE POLICY "asyncapi_select_own" ON asyncapi_specs FOR SELECT USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "asyncapi_insert_own" ON asyncapi_specs FOR INSERT WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "asyncapi_update_own" ON asyncapi_specs FOR UPDATE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "asyncapi_delete_own" ON asyncapi_specs FOR DELETE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

CREATE POLICY "governance_rules_select_own" ON governance_rules FOR SELECT USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "governance_rules_insert_own" ON governance_rules FOR INSERT WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "governance_rules_update_own" ON governance_rules FOR UPDATE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "governance_rules_delete_own" ON governance_rules FOR DELETE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

CREATE POLICY "governance_templates_select_all" ON governance_rule_templates FOR SELECT USING (true);

CREATE POLICY "channels_select_own" ON channels FOR SELECT USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_insert_own" ON channels FOR INSERT WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_update_own" ON channels FOR UPDATE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_delete_own" ON channels FOR DELETE USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

CREATE POLICY "channel_subjects_select_own" ON channel_subjects FOR SELECT USING (channel_id IN (SELECT id FROM channels WHERE registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid())));
CREATE POLICY "channel_subjects_insert_own" ON channel_subjects FOR INSERT WITH CHECK (channel_id IN (SELECT id FROM channels WHERE registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid())));
CREATE POLICY "channel_subjects_delete_own" ON channel_subjects FOR DELETE USING (channel_id IN (SELECT id FROM channels WHERE registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid())));

CREATE POLICY "audit_select_own" ON audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "audit_insert_own" ON audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
*/

-- ========================
-- 8. VERIFICATION
-- ========================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;