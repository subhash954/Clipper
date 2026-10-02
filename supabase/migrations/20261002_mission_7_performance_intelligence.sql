-- ============================================================================
-- CLIPPER MISSION 7: PERFORMANCE INTELLIGENCE & LEARNING ENGINE MIGRATION
-- ============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PERFORMANCE SNAPSHOTS (IMMUTABLE OBSERVED METRICS)
CREATE TABLE IF NOT EXISTS public.performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    publication_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    opportunity_id UUID,
    project_id UUID NOT NULL,
    platform TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Observed Raw Metrics
    views BIGINT NOT NULL DEFAULT 0,
    likes BIGINT NOT NULL DEFAULT 0,
    comments BIGINT NOT NULL DEFAULT 0,
    shares BIGINT NOT NULL DEFAULT 0,
    saves BIGINT NOT NULL DEFAULT 0,
    watch_time_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
    average_view_duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
    completion_rate DOUBLE PRECISION,
    engagement_rate DOUBLE PRECISION,
    followers_gained INTEGER,
    clicks INTEGER,
    impressions BIGINT,
    reach BIGINT,
    
    -- Retention & Raw Platform Metadata
    retention_curve JSONB,
    external_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_workspace ON public.performance_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_publication ON public.performance_snapshots(publication_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_asset ON public.performance_snapshots(asset_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_platform ON public.performance_snapshots(platform);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured ON public.performance_snapshots(captured_at);

-- 2. LEARNED MODEL WEIGHTS (CREATIVE EMPIRICAL WEIGHTS)
CREATE TABLE IF NOT EXISTS public.learned_model_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    hook_category_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    topic_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    optimal_durations JSONB NOT NULL DEFAULT '{}'::jsonb,
    broll_density_preference TEXT NOT NULL DEFAULT 'MEDIUM',
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_publications_analyzed INTEGER NOT NULL DEFAULT 0,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weights_workspace ON public.learned_model_weights(workspace_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_model_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY snapshots_workspace_isolation ON public.performance_snapshots
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY weights_workspace_isolation ON public.learned_model_weights
    FOR ALL USING (auth.uid() IS NOT NULL);
