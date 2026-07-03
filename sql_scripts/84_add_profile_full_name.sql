-- 84_add_profile_full_name.sql
-- Add full_name column to public.profiles and backfill from auth.users

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);

-- Backfill from raw_user_meta_data for existing profiles
UPDATE public.profiles p
SET full_name = u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE p.id = u.id AND p.full_name IS NULL;
