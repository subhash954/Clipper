/**
 * CLIPPER PERFORMANCE INTELLIGENCE — CREATIVE ATTRIBUTION GRAPH
 * Phase 3
 * 
 * Maps observed external performance back through the complete creative lineage:
 * Publication -> Asset -> Opportunity -> Hook -> Timeline RenderSpec.
 * Answers with empirical certainty: Which hook, pacing, duration, and format actually won?
 */

import { listSnapshots } from './performanceStore';
import { normalizeSnapshot } from './normalizationEngine';
import {
  CreativeAttribution,
  DimensionLeaderboard,
} from './types';
import { getContentAssetById, getOpportunityById } from '@/lib/factory/contentStore';
import { HookCategory, SupportedPlatform } from '@/lib/factory/types';

/**
 * Builds creative attribution records for all snapshots in a workspace.
 */
export async function buildAttributionGraph(workspaceId: string): Promise<CreativeAttribution[]> {
  const snapshots = listSnapshots(workspaceId);
  const attributions: CreativeAttribution[] = [];

  for (const snap of snapshots) {
    const asset = await getContentAssetById(snap.assetId);
    let opportunityTopic = 'General';
    let hookCategory: HookCategory | 'UNKNOWN' = 'UNKNOWN';
    let hookText = asset?.title || 'Unknown Title';
    let durationSeconds = asset?.durationSeconds || 30;
    let aspectRatio = asset?.aspectRatio || '9:16';
    let bRollCount = 0;

    if (asset) {
      if (asset.opportunityId) {
        const opp = await getOpportunityById(asset.opportunityId);
        if (opp) {
          opportunityTopic = opp.topic || 'General';
          hookText = opp.hook || asset.title || 'Unknown Title';
          const lowerHook = hookText.toLowerCase();
          if (lowerHook.includes('stop') || lowerHook.includes('never') || lowerHook.includes('wrong') || lowerHook.includes("don't")) {
            hookCategory = 'Contrarian';
          } else if (lowerHook.startsWith('what') || lowerHook.startsWith('why') || lowerHook.startsWith('how') || lowerHook.endsWith('?')) {
            hookCategory = 'Question';
          } else if (lowerHook.includes('secret') || lowerHook.includes('curiosity')) {
            hookCategory = 'Curiosity';
          } else {
            hookCategory = 'Story';
          }
        }
      }

      if (asset.renderSpec) {
        const bRollTrack = asset.renderSpec.tracks.find((t) => t.type === 'BROLL');
        bRollCount = bRollTrack?.clips.length || 0;
      }
    }

    const normalized = normalizeSnapshot(snap, durationSeconds);

    attributions.push({
      assetId: snap.assetId,
      publicationId: snap.publicationId,
      platform: snap.platform,
      hookCategory,
      hookText,
      topic: opportunityTopic,
      aspectRatio,
      durationSeconds,
      bRollCount,
      metrics: normalized,
      capturedAt: snap.capturedAt,
    });
  }

  return attributions;
}

/**
 * Generates leaderboard ranking hook categories by performance multiplier.
 */
export async function getHookCategoryLeaderboard(
  workspaceId: string
): Promise<DimensionLeaderboard<HookCategory | 'UNKNOWN'>[]> {
  const graph = await buildAttributionGraph(workspaceId);
  if (graph.length === 0) return [];

  // Overall baseline engagement rate
  const overallAvgEngagement =
    graph.reduce((acc, g) => acc + g.metrics.normalizedEngagementRate, 0) / graph.length;

  const groups: Record<string, CreativeAttribution[]> = {};
  for (const item of graph) {
    const cat = item.hookCategory;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }

  const result: DimensionLeaderboard<HookCategory | 'UNKNOWN'>[] = [];

  for (const [cat, items] of Object.entries(groups)) {
    const sampleCount = items.length;
    const totalViews = items.reduce((acc, i) => acc + i.metrics.standardizedViews, 0);
    const averageViews = Math.round(totalViews / sampleCount);
    const averageEngagementRate =
      items.reduce((acc, i) => acc + i.metrics.normalizedEngagementRate, 0) / sampleCount;
    const averageCompletionRate =
      items.reduce((acc, i) => acc + i.metrics.normalizedCompletionRate, 0) / sampleCount;

    const multiplier =
      overallAvgEngagement > 0
        ? Number((averageEngagementRate / overallAvgEngagement).toFixed(2))
        : 1.0;

    result.push({
      dimension: cat as HookCategory | 'UNKNOWN',
      sampleCount,
      totalViews,
      averageViews,
      averageEngagementRate: Number(averageEngagementRate.toFixed(4)),
      averageCompletionRate: Number(averageCompletionRate.toFixed(4)),
      relativePerformanceMultiplier: multiplier,
    });
  }

  // Sort descending by performance multiplier
  return result.sort((a, b) => b.relativePerformanceMultiplier - a.relativePerformanceMultiplier);
}

/**
 * Evaluates optimal duration ranges by platform based on actual completion & engagement.
 */
export async function getDurationLeaderboard(
  workspaceId: string,
  platform?: SupportedPlatform
): Promise<DimensionLeaderboard<string>[]> {
  const graph = (await buildAttributionGraph(workspaceId)).filter(
    (g) => !platform || g.platform === platform
  );

  if (graph.length === 0) return [];

  const overallAvgScore =
    graph.reduce((acc, g) => acc + g.metrics.compositePerformanceScore, 0) / graph.length;

  // Bucket durations into standard ranges: <20s, 20-40s, 40-60s, >60s
  const buckets: Record<string, CreativeAttribution[]> = {
    'Under 20s': [],
    '20s - 40s': [],
    '40s - 60s': [],
    'Over 60s': [],
  };

  for (const item of graph) {
    const d = item.durationSeconds;
    if (d < 20) buckets['Under 20s'].push(item);
    else if (d <= 40) buckets['20s - 40s'].push(item);
    else if (d <= 60) buckets['40s - 60s'].push(item);
    else buckets['Over 60s'].push(item);
  }

  const result: DimensionLeaderboard<string>[] = [];

  for (const [bucket, items] of Object.entries(buckets)) {
    if (items.length === 0) continue;
    const sampleCount = items.length;
    const totalViews = items.reduce((acc, i) => acc + i.metrics.standardizedViews, 0);
    const averageViews = Math.round(totalViews / sampleCount);
    const averageEngagementRate =
      items.reduce((acc, i) => acc + i.metrics.normalizedEngagementRate, 0) / sampleCount;
    const averageCompletionRate =
      items.reduce((acc, i) => acc + i.metrics.normalizedCompletionRate, 0) / sampleCount;
    const avgScore =
      items.reduce((acc, i) => acc + i.metrics.compositePerformanceScore, 0) / sampleCount;

    const multiplier =
      overallAvgScore > 0 ? Number((avgScore / overallAvgScore).toFixed(2)) : 1.0;

    result.push({
      dimension: bucket,
      sampleCount,
      totalViews,
      averageViews,
      averageEngagementRate: Number(averageEngagementRate.toFixed(4)),
      averageCompletionRate: Number(averageCompletionRate.toFixed(4)),
      relativePerformanceMultiplier: multiplier,
    });
  }

  return result.sort((a, b) => b.relativePerformanceMultiplier - a.relativePerformanceMultiplier);
}
