-- Migration: 20261004_phase_6_1_hardening.sql
-- Phase 6.1: Auto-Reframe Security, Trust-Boundary & Real-World Hardening

-- 1. Additively extend public.reframe_analyses with metadata and degraded columns
ALTER TABLE public.reframe_analyses
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS degraded BOOLEAN NOT NULL DEFAULT false;

-- Drop older 10-argument signature so the new parameterized function with defaults is unambiguous
DROP FUNCTION IF EXISTS public.save_reframe_analysis_atomic(
  UUID, UUID, UUID, INTEGER, INTEGER, NUMERIC, JSONB, JSONB, TEXT, TEXT
);

-- 2. Enhanced Atomic RPC: save_reframe_analysis_atomic with strict input bounds,

-- tenant validation, media-project relationship verification, and search_path isolation
CREATE OR REPLACE FUNCTION public.save_reframe_analysis_atomic(
  p_project_id UUID,
  p_user_id UUID,
  p_media_asset_id UUID,
  p_source_width INTEGER,
  p_source_height INTEGER,
  p_duration NUMERIC,
  p_scenes JSONB,
  p_subject_tracks JSONB,
  p_provider TEXT DEFAULT 'hybrid',
  p_version TEXT DEFAULT '2.0.0',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_degraded BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_project RECORD;
  v_user_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_media_exists BOOLEAN;
  v_analysis RECORD;
  v_result JSONB;
BEGIN
  -- Strict numeric & schema parameter validation
  IF p_source_width IS NULL OR p_source_width <= 0 THEN
    RAISE EXCEPTION 'INVALID_WIDTH: Source width must be positive' USING ERRCODE = '22003';
  END IF;

  IF p_source_height IS NULL OR p_source_height <= 0 THEN
    RAISE EXCEPTION 'INVALID_HEIGHT: Source height must be positive' USING ERRCODE = '22003';
  END IF;

  IF p_duration IS NULL OR p_duration <= 0 THEN
    RAISE EXCEPTION 'INVALID_DURATION: Duration must be positive' USING ERRCODE = '22003';
  END IF;

  IF p_scenes IS NOT NULL AND jsonb_typeof(p_scenes) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SCENES: Scenes must be a json array' USING ERRCODE = '22023';
  END IF;

  IF p_subject_tracks IS NOT NULL AND jsonb_typeof(p_subject_tracks) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_TRACKS: Subject tracks must be a json array' USING ERRCODE = '22023';
  END IF;

  -- 1. Validate project existence
  SELECT id, user_id, workspace_id INTO v_project
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate authorization
  IF p_user_id IS NOT NULL THEN
    SELECT id, role INTO v_user_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FORBIDDEN: User % does not exist', p_user_id
        USING ERRCODE = '42501';
    END IF;

    IF v_user_profile.role = 'viewer' THEN
      RAISE EXCEPTION 'FORBIDDEN: Viewer % is not permitted to mutate reframe analysis', p_user_id
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

  -- 3. Validate media asset ownership: media must belong strictly to project
  SELECT EXISTS (
    SELECT 1 FROM public.media_assets
    WHERE id = p_media_asset_id AND project_id = p_project_id
  ) INTO v_media_exists;

  IF NOT v_media_exists THEN
    RAISE EXCEPTION 'MEDIA_NOT_OWNED: Media asset % does not belong to project %', p_media_asset_id, p_project_id
      USING ERRCODE = '42501';
  END IF;

  -- 4. Upsert analysis record
  INSERT INTO public.reframe_analyses (
    project_id,
    media_asset_id,
    source_width,
    source_height,
    duration,
    scenes,
    subject_tracks,
    provider,
    version,
    metadata,
    degraded,
    updated_at
  ) VALUES (
    p_project_id,
    p_media_asset_id,
    p_source_width,
    p_source_height,
    p_duration,
    COALESCE(p_scenes, '[]'::jsonb),
    COALESCE(p_subject_tracks, '[]'::jsonb),
    COALESCE(p_provider, 'hybrid'),
    COALESCE(p_version, '2.0.0'),
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_degraded, false),
    NOW()
  )
  ON CONFLICT (project_id, media_asset_id)
  DO UPDATE SET
    source_width = EXCLUDED.source_width,
    source_height = EXCLUDED.source_height,
    duration = EXCLUDED.duration,
    scenes = EXCLUDED.scenes,
    subject_tracks = EXCLUDED.subject_tracks,
    provider = EXCLUDED.provider,
    version = EXCLUDED.version,
    metadata = EXCLUDED.metadata,
    degraded = EXCLUDED.degraded,
    updated_at = NOW()
  RETURNING * INTO v_analysis;

  -- 5. Format JSON response
  v_result := jsonb_build_object(
    'id', v_analysis.id,
    'projectId', v_analysis.project_id,
    'mediaAssetId', v_analysis.media_asset_id,
    'sourceWidth', v_analysis.source_width,
    'sourceHeight', v_analysis.source_height,
    'duration', v_analysis.duration,
    'scenes', v_analysis.scenes,
    'subjectTracks', v_analysis.subject_tracks,
    'provider', v_analysis.provider,
    'version', v_analysis.version,
    'metadata', v_analysis.metadata,
    'degraded', v_analysis.degraded,
    'createdAt', v_analysis.created_at,
    'updatedAt', v_analysis.updated_at
  );

  RETURN v_result;
END;
$$;

-- 3. Enhanced Atomic RPC: save_reframe_config_atomic with strict input bounds
CREATE OR REPLACE FUNCTION public.save_reframe_config_atomic(
  p_project_id UUID,
  p_user_id UUID,
  p_target_aspect_ratio TEXT,
  p_tracking_mode TEXT DEFAULT 'smart',
  p_multi_person_mode TEXT DEFAULT 'GENERAL',
  p_manual_settings JSONB DEFAULT NULL,
  p_smoothing_alpha NUMERIC DEFAULT 0.25,
  p_dead_zone NUMERIC DEFAULT 0.035,
  p_headroom NUMERIC DEFAULT 0.35
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_project RECORD;
  v_user_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_config RECORD;
  v_result JSONB;
BEGIN
  -- Strict configuration parameter validation
  IF p_target_aspect_ratio NOT IN ('16:9', '9:16', '1:1', '4:5') THEN
    RAISE EXCEPTION 'INVALID_ASPECT_RATIO: Target aspect ratio % is invalid', p_target_aspect_ratio
      USING ERRCODE = '22023';
  END IF;

  IF p_tracking_mode IS NOT NULL AND p_tracking_mode NOT IN ('center', 'smart', 'manual') THEN
    RAISE EXCEPTION 'INVALID_TRACKING_MODE: Tracking mode % is invalid', p_tracking_mode
      USING ERRCODE = '22023';
  END IF;

  IF p_multi_person_mode IS NOT NULL AND p_multi_person_mode NOT IN ('SINGLE', 'DUAL', 'GROUP', 'GENERAL') THEN
    RAISE EXCEPTION 'INVALID_MULTI_PERSON_MODE: Multi person mode % is invalid', p_multi_person_mode
      USING ERRCODE = '22023';
  END IF;

  IF p_smoothing_alpha IS NOT NULL AND (p_smoothing_alpha <= 0 OR p_smoothing_alpha > 1.0) THEN
    RAISE EXCEPTION 'INVALID_SMOOTHING_ALPHA: Smoothing alpha must be in (0, 1]'
      USING ERRCODE = '22003';
  END IF;

  IF p_dead_zone IS NOT NULL AND (p_dead_zone < 0 OR p_dead_zone > 0.5) THEN
    RAISE EXCEPTION 'INVALID_DEAD_ZONE: Dead zone must be in [0, 0.5]'
      USING ERRCODE = '22003';
  END IF;

  IF p_headroom IS NOT NULL AND (p_headroom < 0 OR p_headroom > 1.0) THEN
    RAISE EXCEPTION 'INVALID_HEADROOM: Headroom must be in [0, 1.0]'
      USING ERRCODE = '22003';
  END IF;

  -- 1. Validate project existence
  SELECT id, user_id, workspace_id INTO v_project
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND: Project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate authorization
  IF p_user_id IS NOT NULL THEN
    SELECT id, role INTO v_user_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FORBIDDEN: User % does not exist', p_user_id
        USING ERRCODE = '42501';
    END IF;

    IF v_user_profile.role = 'viewer' THEN
      RAISE EXCEPTION 'FORBIDDEN: Viewer % is not permitted to mutate reframe config', p_user_id
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

  -- 3. Upsert config record
  INSERT INTO public.reframe_configs (
    project_id,
    target_aspect_ratio,
    tracking_mode,
    multi_person_mode,
    manual_settings,
    smoothing_alpha,
    dead_zone,
    headroom,
    version,
    updated_at
  ) VALUES (
    p_project_id,
    p_target_aspect_ratio,
    COALESCE(p_tracking_mode, 'smart'),
    COALESCE(p_multi_person_mode, 'GENERAL'),
    p_manual_settings,
    COALESCE(p_smoothing_alpha, 0.25),
    COALESCE(p_dead_zone, 0.035),
    COALESCE(p_headroom, 0.35),
    1,
    NOW()
  )
  ON CONFLICT (project_id, target_aspect_ratio)
  DO UPDATE SET
    tracking_mode = EXCLUDED.tracking_mode,
    multi_person_mode = EXCLUDED.multi_person_mode,
    manual_settings = EXCLUDED.manual_settings,
    smoothing_alpha = EXCLUDED.smoothing_alpha,
    dead_zone = EXCLUDED.dead_zone,
    headroom = EXCLUDED.headroom,
    version = public.reframe_configs.version + 1,
    updated_at = NOW()
  RETURNING * INTO v_config;

  -- 4. Format JSON response
  v_result := jsonb_build_object(
    'id', v_config.id,
    'projectId', v_config.project_id,
    'targetAspectRatio', v_config.target_aspect_ratio,
    'trackingMode', v_config.tracking_mode,
    'multiPersonMode', v_config.multi_person_mode,
    'manualSettings', v_config.manual_settings,
    'smoothingAlpha', v_config.smoothing_alpha,
    'deadZone', v_config.dead_zone,
    'headroom', v_config.headroom,
    'version', v_config.version,
    'createdAt', v_config.created_at,
    'updatedAt', v_config.updated_at
  );

  RETURN v_result;
END;
$$;

-- 4. Permissions
GRANT EXECUTE ON FUNCTION public.save_reframe_analysis_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_reframe_config_atomic TO authenticated, service_role;
