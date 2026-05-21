DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  user_email TEXT := 'player4@example.com'; -- Change this
  user_password TEXT := 'SuperSecurePassword123'; -- Change this
  user_name TEXT := 'wordle_champ'; -- This maps to full_name for your profile trigger
BEGIN

  -- 1. Create the user in auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated', user_email,
    crypt(user_password, gen_salt('bf', 10)),
    NOW(), NULL, NOW(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', user_name), 
    NOW(), NOW(), '', '', '', ''
  );

  -- 2. Link the identity map (including the missing provider_id)
  INSERT INTO auth.identities (
    id, 
    provider_id,   -- 💡 The missing required column
    user_id, 
    identity_data, 
    provider, 
    last_sign_in_at, 
    created_at, 
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id::text, -- For email provider, provider_id matches the user UUID as text
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', user_email),
    'email', 
    NOW(), NOW(), NOW()
  );

END $$;