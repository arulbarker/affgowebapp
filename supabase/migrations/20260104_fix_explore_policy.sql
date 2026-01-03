-- Enable access to public generations for Explore feature
CREATE POLICY "Public can view public generations"
ON public.generations FOR SELECT
USING (is_public = true);

-- Verify existing policies (optional, just to be safe)
-- The existing policy "Users can view their own generations" handles private ones.
