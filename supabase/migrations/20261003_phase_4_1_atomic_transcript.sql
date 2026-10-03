-- ==============================================================================
-- CLIPPER PHASE 4.1: FINAL INTEGRITY HARDENING MIGRATION
-- Enforces:
-- 1. Lifecycle columns (status, deleted_at) on media_assets
-- 2. Composite UNIQUE constraint on media_assets(id, project_id)
-- 3. Composite FOREIGN KEY on transcripts(media_asset_id, project_id) -> media_assets(id, project_id)
--    Physically prevents a transcript from pointing to a media asset belonging to a different project.
-- 4. Atomic PostgreSQL RPC function replace_transcript_atomic for ACID transcript replacement.
-- ==============================================================================

-- 1. Check for any cross-project media_asset_id mismatches before applying constraints
DO $$
DECLARE
  v_mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_mismatch_count
  FROM public.transcripts t
  JOIN public.media_assets m ON t.media_asset_id = m.id
  WHERE t.project_id <> m.project_id;

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % transcript records reference media assets belonging to a different project.', v_mismatch_count;
  END IF;
END $$;

-- 2. Ensure lifecycle columns exist on public.media_assets
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3. Add composite unique constraint on media_assets(id, project_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_media_assets_id_project'
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT uq_media_assets_id_project UNIQUE (id, project_id);
  END IF;
END $$;

-- 4. Upgrade transcripts media_asset_id foreign key to composite foreign key
DO $$
BEGIN
  -- Drop legacy single-column foreign key if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transcripts_media_asset_id_fkey'
  ) THEN
    ALTER TABLE public.transcripts DROP CONSTRAINT transcripts_media_asset_id_fkey;
  END IF;

  -- Add composite foreign key enforcing project_id alignment
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transcripts_media_project'
  ) THEN
    ALTER TABLE public.transcripts
      ADD CONSTRAINT fk_transcripts_media_project
      FOREIGN KEY (media_asset_id, project_id)
      REFERENCES public.media_assets(id, project_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Atomic PostgreSQL RPC function for transcript replacement
CREATE OR REPLACE FUNCTION public.replace_transcript_atomic(
  p_transcript_id UUID,
  p_project_id UUID,
  p_media_asset_id UUID,
  p_transcript_text TEXT,
  p_words JSONB,
  p_utterances JSONB,
  p_language TEXT,
  p_source TEXT,
  p_timing_precision TEXT,
  p_provider TEXT,
  p_model TEXT,
  p_duration NUMERIC,
  p_status TEXT,
  p_error_message TEXT,
  p_metadata JSONB,
  p_segments JSONB,
  p_word_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_media RECORD;
  v_seg JSONB;
  v_word JSONB;
BEGIN
  -- 1. Validate project existence & soft delete status
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Project % does not exist or has been deleted', p_project_id USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate media_asset if specified
  IF p_media_asset_id IS NOT NULL THEN
    SELECT * INTO v_media FROM public.media_assets WHERE id = p_media_asset_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Media asset % does not exist', p_media_asset_id USING ERRCODE = 'P0002';
    END IF;
    IF v_media.project_id IS NOT NULL AND v_media.project_id <> p_project_id THEN
      RAISE EXCEPTION 'Media asset % belongs to project %, not project %', p_media_asset_id, v_media.project_id, p_project_id USING ERRCODE = '42501';
    END IF;
    IF v_media.status = 'failed' OR v_media.status = 'deleted' OR v_media.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Media asset % is in an invalid lifecycle state (%)', p_media_asset_id, v_media.status USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 3. Upsert transcript record
  INSERT INTO public.transcripts (
    id,
    project_id,
    media_asset_id,
    transcript_text,
    words,
    utterances,
    language,
    source,
    timing_precision,
    provider,
    model,
    duration,
    status,
    error_message,
    metadata,
    updated_at
  ) VALUES (
    p_transcript_id,
    p_project_id,
    p_media_asset_id,
    p_transcript_text,
    COALESCE(p_words, '[]'::jsonb),
    COALESCE(p_utterances, '[]'::jsonb),
    COALESCE(p_language, 'en'),
    COALESCE(p_source, 'deepgram'),
    COALESCE(p_timing_precision, 'exact_word'),
    COALESCE(p_provider, 'deepgram'),
    COALESCE(p_model, 'nova-2'),
    p_duration,
    COALESCE(p_status, 'completed'),
    p_error_message,
    COALESCE(p_metadata, '{}'::jsonb),
    NOW()
  )
  ON CONFLICT (project_id) DO UPDATE SET
    media_asset_id = EXCLUDED.media_asset_id,
    transcript_text = EXCLUDED.transcript_text,
    words = EXCLUDED.words,
    utterances = EXCLUDED.utterances,
    language = EXCLUDED.language,
    source = EXCLUDED.source,
    timing_precision = EXCLUDED.timing_precision,
    provider = EXCLUDED.provider,
    model = EXCLUDED.model,
    duration = EXCLUDED.duration,
    status = EXCLUDED.status,
    error_message = EXCLUDED.error_message,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  -- 4. Delete obsolete child rows for this transcript
  DELETE FROM public.transcript_words WHERE transcript_id = p_transcript_id;
  DELETE FROM public.transcript_segments WHERE transcript_id = p_transcript_id;

  -- 5. Insert segments if provided
  IF p_segments IS NOT NULL AND jsonb_array_length(p_segments) > 0 THEN
    FOR v_seg IN SELECT * FROM jsonb_array_elements(p_segments)
    LOOP
      INSERT INTO public.transcript_segments (
        id,
        transcript_id,
        segment_index,
        start_time,
        end_time,
        text,
        confidence,
        speaker,
        metadata
      ) VALUES (
        (v_seg->>'id')::UUID,
        p_transcript_id,
        (v_seg->>'segment_index')::INTEGER,
        (v_seg->>'start_time')::NUMERIC,
        (v_seg->>'end_time')::NUMERIC,
        v_seg->>'text',
        (v_seg->>'confidence')::NUMERIC,
        (v_seg->>'speaker')::INTEGER,
        COALESCE(v_seg->'metadata', '{}'::jsonb)
      );
    END LOOP;
  END IF;

  -- 6. Insert words if provided
  IF p_word_rows IS NOT NULL AND jsonb_array_length(p_word_rows) > 0 THEN
    FOR v_word IN SELECT * FROM jsonb_array_elements(p_word_rows)
    LOOP
      INSERT INTO public.transcript_words (
        id,
        transcript_id,
        segment_id,
        word_index,
        word,
        start_time,
        end_time,
        confidence,
        speaker
      ) VALUES (
        (v_word->>'id')::UUID,
        p_transcript_id,
        (v_word->>'segment_id')::UUID,
        (v_word->>'word_index')::INTEGER,
        v_word->>'word',
        (v_word->>'start_time')::NUMERIC,
        (v_word->>'end_time')::NUMERIC,
        (v_word->>'confidence')::NUMERIC,
        (v_word->>'speaker')::INTEGER
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'transcript_id', p_transcript_id);
END;
$$;
