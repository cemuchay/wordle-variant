-- Add notified_expired_at column to chat_polls to prevent duplicate expiration push notifications
ALTER TABLE public.chat_polls
ADD COLUMN IF NOT EXISTS notified_expired_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_polls_expiration_notify
ON public.chat_polls(expires_at)
WHERE is_admin_poll = true AND notified_expired_at IS NULL;
