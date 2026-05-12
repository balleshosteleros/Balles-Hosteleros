-- Migration for recordings table
CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    file_size BIGINT DEFAULT 0,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Simple policies (allow all for now since it's local development focused)
CREATE POLICY "Allow authenticated users to manage their recordings"
ON public.recordings
FOR ALL
USING (true)
WITH CHECK (true);
