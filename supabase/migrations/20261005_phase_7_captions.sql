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
  end_time NUMERIC(12, 3) NOT NULL CHECK (end_time >= start_time),
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

DROP POLICY IF EXISTS "Users can insert caption tracks for their projects" ON public.caption_tracks;
CREATE POLICY "Users can insert caption tracks for their projects"
  ON public.caption_tracks FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = caption_tracks.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can update caption tracks of their projects" ON public.caption_tracks;
CREATE POLICY "Users can update caption tracks of their projects"
  ON public.caption_tracks FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = caption_tracks.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete caption tracks of their projects" ON public.caption_tracks;
CREATE POLICY "Users can delete caption tracks of their projects"
  ON public.caption_tracks FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = caption_tracks.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- 7. RLS Policies for caption_cues
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
CREATE POLICY "Users can insert caption cues for their projects"
  ON public.caption_cues FOR INSERT
  WITH CHECK (
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

DROP POLICY IF EXISTS "Users can update caption cues of their projects" ON public.caption_cues;
CREATE POLICY "Users can update caption cues of their projects"
  ON public.caption_cues FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete caption cues of their projects" ON public.caption_cues;
CREATE POLICY "Users can delete caption cues of their projects"
  ON public.caption_cues FOR DELETE
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

-- 8. RLS Policies for caption_words
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
CREATE POLICY "Users can insert caption words for their projects"
  ON public.caption_words FOR INSERT
  WITH CHECK (
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

DROP POLICY IF EXISTS "Users can update caption words of their projects" ON public.caption_words;
CREATE POLICY "Users can update caption words of their projects"
  ON public.caption_words FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete caption words of their projects" ON public.caption_words;
CREATE POLICY "Users can delete caption words of their projects"
  ON public.caption_words FOR DELETE
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
  p_user_id UUID,
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
SET search_path = public, pg_catalog
AS $$
DECLARE
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
  v_word_elem JSONB;
  v_word_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Validate project existence with row-level lock for serialization
  SELECT id, user_id, workspace_id, deleted_at INTO v_project
  FROM public.projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Project % does not exist or has been deleted', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate authorization
  IF p_user_id IS NOT NULL THEN
    SELECT id, role INTO v_user_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      IF v_project.user_id != p_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN: User % is not authorized to edit project %', p_user_id, p_project_id
          USING ERRCODE = '42501';
      END IF;
    ELSE
      IF v_user_profile.role = 'viewer' THEN
        RAISE EXCEPTION 'FORBIDDEN: Viewer % is not permitted to mutate captions', p_user_id
          USING ERRCODE = '42501';
      END IF;

      IF v_user_profile.role = 'admin' THEN
        v_is_authorized := TRUE;
      ELSIF v_project.user_id = p_user_id AND v_user_profile.role IN ('owner', 'editor') THEN
        v_is_authorized := TRUE;
      ELSIF v_project.workspace_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.workspace_id = v_project.workspace_id
            AND om.user_id = p_user_id
            AND UPPER(om.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR')
            AND om.status = 'active'
        ) INTO v_is_authorized;
      END IF;

      IF NOT v_is_authorized AND v_project.user_id != p_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN: User % is not authorized to edit project %', p_user_id, p_project_id
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- 3. Validate Transcript Relationship (Cross-Project Rejection)
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

  -- 4. Validate Media Asset Relationship
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

  -- 5. Determine version
  IF p_version IS NULL OR p_version <= 0 THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
    FROM public.caption_tracks
    WHERE project_id = p_project_id;
  ELSE
    v_version := p_version;
  END IF;

  v_track_id := COALESCE(p_track_id, gen_random_uuid());
  v_cues_count := jsonb_array_length(p_cues);

  -- 6. Insert caption track
  INSERT INTO public.caption_tracks (
    id, project_id, transcript_id, media_asset_id, user_id,
    version, language, source, status, style, cues_count,
    duration, metadata, created_at, updated_at
  ) VALUES (
    v_track_id, p_project_id, p_transcript_id, p_media_asset_id, COALESCE(p_user_id, v_project.user_id),
    v_version, COALESCE(p_language, 'en'), COALESCE(p_source, 'generated'), 'ready',
    COALESCE(p_style, '{}'::jsonb), v_cues_count, p_duration,
    COALESCE(p_metadata, '{}'::jsonb), NOW(), NOW()
  )
  RETURNING * INTO v_track;

  -- 7. Insert cues and words with boundary validations
  FOR v_cue_elem IN SELECT * FROM jsonb_array_elements(p_cues)
  LOOP
    -- Validate cue text
    IF v_cue_elem->>'text' IS NULL OR TRIM(v_cue_elem->>'text') = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue text cannot be empty'
        USING ERRCODE = '22023';
    END IF;

    -- Validate cue timestamps
    IF (v_cue_elem->>'start')::NUMERIC < 0 OR (v_cue_elem->>'end')::NUMERIC <= (v_cue_elem->>'start')::NUMERIC THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Cue end time must be strictly greater than start time'
        USING ERRCODE = '22023';
    END IF;

    v_cue_id := COALESCE((v_cue_elem->>'id')::UUID, gen_random_uuid());

    INSERT INTO public.caption_cues (
      id, track_id, sequence, start_time, end_time, text,
      speaker_id, emphasis, style, language, translated_text,
      source, created_at, updated_at
    ) VALUES (
      v_cue_id,
      v_track_id,
      (v_cue_elem->>'sequence')::INTEGER,
      (v_cue_elem->>'start')::NUMERIC,
      (v_cue_elem->>'end')::NUMERIC,
      (v_cue_elem->>'text'),
      (v_cue_elem->>'speakerId'),
      (v_cue_elem->>'emphasis'),
      COALESCE((v_cue_elem->'style'), '{}'::jsonb),
      COALESCE((v_cue_elem->>'language'), v_track.language),
      (v_cue_elem->>'translatedText'),
      COALESCE((v_cue_elem->>'source'), 'generated'),
      NOW(), NOW()
    );

    IF v_cue_elem ? 'words' AND jsonb_typeof(v_cue_elem->'words') = 'array' THEN
      FOR v_word_elem IN SELECT * FROM jsonb_array_elements(v_cue_elem->'words')
      LOOP
        -- Validate word text
        IF v_word_elem->>'word' IS NULL OR TRIM(v_word_elem->>'word') = '' THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word text cannot be empty'
            USING ERRCODE = '22023';
        END IF;

        -- Validate word timestamps
        IF (v_word_elem->>'start')::NUMERIC < 0 OR (v_word_elem->>'end')::NUMERIC <= (v_word_elem->>'start')::NUMERIC THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word end time must be strictly greater than start time'
            USING ERRCODE = '22023';
        END IF;

        -- Validate word within cue bounds (with 0.05s tolerance for rounding)
        IF (v_word_elem->>'start')::NUMERIC < (v_cue_elem->>'start')::NUMERIC - 0.05 OR
           (v_word_elem->>'end')::NUMERIC > (v_cue_elem->>'end')::NUMERIC + 0.05 THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word timing must fall within cue bounds'
            USING ERRCODE = '22023';
        END IF;

        -- Validate word confidence bounds
        IF v_word_elem->>'confidence' IS NOT NULL AND
           ((v_word_elem->>'confidence')::NUMERIC < 0 OR (v_word_elem->>'confidence')::NUMERIC > 1.0) THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: Word confidence must be between 0.0 and 1.0'
            USING ERRCODE = '22023';
        END IF;

        v_word_id := COALESCE((v_word_elem->>'id')::UUID, gen_random_uuid());

        INSERT INTO public.caption_words (
          id, cue_id, track_id, word_index, word,
          start_time, end_time, confidence, speaker,
          highlighted, emphasis_style, created_at
        ) VALUES (
          v_word_id,
          v_cue_id,
          v_track_id,
          (v_word_elem->>'wordIndex')::INTEGER,
          (v_word_elem->>'word'),
          (v_word_elem->>'start')::NUMERIC,
          (v_word_elem->>'end')::NUMERIC,
          CASE WHEN v_word_elem->>'confidence' IS NOT NULL THEN (v_word_elem->>'confidence')::NUMERIC ELSE NULL END,
          CASE WHEN v_word_elem->>'speaker' IS NOT NULL THEN (v_word_elem->>'speaker')::INTEGER ELSE NULL END,
          COALESCE((v_word_elem->>'highlighted')::BOOLEAN, FALSE),
          (v_word_elem->>'emphasisStyle'),
          NOW()
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 8. Return JSON representation
  v_result := jsonb_build_object(
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
