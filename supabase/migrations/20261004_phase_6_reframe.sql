-- Migration: 20261004_phase_6_reframe.sql
-- Phase 6: Real Auto-Reframe Engine, Canonical Model, Additive Persistence & RLS

-- 1. Create public.reframe_analyses table
CREATE TABLE IF NOT EXISTS public.reframe_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  source_width INTEGER NOT NULL CHECK (source_width > 0),
  source_height INTEGER NOT NULL CHECK (source_height > 0),
  duration NUMERIC(12, 3) NOT NULL CHECK (duration > 0),
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject_tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider TEXT NOT NULL DEFAULT 'hybrid',
  version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_reframe_analysis_project_media UNIQUE (project_id, media_asset_id)
);

-- 2. Create public.reframe_configs table
CREATE TABLE IF NOT EXISTS public.reframe_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_aspect_ratio TEXT NOT NULL CHECK (target_aspect_ratio IN ('16:9', '9:16', '1:1', '4:5')),
  tracking_mode TEXT NOT NULL DEFAULT 'smart' CHECK (tracking_mode IN ('center', 'smart', 'manual')),
  multi_person_mode TEXT NOT NULL DEFAULT 'GENERAL' CHECK (multi_person_mode IN ('SINGLE', 'DUAL', 'GROUP', 'GENERAL')),
  manual_settings JSONB,
  smoothing_alpha NUMERIC(4, 3) DEFAULT 0.25 CHECK (smoothing_alpha > 0 AND smoothing_alpha <= 1.0),
  dead_zone NUMERIC(4, 3) DEFAULT 0.035 CHECK (dead_zone >= 0),
  headroom NUMERIC(4, 3) DEFAULT 0.35 CHECK (headroom >= 0 AND headroom <= 1.0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_reframe_configs_proj_aspect UNIQUE (project_id, target_aspect_ratio)
);

-- 3. Update timeline_operations check constraint to allow set_reframe and reframe operations
ALTER TABLE public.timeline_operations
  DROP CONSTRAINT IF EXISTS timeline_operations_operation_type_check;

ALTER TABLE public.timeline_operations
  ADD CONSTRAINT timeline_operations_operation_type_check
  CHECK (LOWER(operation_type) IN (
    'split_item', 'trim_item', 'delete_item', 'delete_range',
    'move_item', 'insert_item', 'set_speed', 'set_enabled',
    'create_timeline', 'sync_transcript', 'split', 'trim',
    'undo', 'redo', 'set_reframe', 'reframe'
  ));

-- 4. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_reframe_analyses_project_id ON public.reframe_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_reframe_analyses_media_id ON public.reframe_analyses(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_reframe_configs_project_id ON public.reframe_configs(project_id);

-- 5. Enable Row-Level Security
ALTER TABLE public.reframe_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reframe_configs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for reframe_analyses
DROP POLICY IF EXISTS "Users can read reframe analyses in their projects" ON public.reframe_analyses;
CREATE POLICY "Users can read reframe analyses in their projects"
ON public.reframe_analyses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = reframe_analyses.project_id
    AND (
      p.user_id = auth.uid()
      OR p.workspace_id IN (
        SELECT workspace_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

DROP POLICY IF EXISTS "Editors can insert or update reframe analyses" ON public.reframe_analyses;
CREATE POLICY "Editors can insert or update reframe analyses"
ON public.reframe_analyses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = reframe_analyses.project_id
    AND (
      p.user_id = auth.uid()
      OR p.workspace_id IN (
        SELECT workspace_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
        AND UPPER(role) IN ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR')
      )
    )
  )
);

-- 7. RLS Policies for reframe_configs
DROP POLICY IF EXISTS "Users can read reframe configs in their projects" ON public.reframe_configs;
CREATE POLICY "Users can read reframe configs in their projects"
ON public.reframe_configs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = reframe_configs.project_id
    AND (
      p.user_id = auth.uid()
      OR p.workspace_id IN (
        SELECT workspace_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

DROP POLICY IF EXISTS "Editors can insert or update reframe configs" ON public.reframe_configs;
CREATE POLICY "Editors can insert or update reframe configs"
ON public.reframe_configs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = reframe_configs.project_id
    AND (
      p.user_id = auth.uid()
      OR p.workspace_id IN (
        SELECT workspace_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
        AND UPPER(role) IN ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR')
      )
    )
  )
);

-- 8. Atomic RPC: save_reframe_analysis_atomic
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
  p_version TEXT DEFAULT '1.0.0'
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
  v_media_exists BOOLEAN;
  v_analysis RECORD;
  v_result JSONB;
BEGIN
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

  -- 3. Validate media asset ownership: media must belong to project
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
    COALESCE(p_version, '1.0.0'),
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
    'createdAt', v_analysis.created_at,
    'updatedAt', v_analysis.updated_at
  );

  RETURN v_result;
END;
$$;

-- 9. Atomic RPC: save_reframe_config_atomic
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
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_project RECORD;
  v_user_profile RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_config RECORD;
  v_result JSONB;
BEGIN
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

-- 10. Grants
GRANT EXECUTE ON FUNCTION public.save_reframe_analysis_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_reframe_config_atomic TO authenticated, service_role;
