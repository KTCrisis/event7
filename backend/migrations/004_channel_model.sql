-- ============================================
-- event7 - Migration 004: Channel Model
-- Version: 1.0.0
-- Date: 13 Mars 2026
-- ============================================
-- ADDITIVE: ne supprime rien, safe à exécuter sur une DB existante.
-- Crée: channels, channel_subjects
-- Modifie: enrichments (ajout data_layer)
-- Design doc: CHANNEL_MODEL_DESIGN.md v1.1.0
-- ============================================

-- ========================
-- 1. TABLE channels
-- ========================

CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES registries(id) ON DELETE CASCADE,

    -- Identité
    name VARCHAR(500) NOT NULL,
    address VARCHAR(1000) NOT NULL,

    -- Broker & pattern
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

    -- Métadonnées techniques (broker-specific, JSON flexible)
    broker_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Data layer (hint UX — le layer primaire vit sur enrichments)
    data_layer VARCHAR(50) CHECK (
        data_layer IN ('raw', 'core', 'refined', 'application') OR data_layer IS NULL
    ),

    -- Enrichissements
    description TEXT,
    owner VARCHAR(200),
    tags TEXT[] DEFAULT '{}',

    -- Auto-detect
    is_auto_detected BOOLEAN NOT NULL DEFAULT FALSE,
    auto_detect_source VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Contraintes
    CONSTRAINT uq_channels_registry_address_broker UNIQUE (registry_id, address, broker_type)
);

-- ========================
-- 2. TABLE channel_subjects (pivot N:N)
-- ========================

CREATE TABLE IF NOT EXISTS channel_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,

    -- Référence au subject (pas de FK — subjects vivent dans le SR, pas en DB)
    subject_name VARCHAR(500) NOT NULL,

    -- Binding conceptuel
    binding_strategy VARCHAR(50) NOT NULL CHECK (binding_strategy IN (
        'channel_bound', 'domain_bound', 'app_bound'
    )),
    schema_role VARCHAR(50) NOT NULL DEFAULT 'value' CHECK (schema_role IN (
        'value', 'key', 'header', 'envelope'
    )),

    -- Binding origine & résolution
    binding_origin VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (binding_origin IN (
        'tns', 'trs', 'rns_heuristic', 'kafka_api', 'routing_key', 'attribute_filter', 'manual'
    )),

    -- Sélecteur sub-channel
    binding_selector VARCHAR(500),

    -- Santé du binding
    binding_status VARCHAR(50) NOT NULL DEFAULT 'unverified' CHECK (binding_status IN (
        'active', 'missing_subject', 'stale', 'unverified'
    )),
    last_verified_at TIMESTAMPTZ,

    -- Auto-detect
    is_auto_detected BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Contraintes
    CONSTRAINT uq_channel_subjects_binding UNIQUE (channel_id, subject_name, schema_role)
);

-- ========================
-- 3. INDEXES
-- ========================

CREATE INDEX IF NOT EXISTS idx_channels_registry ON channels(registry_id);
CREATE INDEX IF NOT EXISTS idx_channels_broker ON channels(broker_type);
CREATE INDEX IF NOT EXISTS idx_channels_layer ON channels(data_layer);
CREATE INDEX IF NOT EXISTS idx_channels_resource ON channels(resource_kind);

CREATE INDEX IF NOT EXISTS idx_channel_subjects_channel ON channel_subjects(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_subjects_subject ON channel_subjects(subject_name);
CREATE INDEX IF NOT EXISTS idx_channel_subjects_strategy ON channel_subjects(binding_strategy);
CREATE INDEX IF NOT EXISTS idx_channel_subjects_status ON channel_subjects(binding_status);

-- ========================
-- 4. TRIGGER (updated_at) — safe if table doesn't exist yet
-- ========================

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trg_channels_updated_at ON channels;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE TRIGGER trg_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- 5. ALTER enrichments — ajout data_layer
-- ========================

ALTER TABLE enrichments ADD COLUMN IF NOT EXISTS data_layer VARCHAR(50)
    CHECK (data_layer IN ('raw', 'core', 'refined', 'application') OR data_layer IS NULL);

-- ========================
-- 6. RLS (commenté — à activer avec les autres tables)
-- ========================

/*
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_select_own" ON channels FOR SELECT
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_insert_own" ON channels FOR INSERT
    WITH CHECK (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_update_own" ON channels FOR UPDATE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));
CREATE POLICY "channels_delete_own" ON channels FOR DELETE
    USING (registry_id IN (SELECT id FROM registries WHERE user_id = auth.uid()));

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
*/

-- ========================
-- 7. VERIFICATION
-- ========================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;