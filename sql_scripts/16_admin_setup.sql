-- Enable pgcrypto extension if not already enabled (required for crypt password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create admin_profile table
CREATE TABLE IF NOT EXISTS public.admin_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create flagged_words table
CREATE TABLE IF NOT EXISTS public.flagged_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word VARCHAR(10) NOT NULL,
    word_length INTEGER NOT NULL,
    flagged_by UUID REFERENCES public.admin_profile(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_flagged_word UNIQUE (word)
);

-- Enable RLS on both tables
ALTER TABLE public.admin_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flagged_words ENABLE ROW LEVEL SECURITY;

-- 3. Create helper function to check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_profile WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Set up RLS Policies for admin_profile
DROP POLICY IF EXISTS "Allow authenticated to read admin profiles" ON public.admin_profile;
CREATE POLICY "Allow authenticated to read admin profiles" 
ON public.admin_profile FOR SELECT 
TO authenticated 
USING (true);

-- 5. Set up RLS Policies for flagged_words
DROP POLICY IF EXISTS "Allow admins to read flagged words" ON public.flagged_words;
CREATE POLICY "Allow admins to read flagged words"
ON public.flagged_words FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Allow admins to insert flagged words" ON public.flagged_words;
CREATE POLICY "Allow admins to insert flagged words"
ON public.flagged_words FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND auth.uid() = flagged_by);

DROP POLICY IF EXISTS "Allow admins to update flagged words" ON public.flagged_words;
CREATE POLICY "Allow admins to update flagged words"
ON public.flagged_words FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admins to delete flagged words" ON public.flagged_words;
CREATE POLICY "Allow admins to delete flagged words"
ON public.flagged_words FOR DELETE
TO authenticated
USING (public.is_admin());

-- 6. Template SQL Function to create an admin user
CREATE OR REPLACE FUNCTION public.create_admin_user(
  admin_email TEXT,
  admin_password TEXT,
  admin_username TEXT
) RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
  encrypted_pw TEXT;
BEGIN
  -- Hashing the password using crypt (blowfish crypt)
  encrypted_pw := crypt(admin_password, gen_salt('bf'));

  -- Insert into auth.users table
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    admin_email,
    encrypted_pw,
    now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('username', admin_username, 'full_name', admin_username),
    now(),
    now()
  ) RETURNING id INTO new_user_id;

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', admin_email),
    'email',
    admin_email,
    NULL,
    now(),
    now()
  );

INSERT INTO public.admin_profile (id, username, email)
VALUES (
  'user-uuid-from-supabase-auth', -- Paste their actual auth ID here
  'their_username',
  'admin@example.com'
);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
