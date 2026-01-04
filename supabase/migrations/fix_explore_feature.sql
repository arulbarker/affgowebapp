-- =============================================
-- FIX FOR EXPLORE FEATURE
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add missing columns to generations table
ALTER TABLE public.generations 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

ALTER TABLE public.generations 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 2. Create table for likes (if not exists)
CREATE TABLE IF NOT EXISTS public.generation_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, generation_id)
);

-- 3. Enable RLS on generation_likes
ALTER TABLE public.generation_likes ENABLE ROW LEVEL SECURITY;

-- 4. Add RLS policy for PUBLIC generations (this is the KEY fix!)
-- Everyone can view public generations
CREATE POLICY "Anyone can view public generations"
  ON public.generations FOR SELECT
  USING (is_public = true);

-- 5. Add RLS policy for users to update their own generations (for publish feature)
CREATE POLICY "Users can update their own generations"
  ON public.generations FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. RLS policies for generation_likes
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

-- 7. Function to update likes_count automatically
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.generations SET likes_count = likes_count + 1 WHERE id = NEW.generation_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.generations SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.generation_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Triggers for auto-updating likes_count
DROP TRIGGER IF EXISTS on_like_insert ON public.generation_likes;
CREATE TRIGGER on_like_insert
  AFTER INSERT ON public.generation_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

DROP TRIGGER IF EXISTS on_like_delete ON public.generation_likes;
CREATE TRIGGER on_like_delete
  AFTER DELETE ON public.generation_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();
