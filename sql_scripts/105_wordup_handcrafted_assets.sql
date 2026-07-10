-- 105_wordup_handcrafted_assets.sql
-- Add asset columns to wordup_handcrafted_questions

ALTER TABLE public.wordup_handcrafted_questions 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_urls TEXT[],
ADD COLUMN IF NOT EXISTS no_image_needed BOOLEAN DEFAULT FALSE;

-- Ensure RLS allows select read access to public
DROP POLICY IF EXISTS "Allow public read access to handcrafted questions" ON public.wordup_handcrafted_questions;
CREATE POLICY "Allow public read access to handcrafted questions" 
ON public.wordup_handcrafted_questions FOR SELECT 
TO anon, authenticated 
USING (true);

-- Ensure admins can perform write/update operations
DROP POLICY IF EXISTS "Allow admins to update handcrafted questions" ON public.wordup_handcrafted_questions;
CREATE POLICY "Allow admins to update handcrafted questions" 
ON public.wordup_handcrafted_questions FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admins to insert handcrafted questions" ON public.wordup_handcrafted_questions;
CREATE POLICY "Allow admins to insert handcrafted questions" 
ON public.wordup_handcrafted_questions FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admins to delete handcrafted questions" ON public.wordup_handcrafted_questions;
CREATE POLICY "Allow admins to delete handcrafted questions" 
ON public.wordup_handcrafted_questions FOR DELETE
TO authenticated
USING (public.is_admin());
