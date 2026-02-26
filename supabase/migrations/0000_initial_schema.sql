-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Untitled Project',
  layers JSONB DEFAULT '[]'::jsonb,
  layer_order JSONB DEFAULT '[]'::jsonb,
  timeline_snapshot JSONB DEFAULT '{}'::jsonb,
  canvas_width INTEGER DEFAULT 680,
  canvas_height INTEGER DEFAULT 445,
  aspect_ratio TEXT,
  background_color TEXT DEFAULT '#000000',
  background_settings JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Active project constraint (one active project per user)
CREATE UNIQUE INDEX IF NOT EXISTS single_active_project_per_user ON public.projects(user_id) WHERE is_active = true;

-- Create motions table
CREATE TABLE IF NOT EXISTS public.motions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  data JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'featured')),
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  use_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- RLS for projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects" 
ON public.projects FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- RLS for motions
ALTER TABLE public.motions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved motions"
ON public.motions FOR SELECT
USING (status IN ('approved', 'featured'));

CREATE POLICY "Authenticated users can submit motions"
ON public.motions FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can view their own submitted motions"
ON public.motions FOR SELECT
USING (auth.uid() = submitted_by);

-- Refresh updated_at triggers
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_modtime
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_motions_modtime
BEFORE UPDATE ON public.motions
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
