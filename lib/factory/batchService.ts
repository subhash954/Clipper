/**
 * CLIPPER CONTENT FACTORY — BATCH PROCESSING & COST CONTROL ENGINE
 * Phase 32, 33, 34, 43, 44, 55, 56
 * 
 * Manages asynchronous batch generation jobs, enforces hard budget caps,
 * isolates per-asset errors, and supports partial regeneration with field locking.
 */

import {
  ContentBatchJob,
  ContentOpportunity,
  ContentAsset,
  SupportedPlatform,
  BrandKit,
  BrandVoice
} from './types';
import { adaptOpportunityToPlatform } from './adaptationEngine';
import { generateHooksForOpportunity } from './hookFactory';
import { auditContentAsset } from './qualityGates';

// In-memory / durable job registry
const batchJobRegistry = new Map<string, ContentBatchJob>();

export interface BatchProcessingOptions {
  platforms: SupportedPlatform[];
  maxBudgetUsd?: number;
  brandKit?: BrandKit;
  brandVoice?: BrandVoice;
  sourceWords?: any[];
  visualOpportunities?: any[];
}

/**
 * Estimates total dollar cost of a proposed batch job (Phase 34)
 */
export function estimateBatchCost(
  opportunitiesCount: number,
  platformsCount: number
): { estimatedCostUsd: number; breakdown: { aiBriefs: number; renders: number } } {
  // Estimated costs:
  // - AI Brief & Copywriting: $0.003 per asset
  // - Video Render processing estimate: $0.012 per asset
  const totalAssets = opportunitiesCount * platformsCount;
  const aiBriefs = parseFloat((totalAssets * 0.003).toFixed(4));
  const renders = parseFloat((totalAssets * 0.012).toFixed(4));
  const estimatedCostUsd = parseFloat((aiBriefs + renders).toFixed(4));

  return {
    estimatedCostUsd,
    breakdown: {
      aiBriefs,
      renders,
    },
  };
}

/**
 * Initializes a new batch job in QUEUED status
 */
export function createBatchJob(
  projectId: string,
  requestedCount: number,
  maxBudgetUsd: number = 10.0
): ContentBatchJob {
  const id = `job-batch-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
  const estimate = estimateBatchCost(requestedCount, 2); // Assume 2 platforms default

  const job: ContentBatchJob = {
    id,
    projectId,
    requestedCount,
    generatedCount: 0,
    rejectedCount: 0,
    duplicatesCount: 0,
    needsReviewCount: 0,
    status: 'QUEUED',
    estimatedCostUsd: estimate.estimatedCostUsd,
    actualCostUsd: 0.0,
    maxBudgetUsd,
    budgetExceeded: false,
    assetIds: [],
    createdAt: new Date().toISOString(),
  };

  batchJobRegistry.set(id, job);
  return job;
}

/**
 * Retrieves a batch job by ID
 */
export function getBatchJob(jobId: string): ContentBatchJob | null {
  return batchJobRegistry.get(jobId) || null;
}

/**
 * Executes batch generation across opportunities with error isolation and budget checks
 */
export async function executeBatchJob(
  jobId: string,
  opportunities: ContentOpportunity[],
  options: BatchProcessingOptions
): Promise<{ job: ContentBatchJob; generatedAssets: ContentAsset[] }> {
  const job = batchJobRegistry.get(jobId);
  if (!job) {
    throw new Error(`Batch job ${jobId} not found`);
  }

  job.status = 'PROCESSING';
  const generatedAssets: ContentAsset[] = [];
  const maxBudget = options.maxBudgetUsd || job.maxBudgetUsd;

  const targetOpportunities = opportunities.slice(0, job.requestedCount);

  for (const opp of targetOpportunities) {
    // Budget Guard (Phase 34)
    if (job.actualCostUsd >= maxBudget) {
      job.budgetExceeded = true;
      break;
    }

    // Process each target platform
    for (const platform of options.platforms) {
      try {
        const { asset } = adaptOpportunityToPlatform(opp, {
          platform,
          brandKit: options.brandKit,
          brandVoice: options.brandVoice,
          sourceWords: options.sourceWords,
          visualOpportunities: options.visualOpportunities,
        });

        // Audit against quality gates
        const audit = auditContentAsset(asset);
        asset.qualityAudit = audit;
        if (!audit.passed) {
          asset.status = 'NEEDS_REVIEW';
          job.needsReviewCount++;
        } else {
          asset.status = 'READY';
          job.generatedCount++;
        }

        generatedAssets.push(asset);
        job.assetIds.push(asset.id);
        job.actualCostUsd = parseFloat((job.actualCostUsd + 0.003).toFixed(4));
        if (job.actualCostUsd >= maxBudget) {
          job.budgetExceeded = true;
          break;
        }
      } catch (err: any) {
        // Per-asset failure isolation (Phase 56)
        job.rejectedCount++;
      }
    }
    if (job.budgetExceeded) {
      break;
    }
  }

  job.status = 'COMPLETED';
  job.completedAt = new Date().toISOString();
  batchJobRegistry.set(jobId, job);

  return { job, generatedAssets };
}

/**
 * Partial Regeneration Engine (Phase 43 & 44)
 * Regenerates only requested fields while strictly preserving locked fields
 */
export function partiallyRegenerateAsset(
  asset: ContentAsset,
  fieldsToRegenerate: ('hook' | 'title' | 'cta' | 'description' | 'hashtags')[],
  opportunity: ContentOpportunity,
  brandVoice?: BrandVoice
): ContentAsset {
  const updated = { ...asset };
  const locked = new Set(asset.lockedFields);

  if (fieldsToRegenerate.includes('hook') && !locked.has('hook')) {
    const hooks = generateHooksForOpportunity(opportunity, { brandTone: brandVoice?.tone });
    updated.title = hooks[0].hookText;
  }

  if (fieldsToRegenerate.includes('title') && !locked.has('title')) {
    const hooks = generateHooksForOpportunity(opportunity, { brandTone: brandVoice?.tone });
    updated.titles = hooks.map((h) => ({
      title: h.hookText,
      type: h.hookType as any,
      sourceEvidence: h.sourceEvidence,
      confidence: h.confidence,
    }));
  }

  if (fieldsToRegenerate.includes('cta') && !locked.has('cta')) {
    updated.cta = `Follow for more breakdowns on ${opportunity.topic}.`;
  }

  updated.updatedAt = new Date().toISOString();
  return updated;
}
