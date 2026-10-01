-- Production PostgreSQL Schema for Clipper AI Video SaaS
-- Fully aligned with application data models & Row Level Security (RLS)

-- 1. Profiles & Subscriptions
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  plan_tier TEXT DEFAULT 'free' CHECK (plan_tier IN ('free', 'starter', 'pro', 'documentary_agency')),
  credits_remaining INTEGER DEFAULT 3,
  total_minutes_processed NUMERIC DEFAULT 0,
  total_cost_incurred_usd NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Video Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  channel_name TEXT,
  thumbnail_url TEXT,
  workflow_type TEXT NOT NULL DEFAULT 'youtube_to_shorts' CHECK (workflow_type IN ('youtube_to_shorts', 'one_finger_reel', 'ai_documentary')),
  source_url TEXT,
  source_type TEXT DEFAULT 'youtube' CHECK (source_type IN ('youtube', 'upload', 'script')),
  duration_seconds NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'ingesting', 'transcribing', 'analyzing', 'clips_ready', 'rendering', 'completed', 'failed')),
  error_message TEXT,
  cost_usd NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Transcripts (Word-level timestamps & full text)
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  transcript_text TEXT NOT NULL,
  words JSONB NOT NULL DEFAULT '[]'::jsonb,
  utterances JSONB DEFAULT '[]'::jsonb,
  language TEXT DEFAULT 'en',
  source TEXT DEFAULT 'deepgram' CHECK (source IN ('deepgram', 'youtube_captions', 'user_upload')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Generated Viral Clips / Outputs
CREATE TABLE IF NOT EXISTS public.clips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
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
  clip_url TEXT,
  thumbnail_url TEXT,
  b_roll_keywords TEXT[] DEFAULT '{}',
  sound_effects_applied TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Render Jobs (Async 9:16 Video Composition System)
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
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Social Media Auto-Scheduler (YouTube Data API v3, TikTok, Reels)
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  clip_id UUID REFERENCES public.clips(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube_shorts', 'tiktok', 'instagram_reels')),
  title TEXT NOT NULL,
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'publishing', 'published', 'failed')),
  published_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Real-Time API Cost Telemetry (For Admin Telemetry Panel)
CREATE TABLE IF NOT EXISTS public.cost_telemetry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL CHECK (service_name IN ('deepgram_stt', 'gemini_flash', 'pexels_broll', 'pixabay_broll', 'ffmpeg_render', 'flux_image', 'r2_storage')),
  model TEXT,
  units_used NUMERIC NOT NULL,
  unit_type TEXT NOT NULL, -- e.g. 'minutes', 'tokens', 'renders', 'requests'
  cost_in_usd NUMERIC NOT NULL,
  is_estimated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_telemetry ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies: Projects (Strict user isolation, no NULL bypass)
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies: Transcripts (Cascaded project ownership)
CREATE POLICY "Users can view transcripts of their projects"
  ON public.transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transcripts for their projects"
  ON public.transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = transcripts.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies: Clips (Cascaded project ownership)
CREATE POLICY "Users can view clips of their projects"
  ON public.clips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = clips.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert clips for their projects"
  ON public.clips FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = clips.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies: Render Jobs (Strict user isolation)
CREATE POLICY "Users can view their own render jobs"
  ON public.render_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create render jobs"
  ON public.render_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own render jobs"
  ON public.render_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies: Scheduled Posts
CREATE POLICY "Users can manage their own scheduled posts"
  ON public.scheduled_posts FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies: Cost Telemetry (Read-only for project owner or Admin)
CREATE POLICY "Users can view cost telemetry of their projects"
  ON public.cost_telemetry FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = cost_telemetry.project_id
      AND projects.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );
