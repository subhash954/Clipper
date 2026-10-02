import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  EnterprisePolicy,
  CostAnomalyAlert,
} from './types';
import { SaasError } from '@/lib/saas/types';

export class EnterprisePolicyEngine {
  private baseDir = path.join(process.cwd(), 'data', 'enterprise');
  private policiesFile = path.join(process.cwd(), 'data', 'enterprise', 'policies.json');
  private alertsFile = path.join(process.cwd(), 'data', 'enterprise', 'cost_anomalies.json');

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

  async getPolicy(organizationId: string): Promise<EnterprisePolicy> {
    const policies = this.read<EnterprisePolicy>(this.policiesFile);
    const policy = policies.find(p => p.organizationId === organizationId);
    if (policy) return policy;

    // Default enterprise policy
    return {
      organizationId,
      requireApprovalBeforePublish: true,
      disableExternalPublishing: false,
      allowedSocialPlatforms: ['youtube_shorts', 'instagram_reels', 'tiktok', 'linkedin', 'x'],
      maxMonthlyAiBudgetUSD: 500,
      maxMonthlyRenderMinutes: 2000,
      enforceMfa: false,
      enforceSSO: false,
      dataRetentionDays: 90,
      updatedAt: new Date().toISOString(),
    };
  }

  async setPolicy(policy: EnterprisePolicy): Promise<EnterprisePolicy> {
    let policies = this.read<EnterprisePolicy>(this.policiesFile);
    policies = policies.filter(p => p.organizationId !== policy.organizationId);
    policy.updatedAt = new Date().toISOString();
    policies.push(policy);
    this.write(this.policiesFile, policies);
    return policy;
  }

  /**
   * Enforces server-side enterprise governance policies
   */
  async assertPublishAllowed(organizationId: string, platform: string, isApproved: boolean): Promise<void> {
    const policy = await this.getPolicy(organizationId);

    if (policy.disableExternalPublishing) {
      throw new SaasError('FORBIDDEN', 'External publishing is currently disabled by enterprise policy.', 403);
    }

    if (!policy.allowedSocialPlatforms.includes(platform)) {
      throw new SaasError(
        'FORBIDDEN',
        `Platform '${platform}' is not permitted by enterprise policy. Allowed: [${policy.allowedSocialPlatforms.join(', ')}]`,
        403
      );
    }

    if (policy.requireApprovalBeforePublish && !isApproved) {
      throw new SaasError(
        'FORBIDDEN',
        'Enterprise policy requires explicit human approval before publishing.',
        403
      );
    }
  }

  /**
   * Analyzes cost ledger records for anomalous spending spikes (Phase 72)
   */
  async checkCostAnomaly(
    organizationId: string,
    serviceCategory: string,
    baselineCostUSD: number,
    observedCostUSD: number,
    spikeThreshold: number = 2.5
  ): Promise<CostAnomalyAlert | null> {
    if (baselineCostUSD <= 0) return null;

    const spikeFactor = observedCostUSD / baselineCostUSD;
    if (spikeFactor >= spikeThreshold) {
      const alerts = this.read<CostAnomalyAlert>(this.alertsFile);
      const alert: CostAnomalyAlert = {
        id: crypto.randomUUID(),
        organizationId,
        serviceCategory,
        spikeFactor: Number(spikeFactor.toFixed(2)),
        baselineCostUSD,
        observedCostUSD,
        periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        detectedAt: new Date().toISOString(),
        status: 'ACTIVE',
      };

      alerts.push(alert);
      this.write(this.alertsFile, alerts);
      return alert;
    }

    return null;
  }

  async listActiveAlerts(organizationId: string): Promise<CostAnomalyAlert[]> {
    const alerts = this.read<CostAnomalyAlert>(this.alertsFile);
    return alerts.filter(a => a.organizationId === organizationId && a.status === 'ACTIVE');
  }
}

// Singleton
let policyEngineInstance: EnterprisePolicyEngine | null = null;

export function getEnterprisePolicyEngine(): EnterprisePolicyEngine {
  if (!policyEngineInstance) {
    policyEngineInstance = new EnterprisePolicyEngine();
  }
  return policyEngineInstance;
}
