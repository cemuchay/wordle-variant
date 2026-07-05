-- 94_wordup_handcrafted_exclusion.sql

-- 1. Create handcrafted seen history table
CREATE TABLE IF NOT EXISTS public.wordup_user_handcrafted_history (
    user_id UUID NOT NULL,
    question_id UUID NOT NULL REFERENCES public.wordup_handcrafted_questions(id) ON DELETE CASCADE,
    seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, question_id)
);

-- Index for fast user history lookup
CREATE INDEX IF NOT EXISTS idx_wordup_user_handcrafted_history_user ON public.wordup_user_handcrafted_history(user_id);

-- Enable RLS
ALTER TABLE public.wordup_user_handcrafted_history ENABLE ROW LEVEL SECURITY;

-- Policy for system/authenticated operations
CREATE POLICY "Allow all operations for service_role" ON public.wordup_user_handcrafted_history
    USING (true) WITH CHECK (true);

-- 2. Create RPC function to record seen handcrafted questions
CREATE OR REPLACE FUNCTION public.record_user_handcrafted_seen(
  p_user_ids UUID[],
  p_question_ids UUID[]
)
RETURNS VOID AS $$
BEGIN
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_question_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.wordup_user_handcrafted_history (user_id, question_id, seen_at)
  SELECT u, q, NOW()
  FROM unnest(p_user_ids) u
  CROSS JOIN unnest(p_question_ids) q
  ON CONFLICT (user_id, question_id)
  DO UPDATE SET seen_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
