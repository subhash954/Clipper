-- ==============================================================================
-- CLIPPER PHASE 4.5: FINAL STALE-WORKER WRITE PROTECTION & FENCING MIGRATION
-- Enforces:
-- 1. Monotonically increasing lease_generation sequence and column on transcription_locks
-- 2. Lease-aware atomic transcript replacement: replace_transcript_atomic requires
--    authoritative lease ownership (p_lease_token, p_lock_key, p_lease_generation)
-- 3. Row-level exclusive lock on transcription_locks (FOR UPDATE) inside replace_transcript_atomic
-- 4. Rejection of missing, superseded, or expired leases at the database transaction boundary
-- 5. Atomic project state transition to 'transcript_ready' within the same transaction
-- 6. Canonical parent transcript ID preservation and child FK cascading
-- ==============================================================================

-- 1. Add monotonically increasing lease_generation sequence and column
CREATE SEQUENCE IF NOT EXISTS public.transcription_lease_generation_seq START WITH 1;

ALTER TABLE IF EXISTS public.transcription_locks
  ADD COLUMN IF NOT EXISTS lease_generation BIGINT NOT NULL DEFAULT nextval('public.transcription_lease_generation_seq');

CREATE INDEX IF NOT EXISTS idx_transcription_locks_generation
  ON public.transcription_locks(lease_generation);

-- 2. Drop old 19-parameter function signature to eliminate un-fenced bypass paths
DROP FUNCTION IF EXISTS public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB
);

-- 3. Create Hardened Lease-Aware replace_transcript_atomic RPC Function
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
  p_word_rows JSONB,
  p_lease_token UUID,
  p_lock_key TEXT DEFAULT NULL,
  p_lease_generation BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project RECORD;
  v_media RECORD;
  v_lock RECORD;
  v_lock_key TEXT;
  v_transcript_id UUID;
  v_seg JSONB;
  v_word JSONB;
BEGIN
  -- A. Authenticated User Identity Check (Fail Closed)
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: p_user_id cannot be null' USING ERRCODE = '42501';
  END IF;

  -- B. Active Lease Ownership Validation (Fencing & Stale-Worker Protection)
  -- 1. Validate that p_lease_token is provided
  IF p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Active lease_token is required to commit transcript' USING ERRCODE = '55P03';
  END IF;

  -- 2. Derive or use provided lock_key
  IF p_lock_key IS NOT NULL AND length(trim(p_lock_key)) > 0 THEN
    v_lock_key := p_lock_key;
  ELSE
    v_lock_key := p_project_id::TEXT || ':' || COALESCE(p_media_asset_id::TEXT, 'none') || ':deepgram:nova-2:exact_word';
  END IF;

  -- 3. Row-level exclusive lock on the active lease row
  SELECT * INTO v_lock
  FROM public.transcription_locks
  WHERE lock_key = v_lock_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transcription lease missing for lock %', v_lock_key USING ERRCODE = '55P03';
  END IF;

  -- 4. Verify lease token ownership
  IF v_lock.lease_token <> p_lease_token THEN
    RAISE EXCEPTION 'Stale worker rejected: lease token % does not match active lease token % for lock %',
      p_lease_token, v_lock.lease_token, v_lock_key USING ERRCODE = '55P03';
  END IF;

  -- 5. Verify lease generation / fencing if provided
  IF p_lease_generation IS NOT NULL AND v_lock.lease_generation <> p_lease_generation THEN
    RAISE EXCEPTION 'Stale worker rejected: lease generation % superseded by % for lock %',
      p_lease_generation, v_lock.lease_generation, v_lock_key USING ERRCODE = '55P03';
  END IF;

  -- 6. Verify lease has not expired
  IF v_lock.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Transcription lease expired at % (now: %) for lock %',
      v_lock.expires_at, NOW(), v_lock_key USING ERRCODE = '55P03';
  END IF;

  -- C. Validate Project Existence & Ownership
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Project % does not exist or has been deleted', p_project_id USING ERRCODE = 'P0002';
  END IF;

  IF v_project.user_id IS NULL OR v_project.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Access denied: user % does not own project %', p_user_id, p_project_id USING ERRCODE = '42501';
  END IF;

  -- D. Validate Media Asset Ownership & Project Association
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

  -- E. Resolve Canonical Existing Transcript ID (Preserve Existing Parent ID)
  SELECT id INTO v_transcript_id FROM public.transcripts WHERE project_id = p_project_id;
  IF v_transcript_id IS NULL THEN
    v_transcript_id := p_transcript_id;
  END IF;

  -- F. Upsert Master Transcript Record
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

  -- G. Delete Existing Child Words & Segments for Canonical Transcript
  DELETE FROM public.transcript_words WHERE transcript_id = v_transcript_id;
  DELETE FROM public.transcript_segments WHERE transcript_id = v_transcript_id;

  -- H. Insert Normalized Segments Using Canonical v_transcript_id
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

  -- I. Insert Normalized Words Using Canonical v_transcript_id
  IF p_word_rows IS NOT NULL AND jsonb_array_length(p_word_rows) > 0 THEN
    FOR v_word IN SELECT * FROM jsonb_array_elements(p_word_rows)
    LOOP
      IF (v_word->>'segment_id') IS NULL THEN
        RAISE EXCEPTION 'Constraint violation: word % at index % has NULL segment_id', v_word->>'word', v_word->>'word_index' USING ERRCODE = '23502';
      END IF;

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

  -- J. Atomically Transition Project Status to transcript_ready
  UPDATE public.projects
  SET status = 'transcript_ready',
      active_media_id = COALESCE(p_media_asset_id, active_media_id),
      updated_at = NOW()
  WHERE id = p_project_id;

  RETURN jsonb_build_object('success', true, 'transcript_id', v_transcript_id);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB, UUID, TEXT, BIGINT
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB, UUID, TEXT, BIGINT
) FROM anon;

REVOKE ALL ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB, UUID, TEXT, BIGINT
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.replace_transcript_atomic(
  UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB, JSONB, UUID, TEXT, BIGINT
) TO service_role;
