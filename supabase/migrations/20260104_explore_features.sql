-- Migration: Add Explore Tab Features
-- Please run this in Supabase Dashboard > SQL Editor

-- 1. Add is_public and likes_count to generations table
ALTER TABLE public.generations 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 2. Create generation_likes table to track user likes
CREATE TABLE IF NOT EXISTS public.generation_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, generation_id)
);

-- 3. Enable RLS on generation_likes
ALTER TABLE public.generation_likes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for generation_likes

-- Users can view likes (public)
CREATE POLICY "Public can view likes"
  ON public.generation_likes FOR SELECT
  USING (true);

-- Users can insert their own likes
CREATE POLICY "Users can like generations"
  ON public.generation_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own likes
CREATE POLICY "Users can unlike generations"
  ON public.generation_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 5. RLS Policy Update for Generations (Public Access)
-- Currently: "Users can view their own generations"
-- New: "Public can view public generations" OR "Users can view their own"

CREATE POLICY "Public can view public generations"
  ON public.generations FOR SELECT
  USING (is_public = true);

-- 6. Helper function to increment/decrement likes
CREATE OR REPLACE FUNCTION public.handle_new_like()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.generations
  SET likes_count = likes_count + 1
  WHERE id = NEW.generation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_unlike()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.generations
  SET likes_count = likes_count - 1
  WHERE id = OLD.generation_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for likes
DROP TRIGGER IF EXISTS on_like_created ON public.generation_likes;
CREATE TRIGGER on_like_created
  AFTER INSERT ON public.generation_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_like();

DROP TRIGGER IF EXISTS on_like_deleted ON public.generation_likes;
CREATE TRIGGER on_like_deleted
  AFTER DELETE ON public.generation_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_unlike();
