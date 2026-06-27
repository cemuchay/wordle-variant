CREATE TABLE IF NOT EXISTS wordup_handcrafted_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    prompt TEXT NOT NULL,
    choices TEXT[] NOT NULL,
    answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    expires_at TIMESTAMPTZ, -- optional expiry for content decay
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries by category and expiry
CREATE INDEX IF NOT EXISTS idx_wordup_handcrafted_category_expiry ON wordup_handcrafted_questions(category, expires_at);
