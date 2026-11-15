-- Add extension_count column to chat_polls to track poll lifetime extensions (max 2)
ALTER TABLE public.chat_polls
ADD COLUMN IF NOT EXISTS extension_count INTEGER NOT NULL DEFAULT 0;

