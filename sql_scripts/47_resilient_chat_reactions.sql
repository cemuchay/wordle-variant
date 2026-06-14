-- 47_resilient_chat_reactions.sql
-- Rebuilding chat reactions for resilience using a dedicated table and atomic triggers.

-- 1. Create message_reactions table for core chat
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, user_id)
);

-- 2. Create challenge_message_reactions table for challenge chat
CREATE TABLE IF NOT EXISTS public.challenge_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.challenge_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, user_id)
);

-- 3. Enable RLS on new tables
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_message_reactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Allow public read of reactions" ON public.message_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated users to manage their own reactions" ON public.message_reactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow public read of challenge reactions" ON public.challenge_message_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated users to manage their own challenge reactions" ON public.challenge_message_reactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Trigger function to sync reactions back to the main messages tables for fast reads
CREATE OR REPLACE FUNCTION public.sync_message_reactions_cache()
RETURNS TRIGGER AS $$
DECLARE
    target_id UUID;
    new_reactions JSONB;
BEGIN
    target_id := COALESCE(NEW.message_id, OLD.message_id);

    SELECT jsonb_object_agg(user_id, emoji)
    INTO new_reactions
    FROM public.message_reactions
    WHERE message_id = target_id;

    UPDATE public.messages
    SET reactions = COALESCE(new_reactions, '{}'::jsonb)
    WHERE id = target_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_challenge_message_reactions_cache()
RETURNS TRIGGER AS $$
DECLARE
    target_id UUID;
    new_reactions JSONB;
BEGIN
    target_id := COALESCE(NEW.message_id, OLD.message_id);

    SELECT jsonb_object_agg(user_id, emoji)
    INTO new_reactions
    FROM public.challenge_message_reactions
    WHERE message_id = target_id;

    UPDATE public.challenge_messages
    SET reactions = COALESCE(new_reactions, '{}'::jsonb)
    WHERE id = target_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create Triggers
DROP TRIGGER IF EXISTS trigger_sync_message_reactions ON public.message_reactions;
CREATE TRIGGER trigger_sync_message_reactions
AFTER INSERT OR UPDATE OR DELETE ON public.message_reactions
FOR EACH ROW EXECUTE FUNCTION public.sync_message_reactions_cache();

DROP TRIGGER IF EXISTS trigger_sync_challenge_message_reactions ON public.challenge_message_reactions;
CREATE TRIGGER trigger_sync_challenge_message_reactions
AFTER INSERT OR UPDATE OR DELETE ON public.challenge_message_reactions
FOR EACH ROW EXECUTE FUNCTION public.sync_challenge_message_reactions_cache();

-- 7. Function to toggle reaction (insert if not exists, delete if emoji matches, update if different emoji)
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
    p_message_id UUID,
    p_user_id UUID,
    p_emoji TEXT
) RETURNS VOID AS $$
BEGIN
    IF p_emoji IS NULL THEN
        DELETE FROM public.message_reactions 
        WHERE message_id = p_message_id AND user_id = p_user_id;
    ELSE
        INSERT INTO public.message_reactions (message_id, user_id, emoji)
        VALUES (p_message_id, p_user_id, p_emoji)
        ON CONFLICT (message_id, user_id) 
        DO UPDATE SET emoji = EXCLUDED.emoji;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.toggle_challenge_message_reaction(
    p_message_id UUID,
    p_user_id UUID,
    p_emoji TEXT
) RETURNS VOID AS $$
BEGIN
    IF p_emoji IS NULL THEN
        DELETE FROM public.challenge_message_reactions 
        WHERE message_id = p_message_id AND user_id = p_user_id;
    ELSE
        INSERT INTO public.challenge_message_reactions (message_id, user_id, emoji)
        VALUES (p_message_id, p_user_id, p_emoji)
        ON CONFLICT (message_id, user_id) 
        DO UPDATE SET emoji = EXCLUDED.emoji;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
