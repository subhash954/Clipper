-- Production PostgreSQL Schema for Clipper AI Video SaaS
-- Mission 2: Real Media Pipeline + Enterprise Tenant Isolation + Role-Based Access Control

-- 1. Profiles & Subscriptions
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  plan_tier TEXT DEFAULT 'free' CHECK (plan_tier IN ('free', 'starter', 'pro', 'documentary_agency')),
  credits_remaining INTEGER DEFAULT 3,
  total_minutes_processed NUMERIC DEFAULT 0,
  total_cost_incurred_usd NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Workspaces (Multi-tenancy & Collaboration)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2b. Organization & Workspace Memberships (RBAC & Collaboration)
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

-- 3. Video Projects (Strict RFC 4122 UUID + source_external_id)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  source_external_id TEXT, -- Stores YouTube Video ID (e.g. dQw4w9WgXcQ), TikTok ID, or external file ID
  title TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  active_media_id UUID,
  active_version_id UUID,
  channel_name TEXT,
  thumbnail_url TEXT,
  workflow_type TEXT NOT NULL DEFAULT 'youtube_to_shorts' CHECK (workflow_type IN ('youtube_to_shorts', 'one_finger_reel', 'ai_documentary')),
  source_url TEXT,
  source_type TEXT DEFAULT 'youtube' CHECK (source_type IN ('youtube', 'upload', 'script')),
  duration_seconds NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'ingesting', 'media_ready', 'transcribing', 'transcript_ready', 'analyzing', 'clips_ready', 'editing', 'render_queued', 'rendering', 'completed', 'export_ready', 'failed')),
  error_message TEXT,
  cost_usd NUMERIC DEFAULT 0,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Media Assets (Uploaded Video, Probed Metadata, Audio Extractions)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  duration NUMERIC,
  width INTEGER,
  height INTEGER,
  codec TEXT,
  audio_codec TEXT,
  fps NUMERIC,
  sample_rate INTEGER,
  channels INTEGER,
  bitrate BIGINT,
  rotation INTEGER DEFAULT 0,
  color_space TEXT,
  status TEXT DEFAULT 'ready' CHECK (status IN ('uploading', 'ready', 'processing', 'failed', 'deleted')),
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_media_assets_id_project UNIQUE (id, project_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_active_media') THEN
    ALTER TABLE public.projects ADD CONSTRAINT fk_projects_active_media FOREIGN KEY (active_media_id) REFERENCES public.media_assets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Transcripts (Word-level timestamps & full text)
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
  media_asset_id UUID,
  transcript_text TEXT NOT NULL,
  words JSONB NOT NULL DEFAULT '[]'::jsonb,
  utterances JSONB DEFAULT '[]'::jsonb,
  language TEXT DEFAULT 'en',
  timing_precision TEXT DEFAULT 'exact_word' CHECK (timing_precision IN ('exact_word', 'approximate_cue')),
  timing_label TEXT,
  source TEXT DEFAULT 'deepgram' CHECK (source IN ('deepgram', 'youtube_captions', 'user_upload')),
  provider TEXT DEFAULT 'deepgram',
  model TEXT DEFAULT 'nova-2',
  duration NUMERIC(12, 3),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_transcripts_media_project FOREIGN KEY (media_asset_id, project_id) REFERENCES public.media_assets(id, project_id) ON DELETE CASCADE
);

-- 5a. Normalized Transcript Segments
CREATE TABLE IF NOT EXISTS public.transcript_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transcript_id UUID NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  start_time NUMERIC(12, 3) NOT NULL CHECK (start_time >= 0),
  end_time NUMERIC(12, 3) NOT NULL CHECK (end_time >= start_time),
  text TEXT NOT NULL,
  confidence NUMERIC(5, 4),
  speaker INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_transcript_segments_transcript_idx UNIQUE (transcript_id, segment_index),
  CONSTRAINT uq_transcript_segments_id_transcript UNIQUE (id, transcript_id)
);

-- 5b. Normalized Transcript Words
CREATE TABLE IF NOT EXISTS public.transcript_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transcript_id UUID NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.transcript_segments(id) ON DELETE CASCADE,
  word_index INTEGER NOT NULL,
  word TEXT NOT NULL,
  start_time NUMERIC(12, 3) NOT NULL CHECK (start_time >= 0),
  end_time NUMERIC(12, 3) NOT NULL CHECK (end_time >= start_time),
  confidence NUMERIC(5, 4),
  speaker INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_transcript_words_transcript_idx UNIQUE (transcript_id, word_index),
  CONSTRAINT fk_transcript_words_segment_transcript FOREIGN KEY (segment_id, transcript_id) REFERENCES public.transcript_segments(id, transcript_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON public.transcripts(project_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_media_asset_id ON public.transcripts(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_transcript_id ON public.transcript_segments(transcript_id, segment_index);
CREATE INDEX IF NOT EXISTS idx_transcript_words_transcript_id ON public.transcript_words(transcript_id, word_index);
CREATE INDEX IF NOT EXISTS idx_transcript_words_timing ON public.transcript_words(transcript_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_transcript_words_segment_id ON public.transcript_words(segment_id);

-- 6. Generated Viral Clips / Outputs
CREATE TABLE IF NOT EXISTS public.clips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  rank INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  hook_summary TEXT,
  important_line TEXT,
  why_important TEXT,
  key_moment_type TEXT,
  viral_score INTEGER CHECK (viral_score BETWEEN 0 AND 100),
  score_breakdown JSONB DEFAULT '{}'::jsonb,
  start_time NUMERIC NOT NULL,
  end_time NUMERIC NOT NULL,
  duration NUMERIC NOT NULL,
  words JSONB NOT NULL DEFAULT '[]'::jsonb,
  cuts JSONB DEFAULT '[]'::jsonb,
  clip_url TEXT,
  thumbnail_url TEXT,
  b_roll_keywords TEXT[] DEFAULT '{}',
  sound_effects_applied TEXT[] DEFAULT '{}',
  alignment_status TEXT DEFAULT 'verified' CHECK (alignment_status IN ('verified', 'approximate', 'needs_review', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Timeline Versions & Non-Destructive Edit Decision Lists
CREATE TABLE IF NOT EXISTS public.timeline_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  render_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Render Jobs (Async Multi-Aspect Video Composition System)
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  clip_id UUID REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  current_stage TEXT DEFAULT 'Preparing render pipeline...',
  input_url TEXT NOT NULL,
  output_url TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  heartbeat_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Social Media Auto-Scheduler
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  clip_id UUID REFERENCES public.clips(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('youtube_shorts', 'tiktok', 'instagram_reels')),
  title TEXT NOT NULL,
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'publishing', 'published', 'failed')),
  published_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Platform OAuth Integrations
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram')),
  account_name TEXT,
  channel_id TEXT,
  status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'expired', 'disconnected')),
  scopes TEXT[] DEFAULT '{}',
  encrypted_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Real-Time API Cost Telemetry
CREATE TABLE IF NOT EXISTS public.cost_telemetry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL CHECK (service_name IN ('deepgram_stt', 'gemini_flash', 'pexels_broll', 'pixabay_broll', 'ffmpeg_render', 'flux_image', 'r2_storage')),
  model TEXT,
  units_used NUMERIC NOT NULL,
  unit_type TEXT NOT NULL,
  cost_in_usd NUMERIC NOT NULL,
  is_estimated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_telemetry_user_id ON public.cost_telemetry(user_id);

-- 12. Database-Backed Concurrency Protection Table
CREATE SEQUENCE IF NOT EXISTS public.transcription_lease_generation_seq START WITH 1;

CREATE TABLE IF NOT EXISTS public.transcription_locks (
  lock_key TEXT PRIMARY KEY,
  lease_token UUID NOT NULL DEFAULT gen_random_uuid(),
  lease_generation BIGINT NOT NULL DEFAULT nextval('public.transcription_lease_generation_seq'),
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
CREATE INDEX IF NOT EXISTS idx_transcription_locks_lease_token ON public.transcription_locks(lease_token);
CREATE INDEX IF NOT EXISTS idx_transcription_locks_generation ON public.transcription_locks(lease_generation);

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation; zero nullable ownership loopholes
-- -------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_locks ENABLE ROW LEVEL SECURITY;

-- Server-only coordination table: revoke direct client access
REVOKE ALL ON public.transcription_locks FROM PUBLIC;
REVOKE ALL ON public.transcription_locks FROM anon;
REVOKE ALL ON public.transcription_locks FROM authenticated;
GRANT ALL ON public.transcription_locks TO service_role;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_telemetry ENABLE ROW LEVEL SECURITY;

-- Helper to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Workspaces
CREATE POLICY "Users can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can manage their workspaces"
  ON public.workspaces FOR ALL
  USING (owner_id = auth.uid());

-- Projects
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (
    (auth.uid() = user_id OR public.is_admin())
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can insert their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (
    (auth.uid() = user_id OR public.is_admin())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (auth.uid() = user_id OR public.is_admin())
  );

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- Media Assets
CREATE POLICY "Users can view their media assets"
  ON public.media_assets FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert their media assets"
  ON public.media_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their media assets"
  ON public.media_assets FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- Transcripts (Inherited project ownership, filtered by non-deleted)
CREATE POLICY "Users can view transcripts of their projects"
  ON public.transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert transcripts for their projects"
  ON public.transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can update transcripts for their projects"
  ON public.transcripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can delete transcripts for their projects"
  ON public.transcripts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- Transcript Segments (Inherited project ownership)
CREATE POLICY "Users can view transcript segments of their projects"
  ON public.transcript_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert transcript segments for their projects"
  ON public.transcript_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can update transcript segments for their projects"
  ON public.transcript_segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can delete transcript segments for their projects"
  ON public.transcript_segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- Transcript Words (Inherited project ownership)
CREATE POLICY "Users can view transcript words of their projects"
  ON public.transcript_words FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert transcript words for their projects"
  ON public.transcript_words FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can update transcript words for their projects"
  ON public.transcript_words FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can delete transcript words for their projects"
  ON public.transcript_words FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- Clips (Inherited project ownership, filtered by non-deleted)
CREATE POLICY "Users can view clips of their projects"
  ON public.clips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = clips.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert clips for their projects"
  ON public.clips FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = clips.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can update clips for their projects"
  ON public.clips FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = clips.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can delete clips for their projects"
  ON public.clips FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = clips.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- Timeline Versions (Inherited project ownership, filtered by non-deleted)
CREATE POLICY "Users can view timeline versions of their projects"
  ON public.timeline_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timeline_versions.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert timeline versions for their projects"
  ON public.timeline_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timeline_versions.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can update timeline versions of their projects"
  ON public.timeline_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timeline_versions.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can delete timeline versions of their projects"
  ON public.timeline_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timeline_versions.project_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- Render Jobs
CREATE POLICY "Users can view their own render jobs"
  ON public.render_jobs FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create render jobs"
  ON public.render_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own render jobs"
  ON public.render_jobs FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

-- Scheduled Posts
CREATE POLICY "Users can manage their own scheduled posts"
  ON public.scheduled_posts FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- Integrations
CREATE POLICY "Users can manage their own integrations"
  ON public.integrations FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- Cost Telemetry
CREATE POLICY "Users can view cost telemetry of their projects"
  ON public.cost_telemetry FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = cost_telemetry.project_id
      AND projects.user_id = auth.uid()
    )
    OR
    public.is_admin()
  );

-- Atomic PostgreSQL RPC function for transcript replacement (Hardened SECURITY DEFINER + Fencing)
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

-- Lock down Execution Permissions (Principle of Least Privilege)
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

-- ----------------------------------------------------------------------------
-- Lease-Aware Project Status Transition RPC Function
-- Prevents un-leased, stale, or superseded workers from corrupting project state
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_project_status_if_lease_held(
  p_project_id UUID,
  p_lock_key TEXT,
  p_lease_token UUID,
  p_target_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_lease_generation BIGINT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock public.transcription_locks%ROWTYPE;
BEGIN
  IF p_lease_token IS NULL OR p_lock_key IS NULL OR p_project_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_lock
  FROM public.transcription_locks
  WHERE lock_key = p_lock_key
    AND lease_token = p_lease_token
    AND (p_lease_generation IS NULL OR lease_generation = p_lease_generation)
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.projects
  SET status = p_target_status,
      error_message = COALESCE(p_error_message, error_message),
      updated_at = NOW()
  WHERE id = p_project_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_project_status_if_lease_held(UUID, TEXT, UUID, TEXT, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_project_status_if_lease_held(UUID, TEXT, UUID, TEXT, TEXT, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.update_project_status_if_lease_held(UUID, TEXT, UUID, TEXT, TEXT, BIGINT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_status_if_lease_held(UUID, TEXT, UUID, TEXT, TEXT, BIGINT) TO service_role;

-- ============================================================================
-- Phase 5: Authoritative Non-Destructive Edit Decision List (EDL) Architecture
-- ============================================================================

-- 1. Create public.timelines table
CREATE TABLE IF NOT EXISTS public.timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  duration NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (duration >= 0),
  timebase TEXT NOT NULL DEFAULT '30fps',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  current_operation_index INTEGER NOT NULL DEFAULT 0 CHECK (current_operation_index >= 0),
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

-- 4. Create public.timeline_operations table
CREATE TABLE IF NOT EXISTS public.timeline_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (LOWER(operation_type) IN ('split_item', 'trim_item', 'delete_item', 'delete_range', 'move_item', 'insert_item', 'set_speed', 'set_enabled', 'create_timeline', 'sync_transcript', 'split', 'trim', 'undo', 'redo')),
  operation_index INTEGER NOT NULL CHECK (operation_index >= 1),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  inverse_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_before JSONB DEFAULT '[]'::jsonb,
  snapshot_after JSONB DEFAULT '[]'::jsonb,
  version_after INTEGER NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_timeline_ops_timeline_idx UNIQUE (timeline_id, operation_index)
);

-- Indexes
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

GRANT ALL ON public.timelines TO service_role;
GRANT ALL ON public.tracks TO service_role;
GRANT ALL ON public.timeline_items TO service_role;
GRANT ALL ON public.timeline_operations TO service_role;

REVOKE ALL ON public.timelines FROM PUBLIC, anon;
REVOKE ALL ON public.tracks FROM PUBLIC, anon;
REVOKE ALL ON public.timeline_items FROM PUBLIC, anon;
REVOKE ALL ON public.timeline_operations FROM PUBLIC, anon;

-- RPC for atomic timeline mutations
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

-- Create authoritative undo_timeline_atomic RPC
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

-- Create authoritative redo_timeline_atomic RPC
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

-- Enforce least privilege execution permissions
REVOKE EXECUTE ON FUNCTION public.save_timeline_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_timeline_atomic TO service_role;

REVOKE EXECUTE ON FUNCTION public.undo_timeline_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_timeline_atomic TO service_role;

REVOKE EXECUTE ON FUNCTION public.redo_timeline_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redo_timeline_atomic TO service_role;

-- ============================================================================
-- PHASE 6: REAL AUTO-REFRAME ENGINE (20261004_phase_6_reframe.sql)
-- ============================================================================

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
  version TEXT NOT NULL DEFAULT '2.0.0',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  degraded BOOLEAN NOT NULL DEFAULT false,
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


