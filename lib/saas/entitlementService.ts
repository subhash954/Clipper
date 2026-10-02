import { PlanTier, PlanDefinition, PlanLimits, SaasError } from './types';

export const DEFAULT_PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free Trial',
    description: 'Get started with basic video clipping',
    monthlyPriceUSD: 0,
    annualPriceUSD: 0,
    limits: {
      maxMembers: 1,
      maxWorkspaces: 1,
      maxProjects: 3,
      maxStorageBytes: 2 * 1024 * 1024 * 1024, // 2 GB
      maxRenderMinutesPerMonth: 15,
      maxAiTokensPerMonth: 50_000,
      maxPublishedPostsPerMonth: 5,
      maxConnectedAccounts: 1,
      allowWhitelabel: false,
      allowCustomDomain: false,
      allowClientPortal: false,
      allowApiAccess: false,
    },
  },

  starter: {
    id: 'starter',
    name: 'Creator Starter',
    description: 'For solo creators producing daily shorts',
    monthlyPriceUSD: 29,
    annualPriceUSD: 290,
    limits: {
      maxMembers: 2,
      maxWorkspaces: 1,
      maxProjects: 20,
      maxStorageBytes: 25 * 1024 * 1024 * 1024, // 25 GB
      maxRenderMinutesPerMonth: 120,
      maxAiTokensPerMonth: 500_000,
      maxPublishedPostsPerMonth: 60,
      maxConnectedAccounts: 3,
      allowWhitelabel: false,
      allowCustomDomain: false,
      allowClientPortal: false,
      allowApiAccess: false,
    },
  },

  pro: {
    id: 'pro',
    name: 'Pro Studio',
    description: 'For serious video creators & small teams',
    monthlyPriceUSD: 79,
    annualPriceUSD: 790,
    limits: {
      maxMembers: 5,
      maxWorkspaces: 3,
      maxProjects: 100,
      maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
      maxRenderMinutesPerMonth: 600,
      maxAiTokensPerMonth: 2_500_000,
      maxPublishedPostsPerMonth: 300,
      maxConnectedAccounts: 10,
      allowWhitelabel: false,
      allowCustomDomain: false,
      allowClientPortal: true,
      allowApiAccess: true,
    },
  },

  agency: {
    id: 'agency',
    name: 'Agency Scale',
    description: 'For agencies managing multiple client brands',
    monthlyPriceUSD: 249,
    annualPriceUSD: 2490,
    limits: {
      maxMembers: 25,
      maxWorkspaces: 20,
      maxProjects: 1000,
      maxStorageBytes: 500 * 1024 * 1024 * 1024, // 500 GB
      maxRenderMinutesPerMonth: 3000,
      maxAiTokensPerMonth: 15_000_000,
      maxPublishedPostsPerMonth: 2000,
      maxConnectedAccounts: 50,
      allowWhitelabel: true,
      allowCustomDomain: true,
      allowClientPortal: true,
      allowApiAccess: true,
    },
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Custom',
    description: 'Dedicated infrastructure, custom SLAs and limits',
    monthlyPriceUSD: 999,
    annualPriceUSD: 9990,
    limits: {
      maxMembers: 100,
      maxWorkspaces: 100,
      maxProjects: 10000,
      maxStorageBytes: 2000 * 1024 * 1024 * 1024, // 2 TB
      maxRenderMinutesPerMonth: 20000,
      maxAiTokensPerMonth: 100_000_000,
      maxPublishedPostsPerMonth: 15000,
      maxConnectedAccounts: 200,
      allowWhitelabel: true,
      allowCustomDomain: true,
      allowClientPortal: true,
      allowApiAccess: true,
    },
  },
};

export class EntitlementService {
  getPlan(planId: PlanTier): PlanDefinition {
    return DEFAULT_PLANS[planId] || DEFAULT_PLANS.free;
  }

  getPlanLimits(planId: PlanTier): PlanLimits {
    return this.getPlan(planId).limits;
  }

  canWhitelabel(planId: PlanTier): boolean {
    return this.getPlanLimits(planId).allowWhitelabel;
  }

  canCustomDomain(planId: PlanTier): boolean {
    return this.getPlanLimits(planId).allowCustomDomain;
  }

  canClientPortal(planId: PlanTier): boolean {
    return this.getPlanLimits(planId).allowClientPortal;
  }

  canApiAccess(planId: PlanTier): boolean {
    return this.getPlanLimits(planId).allowApiAccess;
  }

  assertFeatureEntitlement(planId: PlanTier, feature: 'whitelabel' | 'custom_domain' | 'client_portal' | 'api_access') {
    const limits = this.getPlanLimits(planId);
    let allowed = false;

    if (feature === 'whitelabel') allowed = limits.allowWhitelabel;
    else if (feature === 'custom_domain') allowed = limits.allowCustomDomain;
    else if (feature === 'client_portal') allowed = limits.allowClientPortal;
    else if (feature === 'api_access') allowed = limits.allowApiAccess;

    if (!allowed) {
      throw new SaasError(
        'FORBIDDEN',
        `Feature '${feature}' requires an upgrade from plan '${planId}' to Agency or Enterprise.`,
        403,
        { currentPlan: planId, requiredFeature: feature }
      );
    }
  }
}

// Singleton
let entitlementServiceInstance: EntitlementService | null = null;

export function getEntitlementService(): EntitlementService {
  if (!entitlementServiceInstance) {
    entitlementServiceInstance = new EntitlementService();
  }
  return entitlementServiceInstance;
}
