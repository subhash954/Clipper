-- ==============================================================================
-- CLIPPER PHASE 4.2: FINAL SECURITY + DATA TRUTH HARDENING MIGRATION
-- Enforces:
-- 1. Exact millisecond timestamp precision: NUMERIC(12, 3) across transcripts, segments, words
-- 2. Media deletion cascade: fk_transcripts_media_project ON DELETE CASCADE
-- 3. Tenant attribution for cost telemetry: user_id UUID REFERENCES public.profiles(id)
-- 4. Database-backed concurrency coordination: public.transcription_locks table
-- 5. Hardened SECURITY DEFINER replace_transcript_atomic with search_path and server-role grants
-- ==============================================================================

-- 1. Upgrade Timestamp Columns to Millisecond Precision NUMERIC(12, 3)
ALTER TABLE public.transcripts
  ALTER COLUMN duration TYPE NUMERIC(12, 3);

ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS timing_label TEXT;

ALTER TABLE public.transcript_segments
  ALTER COLUMN start_time TYPE NUMERIC(12, 3),
  ALTER COLUMN end_time TYPE NUMERIC(12, 3),
  ALTER COLUMN confidence TYPE NUMERIC(5, 4);

ALTER TABLE public.transcript_words
  ALTER COLUMN start_time TYPE NUMERIC(12, 3),
  ALTER COLUMN end_time TYPE NUMERIC(12, 3),
  ALTER COLUMN confidence TYPE NUMERIC(5, 4);

-- 2. Media Deletion Semantics: CASCADE on Media Asset Deletion
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transcripts_media_project'
  ) THEN
    ALTER TABLE public.transcripts DROP CONSTRAINT fk_transcripts_media_project;
  END IF;

  ALTER TABLE public.transcripts
    ADD CONSTRAINT fk_transcripts_media_project
    FOREIGN KEY (media_asset_id, project_id)
    REFERENCES public.media_assets(id, project_id)
    ON DELETE CASCADE;
END $$;

-- 3. Tenant Attribution on Cost Telemetry
ALTER TABLE public.cost_telemetry
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cost_telemetry_user_id ON public.cost_telemetry(user_id);

-- 4. Database-Backed Concurrency Protection Table
CREATE TABLE IF NOT EXISTS public.transcription_locks (
  lock_key TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  media_asset_id UUID,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'deepgram',
  model TEXT NOT NULL DEFAULT 'nova-2',
  timing_precision TEXT NOT NULL DEFAULT 'exact_word',
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcription_locks_expires ON public.transcription_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_transcription_locks_project ON public.transcription_locks(project_id);

-- 5. Hardened SECURITY DEFINER replace_transcript_atomic RPC Function
CREATE OR REPLACE FUNCTION public.replace_transcript_atomic(
  p_user_id UUID,
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project RECORD;
  v_media RECORD;
  v_seg JSONB;
  v_word JSONB;
BEGIN
  -- A. Authenticated User Identity Check (Fail Closed)
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: p_user_id cannot be null' USING ERRCODE = '42501';
  END IF;

  -- B. Validate Project Existence & Ownership
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Project % does not exist or has been deleted', p_project_id USING ERRCODE = 'P0002';
  END IF;

  IF v_project.user_id IS NULL OR v_project.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Access denied: user % does not own project %', p_user_id, p_project_id USING ERRCODE = '42501';
  END IF;

  -- C. Validate Media Asset Ownership & Project Association
  IF p_media_asset_id IS NOT NULL THEN
    SELECT * INTO v_media FROM public.media_assets WHERE id = p_media_asset_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Media asset % does not exist', p_media_asset_id USING ERRCODE = 'P0002';
    END IF;

    IF v_media.user_id IS NULL OR v_media.user_id <> p_user_id THEN
      RAISE EXCEPTION 'Access denied: user % does not own media asset %', p_user_id, p_media_asset_id USING ERRCODE = '42501';
    END IF;

    IF v_media.project_id IS NOT NULL AND v_media.project_id <> p_project_id THEN
      RAISE EXCEPTION 'Media asset % belongs to project %, not project %', p_media_asset_id, v_media.project_id, p_project_id USING ERRCODE = '42501';
    END IF;

    IF v_media.status = 'failed' OR v_media.status = 'deleted' OR v_media.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Media asset % is in an invalid lifecycle state (%)', p_media_asset_id, v_media.status USING ERRCODE = '22000';
    END IF;
  END IF;

  -- D. Upsert Master Transcript Record
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

  -- E. Delete Existing Child Words & Segments
  DELETE FROM public.transcript_words WHERE transcript_id = p_transcript_id;
  DELETE FROM public.transcript_segments WHERE transcript_id = p_transcript_id;

  -- F. Insert Normalized Segments
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
        (v_seg->>'start_time')::NUMERIC(12, 3),
        (v_seg->>'end_time')::NUMERIC(12, 3),
        v_seg->>'text',
        (v_seg->>'confidence')::NUMERIC(5, 4),
        (v_seg->>'speaker')::INTEGER,
        COALESCE(v_seg->'metadata', '{}'::jsonb)
      );
    END LOOP;
  END IF;

  -- G. Insert Normalized Words
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
        (v_word->>'start_time')::NUMERIC(12, 3),
        (v_word->>'end_time')::NUMERIC(12, 3),
        (v_word->>'confidence')::NUMERIC(5, 4),
        (v_word->>'speaker')::INTEGER
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'transcript_id', p_transcript_id);
END;
$$;

-- 6. Lock down Execution Permissions (Principle of Least Privilege)
REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
) FROM anon;

REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
) TO service_role;
