-- 86_remove_db_wordup_async_triggers.sql
-- Removes the database triggers that auto-inserted async notifications,
-- so client-side push notifications (clientPush.ts) handle all notification delivery with custom rich formatting.

DROP TRIGGER IF EXISTS trigger_wordup_async_match_inserted ON public.wordup_async_matches;
DROP TRIGGER IF EXISTS trigger_wordup_async_match_updated ON public.wordup_async_matches;

DROP FUNCTION IF EXISTS public.handle_wordup_async_match_inserted();
DROP FUNCTION IF EXISTS public.handle_wordup_async_match_updated();
