-- Create the public bucket for WordUp topic preview videos and screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('topic-previews', 'topic-previews', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view/download topic preview media
CREATE POLICY "Public read access for topic-previews"
ON storage.objects FOR SELECT
USING (bucket_id = 'topic-previews');

-- Allow admins (verified via public.admin_profile) to upload, update, and delete
CREATE POLICY "Admin upload access for topic-previews"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'topic-previews'
    AND EXISTS (
        SELECT 1 FROM public.admin_profile WHERE id = auth.uid()
    )
);

CREATE POLICY "Admin update access for topic-previews"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'topic-previews'
    AND EXISTS (
        SELECT 1 FROM public.admin_profile WHERE id = auth.uid()
    )
);

CREATE POLICY "Admin delete access for topic-previews"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'topic-previews'
    AND EXISTS (
        SELECT 1 FROM public.admin_profile WHERE id = auth.uid()
    )
);

