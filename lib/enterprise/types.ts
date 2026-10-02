/**
 * Clipper Mission 9: Enterprise Scale + AI Autonomous Content Operating System
 * Canonical Enterprise Data Models and Interfaces
 */

// ---------------------------------------------------------------------------
// 1. DISTRIBUTED JOB QUEUE, WORKERS & DEAD LETTER
// ---------------------------------------------------------------------------

export type JobPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type JobStatus = 
  | 'QUEUED' 
  | 'LEASED' 
  | 'PROCESSING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'DEAD_LETTER' 
  | 'CANCELLED';

export interface EnterpriseJob<TData = any, TResult = any> {
  id: string;
  type: string;                    // e.g. "media.transcode", "render.video", "ai.intelligence", "publish.post"
  priority: JobPriority;
  status: JobStatus;
  organizationId: string;
  workspaceId: string;
  userId?: string;
  data: TData;
  result?: TResult;
  attempts: number;
  maxRetries: number;
  backoffMs: number;
  workerId?: string;
  leaseExpiresAt?: string;
  heartbeatAt?: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  errorHistory: { error: string; timestamp: string; attempt: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkerHeartbeatPayload {
  workerId: string;
  jobId: string;
  progressPercent: number;
  stage: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 2. AI PROVIDER REGISTRY & CIRCUIT BREAKER
// ---------------------------------------------------------------------------

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;       // Consecutive failures before opening (e.g. 5)
  recoveryTimeMs: number;         // Cooldown before half-open (e.g. 30,000ms)
  timeoutMs: number;              // Request timeout (e.g. 10,000ms)
}

export interface AIProviderStatus {
  providerId: string;
  circuitState: CircuitBreakerState;
  consecutiveFailures: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  recoveryAt?: string;
}

export interface AIRequestMeta {
  providerId: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  requestHash: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  costUSD?: number;
}

// ---------------------------------------------------------------------------
// 3. AUTONOMOUS CONTENT AGENT & WORKFLOW DAG
// ---------------------------------------------------------------------------

export type AgentActionType =
  | 'ANALYZE_SOURCE'
  | 'EXTRACT_OPPORTUNITIES'
  | 'GENERATE_VARIANTS'
  | 'COMPILE_RENDERSPEC'
  | 'REQUEST_HUMAN_APPROVAL'
  | 'DISPATCH_RENDER'
  | 'PUBLISH_TO_PLATFORM'
  | 'SYNC_PERFORMANCE'
  | 'ADAPT_MODEL_WEIGHTS';

export interface AutonomousAgentPlan {
  planId: string;
  organizationId: string;
  workspaceId: string;
  sourceProjectId: string;
  status: 'PLANNING' | 'EXECUTING' | 'REQUIRES_APPROVAL' | 'COMPLETED' | 'FAILED';
  steps: {
    stepId: string;
    action: AgentActionType;
    params: Record<string, any>;
    status: 'PENDING' | 'RUNNING' | 'REQUIRES_APPROVAL' | 'COMPLETED' | 'FAILED';
    result?: any;
    error?: string;
  }[];
  requiresHumanApproval: boolean;
  approvalGrantedBy?: string;
  approvalGrantedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowNodeType = 
  | 'TRIGGER'
  | 'AI_ANALYSIS'
  | 'CONTENT_GENERATION'
  | 'HUMAN_APPROVAL'
  | 'RENDER_VIDEO'
  | 'SCHEDULE_POST'
  | 'PUBLISH_POST'
  | 'PERFORMANCE_SYNC'
  | 'SEND_NOTIFICATION';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  title: string;
  config: Record<string, any>;
  nextNodes: string[];            // Directed edges to subsequent nodes
}

export interface AutomationWorkflow {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  description?: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  nodes: WorkflowNode[];
  entryNodeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionRun {
  runId: string;
  workflowId: string;
  workspaceId: string;
  status: 'RUNNING' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'FAILED';
  currentNodeId: string;
  nodeHistory: {
    nodeId: string;
    status: 'SUCCESS' | 'FAILURE' | 'AWAITING_APPROVAL';
    output?: any;
    durationMs: number;
    timestamp: string;
  }[];
  context: Record<string, any>;
  startedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// 4. ENTERPRISE POLICY ENGINE & GOVERNANCE
// ---------------------------------------------------------------------------

export interface EnterprisePolicy {
  organizationId: string;
  requireApprovalBeforePublish: boolean;
  disableExternalPublishing: boolean;
  allowedSocialPlatforms: string[];
  maxMonthlyAiBudgetUSD: number;
  maxMonthlyRenderMinutes: number;
  enforceMfa: boolean;
  enforceSSO: boolean;
  ipAllowlist?: string[];
  dataRetentionDays: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 5. EVENT BUS & TRANSACTIONAL OUTBOX
// ---------------------------------------------------------------------------

export interface DomainEvent<TPayload = any> {
  eventId: string;
  eventType: string;              // e.g. "project.created", "render.completed", "asset.approved"
  organizationId: string;
  workspaceId: string;
  payload: TPayload;
  idempotencyKey: string;
  version: string;
  timestamp: string;
}

export interface OutboxRecord {
  id: string;
  eventId: string;
  eventType: string;
  payload: any;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  attempts: number;
  lastAttemptAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 6. OBJECT STORAGE & MEDIA LIFECYCLE
// ---------------------------------------------------------------------------

export type MediaLifecycleState = 
  | 'UPLOADED' 
  | 'PROCESSING' 
  | 'READY' 
  | 'ARCHIVED' 
  | 'DELETING' 
  | 'DELETED';

export interface EnterpriseMediaAsset {
  id: string;
  organizationId: string;
  workspaceId: string;
  projectId: string;
  contentHash: string;           // SHA-256 for deduplication
  storageNamespace: string;      // e.g. "org_1/ws_2/proj_3/media/asset.mp4"
  filename: string;
  mimeType: string;
  sizeBytes: number;
  lifecycleState: MediaLifecycleState;
  proxyUrls: {
    preview720p?: string;
    editingProxy360p?: string;
    thumbnailUrl?: string;
    waveformJsonUrl?: string;
  };
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 7. OBSERVABILITY, METRICS & COST ANOMALY
// ---------------------------------------------------------------------------

export interface EnterpriseTraceContext {
  traceId: string;
  requestId: string;
  organizationId: string;
  workspaceId: string;
  userId?: string;
  jobId?: string;
}

export interface CostAnomalyAlert {
  id: string;
  organizationId: string;
  serviceCategory: string;
  spikeFactor: number;           // e.g. 3.5x normal baseline
  baselineCostUSD: number;
  observedCostUSD: number;
  periodStart: string;
  periodEnd: string;
  detectedAt: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}
