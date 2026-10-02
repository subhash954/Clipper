-- =====================================================================
-- CLIPPER PHASE 3: RLS POLICY HARDENING & FULL CRUD COVERAGE
-- Completes Row-Level Security for projects, timeline_versions,
-- clips, and transcripts with soft-deletion awareness.
-- =====================================================================

-- 1. HARDEN PROJECTS UPDATE & DELETE
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (
    (auth.uid() = user_id OR public.is_admin())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (auth.uid() = user_id OR public.is_admin())
  );

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- 2. HARDEN TIMELINE_VERSIONS UPDATE
DROP POLICY IF EXISTS "Users can update timeline versions of owned projects" ON public.timeline_versions;
CREATE POLICY "Users can update timeline versions of owned projects"
  ON public.timeline_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timeline_versions.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timeline_versions.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

-- 3. HARDEN TRANSCRIPTS (FULL CRUD WITH PARENT SOFT-DELETE FILTER)
DROP POLICY IF EXISTS "Users can view transcripts of their projects" ON public.transcripts;
CREATE POLICY "Users can view transcripts of their projects"
  ON public.transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = transcripts.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert transcripts for their projects" ON public.transcripts;
CREATE POLICY "Users can insert transcripts for their projects"
  ON public.transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = transcripts.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can update transcripts for their projects" ON public.transcripts;
CREATE POLICY "Users can update transcripts for their projects"
  ON public.transcripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = transcripts.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete transcripts for their projects" ON public.transcripts;
CREATE POLICY "Users can delete transcripts for their projects"
  ON public.transcripts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = transcripts.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

-- 4. HARDEN CLIPS (FULL CRUD WITH PARENT SOFT-DELETE FILTER)
DROP POLICY IF EXISTS "Users can view clips of their projects" ON public.clips;
CREATE POLICY "Users can view clips of their projects"
  ON public.clips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = clips.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert clips for their projects" ON public.clips;
CREATE POLICY "Users can insert clips for their projects"
  ON public.clips FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = clips.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can update clips for their projects" ON public.clips;
CREATE POLICY "Users can update clips for their projects"
  ON public.clips FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = clips.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete clips for their projects" ON public.clips;
CREATE POLICY "Users can delete clips for their projects"
  ON public.clips FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = clips.project_id
        AND (p.user_id = auth.uid() OR public.is_admin())
        AND p.deleted_at IS NULL
    )
  );
