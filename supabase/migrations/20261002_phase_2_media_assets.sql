-- =====================================================================
-- CLIPPER PHASE 2: MEDIA ASSETS PRODUCTION STORAGE MIGRATION
-- Provider: Bunny Storage + Bunny CDN with Provider-Agnostic Schema
-- =====================================================================

-- 1. Create or upgrade media_assets table
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'bunny',
  storage_bucket_or_zone TEXT NOT NULL DEFAULT '',
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  sanitized_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'video',
  size_bytes BIGINT NOT NULL,
  checksum TEXT,
  etag TEXT,
  duration_seconds NUMERIC,
  width INTEGER,
  height INTEGER,
  frame_rate NUMERIC,
  video_codec TEXT,
  audio_codec TEXT,
  status TEXT NOT NULL DEFAULT 'INITIATED',
  upload_session_id TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add any missing columns for existing instances
ALTER TABLE public.media_assets 
  ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'bunny',
  ADD COLUMN IF NOT EXISTS storage_bucket_or_zone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS sanitized_filename TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS checksum TEXT,
  ADD COLUMN IF NOT EXISTS etag TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS frame_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS video_codec TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'INITIATED',
  ADD COLUMN IF NOT EXISTS upload_session_id TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Performance & Tenant Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON public.media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON public.media_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON public.media_assets(status);
CREATE INDEX IF NOT EXISTS idx_media_assets_storage_key ON public.media_assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON public.media_assets(created_at DESC);

-- 3. Row-Level Security (RLS) Multi-Tenant Policies
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own media assets" ON public.media_assets;
CREATE POLICY "Users can read own media assets"
  ON public.media_assets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own media assets" ON public.media_assets;
CREATE POLICY "Users can insert own media assets"
  ON public.media_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own media assets" ON public.media_assets;
CREATE POLICY "Users can update own media assets"
  ON public.media_assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own media assets" ON public.media_assets;
CREATE POLICY "Users can delete own media assets"
  ON public.media_assets FOR DELETE
  USING (auth.uid() = user_id);
