import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  MeteredResource,
  UsageRecord,
  WorkspaceUsageSummary,
  SaasError,
} from './types';
import { getTenantStore } from './tenantStore';
import { getEntitlementService } from './entitlementService';

export class MeteringService {
  private baseDir = path.join(process.cwd(), 'data', 'saas');
  private ledgerFile = path.join(process.cwd(), 'data', 'saas', 'usage_ledger.json');

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private read<T>(filePath: string): T[] {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private write<T>(filePath: string, data: T[]): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Records an immutable usage event in the ledger
   */
  async recordUsage(entry: {
    organizationId: string;
    workspaceId: string;
    resource: MeteredResource;
    quantity: number;
    source: string;
    jobId?: string;
    metadata?: Record<string, any>;
  }): Promise<UsageRecord> {
    const ledger = this.read<UsageRecord>(this.ledgerFile);
    const record: UsageRecord = {
      id: crypto.randomUUID(),
      organizationId: entry.organizationId,
      workspaceId: entry.workspaceId,
      resource: entry.resource,
      quantity: entry.quantity,
      source: entry.source,
      jobId: entry.jobId,
      metadata: entry.metadata,
      timestamp: new Date().toISOString(),
    };

    ledger.push(record);
    this.write(this.ledgerFile, ledger);
    return record;
  }

  /**
   * Computes the aggregated usage for a workspace across the current billing period
   */
  async getWorkspaceUsage(workspaceId: string, sinceDate?: Date): Promise<WorkspaceUsageSummary> {
    const tenantStore = getTenantStore();
    const ws = await tenantStore.getWorkspace(workspaceId);
    if (!ws) throw new SaasError('NOT_FOUND', `Workspace ${workspaceId} not found`, 404);

    const org = await tenantStore.getOrganization(ws.organizationId);
    if (!org) throw new SaasError('NOT_FOUND', `Organization ${ws.organizationId} not found`, 404);

    const entitlementService = getEntitlementService();
    const planLimits = entitlementService.getPlanLimits(org.planId);

    // Default period: start of current calendar month
    const now = new Date();
    const periodStart = sinceDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const ledger = this.read<UsageRecord>(this.ledgerFile);
    const periodRecords = ledger.filter(r => {
      if (r.workspaceId !== workspaceId) return false;
      const recTime = new Date(r.timestamp).getTime();
      return recTime >= periodStart.getTime() && recTime <= periodEnd.getTime();
    });

    let renderSeconds = 0;
    let storageBytes = 0;
    let transcriptionMinutes = 0;
    let aiTokens = 0;
    let aiRequests = 0;
    let publishedPosts = 0;
    let socialAccounts = 0;

    for (const r of periodRecords) {
      if (r.resource === 'render_seconds') renderSeconds += r.quantity;
      else if (r.resource === 'storage_bytes') storageBytes = Math.max(storageBytes, r.quantity); // Peak or latest
      else if (r.resource === 'transcription_minutes') transcriptionMinutes += r.quantity;
      else if (r.resource === 'ai_tokens') aiTokens += r.quantity;
      else if (r.resource === 'ai_requests') aiRequests += r.quantity;
      else if (r.resource === 'published_posts') publishedPosts += r.quantity;
      else if (r.resource === 'social_accounts') socialAccounts = Math.max(socialAccounts, r.quantity);
    }

    const renderMinutes = Math.ceil(renderSeconds / 60);

    return {
      workspaceId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totals: {
        renderSeconds,
        renderMinutes,
        storageBytes,
        transcriptionMinutes,
        aiTokens,
        aiRequests,
        publishedPosts,
        socialAccounts,
      },
      quotas: planLimits,
      percentages: {
        renderMinutes: Math.min(100, (renderMinutes / planLimits.maxRenderMinutesPerMonth) * 100),
        storage: Math.min(100, (storageBytes / planLimits.maxStorageBytes) * 100),
        aiTokens: Math.min(100, (aiTokens / planLimits.maxAiTokensPerMonth) * 100),
        posts: Math.min(100, (publishedPosts / planLimits.maxPublishedPostsPerMonth) * 100),
      },
    };
  }

  /**
   * Enforces hard quota limits.
   * Throws SaasError('QUOTA_EXCEEDED') if the requested operation would exceed plan limits.
   */
  async assertQuotaAvailable(
    workspaceId: string,
    resource: MeteredResource,
    requestedQuantity: number = 1
  ): Promise<void> {
    const summary = await this.getWorkspaceUsage(workspaceId);

    if (resource === 'render_seconds') {
      const additionalMinutes = Math.ceil(requestedQuantity / 60);
      if (summary.totals.renderMinutes + additionalMinutes > summary.quotas.maxRenderMinutesPerMonth) {
        throw new SaasError(
          'QUOTA_EXCEEDED',
          `Render quota exceeded. Used ${summary.totals.renderMinutes}m of ${summary.quotas.maxRenderMinutesPerMonth}m monthly limit. Upgrade plan to render more.`,
          429,
          { resource, current: summary.totals.renderMinutes, limit: summary.quotas.maxRenderMinutesPerMonth }
        );
      }
    } else if (resource === 'storage_bytes') {
      if (summary.totals.storageBytes + requestedQuantity > summary.quotas.maxStorageBytes) {
        throw new SaasError(
          'QUOTA_EXCEEDED',
          `Storage quota exceeded. Used ${(summary.totals.storageBytes / (1024 * 1024 * 1024)).toFixed(2)}GB of ${(summary.quotas.maxStorageBytes / (1024 * 1024 * 1024)).toFixed(0)}GB limit.`,
          429,
          { resource, current: summary.totals.storageBytes, limit: summary.quotas.maxStorageBytes }
        );
      }
    } else if (resource === 'ai_tokens') {
      if (summary.totals.aiTokens + requestedQuantity > summary.quotas.maxAiTokensPerMonth) {
        throw new SaasError(
          'QUOTA_EXCEEDED',
          `AI token quota exceeded. Used ${summary.totals.aiTokens.toLocaleString()} of ${summary.quotas.maxAiTokensPerMonth.toLocaleString()} monthly tokens.`,
          429,
          { resource, current: summary.totals.aiTokens, limit: summary.quotas.maxAiTokensPerMonth }
        );
      }
    } else if (resource === 'published_posts') {
      if (summary.totals.publishedPosts + requestedQuantity > summary.quotas.maxPublishedPostsPerMonth) {
        throw new SaasError(
          'QUOTA_EXCEEDED',
          `Publication quota exceeded. Published ${summary.totals.publishedPosts} of ${summary.quotas.maxPublishedPostsPerMonth} monthly posts.`,
          429,
          { resource, current: summary.totals.publishedPosts, limit: summary.quotas.maxPublishedPostsPerMonth }
        );
      }
    }
  }
}

// Singleton
let meteringServiceInstance: MeteringService | null = null;

export function getMeteringService(): MeteringService {
  if (!meteringServiceInstance) {
    meteringServiceInstance = new MeteringService();
  }
  return meteringServiceInstance;
}
