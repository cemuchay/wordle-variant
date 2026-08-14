-- ====================================================================
-- SQL Setup Script: Row Level Security (RLS) Policies for `user_awards`
-- ====================================================================
-- Grants permissions for authenticated client users to insert and update
-- their earned award rows in the user_awards table without 403 Forbidden errors.

-- 1. Enable Row Level Security
ALTER TABLE user_awards ENABLE ROW LEVEL SECURITY;

-- 2. Allow authenticated users to insert their own earned awards
DROP POLICY IF EXISTS "Users can insert their own awards" ON user_awards;
CREATE POLICY "Users can insert their own awards" 
ON user_awards 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Allow authenticated users to update/upsert their own awards
DROP POLICY IF EXISTS "Users can update their own awards" ON user_awards;
CREATE POLICY "Users can update their own awards" 
ON user_awards 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 4. Allow public reading of user awards (for trophy cabinets)
DROP POLICY IF EXISTS "Anyone can view user awards" ON user_awards;
CREATE POLICY "Anyone can view user awards" 
ON user_awards 
FOR SELECT 
TO public 
USING (true);
