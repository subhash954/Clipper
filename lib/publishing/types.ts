/**
 * CLIPPER REAL SOCIAL PUBLISHING & AUTOMATION ENGINE
 * Canonical Data Models and Type Definitions (Mission 6)
 */

import { SupportedPlatform } from '@/lib/factory/types';

// ============================================================================
// SOCIAL CONNECTION (Phase 1)
// ============================================================================

export type ConnectionStatus =
  | 'CONNECTED'
  | 'EXPIRED'
  | 'REAUTH_REQUIRED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'NOT_CONFIGURED';

export interface SocialConnection {
  id: string;
  workspaceId: string;
  platform: SupportedPlatform;
  accountId: string;
  accountName: string;
  accountHandle: string;
  status: ConnectionStatus;
  scopes: string[];
  tokenReference: string; // References encrypted token vault entry, never raw token
  tokenExpiresAt: string;
  refreshTokenReference?: string;
  connectedAt: string;
  lastValidatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedTokenVaultEntry {
  referenceId: string;
  ciphertext: string;
  iv: string;
  tag: string;
  expiresAt: string;
  updatedAt: string;
}

// ============================================================================
// PUBLISHING QUEUE & JOBS (Phase 8, 9, 11, 12)
// ============================================================================

export type PublishJobStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'PREPARING'
  | 'UPLOADING'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RETRYING'
  | 'REAUTH_REQUIRED';

export type ErrorClassification =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'PLATFORM_ERROR'
  | 'MEDIA_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'UNKNOWN_ERROR';

export interface PublishMediaValidation {
  valid: boolean;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  aspectRatio: string;
  hasAudio: boolean;
  errors: string[];
}

export interface PublishMetadata {
  title: string;
  description: string;
  caption?: string;
  hashtags: string[];
  privacy: 'public' | 'unlisted' | 'private';
  customThumbnailPath?: string;
  customThumbnailUrl?: string;
  location?: string;
}

export interface PublishJob {
  id: string;
  workspaceId: string;
  assetId: string;
  connectionId: string;
  platform: SupportedPlatform;
  idempotencyKey: string;
  status: PublishJobStatus;
  scheduledAt: string;
  scheduledTimezone: string; // e.g. "America/New_York", "UTC", "Asia/Kolkata"
  
  // Media & Metadata
  mediaFilePath: string;
  mediaValidation?: PublishMediaValidation;
  metadata: PublishMetadata;
  
  // Confirmed External Publication Data (Phase 12)
  externalPostId?: string;
  externalUrl?: string;
  publishedAt?: string;
  platformResponseMetadata?: Record<string, any>;
  
  // Execution & Retry State
  attemptCount: number;
  maxAttempts: number;
  lastError?: {
    code: string;
    message: string;
    classification: ErrorClassification;
    timestamp: string;
    actionableFix: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PUBLISHING CHECKLIST (Phase 17)
// ============================================================================

export interface PublishingChecklist {
  isBlocked: boolean;
  blockers: string[];
  checks: {
    sourceLineageExists: boolean;
    renderExists: boolean;
    renderValidated: boolean;
    captionExists: boolean;
    titleValid: boolean;
    descriptionValid: boolean;
    accountConnected: boolean;
    permissionValid: boolean;
    platformConstraintsPass: boolean;
    approvalComplete: boolean;
  };
}

// ============================================================================
// AUDIT LOG & TELEMETRY (Phase 20)
// ============================================================================

export interface PublishingLog {
  id: string;
  jobId: string;
  workspaceId: string;
  assetId: string;
  platform: SupportedPlatform;
  accountHandle: string;
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  result: 'SUCCESS' | 'FAILURE' | 'RETRY_SCHEDULED';
  errorCode?: string;
  errorMessage?: string;
  externalPostId?: string;
}

// ============================================================================
// AUTOMATION RULES ENGINE (Phase 26 & 27)
// ============================================================================

export type AutomationTriggerEvent =
  | 'asset.created'
  | 'asset.approved'
  | 'render.completed'
  | 'publish.queued'
  | 'publish.completed'
  | 'publish.failed'
  | 'account.expiring';

export type AutomationActionType =
  | 'create_task'
  | 'schedule_asset'
  | 'send_notification'
  | 'create_variant'
  | 'request_review';

export interface AutomationRule {
  id: string;
  workspaceId: string;
  name: string;
  triggerEvent: AutomationTriggerEvent;
  actionType: AutomationActionType;
  config: {
    targetPlatform?: SupportedPlatform;
    scheduleDelayMinutes?: number;
    notificationChannels?: ('in_app' | 'email')[];
    targetStatus?: string;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecutionLog {
  id: string;
  ruleId: string;
  workspaceId: string;
  triggerEvent: AutomationTriggerEvent;
  actionType: AutomationActionType;
  status: 'SUCCESS' | 'FAILED';
  details: string;
  timestamp: string;
}

// ============================================================================
// IN-APP NOTIFICATIONS (Phase 28)
// ============================================================================

export interface InAppNotification {
  id: string;
  workspaceId: string;
  type: 'publish_success' | 'publish_failure' | 'oauth_expiring' | 'approval_request' | 'render_failure';
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

// ============================================================================
// BULK SCHEDULING (Phase 14 & 15)
// ============================================================================

export interface BulkScheduleConfig {
  workspaceId: string;
  assetIds: string[];
  platform: SupportedPlatform;
  connectionId: string;
  startDate: string;
  timezone: string;
  frequency: 'daily' | 'weekdays' | 'custom_gap';
  gapHours: number; // minimum gap between posts
  allowedHoursStart: number; // e.g. 9 for 9 AM
  allowedHoursEnd: number;   // e.g. 21 for 9 PM
}

export interface BulkSchedulePreviewItem {
  assetId: string;
  platform: SupportedPlatform;
  scheduledAt: string;
  scheduledTimezone: string;
  accountHandle: string;
}
