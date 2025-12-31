-- Create storage bucket for AI generations
INSERT INTO storage.buckets (id, name, public) VALUES ('generations', 'generations', true);

-- Allow authenticated users to upload to generations bucket
CREATE POLICY "Authenticated users can upload generations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to generations
CREATE POLICY "Public can read generations"
ON storage.objects FOR SELECT
USING (bucket_id = 'generations');