-- Migration: 20261002_mission_4_studio_editor.sql
-- Mission 4: Professional Studio & Non-Destructive Timeline Versions

-- 1. Add canonical_render_spec to projects table
ALTER TABLE IF EXISTS public.projects
  ADD COLUMN IF NOT EXISTS canonical_render_spec JSONB,
  ADD COLUMN IF NOT EXISTS studio_version INTEGER DEFAULT 1;

-- 2. Create timeline_versions table
CREATE TABLE IF NOT EXISTS public.timeline_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  render_spec JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for high-performance version timeline queries
CREATE INDEX IF NOT EXISTS idx_timeline_versions_project_order 
  ON public.timeline_versions(project_id, version_number DESC);

-- Enable Row Level Security
ALTER TABLE public.timeline_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view timeline versions for projects they have access to
DROP POLICY IF EXISTS "Users can view timeline versions of accessible projects" ON public.timeline_versions;
CREATE POLICY "Users can view timeline versions of accessible projects"
  ON public.timeline_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timeline_versions.project_id
        AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

-- RLS Policy: Users can insert timeline versions for projects they own/edit
DROP POLICY IF EXISTS "Users can insert timeline versions for accessible projects" ON public.timeline_versions;
CREATE POLICY "Users can insert timeline versions for accessible projects"
  ON public.timeline_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timeline_versions.project_id
        AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

-- RLS Policy: Users can delete timeline versions for accessible projects
DROP POLICY IF EXISTS "Users can delete timeline versions for accessible projects" ON public.timeline_versions;
CREATE POLICY "Users can delete timeline versions for accessible projects"
  ON public.timeline_versions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timeline_versions.project_id
        AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );
