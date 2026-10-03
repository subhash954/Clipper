-- ==============================================================================
-- CLIPPER PHASE 4.3: FINAL TRANSCRIPT REPLACEMENT + SCHEMA SECURITY HARDENING MIGRATION
-- Enforces:
-- 1. Canonical transcript ID resolution in replace_transcript_atomic (prevents parent FK violation)
-- 2. Persistence of timing_label in replace_transcript_atomic
-- 3. Row Level Security & privilege lockdown on public.transcription_locks
-- 4. Complete cleanup of old function overloads
-- ==============================================================================

-- 1. Drop Stale Overloaded Functions
DROP FUNCTION IF EXISTS public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
);
DROP FUNCTION IF EXISTS public.replace_transcript_atomic(
  JSONB, UUID, UUID, JSONB, JSONB, JSONB
);

-- 2. Hardened Canonical replace_transcript_atomic RPC Function
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
  p_timing_label TEXT,
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
  v_transcript_id UUID;
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

  -- D. Resolve Canonical Existing Transcript ID (Preserve Existing Parent ID)
  SELECT id INTO v_transcript_id FROM public.transcripts WHERE project_id = p_project_id;
  IF v_transcript_id IS NULL THEN
    v_transcript_id := p_transcript_id;
  END IF;

  -- E. Upsert Master Transcript Record
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
    timing_label,
    provider,
    model,
    duration,
    status,
    error_message,
    metadata,
    updated_at
  ) VALUES (
    v_transcript_id,
    p_project_id,
    p_media_asset_id,
    p_transcript_text,
    COALESCE(p_words, '[]'::jsonb),
    COALESCE(p_utterances, '[]'::jsonb),
    COALESCE(p_language, 'en'),
    COALESCE(p_source, 'deepgram'),
    COALESCE(p_timing_precision, 'exact_word'),
    p_timing_label,
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
    timing_label = EXCLUDED.timing_label,
    provider = EXCLUDED.provider,
    model = EXCLUDED.model,
    duration = EXCLUDED.duration,
    status = EXCLUDED.status,
    error_message = EXCLUDED.error_message,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_transcript_id;

  -- F. Delete Existing Child Words & Segments for Canonical Transcript
  DELETE FROM public.transcript_words WHERE transcript_id = v_transcript_id;
  DELETE FROM public.transcript_segments WHERE transcript_id = v_transcript_id;

  -- G. Insert Normalized Segments Using Canonical v_transcript_id
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
        v_transcript_id,
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

  -- H. Insert Normalized Words Using Canonical v_transcript_id
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
        v_transcript_id,
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

  RETURN jsonb_build_object('success', true, 'transcript_id', v_transcript_id);
END;
$$;

-- 3. Lock down Execution Permissions (Principle of Least Privilege)
REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
) FROM anon;

REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
) TO service_role;

-- 4. Secure Database-Backed Concurrency Protection Table (transcription_locks)
ALTER TABLE public.transcription_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.transcription_locks FROM PUBLIC;
REVOKE ALL ON public.transcription_locks FROM anon;
REVOKE ALL ON public.transcription_locks FROM authenticated;

GRANT ALL ON public.transcription_locks TO service_role;
