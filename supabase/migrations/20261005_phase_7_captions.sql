-- Migration: 20261005_phase_7_captions.sql
-- Phase 7: Real Caption & Subtitle Engine, Canonical Model, Persistence & RLS

-- 1. Create public.caption_tracks table
CREATE TABLE IF NOT EXISTS public.caption_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES public.transcripts(id) ON DELETE SET NULL,
  media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  language TEXT NOT NULL DEFAULT 'en',
  source TEXT NOT NULL DEFAULT 'generated' CHECK (source IN ('generated', 'edited', 'imported')),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'processing', 'failed')),
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  cues_count INTEGER NOT NULL DEFAULT 0 CHECK (cues_count >= 0),
  duration NUMERIC(12, 3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_caption_tracks_project_version UNIQUE (project_id, version)
);

-- 2. Create public.caption_cues table
CREATE TABLE IF NOT EXISTS public.caption_cues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.caption_tracks(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  start_time NUMERIC(12, 3) NOT NULL CHECK (start_time >= 0),
  end_time NUMERIC(12, 3) NOT NULL CHECK (end_time > start_time),
  text TEXT NOT NULL,
  speaker_id TEXT,
  emphasis TEXT,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  language TEXT NOT NULL DEFAULT 'en',
  translated_text TEXT,
  source TEXT NOT NULL DEFAULT 'generated',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_caption_cues_track_sequence UNIQUE (track_id, sequence)
);

-- 3. Create public.caption_words table
CREATE TABLE IF NOT EXISTS public.caption_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cue_id UUID NOT NULL REFERENCES public.caption_cues(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.caption_tracks(id) ON DELETE CASCADE,
  word_index INTEGER NOT NULL CHECK (word_index >= 0),
  word TEXT NOT NULL,
  start_time NUMERIC(12, 3) NOT NULL CHECK (start_time >= 0),
  end_time NUMERIC(12, 3) NOT NULL CHECK (end_time > start_time),
  confidence NUMERIC(4, 2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1.0)),
  speaker INTEGER,
  highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  emphasis_style TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_caption_words_cue_idx UNIQUE (cue_id, word_index)
);

-- 4. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_caption_tracks_project_id ON public.caption_tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_caption_tracks_user_id ON public.caption_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_caption_tracks_transcript_id ON public.caption_tracks(transcript_id);
CREATE INDEX IF NOT EXISTS idx_caption_cues_track_id ON public.caption_cues(track_id);
CREATE INDEX IF NOT EXISTS idx_caption_cues_timing ON public.caption_cues(track_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_caption_words_cue_id ON public.caption_words(cue_id);
CREATE INDEX IF NOT EXISTS idx_caption_words_track_id ON public.caption_words(track_id);

-- 5. Enable Row-Level Security
ALTER TABLE public.caption_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caption_cues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caption_words ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for caption_tracks
DROP POLICY IF EXISTS "Users can view caption tracks of their projects" ON public.caption_tracks;
CREATE POLICY "Users can view caption tracks of their projects"
  ON public.caption_tracks FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = caption_tracks.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- Direct mutation policies dropped to guarantee immutable versioning via save_caption_track_atomic()
DROP POLICY IF EXISTS "Users can insert caption tracks for their projects" ON public.caption_tracks;
DROP POLICY IF EXISTS "Users can update caption tracks of their projects" ON public.caption_tracks;
DROP POLICY IF EXISTS "Users can delete caption tracks of their projects" ON public.caption_tracks;

-- 7. RLS Policies for caption_cues (SELECT ONLY for authenticated clients)
DROP POLICY IF EXISTS "Users can view caption cues of their projects" ON public.caption_cues;
CREATE POLICY "Users can view caption cues of their projects"
  ON public.caption_cues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.caption_tracks
      WHERE caption_tracks.id = caption_cues.track_id
      AND (
        caption_tracks.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = caption_tracks.project_id
          AND (projects.user_id = auth.uid() OR public.is_admin())
          AND projects.deleted_at IS NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert caption cues for their projects" ON public.caption_cues;
DROP POLICY IF EXISTS "Users can update caption cues of their projects" ON public.caption_cues;
DROP POLICY IF EXISTS "Users can delete caption cues of their projects" ON public.caption_cues;

-- 8. RLS Policies for caption_words (SELECT ONLY for authenticated clients)
DROP POLICY IF EXISTS "Users can view caption words of their projects" ON public.caption_words;
CREATE POLICY "Users can view caption words of their projects"
  ON public.caption_words FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.caption_tracks
      WHERE caption_tracks.id = caption_words.track_id
      AND (
        caption_tracks.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = caption_tracks.project_id
          AND (projects.user_id = auth.uid() OR public.is_admin())
          AND projects.deleted_at IS NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert caption words for their projects" ON public.caption_words;
DROP POLICY IF EXISTS "Users can update caption words of their projects" ON public.caption_words;
DROP POLICY IF EXISTS "Users can delete caption words of their projects" ON public.caption_words;

-- Table Grants: Revoke direct mutation from untrusted and authenticated roles
REVOKE ALL ON TABLE public.caption_tracks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.caption_cues FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.caption_words FROM PUBLIC, anon, authenticated;

-- Allow SELECT for authenticated and anon (enforced via SELECT RLS policies)
GRANT SELECT ON TABLE public.caption_tracks TO authenticated, anon;
GRANT SELECT ON TABLE public.caption_cues TO authenticated, anon;
GRANT SELECT ON TABLE public.caption_words TO authenticated, anon;

-- service_role retains ALL privileges for background/administrative tasks
GRANT ALL ON TABLE public.caption_tracks TO service_role;
GRANT ALL ON TABLE public.caption_cues TO service_role;
GRANT ALL ON TABLE public.caption_words TO service_role;

-- 9. Allow caption-related operation types in timeline_operations
ALTER TABLE public.timeline_operations
  DROP CONSTRAINT IF EXISTS timeline_operations_operation_type_check;

ALTER TABLE public.timeline_operations
  ADD CONSTRAINT timeline_operations_operation_type_check
  CHECK (LOWER(operation_type) IN (
    'split_item', 'trim_item', 'delete_item', 'delete_range',
    'move_item', 'insert_item', 'set_speed', 'set_enabled',
    'create_timeline', 'sync_transcript', 'split', 'trim',
    'undo', 'redo', 'set_reframe', 'reframe',
    'add_caption', 'change_caption', 'set_caption_style'
  ));

-- 10. Atomic RPC: save_caption_track_atomic
CREATE OR REPLACE FUNCTION public.save_caption_track_atomic(
  p_project_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_track_id UUID DEFAULT NULL,
  p_transcript_id UUID DEFAULT NULL,
  p_media_asset_id UUID DEFAULT NULL,
  p_language TEXT DEFAULT 'en',
  p_version INTEGER DEFAULT NULL,
  p_source TEXT DEFAULT 'generated',
  p_style JSONB DEFAULT '{}'::jsonb,
  p_duration NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_cues JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid UUID;
  v_effective_user_id UUID;
  v_project RECORD;
  v_user_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_transcript RECORD;
  v_media RECORD;
  v_version INTEGER;
  v_track_id UUID;
  v_cues_count INTEGER;
  v_track RECORD;
  v_cue_elem JSONB;
  v_cue_id UUID;
  v_cue_idx INTEGER := 0;
  v_curr_seq INTEGER;
  v_prev_cue_seq INTEGER := 0;
  v_cue_start NUMERIC;
  v_cue_end NUMERIC;
  v_prev_cue_end NUMERIC := -1;
  v_cue_text TEXT;
  v_word_elem JSONB;
  v_word_id UUID;
  v_w_idx INTEGER;
  v_prev_word_idx INTEGER;
  v_w_start NUMERIC;
  v_w_end NUMERIC;
  v_prev_word_start NUMERIC;
  v_w_conf NUMERIC;
  v_words_joined TEXT;
  v_words_clean TEXT;
  v_cue_clean TEXT;
  v_result JSONB;
BEGIN
  -- 1. Validate authorization and fail-closed identity boundary
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NOT NULL THEN
    -- In authenticated user context, never trust client-supplied p_user_id claiming another user
    IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_uid THEN
      RAISE EXCEPTION 'FORBIDDEN: Impersonation not permitted. Claimed user % does not match authenticated user %',
        p_user_id, v_auth_uid
        USING ERRCODE = '42501';
    END IF;
    v_effective_user_id := v_auth_uid;
  ELSE
    -- Server-side / internal / direct psql context
    IF p_user_id IS NOT NULL THEN
      v_effective_user_id := p_user_id;
    ELSE
      v_effective_user_id := NULL;
    END IF;
  END IF;

  IF v_effective_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Authentication required to save caption track'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validate project existence with row-level lock for serialization
  SELECT id, user_id, workspace_id, deleted_at INTO v_project
  FROM public.projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Project % does not exist or has been deleted', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 3. RBAC checks on effective user
  SELECT id, role INTO v_user_profile
  FROM public.profiles
  WHERE id = v_effective_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: User % does not exist', v_effective_user_id
      USING ERRCODE = '42501';
  END IF;

  IF v_user_profile.role = 'viewer' THEN
    RAISE EXCEPTION 'FORBIDDEN: Viewer % is not permitted to mutate captions', v_effective_user_id
      USING ERRCODE = '42501';
  END IF;

  IF v_user_profile.role = 'admin' THEN
    v_is_authorized := TRUE;
  ELSIF v_project.user_id = v_effective_user_id AND v_user_profile.role IN ('owner', 'editor') THEN
    v_is_authorized := TRUE;
  ELSIF v_project.workspace_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.workspace_id = v_project.workspace_id
        AND om.user_id = v_effective_user_id
        AND pg_catalog.upper(om.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR')
        AND om.status = 'active'
    ) INTO v_is_authorized;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'FORBIDDEN: User % is not authorized to edit project %', v_effective_user_id, p_project_id
      USING ERRCODE = '42501';
  END IF;

  -- 4. Validate Transcript Relationship (Cross-Project Rejection)
  IF p_transcript_id IS NOT NULL THEN
    SELECT id, project_id INTO v_transcript
    FROM public.transcripts
    WHERE id = p_transcript_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSCRIPT_NOT_FOUND: Transcript % does not exist', p_transcript_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_transcript.project_id != p_project_id THEN
      RAISE EXCEPTION 'CROSS_PROJECT_FORBIDDEN: Transcript % belongs to project %, not project %',
        p_transcript_id, v_transcript.project_id, p_project_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 5. Validate Media Asset Relationship
  IF p_media_asset_id IS NOT NULL THEN
    SELECT id, project_id, user_id INTO v_media
    FROM public.media_assets
    WHERE id = p_media_asset_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'MEDIA_NOT_FOUND: Media asset % does not exist', p_media_asset_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_media.project_id != p_project_id THEN
      RAISE EXCEPTION 'CROSS_PROJECT_FORBIDDEN: Media asset % belongs to project %, not project %',
        p_media_asset_id, v_media.project_id, p_project_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 6. Validate p_duration (Requirement 2.E, 2.F)
  IF p_duration IS NOT NULL THEN
    IF p_duration = 'NaN'::pg_catalog.numeric OR p_duration <= 0 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Media duration must be a finite positive number'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 7. Validate p_cues array structure (Requirement 2.A)
  IF p_cues IS NULL OR pg_catalog.jsonb_typeof(p_cues) != 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: p_cues must be a JSON array'
      USING ERRCODE = '22023';
  END IF;
  v_cues_count := pg_catalog.jsonb_array_length(p_cues);

  -- 8. COMPLETE IN-MEMORY CANONICAL VALIDATION BEFORE PERSISTENCE
  -- Section 2 & 3: Validate all cues and words BEFORE performing any database INSERT
  FOR v_cue_elem IN SELECT * FROM pg_catalog.jsonb_array_elements(p_cues)
  LOOP
    v_cue_idx := v_cue_idx + 1;

    -- Validate cue UUID if supplied
    IF v_cue_elem->>'id' IS NOT NULL THEN
      BEGIN
        PERFORM (v_cue_elem->>'id')::pg_catalog.uuid;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Cue at index % has invalid UUID: %', v_cue_idx, v_cue_elem->>'id'
          USING ERRCODE = '22023';
      END;
    END IF;

    -- Validate cue sequence (integer >= 1)
    IF v_cue_elem->>'sequence' IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue at index % is missing sequence', v_cue_idx
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_curr_seq := (v_cue_elem->>'sequence')::pg_catalog.int4;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue at index % has invalid sequence: %', v_cue_idx, v_cue_elem->>'sequence'
        USING ERRCODE = '22023';
    END;
    IF v_curr_seq < 1 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue sequence must be >= 1 (got %)', v_curr_seq
        USING ERRCODE = '22023';
    END IF;

    -- Cue sequence strictly increasing in supplied canonical order (Reject 1, 3, 2 and duplicates)
    IF v_curr_seq <= v_prev_cue_seq THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue sequence must be strictly increasing (got % after %)', v_curr_seq, v_prev_cue_seq
        USING ERRCODE = '22023';
    END IF;
    v_prev_cue_seq := v_curr_seq;

    -- Validate cue text
    IF v_cue_elem->>'text' IS NULL OR pg_catalog.btrim(v_cue_elem->>'text') = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue text cannot be empty'
        USING ERRCODE = '22023';
    END IF;
    v_cue_text := pg_catalog.btrim(v_cue_elem->>'text');

    -- Validate cue timestamps
    IF v_cue_elem->>'start' IS NULL OR v_cue_elem->>'end' IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue start and end timestamps are required'
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_cue_start := (v_cue_elem->>'start')::pg_catalog.numeric;
      v_cue_end := (v_cue_elem->>'end')::pg_catalog.numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue timestamps must be valid numbers'
        USING ERRCODE = '22023';
    END;

    IF v_cue_start = 'NaN'::pg_catalog.numeric OR v_cue_end = 'NaN'::pg_catalog.numeric THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue timestamps cannot be NaN'
        USING ERRCODE = '22023';
    END IF;

    IF v_cue_start < 0 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue start time cannot be negative (got %)', v_cue_start
        USING ERRCODE = '22023';
    END IF;

    IF v_cue_end <= v_cue_start THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue end time must be strictly greater than start time (got start %, end %)', v_cue_start, v_cue_end
        USING ERRCODE = '22023';
    END IF;

    -- Canonical non-overlapping cues
    IF v_prev_cue_end >= 0 AND v_cue_start < v_prev_cue_end THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cues overlap: cue starts at % before previous ended at %', v_cue_start, v_prev_cue_end
        USING ERRCODE = '22023';
    END IF;
    v_prev_cue_end := v_cue_end;

    -- Media duration check for cue
    IF p_duration IS NOT NULL THEN
      IF v_cue_start > p_duration OR v_cue_end > p_duration THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Cue timing [%, %] extends beyond media duration %', v_cue_start, v_cue_end, p_duration
          USING ERRCODE = '22023';
      END IF;
    END IF;

    -- Word invariants within cue
    IF v_cue_elem ? 'words' AND pg_catalog.jsonb_typeof(v_cue_elem->'words') = 'array' THEN
      v_prev_word_idx := -1;
      v_prev_word_start := -1;
      v_words_joined := '';

      FOR v_word_elem IN SELECT * FROM pg_catalog.jsonb_array_elements(v_cue_elem->'words')
      LOOP
        -- Word text
        IF v_word_elem->>'word' IS NULL OR pg_catalog.btrim(v_word_elem->>'word') = '' THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word text cannot be empty'
            USING ERRCODE = '22023';
        END IF;

        -- Word timestamps
        IF v_word_elem->>'start' IS NULL OR v_word_elem->>'end' IS NULL THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word start and end timestamps are required'
            USING ERRCODE = '22023';
        END IF;
        BEGIN
          v_w_start := (v_word_elem->>'start')::pg_catalog.numeric;
          v_w_end := (v_word_elem->>'end')::pg_catalog.numeric;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word timestamps must be valid numbers'
            USING ERRCODE = '22023';
        END;

        IF v_w_start = 'NaN'::pg_catalog.numeric OR v_w_end = 'NaN'::pg_catalog.numeric THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word timestamps cannot be NaN'
            USING ERRCODE = '22023';
        END IF;

        IF v_w_start < 0 THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word start time cannot be negative (got %)', v_w_start
            USING ERRCODE = '22023';
        END IF;

        IF v_w_end <= v_w_start THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word end time must be strictly greater than start time (got start %, end %)', v_w_start, v_w_end
            USING ERRCODE = '22023';
        END IF;

        -- Exact containment inside cue boundaries (NO ±0.05 tolerance in DB boundary)
        IF v_w_start < v_cue_start OR v_w_end > v_cue_end THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word timing [%, %] must fall within cue bounds [%, %]', v_w_start, v_w_end, v_cue_start, v_cue_end
            USING ERRCODE = '22023';
        END IF;

        -- Word index progression (>= 0 and strictly increasing)
        IF v_word_elem->>'wordIndex' IS NOT NULL THEN
          BEGIN
            v_w_idx := (v_word_elem->>'wordIndex')::pg_catalog.int4;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: Invalid wordIndex: %', v_word_elem->>'wordIndex'
              USING ERRCODE = '22023';
          END;
          IF v_w_idx < 0 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: wordIndex must be >= 0 (got %)', v_w_idx
              USING ERRCODE = '22023';
          END IF;
          IF v_prev_word_idx >= 0 AND v_w_idx <= v_prev_word_idx THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: wordIndex must be strictly increasing (got % after %)', v_w_idx, v_prev_word_idx
              USING ERRCODE = '22023';
          END IF;
          v_prev_word_idx := v_w_idx;
        END IF;

        -- Monotonic word timestamps
        IF v_prev_word_start >= 0 AND v_w_start < v_prev_word_start THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word timing is non-monotonic: word starts at % before previous word started at %', v_w_start, v_prev_word_start
            USING ERRCODE = '22023';
        END IF;
        v_prev_word_start := v_w_start;

        -- Media duration check for word
        IF p_duration IS NOT NULL AND v_w_end > p_duration THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word timing [%, %] exceeds media duration %', v_w_start, v_w_end, p_duration
            USING ERRCODE = '22023';
        END IF;

        -- Confidence bounds if present
        IF v_word_elem->>'confidence' IS NOT NULL THEN
          BEGIN
            v_w_conf := (v_word_elem->>'confidence')::pg_catalog.numeric;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: Invalid confidence value: %', v_word_elem->>'confidence'
              USING ERRCODE = '22023';
          END;
          IF v_w_conf < 0 OR v_w_conf > 1.0 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: Word confidence must be between 0.0 and 1.0 (got %)', v_w_conf
              USING ERRCODE = '22023';
          END IF;
        END IF;

        -- Concatenate word text for consistency check
        v_words_joined := v_words_joined || ' ' || pg_catalog.btrim(v_word_elem->>'word');
      END LOOP;

      -- Check text/word consistency
      IF pg_catalog.jsonb_array_length(v_cue_elem->'words') > 0 THEN
        v_words_clean := pg_catalog.regexp_replace(v_words_joined, '[^[:alnum:]]', '', 'g');
        v_cue_clean := pg_catalog.regexp_replace(v_cue_text, '[^[:alnum:]]', '', 'g');
        IF v_words_clean != '' AND v_cue_clean != '' AND v_words_clean != v_cue_clean THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Cue text ("%") is inconsistent with its words ("%")',
            v_cue_text, pg_catalog.btrim(v_words_joined)
            USING ERRCODE = '22023';
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 9. ALL VALIDATION PASSED — PROCEED WITH ATOMIC PERSISTENCE
  -- Allocate version under locked project
  IF p_version IS NULL OR p_version <= 0 THEN
    SELECT COALESCE(pg_catalog.max(version), 0) + 1 INTO v_version
    FROM public.caption_tracks
    WHERE project_id = p_project_id;
  ELSE
    v_version := p_version;
  END IF;

  v_track_id := COALESCE(p_track_id, pg_catalog.gen_random_uuid());

  -- Insert caption track
  INSERT INTO public.caption_tracks (
    id, project_id, transcript_id, media_asset_id, user_id,
    version, language, source, status, style, cues_count,
    duration, metadata, created_at, updated_at
  ) VALUES (
    v_track_id, p_project_id, p_transcript_id, p_media_asset_id, v_effective_user_id,
    v_version, COALESCE(p_language, 'en'), COALESCE(p_source, 'generated'), 'ready',
    COALESCE(p_style, '{}'::pg_catalog.jsonb), v_cues_count, p_duration,
    COALESCE(p_metadata, '{}'::pg_catalog.jsonb), pg_catalog.now(), pg_catalog.now()
  )
  RETURNING * INTO v_track;

  -- Insert cues and words
  FOR v_cue_elem IN SELECT * FROM pg_catalog.jsonb_array_elements(p_cues)
  LOOP
    v_cue_id := COALESCE((v_cue_elem->>'id')::pg_catalog.uuid, pg_catalog.gen_random_uuid());

    INSERT INTO public.caption_cues (
      id, track_id, sequence, start_time, end_time, text,
      speaker_id, emphasis, style, language, translated_text,
      source, created_at, updated_at
    ) VALUES (
      v_cue_id,
      v_track_id,
      (v_cue_elem->>'sequence')::pg_catalog.int4,
      (v_cue_elem->>'start')::pg_catalog.numeric,
      (v_cue_elem->>'end')::pg_catalog.numeric,
      pg_catalog.btrim(v_cue_elem->>'text'),
      (v_cue_elem->>'speakerId'),
      (v_cue_elem->>'emphasis'),
      COALESCE((v_cue_elem->'style'), '{}'::pg_catalog.jsonb),
      COALESCE((v_cue_elem->>'language'), v_track.language),
      (v_cue_elem->>'translatedText'),
      COALESCE((v_cue_elem->>'source'), 'generated'),
      pg_catalog.now(), pg_catalog.now()
    );

    IF v_cue_elem ? 'words' AND pg_catalog.jsonb_typeof(v_cue_elem->'words') = 'array' THEN
      FOR v_word_elem IN SELECT * FROM pg_catalog.jsonb_array_elements(v_cue_elem->'words')
      LOOP
        v_word_id := COALESCE((v_word_elem->>'id')::pg_catalog.uuid, pg_catalog.gen_random_uuid());

        INSERT INTO public.caption_words (
          id, cue_id, track_id, word_index, word,
          start_time, end_time, confidence, speaker,
          highlighted, emphasis_style, created_at
        ) VALUES (
          v_word_id,
          v_cue_id,
          v_track_id,
          (v_word_elem->>'wordIndex')::pg_catalog.int4,
          pg_catalog.btrim(v_word_elem->>'word'),
          (v_word_elem->>'start')::pg_catalog.numeric,
          (v_word_elem->>'end')::pg_catalog.numeric,
          CASE WHEN v_word_elem->>'confidence' IS NOT NULL THEN (v_word_elem->>'confidence')::pg_catalog.numeric ELSE NULL END,
          CASE WHEN v_word_elem->>'speaker' IS NOT NULL THEN (v_word_elem->>'speaker')::pg_catalog.int4 ELSE NULL END,
          COALESCE((v_word_elem->>'highlighted')::pg_catalog.bool, FALSE),
          (v_word_elem->>'emphasisStyle'),
          pg_catalog.now()
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 10. Return JSON representation
  v_result := pg_catalog.jsonb_build_object(
    'id', v_track.id,
    'projectId', v_track.project_id,
    'transcriptId', v_track.transcript_id,
    'mediaAssetId', v_track.media_asset_id,
    'userId', v_track.user_id,
    'version', v_track.version,
    'language', v_track.language,
    'source', v_track.source,
    'status', v_track.status,
    'style', v_track.style,
    'cuesCount', v_track.cues_count,
    'durationSeconds', v_track.duration,
    'metadata', v_track.metadata,
    'createdAt', v_track.created_at,
    'updatedAt', v_track.updated_at
  );

  RETURN v_result;
END;
$$;

-- 11. Strict Execution Privileges for SECURITY DEFINER RPC
REVOKE EXECUTE ON FUNCTION public.save_caption_track_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_caption_track_atomic FROM anon;
GRANT EXECUTE ON FUNCTION public.save_caption_track_atomic TO authenticated, service_role;

-- 12. Immutability Protections for Canonical Captions
CREATE OR REPLACE FUNCTION public.prevent_caption_track_immutability_violation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_tracks.id cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_tracks.project_id cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF NEW.version IS DISTINCT FROM OLD.version THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_tracks.version cannot be modified' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_caption_tracks_immutable ON public.caption_tracks;
CREATE TRIGGER trg_caption_tracks_immutable
BEFORE UPDATE ON public.caption_tracks
FOR EACH ROW
EXECUTE FUNCTION public.prevent_caption_track_immutability_violation();

CREATE OR REPLACE FUNCTION public.prevent_caption_cue_immutability_violation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_cues.id cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF NEW.track_id IS DISTINCT FROM OLD.track_id THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_cues.track_id cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF NEW.sequence IS DISTINCT FROM OLD.sequence THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_cues.sequence cannot be modified' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_caption_cues_immutable ON public.caption_cues;
CREATE TRIGGER trg_caption_cues_immutable
BEFORE UPDATE ON public.caption_cues
FOR EACH ROW
EXECUTE FUNCTION public.prevent_caption_cue_immutability_violation();

CREATE OR REPLACE FUNCTION public.prevent_caption_word_immutability_violation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_words.id cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF NEW.cue_id IS DISTINCT FROM OLD.cue_id THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_words.cue_id cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF NEW.track_id IS DISTINCT FROM OLD.track_id THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_words.track_id cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF NEW.word_index IS DISTINCT FROM OLD.word_index THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: caption_words.word_index cannot be modified' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_caption_words_immutable ON public.caption_words;
CREATE TRIGGER trg_caption_words_immutable
BEFORE UPDATE ON public.caption_words
FOR EACH ROW
EXECUTE FUNCTION public.prevent_caption_word_immutability_violation();

