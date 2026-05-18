-- Create client_logs table
CREATE TABLE IF NOT EXISTS public.client_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id),
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    session_id TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.client_logs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (anyone can log an error)
CREATE POLICY "Allow anonymous inserts" ON public.client_logs
    FOR INSERT WITH CHECK (true);

-- Allow users to view their own logs (optional, for debugging)
CREATE POLICY "Allow users to view own logs" ON public.client_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Index for session grouping and level filtering
CREATE INDEX IF NOT EXISTS idx_client_logs_session_id ON public.client_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_level ON public.client_logs(level);
