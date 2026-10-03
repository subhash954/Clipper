-- Migration: 20261003_phase_5_canonical_edl.sql
-- Phase 5: Authoritative Non-Destructive Edit Decision List (EDL) & Relational Timeline Architecture

-- 1. Create public.timelines table
CREATE TABLE IF NOT EXISTS public.timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  duration NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (duration >= 0),
  timebase TEXT NOT NULL DEFAULT '30fps',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create public.tracks table
CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL CHECK (LOWER(track_type) IN ('video', 'audio', 'broll', 'caption', 'overlay')),
  track_index INTEGER NOT NULL CHECK (track_index >= 0),
  name TEXT NOT NULL,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_tracks_timeline_index UNIQUE (timeline_id, track_index)
);

-- 3. Create public.timeline_items table
CREATE TABLE IF NOT EXISTS public.timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  source_media_id UUID REFERENCES public.media_assets(id) ON DELETE CASCADE,
  source_start NUMERIC(12, 3) NOT NULL CHECK (source_start >= 0),
  source_end NUMERIC(12, 3) NOT NULL CHECK (source_end > source_start),
  timeline_start NUMERIC(12, 3) NOT NULL CHECK (timeline_start >= 0),
  timeline_end NUMERIC(12, 3) NOT NULL CHECK (timeline_end > timeline_start),
  speed NUMERIC(6, 3) NOT NULL DEFAULT 1.000 CHECK (speed > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  label TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create public.timeline_operations table (Audit log & Undo/Redo journal)
CREATE TABLE IF NOT EXISTS public.timeline_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (LOWER(operation_type) IN ('split_item', 'trim_item', 'delete_item', 'delete_range', 'move_item', 'insert_item', 'set_speed', 'set_enabled', 'create_timeline', 'sync_transcript', 'split', 'trim')),
  operation_index INTEGER NOT NULL CHECK (operation_index >= 1),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  inverse_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  version_after INTEGER NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_timeline_ops_timeline_idx UNIQUE (timeline_id, operation_index)
);

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_timelines_project_id ON public.timelines(project_id);
CREATE INDEX IF NOT EXISTS idx_tracks_timeline_id ON public.tracks(timeline_id);
CREATE INDEX IF NOT EXISTS idx_timeline_items_track_id ON public.timeline_items(track_id);
CREATE INDEX IF NOT EXISTS idx_timeline_items_source_media_id ON public.timeline_items(source_media_id);
CREATE INDEX IF NOT EXISTS idx_timeline_ops_timeline_id ON public.timeline_operations(timeline_id, operation_index DESC);

-- Enable Row Level Security
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_operations ENABLE ROW LEVEL SECURITY;

-- Service Role full access
GRANT ALL ON public.timelines TO service_role;
GRANT ALL ON public.tracks TO service_role;
GRANT ALL ON public.timeline_items TO service_role;
GRANT ALL ON public.timeline_operations TO service_role;

-- Revoke write from public/anon
REVOKE ALL ON public.timelines FROM PUBLIC, anon;
REVOKE ALL ON public.tracks FROM PUBLIC, anon;
REVOKE ALL ON public.timeline_items FROM PUBLIC, anon;
REVOKE ALL ON public.timeline_operations FROM PUBLIC, anon;

-- Read policies for authenticated project owners
DROP POLICY IF EXISTS "Users can view timelines of their projects" ON public.timelines;
CREATE POLICY "Users can view timelines of their projects"
  ON public.timelines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = timelines.project_id
        AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

DROP POLICY IF EXISTS "Users can view tracks of their projects" ON public.tracks;
CREATE POLICY "Users can view tracks of their projects"
  ON public.tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.timelines t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = tracks.timeline_id
        AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

DROP POLICY IF EXISTS "Users can view items of their projects" ON public.timeline_items;
CREATE POLICY "Users can view items of their projects"
  ON public.timeline_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tracks tr
      JOIN public.timelines t ON t.id = tr.timeline_id
      JOIN public.projects p ON p.id = t.project_id
      WHERE tr.id = timeline_items.track_id
        AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

DROP POLICY IF EXISTS "Users can view operations of their projects" ON public.timeline_operations;
CREATE POLICY "Users can view operations of their projects"
  ON public.timeline_operations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.timelines t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = timeline_operations.timeline_id
        AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

-- ============================================================================
-- AUTHORITATIVE ATOMIC TIMELINE MUTATION RPC
-- Saves an entire EDL timeline atomically with optimistic concurrency control,
-- media asset ownership validation, and operation journal recording.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_timeline_atomic(
  p_project_id UUID,
  p_user_id UUID,
  p_expected_version INTEGER,
  p_duration NUMERIC,
  p_timebase TEXT,
  p_tracks JSONB,
  p_operation JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_project RECORD;
  v_timeline RECORD;
  v_new_version INTEGER;
  v_timeline_id UUID;
  v_track_elem JSONB;
  v_item_elem JSONB;
  v_track_id UUID;
  v_item_id UUID;
  v_media_id UUID;
  v_next_op_idx INTEGER;
  v_media_exists BOOLEAN;
  v_result JSONB;
BEGIN
  -- 1. Validate project existence and ownership
  SELECT id, user_id, active_media_id INTO v_project
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  IF p_user_id IS NOT NULL AND v_project.user_id IS NOT NULL AND v_project.user_id <> p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: User % does not own project %', p_user_id, p_project_id
      USING ERRCODE = '42501';
  END IF;

  -- 2. Lock or initialize timeline row with optimistic concurrency check
  SELECT * INTO v_timeline
  FROM public.timelines
  WHERE project_id = p_project_id
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_version IS NOT NULL AND v_timeline.version <> p_expected_version THEN
      RAISE EXCEPTION 'TIMELINE_VERSION_CONFLICT: Expected version % but found version %',
        p_expected_version, v_timeline.version
        USING ERRCODE = '23505';
    END IF;

    v_new_version := v_timeline.version + 1;
    v_timeline_id := v_timeline.id;

    UPDATE public.timelines
    SET version = v_new_version,
        duration = p_duration,
        timebase = COALESCE(p_timebase, v_timeline.timebase),
        updated_at = NOW()
    WHERE id = v_timeline_id;
  ELSE
    v_new_version := 1;
    v_timeline_id := gen_random_uuid();

    INSERT INTO public.timelines (
      id, project_id, version, duration, timebase, status, created_at, updated_at
    ) VALUES (
      v_timeline_id, p_project_id, v_new_version, p_duration, COALESCE(p_timebase, '30fps'), 'active', NOW(), NOW()
    );
  END IF;

  -- 3. Atomically replace tracks and timeline items
  -- Cascade delete will remove timeline_items for old tracks
  DELETE FROM public.tracks WHERE timeline_id = v_timeline_id;

  IF p_tracks IS NOT NULL AND jsonb_array_length(p_tracks) > 0 THEN
    FOR v_track_elem IN SELECT * FROM jsonb_array_elements(p_tracks)
    LOOP
      v_track_id := COALESCE((v_track_elem->>'id')::UUID, gen_random_uuid());

      INSERT INTO public.tracks (
        id, timeline_id, track_type, track_index, name, is_muted, is_locked, created_at, updated_at
      ) VALUES (
        v_track_id,
        v_timeline_id,
        LOWER(v_track_elem->>'type'),
        (v_track_elem->>'index')::INTEGER,
        COALESCE(v_track_elem->>'name', 'Track'),
        COALESCE((v_track_elem->>'isMuted')::BOOLEAN, FALSE),
        COALESCE((v_track_elem->>'isLocked')::BOOLEAN, FALSE),
        NOW(),
        NOW()
      );

      IF (v_track_elem->'items') IS NOT NULL AND jsonb_array_length(v_track_elem->'items') > 0 THEN
        FOR v_item_elem IN SELECT * FROM jsonb_array_elements(v_track_elem->'items')
        LOOP
          v_item_id := COALESCE((v_item_elem->>'id')::UUID, gen_random_uuid());
          v_media_id := (v_item_elem->>'sourceMediaId')::UUID;

          -- Enforce that source_media_id belongs to the project
          IF v_media_id IS NOT NULL THEN
            SELECT EXISTS (
              SELECT 1 FROM public.media_assets
              WHERE id = v_media_id AND project_id = p_project_id
            ) INTO v_media_exists;

            IF NOT v_media_exists THEN
              RAISE EXCEPTION 'MEDIA_NOT_OWNED: Media asset % is not owned by project %', v_media_id, p_project_id
                USING ERRCODE = '42501';
            END IF;
          END IF;

          INSERT INTO public.timeline_items (
            id,
            track_id,
            source_media_id,
            source_start,
            source_end,
            timeline_start,
            timeline_end,
            speed,
            enabled,
            label,
            metadata,
            created_at,
            updated_at
          ) VALUES (
            v_item_id,
            v_track_id,
            v_media_id,
            (v_item_elem->>'sourceStart')::NUMERIC,
            (v_item_elem->>'sourceEnd')::NUMERIC,
            (v_item_elem->>'timelineStart')::NUMERIC,
            (v_item_elem->>'timelineEnd')::NUMERIC,
            COALESCE((v_item_elem->>'speed')::NUMERIC, 1.000),
            COALESCE((v_item_elem->>'enabled')::BOOLEAN, TRUE),
            v_item_elem->>'label',
            COALESCE(v_item_elem->'metadata', '{}'::jsonb),
            NOW(),
            NOW()
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 4. Record operation in timeline_operations if provided
  IF p_operation IS NOT NULL AND (p_operation->>'type') IS NOT NULL THEN
    SELECT COALESCE(MAX(operation_index), 0) + 1 INTO v_next_op_idx
    FROM public.timeline_operations
    WHERE timeline_id = v_timeline_id;

    INSERT INTO public.timeline_operations (
      id,
      timeline_id,
      operation_type,
      operation_index,
      params,
      inverse_params,
      version_after,
      user_id,
      created_at
    ) VALUES (
      COALESCE((p_operation->>'id')::UUID, gen_random_uuid()),
      v_timeline_id,
      LOWER(p_operation->>'type'),
      v_next_op_idx,
      COALESCE(p_operation->'params', '{}'::jsonb),
      COALESCE(p_operation->'inverseParams', '{}'::jsonb),
      v_new_version,
      p_user_id,
      NOW()
    );
  END IF;

  -- 5. Construct canonical return JSON
  SELECT jsonb_build_object(
    'id', v_timeline_id,
    'projectId', p_project_id,
    'version', v_new_version,
    'duration', p_duration,
    'timebase', COALESCE(p_timebase, '30fps'),
    'status', 'active',
    'tracks', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', tr.id,
          'timelineId', tr.timeline_id,
          'type', tr.track_type,
          'index', tr.track_index,
          'name', tr.name,
          'isMuted', tr.is_muted,
          'isLocked', tr.is_locked,
          'items', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', ti.id,
                'trackId', ti.track_id,
                'sourceMediaId', ti.source_media_id,
                'sourceStart', ti.source_start,
                'sourceEnd', ti.source_end,
                'timelineStart', ti.timeline_start,
                'timelineEnd', ti.timeline_end,
                'speed', ti.speed,
                'enabled', ti.enabled,
                'label', ti.label,
                'metadata', ti.metadata
              ) ORDER BY ti.timeline_start ASC
            )
            FROM public.timeline_items ti
            WHERE ti.track_id = tr.id
          ), '[]'::jsonb)
        ) ORDER BY tr.track_index ASC
      )
      FROM public.tracks tr
      WHERE tr.timeline_id = v_timeline_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Secure the RPC
REVOKE EXECUTE ON FUNCTION public.save_timeline_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_timeline_atomic TO service_role;
