-- Migration: 20261002_mission_8_multi_tenant_saas.sql
-- Mission 8: Agency + Multi-Tenant SaaS Operating System
-- Organizations, Workspaces, Members, Clients, Approvals, Comments, Tasks, Subscriptions, Usage, API Keys, Webhooks, Audit

-- 1. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL,
    plan_id TEXT NOT NULL DEFAULT 'starter' CHECK (plan_id IN ('free', 'starter', 'pro', 'agency', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trialing', 'delinquent', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    default_language TEXT DEFAULT 'en',
    brand_kit_id UUID,
    settings JSONB DEFAULT '{"allowClientComments": true, "requireApprovalBeforePublish": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Organization Memberships & RBAC
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'EDITOR' CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'APPROVER', 'CLIENT', 'VIEWER')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(workspace_id, user_id)
);

-- 4. Agency Clients
CREATE TABLE IF NOT EXISTS public.agency_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    logo_url TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'onboarding', 'paused', 'archived')),
    monthly_retainer_usd NUMERIC(10, 2) DEFAULT 0,
    allocated_credits INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Asset Approvals Workflow
CREATE TABLE IF NOT EXISTS public.asset_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    actor_id UUID NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    notes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Asset Comments & Video Timestamps
CREATE TABLE IF NOT EXISTS public.asset_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL,
    text TEXT NOT NULL,
    video_timestamp_seconds NUMERIC(8, 2),
    mentions TEXT[] DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Workspace Tasks
CREATE TABLE IF NOT EXISTS public.workspace_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID,
    asset_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    assignee_id UUID,
    assignee_name TEXT,
    status TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE')),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    due_at TIMESTAMP WITH TIME ZONE,
    created_by_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Organization Subscriptions
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'incomplete')),
    customer_id TEXT,
    subscription_id TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Usage Ledger
CREATE TABLE IF NOT EXISTS public.usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    resource TEXT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL,
    source TEXT NOT NULL,
    job_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. API Keys
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    key_prefix TEXT NOT NULL,
    hashed_secret TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Webhook Endpoints & Logs
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_triggered_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    status_code INTEGER,
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID,
    actor_id UUID NOT NULL,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Indexes for Tenant Isolation & High Performance
CREATE INDEX IF NOT EXISTS idx_workspaces_org ON public.workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_ws ON public.organization_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_ws ON public.agency_clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_approvals_asset ON public.asset_approvals(asset_id);
CREATE INDEX IF NOT EXISTS idx_comments_asset ON public.asset_comments(asset_id);
CREATE INDEX IF NOT EXISTS idx_tasks_ws ON public.workspace_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_usage_ws_time ON public.usage_ledger(workspace_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON public.audit_logs(organization_id, timestamp DESC);

-- 14. Enable Row-Level Security
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
