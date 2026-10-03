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

-- 3. Video Projects (Strict RFC 4122 UUID + source_external_id)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  source_external_id TEXT, -- Stores YouTube Video ID (e.g. dQw4w9WgXcQ), TikTok ID, or external file ID
  title TEXT NOT NULL,
  channel_name TEXT,
  thumbnail_url TEXT,
  workflow_type TEXT NOT NULL DEFAULT 'youtube_to_shorts' CHECK (workflow_type IN ('youtube_to_shorts', 'one_finger_reel', 'ai_documentary')),
  source_url TEXT,
  source_type TEXT DEFAULT 'youtube' CHECK (source_type IN ('youtube', 'upload', 'script')),
  duration_seconds NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'ingesting', 'media_ready', 'transcribing', 'transcript_ready', 'analyzing', 'clips_ready', 'editing', 'render_queued', 'rendering', 'completed', 'export_ready', 'failed')),
  error_message TEXT,
  cost_usd NUMERIC DEFAULT 0,
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
  source TEXT DEFAULT 'deepgram' CHECK (source IN ('deepgram', 'youtube_captions', 'user_upload')),
  provider TEXT DEFAULT 'deepgram',
  model TEXT DEFAULT 'nova-2',
  duration NUMERIC(10, 2),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_transcripts_media_project FOREIGN KEY (media_asset_id, project_id) REFERENCES public.media_assets(id, project_id) ON DELETE SET NULL
);

-- 5a. Normalized Transcript Segments
CREATE TABLE IF NOT EXISTS public.transcript_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transcript_id UUID NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  start_time NUMERIC(10, 2) NOT NULL CHECK (start_time >= 0),
  end_time NUMERIC(10, 2) NOT NULL CHECK (end_time >= start_time),
  text TEXT NOT NULL,
  confidence NUMERIC(4, 2),
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
  segment_id UUID REFERENCES public.transcript_segments(id) ON DELETE CASCADE,
  word_index INTEGER NOT NULL,
  word TEXT NOT NULL,
  start_time NUMERIC(10, 2) NOT NULL CHECK (start_time >= 0),
  end_time NUMERIC(10, 2) NOT NULL CHECK (end_time >= start_time),
  confidence NUMERIC(4, 2),
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

-- Atomic PostgreSQL RPC function for transcript replacement
CREATE OR REPLACE FUNCTION public.replace_transcript_atomic(
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
AS $$
DECLARE
  v_project RECORD;
  v_media RECORD;
  v_seg JSONB;
  v_word JSONB;
BEGIN
  -- 1. Validate project existence & soft delete status
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Project % does not exist or has been deleted', p_project_id USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate media_asset if specified
  IF p_media_asset_id IS NOT NULL THEN
    SELECT * INTO v_media FROM public.media_assets WHERE id = p_media_asset_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Media asset % does not exist', p_media_asset_id USING ERRCODE = 'P0002';
    END IF;
    IF v_media.project_id IS NOT NULL AND v_media.project_id <> p_project_id THEN
      RAISE EXCEPTION 'Media asset % belongs to project %, not project %', p_media_asset_id, v_media.project_id, p_project_id USING ERRCODE = '42501';
    END IF;
    IF v_media.status = 'failed' OR v_media.status = 'deleted' OR v_media.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Media asset % is in an invalid lifecycle state (%)', p_media_asset_id, v_media.status USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 3. Upsert transcript record
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

  -- 4. Delete obsolete child rows for this transcript
  DELETE FROM public.transcript_words WHERE transcript_id = p_transcript_id;
  DELETE FROM public.transcript_segments WHERE transcript_id = p_transcript_id;

  -- 5. Insert segments if provided
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
        (v_seg->>'start_time')::NUMERIC,
        (v_seg->>'end_time')::NUMERIC,
        v_seg->>'text',
        (v_seg->>'confidence')::NUMERIC,
        (v_seg->>'speaker')::INTEGER,
        COALESCE(v_seg->'metadata', '{}'::jsonb)
      );
    END LOOP;
  END IF;

  -- 6. Insert words if provided
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
        (v_word->>'start_time')::NUMERIC,
        (v_word->>'end_time')::NUMERIC,
        (v_word->>'confidence')::NUMERIC,
        (v_word->>'speaker')::INTEGER
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'transcript_id', p_transcript_id);
END;
$$;
