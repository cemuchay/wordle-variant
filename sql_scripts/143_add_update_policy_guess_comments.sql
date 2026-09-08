-- 143_add_update_policy_guess_comments.sql
-- Fix: Allow users to edit / update their own comments in public.guess_comments

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guess_comments' 
          AND policyname = 'Users can update own comments'
    ) THEN
        CREATE POLICY "Users can update own comments" 
            ON public.guess_comments 
            FOR UPDATE 
            USING (auth.uid() = author_id)
            WITH CHECK (auth.uid() = author_id);
    END IF;
END $$;
