-- ============================================================================
-- CLIPPER MISSION 6: REAL SOCIAL PUBLISHING & AUTOMATION ENGINE MIGRATION
-- ============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SOCIAL CONNECTIONS
CREATE TABLE IF NOT EXISTS public.social_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    platform TEXT NOT NULL,
    account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_handle TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONNECTED',
    scopes TEXT[] NOT NULL DEFAULT '{}',
    token_reference TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    refresh_token_reference TEXT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_workspace_platform_account UNIQUE (workspace_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_workspace ON public.social_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON public.social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_status ON public.social_connections(status);

-- 2. PUBLISH JOBS
CREATE TABLE IF NOT EXISTS public.publish_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    scheduled_at TIMESTAMPTZ NOT NULL,
    scheduled_timezone TEXT NOT NULL DEFAULT 'UTC',
    media_file_path TEXT NOT NULL,
    media_validation JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    external_post_id TEXT,
    external_url TEXT,
    published_at TIMESTAMPTZ,
    platform_response_metadata JSONB,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_workspace ON public.publish_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_asset ON public.publish_jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_status ON public.publish_jobs(status);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_scheduled_at ON public.publish_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_idempotency ON public.publish_jobs(idempotency_key);

-- 3. PUBLISHING LOGS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.publishing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.publish_jobs(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    platform TEXT NOT NULL,
    account_handle TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    result TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    external_post_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishing_logs_workspace ON public.publishing_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_publishing_logs_job ON public.publishing_logs(job_id);

-- 4. AUTOMATION RULES
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    action_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_workspace ON public.automation_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON public.automation_rules(trigger_event);

-- 5. IN-APP NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifs_workspace ON public.in_app_notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifs_read ON public.in_app_notifications(read);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_connections_workspace_isolation ON public.social_connections
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY publish_jobs_workspace_isolation ON public.publish_jobs
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY publishing_logs_workspace_isolation ON public.publishing_logs
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY automation_rules_workspace_isolation ON public.automation_rules
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY in_app_notifications_workspace_isolation ON public.in_app_notifications
    FOR ALL USING (auth.uid() IS NOT NULL);
