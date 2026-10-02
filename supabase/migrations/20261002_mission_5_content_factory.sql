-- ============================================================================
-- CLIPPER MISSION 5: CONTENT FACTORY & MULTI-PLATFORM ENGINE MIGRATION
-- Database Schema for Opportunities, Briefs, Assets, Variants, Calendar, Brand Kits
-- ============================================================================

-- 1. Brand Kits
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  fonts JSONB NOT NULL DEFAULT '{}'::jsonb,
  colors JSONB NOT NULL DEFAULT '{}'::jsonb,
  caption_preset TEXT NOT NULL DEFAULT 'karaoke',
  watermark_url TEXT,
  intro_media_url TEXT,
  outro_media_url TEXT,
  default_cta TEXT,
  social_handles JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read/write on brand_kits"
  ON public.brand_kits FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Content Opportunities
CREATE TABLE IF NOT EXISTS public.content_opportunities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_start DOUBLE PRECISION NOT NULL,
  source_end DOUBLE PRECISION NOT NULL,
  source_transcript TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  content_type TEXT NOT NULL,
  hook TEXT NOT NULL,
  payoff TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL DEFAULT 80.0,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  platform_fit JSONB NOT NULL DEFAULT '{}'::jsonb,
  pillars TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_opps_project_id ON public.content_opportunities(project_id);
CREATE INDEX IF NOT EXISTS idx_content_opps_score ON public.content_opportunities(score DESC);
CREATE INDEX IF NOT EXISTS idx_content_opps_status ON public.content_opportunities(status);

ALTER TABLE public.content_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read/write on content_opportunities"
  ON public.content_opportunities FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Content Briefs
CREATE TABLE IF NOT EXISTS public.content_briefs (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES public.content_opportunities(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL,
  topic TEXT NOT NULL,
  hook TEXT NOT NULL,
  core_idea TEXT NOT NULL,
  supporting_evidence TEXT NOT NULL,
  payoff TEXT NOT NULL,
  cta TEXT NOT NULL,
  platform TEXT NOT NULL,
  target_duration_seconds INTEGER NOT NULL,
  visual_strategy TEXT,
  caption_strategy TEXT,
  brand_voice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_briefs_opp_id ON public.content_briefs(opportunity_id);

ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read/write on content_briefs"
  ON public.content_briefs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Content Assets
CREATE TABLE IF NOT EXISTS public.content_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES public.content_opportunities(id) ON DELETE CASCADE,
  brief_id TEXT REFERENCES public.content_briefs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  duration_seconds DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  render_spec JSONB,
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  rendered_video_path TEXT,
  rendered_video_checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_assets_project ON public.content_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_platform ON public.content_assets(platform);
CREATE INDEX IF NOT EXISTS idx_content_assets_status ON public.content_assets(status);

ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read/write on content_assets"
  ON public.content_assets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Content Variants
CREATE TABLE IF NOT EXISTS public.content_variants (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES public.content_assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant_type TEXT NOT NULL,
  hook_override JSONB,
  caption_style_override TEXT,
  aspect_ratio_override TEXT,
  audio_mix_override TEXT,
  render_spec_override JSONB,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  rendered_path TEXT,
  rendered_checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_variants_asset ON public.content_variants(asset_id);

ALTER TABLE public.content_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read/write on content_variants"
  ON public.content_variants FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Content Calendar
CREATE TABLE IF NOT EXISTS public.content_calendar (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES public.content_assets(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  campaign TEXT,
  pillar TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_calendar_project ON public.content_calendar(project_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_scheduled ON public.content_calendar(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON public.content_calendar(status);

ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read/write on content_calendar"
  ON public.content_calendar FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
