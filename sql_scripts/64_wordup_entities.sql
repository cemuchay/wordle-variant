-- Up migration: Core knowledge infrastructure for WordUp procedural categories

CREATE TABLE IF NOT EXISTS wordup_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_type_difficulty ON wordup_entities(type, difficulty);

CREATE TABLE IF NOT EXISTS wordup_match_payloads (
    match_id VARCHAR(255) PRIMARY KEY,
    encrypted_payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- SECURITY LAYER (RLS Configuration)
-- ==========================================

-- 1. Configure wordup_entities
ALTER TABLE wordup_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to entities" 
ON wordup_entities FOR SELECT 
TO anon, authenticated 
USING (true);

-- 2. Configure wordup_match_payloads
ALTER TABLE wordup_match_payloads ENABLE ROW LEVEL SECURITY; 
-- (No policies created = Full client lockdown. Server-only access via service_role.)