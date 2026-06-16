-- Create a trigger function that invokes the send-push edge function when a notification is created
create or replace function public.handle_new_notification_push()
returns trigger
security definer
language plpgsql
as $$
declare
  payload json;
  http_response record;
begin
  -- Construct the JSON payload for the edge function
  payload := json_build_object(
    'user_id', new.user_id,
    'title', coalesce(new.title, 'New Notification'),
    'body', coalesce(new.message, 'You have a new update.')
  );

  -- Perform the asynchronous HTTP POST to the send-push Edge Function
  -- Ensure that you have the vault secret or service key set up, or replace with local URL during dev
  perform net.http_post(
    url := concat(
      coalesce(
        (select value from pg_catalog.pg_settings where name = 'supabase.url'),
        'https://your-project-ref.supabase.co'
      ),
      '/functions/v1/send-push'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat('Bearer ', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1))
    ),
    body := payload
  );

  return new;
end;
$$;

-- Create the trigger on the notifications table
create or replace trigger on_notification_created
  after insert on public.notifications
  for each row
  execute function public.handle_new_notification_push();
