-- Migration: 20261001_mission_2_tenant_isolation.sql
-- Fixes UUID project id, introduces source_external_id, adds workspaces, media_assets, timeline_versions, integrations, and enforces role-based RLS

-- 1. Profiles role column
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));

-- 2. Projects source_external_id and workspace_id
ALTER TABLE IF EXISTS public.projects 
  ADD COLUMN IF NOT EXISTS source_external_id TEXT,
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- 3. Transcripts timing_precision
ALTER TABLE IF EXISTS public.transcripts
  ADD COLUMN IF NOT EXISTS timing_precision TEXT DEFAULT 'exact_word' CHECK (timing_precision IN ('exact_word', 'approximate_cue'));

-- 4. Clips cuts column
ALTER TABLE IF EXISTS public.clips
  ADD COLUMN IF NOT EXISTS cuts JSONB DEFAULT '[]'::jsonb;

-- 5. Render jobs heartbeat and retries
ALTER TABLE IF EXISTS public.render_jobs
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMP WITH TIME ZONE;
