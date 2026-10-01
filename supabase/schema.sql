-- Production PostgreSQL Schema for Proprietary AI Video SaaS
-- Compatible with Supabase (Row Level Security enabled)

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

-- 2. Video Projects (Supports all 3 workflows)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  workflow_type TEXT NOT NULL CHECK (workflow_type IN ('youtube_to_shorts', 'one_finger_reel', 'ai_documentary')),
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('youtube', 'upload', 'script')),
  duration_seconds NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  cost_usd NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Generated Viral Clips / Outputs
CREATE TABLE IF NOT EXISTS public.clips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  hook_summary TEXT,
  viral_score INTEGER CHECK (viral_score BETWEEN 0 AND 100),
  start_time NUMERIC NOT NULL,
  end_time NUMERIC NOT NULL,
  clip_url TEXT,
  subtitles_json JSONB,
  b_roll_keywords TEXT[],
  sound_effects_applied TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Social Media Auto-Scheduler (YouTube Data API v3, TikTok, Reels)
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  clip_id UUID REFERENCES public.clips(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube_shorts', 'tiktok', 'instagram_reels')),
  title TEXT NOT NULL,
  description TEXT,
  hashtags TEXT[],
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'publishing', 'published', 'failed')),
  published_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Real-Time API Cost Telemetry (For Admin Super-Panel)
CREATE TABLE IF NOT EXISTS public.cost_telemetry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL CHECK (service_name IN ('deepgram_stt', 'gemini_flash', 'pexels_broll', 'flux_ai_image', 'ffmpeg_render', 'r2_storage')),
  units_used NUMERIC NOT NULL, -- e.g. minutes, tokens, GB
  cost_in_usd NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_telemetry ENABLE ROW LEVEL SECURITY;
