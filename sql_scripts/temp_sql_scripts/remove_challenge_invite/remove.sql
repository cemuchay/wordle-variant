-- Temporarily disables CHALLENGE_INVITE notifications while WordUp is in beta
DROP TRIGGER IF EXISTS trigger_wordup_match_inserted ON public.wordup_matches;
DROP FUNCTION IF EXISTS public.handle_wordup_match_inserted;
