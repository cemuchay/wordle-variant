-- Allow chat_polls to be extended up to 10 days total lifetime (7 days max on creation + extensions)
ALTER TABLE public.chat_polls
  DROP CONSTRAINT IF EXISTS check_poll_max_duration;

ALTER TABLE public.chat_polls
  ADD CONSTRAINT check_poll_max_duration
  CHECK (expires_at <= created_at + interval '10 days');

