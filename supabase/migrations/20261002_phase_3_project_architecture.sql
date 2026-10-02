-- =====================================================================
-- CLIPPER PHASE 3: REAL PROJECT & DATABASE ARCHITECTURE MIGRATION
-- Canonical domain relationships, optimistic concurrency, soft deletion,
-- timeline versioning, and strict tenant isolation.
-- =====================================================================

-- 1. UPGRADE PROJECTS TABLE
ALTER TABLE IF EXISTS public.projects
  ADD COLUMN IF NOT EXISTS active_media_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_version_id UUID,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Normalize project status check constraint to support canonical project state machine
ALTER TABLE IF EXISTS public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE IF EXISTS public.projects ADD CONSTRAINT projects_status_check CHECK (
  status IN (
    'draft',
    'uploading',
    'processing',
    'ready',
    'editing',
    'rendering',
    'completed',
    'failed',
    -- Legacy compatibility statuses
    'created',
    'ingesting',
    'media_ready',
    'transcribing',
    'transcript_ready',
    'analyzing',
    'clips_ready',
    'render_queued',
    'export_ready'
  )
);

-- 2. UPGRADE CLIPS TABLE
ALTER TABLE IF EXISTS public.clips
  ADD COLUMN IF NOT EXISTS source_media_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL;

-- 3. UPGRADE TRANSCRIPTS TABLE
ALTER TABLE IF EXISTS public.transcripts
  ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL;

-- 4. ENSURE TIMELINE_VERSIONS TABLE EXISTS & UPGRADE
CREATE TABLE IF NOT EXISTS public.timeline_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  render_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. UPGRADE RENDER_JOBS TABLE
ALTER TABLE IF EXISTS public.render_jobs
  ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES public.timeline_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS input_media_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS output_media_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL;

-- 6. PERFORMANCE & TENANT QUERY INDEXES
CREATE INDEX IF NOT EXISTS idx_projects_user_created 
  ON public.projects(user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at 
  ON public.projects(deleted_at);

CREATE INDEX IF NOT EXISTS idx_projects_active_media 
  ON public.projects(active_media_id);

CREATE INDEX IF NOT EXISTS idx_timeline_versions_project_version 
  ON public.timeline_versions(project_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_clips_project_id 
  ON public.clips(project_id);

CREATE INDEX IF NOT EXISTS idx_transcripts_project_id 
  ON public.transcripts(project_id);

CREATE INDEX IF NOT EXISTS idx_render_jobs_project_id 
  ON public.render_jobs(project_id);

CREATE INDEX IF NOT EXISTS idx_render_jobs_user_id 
  ON public.render_jobs(user_id);

-- 7. HARDEN ROW-LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

-- Remove any legacy permissive policies
DROP POLICY IF EXISTS "Users can view timeline versions of accessible projects" ON public.timeline_versions;
DROP POLICY IF EXISTS "Users can insert timeline versions for accessible projects" ON public.timeline_versions;
DROP POLICY IF EXISTS "Users can delete timeline versions for accessible projects" ON public.timeline_versions;

-- Projects Policy: strictly isolate by authenticated user, hide soft-deleted
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (
    (auth.uid() = user_id OR public.is_admin())
    AND deleted_at IS NULL
  );

-- Timeline Versions: strictly enforce project ownership without null-auth bypass
CREATE POLICY "Users can view timeline versions of owned projects"
  ON public.timeline_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timeline_versions.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert timeline versions for owned projects"
  ON public.timeline_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timeline_versions.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can delete timeline versions for owned projects"
  ON public.timeline_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timeline_versions.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );
