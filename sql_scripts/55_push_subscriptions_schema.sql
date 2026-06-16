-- SQL Migration to support multi-device push notifications

-- 1. Add endpoint, created_at, and last_seen_at columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'push_subscriptions' AND column_name = 'endpoint') THEN
        ALTER TABLE public.push_subscriptions ADD COLUMN endpoint TEXT;
        
        -- Populate endpoint from existing subscription JSON if possible
        UPDATE public.push_subscriptions SET endpoint = subscription->>'endpoint' WHERE endpoint IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'push_subscriptions' AND column_name = 'created_at') THEN
        ALTER TABLE public.push_subscriptions ADD COLUMN created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'push_subscriptions' AND column_name = 'last_seen_at') THEN
        ALTER TABLE public.push_subscriptions ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

-- 2. Add a unique constraint to prevent duplicate subscriptions for the same endpoint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_key') THEN
        ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
    END IF;
END $$;

-- 3. Ensure RLS is active
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Re-create RLS policies for push_subscriptions if needed
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
