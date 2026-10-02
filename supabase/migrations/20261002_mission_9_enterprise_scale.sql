-- Migration: 20261002_mission_9_enterprise_scale.sql
-- Mission 9: Enterprise Scale + AI Autonomous Content Operating System
-- Distributed job queue, dead letter queue, enterprise policies, workflows, domain outbox, and media lifecycle

-- 1. Enterprise Distributed Job Queue
CREATE TABLE IF NOT EXISTS public.enterprise_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('CRITICAL', 'HIGH', 'NORMAL', 'LOW')),
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'LEASED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED')),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    backoff_ms INTEGER NOT NULL DEFAULT 1000,
    worker_id TEXT,
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    heartbeat_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    error_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Dead Letter Queue
CREATE TABLE IF NOT EXISTS public.enterprise_dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    data JSONB NOT NULL,
    attempts INTEGER NOT NULL,
    last_error TEXT,
    error_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enterprise Governance Policies
CREATE TABLE IF NOT EXISTS public.enterprise_policies (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    require_approval_before_publish BOOLEAN NOT NULL DEFAULT TRUE,
    disable_external_publishing BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_social_platforms TEXT[] NOT NULL DEFAULT '{"youtube_shorts", "instagram_reels", "tiktok", "linkedin", "x"}',
    max_monthly_ai_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    max_monthly_render_minutes INTEGER NOT NULL DEFAULT 2000,
    enforce_mfa BOOLEAN NOT NULL DEFAULT FALSE,
    enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
    data_retention_days INTEGER NOT NULL DEFAULT 90,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Automation Workflows & DAG Runs
CREATE TABLE IF NOT EXISTS public.enterprise_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    entry_node_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.enterprise_workflow_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.enterprise_workflows(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'FAILED')),
    current_node_id TEXT NOT NULL,
    node_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. Transactional Event Outbox
CREATE TABLE IF NOT EXISTS public.domain_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enterprise Media Assets with Namespacing & Deduplication
CREATE TABLE IF NOT EXISTS public.enterprise_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    storage_namespace TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'READY' CHECK (lifecycle_state IN ('UPLOADED', 'PROCESSING', 'READY', 'ARCHIVED', 'DELETING', 'DELETED')),
    proxy_urls JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Cost Anomaly Alerts
CREATE TABLE IF NOT EXISTS public.cost_anomaly_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    service_category TEXT NOT NULL,
    spike_factor NUMERIC(6, 2) NOT NULL,
    baseline_cost_usd NUMERIC(10, 2) NOT NULL,
    observed_cost_usd NUMERIC(10, 2) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'))
);

-- 8. High-Performance Compound Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_lease ON public.enterprise_jobs(status, priority, organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_lease_time ON public.enterprise_jobs(lease_expires_at) WHERE status = 'LEASED';
CREATE INDEX IF NOT EXISTS idx_media_content_hash ON public.enterprise_media_assets(organization_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON public.domain_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_ws ON public.enterprise_workflow_runs(workspace_id, status);

-- 9. Row-Level Security
ALTER TABLE public.enterprise_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_anomaly_alerts ENABLE ROW LEVEL SECURITY;
