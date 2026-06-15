-- 49_extend_chat_retention.sql
-- Extend retention of general, game_analysis, and DM chat messages/images from 24 hours to 7 days.

CREATE OR REPLACE FUNCTION public.purge_expired_chat_messages()
RETURNS void AS $$
BEGIN
    -- Delete expired chat messages (7 days limit for general, game_analysis, dm)
    DELETE FROM public.messages 
    WHERE created_at < now() - INTERVAL '7 days'
      AND group_id IN (
          SELECT id FROM public.chat_groups 
          WHERE type IN ('general', 'game_analysis', 'dm')
      );
      
    -- Delete expired chat images from storage matching general, game_analysis, dm
    -- We can delete objects older than 7 days in 'chat-images' bucket
    DELETE FROM storage.objects 
    WHERE bucket_id = 'chat-images' 
      AND created_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
