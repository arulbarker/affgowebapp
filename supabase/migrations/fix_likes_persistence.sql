-- =============================================
-- FIX LIKES PERSISTENCE
-- Run this in Supabase SQL Editor
-- =============================================

-- Make sure generation_likes table exists with proper structure
CREATE TABLE IF NOT EXISTS public.generation_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, generation_id)
);

-- Enable RLS
ALTER TABLE public.generation_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view all likes" ON public.generation_likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON public.generation_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.generation_likes;

-- RLS policies for generation_likes
CREATE POLICY "Users can view all likes"
  ON public.generation_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own likes"
  ON public.generation_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON public.generation_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop existing trigger and function to recreate
DROP TRIGGER IF EXISTS on_like_insert ON public.generation_likes;
DROP TRIGGER IF EXISTS on_like_delete ON public.generation_likes;
DROP FUNCTION IF EXISTS public.update_likes_count();

-- Function to update likes_count automatically
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.generations SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.generation_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.generations SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.generation_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for auto-updating likes_count
CREATE TRIGGER on_like_insert
  AFTER INSERT ON public.generation_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

CREATE TRIGGER on_like_delete
  AFTER DELETE ON public.generation_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- Sync existing likes count (in case there's any mismatch)
UPDATE public.generations g
SET likes_count = (
  SELECT COUNT(*) FROM public.generation_likes l WHERE l.generation_id = g.id
);
