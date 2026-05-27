-- 31_welcome_email_trigger.sql
-- Setup a trigger on the profiles table to automatically send a welcome email on new user registration

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  ef_url TEXT;
  ef_secret TEXT;
  headers_json JSONB;
  body_json JSONB;
  user_email TEXT;
BEGIN
  -- Fetch the Edge Function URL and secret from public.cache_settings
  SELECT value INTO ef_url FROM public.cache_settings WHERE key = 'edge_function_url';
  SELECT value INTO ef_secret FROM public.cache_settings WHERE key = 'internal_secret';

  IF ef_url IS NULL OR ef_secret IS NULL OR ef_url = '' OR ef_secret = '' THEN
    RAISE WARNING 'Cache / system settings not configured. Skipping welcome email trigger.';
    RETURN NEW;
  END IF;

  -- Adapt the base URL to point specifically to the email-notifications endpoint
  ef_url := REPLACE(ef_url, 'redis-cache', 'email-notifications');

  -- Fetch the newly registered user's email address from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;

  IF user_email IS NULL THEN
    RAISE WARNING 'Could not retrieve email for user ID %. Skipping welcome email trigger.', NEW.id;
    RETURN NEW;
  END IF;

  -- Build headers and body JSON payload
  headers_json := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-internal-secret', ef_secret
  );

  body_json := jsonb_build_object(
    'action', 'welcome-email',
    'email', user_email,
    'username', NEW.username,
    'userId', NEW.id
  );

  -- Trigger the HTTP POST request to the Edge Function asynchronously via pg_net
  PERFORM net.http_post(
    url := ef_url,
    headers := headers_json,
    body := body_json
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger welcome email for user ID %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to public.profiles table
DROP TRIGGER IF EXISTS trigger_welcome_email_on_signup ON public.profiles;
CREATE TRIGGER trigger_welcome_email_on_signup
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_welcome_email();
