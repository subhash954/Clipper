-- ==============================================================================
-- CLIPPER PHASE 4 HARDENING: RELATIONAL & RLS INTEGRITY CONSTRAINTS
-- Enforces:
-- 1. Composite UNIQUE constraint on transcript_segments(id, transcript_id)
-- 2. Composite Foreign Key on transcript_words(segment_id, transcript_id) -> transcript_segments(id, transcript_id)
--    Physically prevents a word from pointing to a segment belonging to a different transcript.
-- 3. WITH CHECK clauses on all UPDATE policies for transcripts, transcript_segments, and transcript_words.
-- ==============================================================================

-- 1. Ensure composite unique constraint on transcript_segments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_transcript_segments_id_transcript'
  ) THEN
    ALTER TABLE public.transcript_segments
      ADD CONSTRAINT uq_transcript_segments_id_transcript UNIQUE (id, transcript_id);
  END IF;
END $$;

-- 2. Ensure composite foreign key on transcript_words linking segment_id and transcript_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transcript_words_segment_transcript'
  ) THEN
    ALTER TABLE public.transcript_words
      ADD CONSTRAINT fk_transcript_words_segment_transcript
      FOREIGN KEY (segment_id, transcript_id)
      REFERENCES public.transcript_segments(id, transcript_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Harden transcripts UPDATE RLS with WITH CHECK
DROP POLICY IF EXISTS "Users can update transcripts for their projects" ON public.transcripts;
CREATE POLICY "Users can update transcripts for their projects"
  ON public.transcripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- 4. Harden transcript_segments UPDATE RLS with WITH CHECK
DROP POLICY IF EXISTS "Users can update transcript segments for their projects" ON public.transcript_segments;
CREATE POLICY "Users can update transcript segments for their projects"
  ON public.transcript_segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- 5. Harden transcript_words UPDATE RLS with WITH CHECK
DROP POLICY IF EXISTS "Users can update transcript words for their projects" ON public.transcript_words;
CREATE POLICY "Users can update transcript words for their projects"
  ON public.transcript_words FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );
