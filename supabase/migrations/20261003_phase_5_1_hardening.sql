-- Migration: 20261003_phase_5_1_hardening.sql
-- Phase 5.1: Real Redo Engine, Deterministic Journal Semantics, Consistent RBAC & Strict DB Validation

-- 1. Ensure organization_members table exists for workspace collaboration RBAC
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'EDITOR' CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'APPROVER', 'CLIENT', 'VIEWER')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(workspace_id, user_id)
);

-- 2. Add current_operation_index column to timelines
ALTER TABLE public.timelines 
  ADD COLUMN IF NOT EXISTS current_operation_index INTEGER NOT NULL DEFAULT 0 CHECK (current_operation_index >= 0);

-- 3. Add snapshots to timeline_operations for deterministic state reconstruction
ALTER TABLE public.timeline_operations
  ADD COLUMN IF NOT EXISTS snapshot_before JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_after JSONB DEFAULT '[]'::jsonb;

-- 4. Replace save_timeline_atomic with RBAC, journal cursor, and strict validation
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
  v_user_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_new_version INTEGER;
  v_timeline_id UUID;
  v_track_elem JSONB;
  v_item_elem JSONB;
  v_track_id UUID;
  v_item_id UUID;
  v_media_id UUID;
  v_next_op_idx INTEGER;
  v_media_exists BOOLEAN;
  v_old_tracks JSONB := '[]'::jsonb;
  v_result JSONB;
  v_source_start NUMERIC;
  v_source_end NUMERIC;
  v_timeline_start NUMERIC;
  v_timeline_end NUMERIC;
  v_speed NUMERIC;
BEGIN
  -- 1. Validate project existence
  SELECT id, user_id, workspace_id, active_media_id INTO v_project
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate user authorization
  IF p_user_id IS NOT NULL THEN
    SELECT id, role INTO v_user_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FORBIDDEN: User % does not exist', p_user_id
        USING ERRCODE = '42501';
    END IF;

    -- Viewers cannot mutate
    IF v_user_profile.role = 'viewer' THEN
      RAISE EXCEPTION 'FORBIDDEN: Viewer % is not permitted to mutate timeline', p_user_id
        USING ERRCODE = '42501';
    END IF;

    -- Owner, Admin, or legitimate Workspace Editor check
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

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'FORBIDDEN: User % is not authorized to edit project %', p_user_id, p_project_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Strict duration validation
  IF p_duration IS NULL OR p_duration < 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Duration must be a non-negative number'
      USING ERRCODE = '22023';
  END IF;

  -- 4. Lock or initialize timeline row with optimistic concurrency check
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

    -- Capture existing tracks snapshot before deletion
    SELECT COALESCE((
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
    ), '[]'::jsonb) INTO v_old_tracks;

    UPDATE public.timelines
    SET version = v_new_version,
        duration = p_duration,
        timebase = COALESCE(p_timebase, v_timeline.timebase),
        updated_at = NOW()
    WHERE id = v_timeline_id;
  ELSE
    v_new_version := 1;
    v_timeline_id := gen_random_uuid();
    v_old_tracks := '[]'::jsonb;

    INSERT INTO public.timelines (
      id, project_id, version, duration, timebase, status, current_operation_index, created_at, updated_at
    ) VALUES (
      v_timeline_id, p_project_id, v_new_version, p_duration, COALESCE(p_timebase, '30fps'), 'active', 0, NOW(), NOW()
    );
  END IF;

  -- 5. Atomically replace tracks and timeline items
  DELETE FROM public.tracks WHERE timeline_id = v_timeline_id;

  IF p_tracks IS NOT NULL AND jsonb_array_length(p_tracks) > 0 THEN
    FOR v_track_elem IN SELECT * FROM jsonb_array_elements(p_tracks)
    LOOP
      v_track_id := COALESCE((v_track_elem->>'id')::UUID, gen_random_uuid());

      IF (v_track_elem->>'index') IS NULL OR (v_track_elem->>'index')::INTEGER < 0 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Track index must be non-negative integer'
          USING ERRCODE = '22023';
      END IF;

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

          -- Strict field presence validation
          IF (v_item_elem->>'sourceStart') IS NULL OR (v_item_elem->>'sourceEnd') IS NULL OR
             (v_item_elem->>'timelineStart') IS NULL OR (v_item_elem->>'timelineEnd') IS NULL THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: Missing numeric timestamps in timeline item'
              USING ERRCODE = '22023';
          END IF;

          v_source_start := (v_item_elem->>'sourceStart')::NUMERIC;
          v_source_end := (v_item_elem->>'sourceEnd')::NUMERIC;
          v_timeline_start := (v_item_elem->>'timelineStart')::NUMERIC;
          v_timeline_end := (v_item_elem->>'timelineEnd')::NUMERIC;
          v_speed := COALESCE((v_item_elem->>'speed')::NUMERIC, 1.000);

          -- Mathematical range & constraint validation
          IF v_source_start < 0 THEN
            RAISE EXCEPTION 'INVALID_SOURCE_RANGE: sourceStart % must be non-negative', v_source_start
              USING ERRCODE = '22023';
          END IF;

          IF v_source_end <= v_source_start THEN
            RAISE EXCEPTION 'INVALID_SOURCE_RANGE: sourceEnd % must be greater than sourceStart %', v_source_end, v_source_start
              USING ERRCODE = '22023';
          END IF;

          IF v_timeline_start < 0 THEN
            RAISE EXCEPTION 'INVALID_TIMELINE_RANGE: timelineStart % must be non-negative', v_timeline_start
              USING ERRCODE = '22023';
          END IF;

          IF v_timeline_end <= v_timeline_start THEN
            RAISE EXCEPTION 'INVALID_TIMELINE_RANGE: timelineEnd % must be greater than timelineStart %', v_timeline_end, v_timeline_start
              USING ERRCODE = '22023';
          END IF;

          IF v_speed <= 0 THEN
            RAISE EXCEPTION 'INVALID_SPEED: speed % must be strictly positive', v_speed
              USING ERRCODE = '22023';
          END IF;

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
            v_source_start,
            v_source_end,
            v_timeline_start,
            v_timeline_end,
            v_speed,
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

  -- 6. Journal Cursor Management & Redo Invalidation
  IF p_operation IS NOT NULL AND (p_operation->>'type') IS NOT NULL THEN
    -- Invalidate redo branch: any operations beyond current cursor are permanently removed
    DELETE FROM public.timeline_operations
    WHERE timeline_id = v_timeline_id
      AND operation_index > COALESCE(v_timeline.current_operation_index, 0);

    v_next_op_idx := COALESCE(v_timeline.current_operation_index, 0) + 1;

    INSERT INTO public.timeline_operations (
      id,
      timeline_id,
      operation_type,
      operation_index,
      params,
      inverse_params,
      snapshot_before,
      snapshot_after,
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
      v_old_tracks,
      p_tracks,
      v_new_version,
      p_user_id,
      NOW()
    );

    UPDATE public.timelines
    SET current_operation_index = v_next_op_idx
    WHERE id = v_timeline_id;
  ELSE
    v_next_op_idx := COALESCE(v_timeline.current_operation_index, 0);
  END IF;

  -- 7. Construct canonical return JSON
  SELECT jsonb_build_object(
    'id', v_timeline_id,
    'projectId', p_project_id,
    'version', v_new_version,
    'duration', p_duration,
    'timebase', COALESCE(p_timebase, '30fps'),
    'status', 'active',
    'currentOperationIndex', v_next_op_idx,
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

-- 4. Create authoritative undo_timeline_atomic RPC
CREATE OR REPLACE FUNCTION public.undo_timeline_atomic(
  p_project_id UUID,
  p_user_id UUID,
  p_expected_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_project RECORD;
  v_timeline RECORD;
  v_user_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_current_cursor INTEGER;
  v_target_op RECORD;
  v_restored_tracks JSONB;
  v_new_version INTEGER;
  v_timeline_id UUID;
  v_track_elem JSONB;
  v_item_elem JSONB;
  v_track_id UUID;
  v_item_id UUID;
  v_media_id UUID;
  v_media_exists BOOLEAN;
  v_result JSONB;
  v_new_duration NUMERIC := 0.000;
  v_item_end NUMERIC;
BEGIN
  -- 1. Validate project existence
  SELECT id, user_id, workspace_id INTO v_project
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Authorization check
  IF p_user_id IS NOT NULL THEN
    SELECT id, role INTO v_user_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FORBIDDEN: User % does not exist', p_user_id
        USING ERRCODE = '42501';
    END IF;

    IF v_user_profile.role = 'viewer' THEN
      RAISE EXCEPTION 'FORBIDDEN: Viewer % is not permitted to mutate timeline', p_user_id
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

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'FORBIDDEN: User % is not authorized to edit project %', p_user_id, p_project_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Lock timeline row FOR UPDATE and check expected version
  SELECT * INTO v_timeline
  FROM public.timelines
  WHERE project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TIMELINE_NOT_FOUND: Timeline for project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  IF p_expected_version IS NOT NULL AND v_timeline.version <> p_expected_version THEN
    RAISE EXCEPTION 'TIMELINE_VERSION_CONFLICT: Expected version % but found version %',
      p_expected_version, v_timeline.version
      USING ERRCODE = '23505';
  END IF;

  v_timeline_id := v_timeline.id;
  v_current_cursor := COALESCE(v_timeline.current_operation_index, 0);

  IF v_current_cursor <= 0 THEN
    RAISE EXCEPTION 'NO_UNDO_OPERATION: Nothing to undo'
      USING ERRCODE = 'P0002';
  END IF;

  -- Fetch operation at current cursor
  SELECT * INTO v_target_op
  FROM public.timeline_operations
  WHERE timeline_id = v_timeline_id
    AND operation_index = v_current_cursor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_UNDO_OPERATION: Target operation not found at cursor %', v_current_cursor
      USING ERRCODE = 'P0002';
  END IF;

  IF LOWER(v_target_op.operation_type) = 'create_timeline' THEN
    RAISE EXCEPTION 'NO_UNDO_OPERATION: Cannot undo initial timeline creation'
      USING ERRCODE = 'P0002';
  END IF;

  v_restored_tracks := v_target_op.snapshot_before;
  IF v_restored_tracks IS NULL THEN
    v_restored_tracks := '[]'::jsonb;
  END IF;

  -- Atomically restore tracks and timeline items
  DELETE FROM public.tracks WHERE timeline_id = v_timeline_id;

  IF jsonb_array_length(v_restored_tracks) > 0 THEN
    FOR v_track_elem IN SELECT * FROM jsonb_array_elements(v_restored_tracks)
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

          v_item_end := (v_item_elem->>'timelineEnd')::NUMERIC;
          IF v_item_end > v_new_duration THEN
            v_new_duration := v_item_end;
          END IF;

          INSERT INTO public.timeline_items (
            id, track_id, source_media_id, source_start, source_end, timeline_start, timeline_end,
            speed, enabled, label, metadata, created_at, updated_at
          ) VALUES (
            v_item_id,
            v_track_id,
            v_media_id,
            (v_item_elem->>'sourceStart')::NUMERIC,
            (v_item_elem->>'sourceEnd')::NUMERIC,
            (v_item_elem->>'timelineStart')::NUMERIC,
            v_item_end,
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

  v_new_version := v_timeline.version + 1;

  UPDATE public.timelines
  SET version = v_new_version,
      current_operation_index = v_current_cursor - 1,
      duration = v_new_duration,
      updated_at = NOW()
  WHERE id = v_timeline_id;

  -- Construct canonical return JSON
  SELECT jsonb_build_object(
    'id', v_timeline_id,
    'projectId', p_project_id,
    'version', v_new_version,
    'duration', v_new_duration,
    'timebase', v_timeline.timebase,
    'status', v_timeline.status,
    'currentOperationIndex', v_current_cursor - 1,
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

-- 5. Create authoritative redo_timeline_atomic RPC
CREATE OR REPLACE FUNCTION public.redo_timeline_atomic(
  p_project_id UUID,
  p_user_id UUID,
  p_expected_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_project RECORD;
  v_timeline RECORD;
  v_user_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_current_cursor INTEGER;
  v_target_op RECORD;
  v_restored_tracks JSONB;
  v_new_version INTEGER;
  v_timeline_id UUID;
  v_track_elem JSONB;
  v_item_elem JSONB;
  v_track_id UUID;
  v_item_id UUID;
  v_media_id UUID;
  v_media_exists BOOLEAN;
  v_result JSONB;
  v_new_duration NUMERIC := 0.000;
  v_item_end NUMERIC;
BEGIN
  -- 1. Validate project existence
  SELECT id, user_id, workspace_id INTO v_project
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Authorization check
  IF p_user_id IS NOT NULL THEN
    SELECT id, role INTO v_user_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FORBIDDEN: User % does not exist', p_user_id
        USING ERRCODE = '42501';
    END IF;

    IF v_user_profile.role = 'viewer' THEN
      RAISE EXCEPTION 'FORBIDDEN: Viewer % is not permitted to mutate timeline', p_user_id
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

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'FORBIDDEN: User % is not authorized to edit project %', p_user_id, p_project_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Lock timeline row FOR UPDATE and check expected version
  SELECT * INTO v_timeline
  FROM public.timelines
  WHERE project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TIMELINE_NOT_FOUND: Timeline for project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  IF p_expected_version IS NOT NULL AND v_timeline.version <> p_expected_version THEN
    RAISE EXCEPTION 'TIMELINE_VERSION_CONFLICT: Expected version % but found version %',
      p_expected_version, v_timeline.version
      USING ERRCODE = '23505';
  END IF;

  v_timeline_id := v_timeline.id;
  v_current_cursor := COALESCE(v_timeline.current_operation_index, 0);

  -- Target op to redo is cursor + 1
  SELECT * INTO v_target_op
  FROM public.timeline_operations
  WHERE timeline_id = v_timeline_id
    AND operation_index = v_current_cursor + 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_REDO_OPERATION: No operations available to redo'
      USING ERRCODE = 'P0002';
  END IF;

  v_restored_tracks := v_target_op.snapshot_after;
  IF v_restored_tracks IS NULL THEN
    v_restored_tracks := '[]'::jsonb;
  END IF;

  -- Atomically restore tracks and timeline items
  DELETE FROM public.tracks WHERE timeline_id = v_timeline_id;

  IF jsonb_array_length(v_restored_tracks) > 0 THEN
    FOR v_track_elem IN SELECT * FROM jsonb_array_elements(v_restored_tracks)
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

          v_item_end := (v_item_elem->>'timelineEnd')::NUMERIC;
          IF v_item_end > v_new_duration THEN
            v_new_duration := v_item_end;
          END IF;

          INSERT INTO public.timeline_items (
            id, track_id, source_media_id, source_start, source_end, timeline_start, timeline_end,
            speed, enabled, label, metadata, created_at, updated_at
          ) VALUES (
            v_item_id,
            v_track_id,
            v_media_id,
            (v_item_elem->>'sourceStart')::NUMERIC,
            (v_item_elem->>'sourceEnd')::NUMERIC,
            (v_item_elem->>'timelineStart')::NUMERIC,
            v_item_end,
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

  v_new_version := v_timeline.version + 1;

  UPDATE public.timelines
  SET version = v_new_version,
      current_operation_index = v_current_cursor + 1,
      duration = v_new_duration,
      updated_at = NOW()
  WHERE id = v_timeline_id;

  -- Construct canonical return JSON
  SELECT jsonb_build_object(
    'id', v_timeline_id,
    'projectId', p_project_id,
    'version', v_new_version,
    'duration', v_new_duration,
    'timebase', v_timeline.timebase,
    'status', v_timeline.status,
    'currentOperationIndex', v_current_cursor + 1,
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

-- 6. Enforce least privilege execution permissions
REVOKE EXECUTE ON FUNCTION public.save_timeline_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_timeline_atomic TO service_role;

REVOKE EXECUTE ON FUNCTION public.undo_timeline_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_timeline_atomic TO service_role;

REVOKE EXECUTE ON FUNCTION public.redo_timeline_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redo_timeline_atomic TO service_role;
