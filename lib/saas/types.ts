/**
 * Clipper Mission 8: Agency + Multi-Tenant SaaS Operating System
 * Canonical Data Models and Interfaces
 */

// ---------------------------------------------------------------------------
// 1. TENANT ARCHITECTURE & ROLES
// ---------------------------------------------------------------------------

export type OrganizationStatus = 'active' | 'suspended' | 'trialing' | 'delinquent' | 'cancelled';
export type PlanTier = 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  planId: PlanTier;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  allowClientComments?: boolean;
  requireApprovalBeforePublish?: boolean;
  autoTranscribeUploads?: boolean;
  watermarkPreview?: boolean;
  customDomain?: string;
  whitelabelEnabled?: boolean;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  timezone: string;
  defaultLanguage: string;
  brandKitId?: string;
  clientId?: string; // If scoped to a specific agency client
  settings: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceRole = 
  | 'OWNER' 
  | 'ADMIN' 
  | 'MANAGER' 
  | 'EDITOR' 
  | 'APPROVER' 
  | 'CLIENT' 
  | 'VIEWER';

export interface OrganizationMember {
  id: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  invitedBy?: string;
  joinedAt: string;
  status: 'active' | 'invited' | 'suspended';
}

export interface WorkspaceInvitation {
  id: string;
  organizationId: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 2. PERMISSIONS & RBAC
// ---------------------------------------------------------------------------

export type PermissionAction =
  | 'project.read'
  | 'project.create'
  | 'project.edit'
  | 'project.delete'
  | 'asset.read'
  | 'asset.create'
  | 'asset.edit'
  | 'asset.delete'
  | 'asset.render'
  | 'asset.approve'
  | 'publish.create'
  | 'publish.execute'
  | 'billing.view'
  | 'billing.manage'
  | 'workspace.manage'
  | 'members.invite'
  | 'members.manage'
  | 'apikeys.manage'
  | 'analytics.view'
  | 'client.portal_access';

// ---------------------------------------------------------------------------
// 3. CLIENT MANAGEMENT & PORTAL
// ---------------------------------------------------------------------------

export type ClientStatus = 'active' | 'onboarding' | 'paused' | 'archived';

export interface AgencyClient {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  company: string;
  logoUrl?: string;
  contactEmail: string;
  contactPhone?: string;
  notes?: string;
  status: ClientStatus;
  monthlyRetainerUSD?: number;
  allocatedCredits?: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 4. APPROVAL WORKFLOW & COMMENTS
// ---------------------------------------------------------------------------

export type AssetApprovalStatus = 
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'CLIENT_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED';

export interface ApprovalHistoryRecord {
  id: string;
  assetId: string;
  workspaceId: string;
  fromStatus: AssetApprovalStatus;
  toStatus: AssetApprovalStatus;
  actorId: string;
  actorName: string;
  actorRole: WorkspaceRole;
  notes?: string;
  timestamp: string;
}

export interface AssetComment {
  id: string;
  assetId: string;
  workspaceId: string;
  authorId: string;
  authorName: string;
  authorRole: WorkspaceRole;
  text: string;
  videoTimestampSeconds?: number; // e.g. 17.5 for "00:17"
  mentions: string[]; // List of user IDs mentioned
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 5. TASKS MANAGEMENT
// ---------------------------------------------------------------------------

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface WorkspaceTask {
  id: string;
  workspaceId: string;
  projectId?: string;
  assetId?: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 6. SUBSCRIPTION & BILLING
// ---------------------------------------------------------------------------

export interface PlanLimits {
  maxMembers: number;
  maxWorkspaces: number;
  maxProjects: number;
  maxStorageBytes: number;        // e.g. 50GB = 53687091200
  maxRenderMinutesPerMonth: number;
  maxAiTokensPerMonth: number;
  maxPublishedPostsPerMonth: number;
  maxConnectedAccounts: number;
  allowWhitelabel: boolean;
  allowCustomDomain: boolean;
  allowClientPortal: boolean;
  allowApiAccess: boolean;
}

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  description: string;
  monthlyPriceUSD: number;
  annualPriceUSD: number;
  limits: PlanLimits;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete';

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planId: PlanTier;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  customerId?: string;
  subscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionEvent {
  id: string;
  organizationId: string;
  eventType: 'created' | 'updated' | 'cancelled' | 'payment_succeeded' | 'payment_failed';
  details: Record<string, any>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 7. USAGE METERING & LEDGER
// ---------------------------------------------------------------------------

export type MeteredResource =
  | 'render_seconds'
  | 'storage_bytes'
  | 'transcription_minutes'
  | 'ai_tokens'
  | 'ai_requests'
  | 'published_posts'
  | 'social_accounts';

export interface UsageRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  resource: MeteredResource;
  quantity: number;
  timestamp: string;
  source: string;       // e.g. "ffmpeg_render", "gemini_pro", "deepgram"
  jobId?: string;
  metadata?: Record<string, any>;
}

export interface WorkspaceUsageSummary {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  totals: {
    renderSeconds: number;
    renderMinutes: number;
    storageBytes: number;
    transcriptionMinutes: number;
    aiTokens: number;
    aiRequests: number;
    publishedPosts: number;
    socialAccounts: number;
  };
  quotas: PlanLimits;
  percentages: {
    renderMinutes: number;
    storage: number;
    aiTokens: number;
    posts: number;
  };
}

// ---------------------------------------------------------------------------
// 8. API KEYS & WEBHOOKS
// ---------------------------------------------------------------------------

export interface ApiKeyRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  keyPrefix: string;           // First 8 chars for display (e.g. "clp_live_ab12cd34")
  hashedSecret: string;        // SHA-256 hash of raw secret key
  name: string;
  permissions: PermissionAction[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export type OutgoingWebhookEvent =
  | 'asset.created'
  | 'asset.approved'
  | 'render.started'
  | 'render.completed'
  | 'publish.completed'
  | 'publish.failed'
  | 'approval.requested';

export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  url: string;
  secret: string;              // HMAC secret for signature
  events: OutgoingWebhookEvent[];
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  workspaceId: string;
  event: OutgoingWebhookEvent;
  payload: any;
  statusCode?: number;
  durationMs: number;
  success: boolean;
  error?: string;
  deliveredAt: string;
}

// ---------------------------------------------------------------------------
// 9. AUDIT LOG & SECURITY CENTER
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  workspaceId?: string;
  actorId: string;
  actorEmail: string;
  action: string;             // e.g. "asset.approved", "member.invited", "apikey.created"
  resourceType: string;       // "asset", "member", "project", "billing", "apikey"
  resourceId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface SecuritySession {
  id: string;
  userId: string;
  organizationId: string;
  deviceInfo: string;
  ipAddress: string;
  lastActiveAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

// ---------------------------------------------------------------------------
// 10. SUPPORT & HEALTH MONITORING
// ---------------------------------------------------------------------------

export type TicketCategory = 'billing' | 'rendering' | 'publishing' | 'ai' | 'account' | 'bug';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';

export interface SupportTicket {
  id: string;
  organizationId: string;
  workspaceId?: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface SubsystemHealth {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  message?: string;
  lastCheckedAt: string;
}

export interface PlatformHealthReport {
  overallStatus: HealthStatus;
  timestamp: string;
  subsystems: {
    database: SubsystemHealth;
    storage: SubsystemHealth;
    aiGemini: SubsystemHealth;
    transcriptionDeepgram: SubsystemHealth;
    renderWorkers: SubsystemHealth;
    publishingWorkers: SubsystemHealth;
    webhooks: SubsystemHealth;
  };
}

// ---------------------------------------------------------------------------
// 11. BRANDING, WHITE-LABEL & DOMAINS
// ---------------------------------------------------------------------------

export interface AgencyBranding {
  workspaceId: string;
  brandName: string;
  portalName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColorHex: string;
  accentColorHex: string;
  supportEmail: string;
  removePlatformAttribution: boolean; // Requires Agency or Enterprise plan
}

export type DomainVerificationStatus = 'pending' | 'verified' | 'failed';

export interface CustomDomainConfig {
  id: string;
  workspaceId: string;
  hostname: string;
  verificationToken: string;
  status: DomainVerificationStatus;
  verifiedAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 12. COST ACCOUNTING & MARGIN PROTECTION
// ---------------------------------------------------------------------------

export interface CostLedgerEntry {
  id: string;
  organizationId: string;
  workspaceId: string;
  serviceCategory: 'ai' | 'transcription' | 'rendering' | 'storage' | 'publishing';
  providerName: 'gemini' | 'deepgram' | 'aws' | 'local_ffmpeg' | 'social_api';
  estimatedCostUSD: number;
  actualCostUSD: number;
  unitsConsumed: number;
  unitType: string;
  timestamp: string;
}

export interface MarginReport {
  organizationId: string;
  period: string;
  totalRevenueUSD: number;
  totalCostUSD: number;
  breakdown: {
    aiCostUSD: number;
    transcriptionCostUSD: number;
    renderingCostUSD: number;
    storageCostUSD: number;
  };
  grossProfitUSD: number;
  grossMarginPercent: number; // e.g. 78.5%
}

// ---------------------------------------------------------------------------
// 13. STANDARDIZED SaaS ERRORS
// ---------------------------------------------------------------------------

export type StandardErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'MEDIA_ERROR'
  | 'JOB_ERROR'
  | 'BILLING_ERROR';

export class SaasError extends Error {
  code: StandardErrorCode;
  statusCode: number;
  details?: Record<string, any>;

  constructor(code: StandardErrorCode, message: string, statusCode: number = 400, details?: Record<string, any>) {
    super(message);
    this.name = 'SaaSError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
