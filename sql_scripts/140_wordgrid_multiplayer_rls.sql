-- 140_wordgrid_multiplayer_rls.sql
-- Fixes RLS policies on public.wordgrid_matches to support matches with 3 or more players.
-- Previously, UPDATE and INSERT policies only checked `player1_id` and `player2_id`,
-- blocking the 3rd (and any subsequent) player from persisting their moves or exchanges to the database.

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can update matches they participate in" ON public.wordgrid_matches;
DROP POLICY IF EXISTS "Users can insert matches" ON public.wordgrid_matches;

-- 2. Create updated UPDATE policy allowing:
--    - player1 or player2
--    - bot matches
--    - any player whose ID is stored in the `players_data` JSONB array (e.g. [{"id": "uuid"}, ...])
CREATE POLICY "Users can update matches they participate in"
ON public.wordgrid_matches FOR UPDATE
TO authenticated
USING (
  auth.uid() = player1_id
  OR auth.uid() = player2_id
  OR is_bot_match
  OR (
    players_data IS NOT NULL
    AND players_data @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  )
)
WITH CHECK (
  auth.uid() = player1_id
  OR auth.uid() = player2_id
  OR is_bot_match
  OR (
    players_data IS NOT NULL
    AND players_data @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  )
);

-- 3. Create updated INSERT policy allowing any participant to create/insert matches
CREATE POLICY "Users can insert matches"
ON public.wordgrid_matches FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = player1_id
  OR auth.uid() = player2_id
  OR (
    players_data IS NOT NULL
    AND players_data @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  )
);
