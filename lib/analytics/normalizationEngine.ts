/**
 * CLIPPER PERFORMANCE INTELLIGENCE — METRIC NORMALIZATION ENGINE
 * Phase 2
 * 
 * Normalizes disparate platform analytics into a fair, unified comparison index.
 * Accounts for platform view thresholds (TikTok 0s vs Instagram 3s vs YouTube Shorts).
 */

import { SupportedPlatform } from '@/lib/factory/types';
import { PerformanceSnapshot, NormalizedMetrics } from './types';

// Platform friction & view threshold normalization multipliers
const PLATFORM_VIEW_WEIGHTS: Record<SupportedPlatform, number> = {
  youtube_shorts: 1.25,  // Strict view definition & intentional feed
  instagram_reels: 1.00, // Standard 3-second view threshold
  tiktok: 0.85,          // Instant autoplay view count
  linkedin: 1.50,        // High-value professional attention friction
  x: 1.10,               // Feed scroll with 2-second threshold
  facebook: 0.90,        // Autoplay feed baseline
};

/**
 * Normalizes a raw performance snapshot against standard baseline metrics.
 */
export function normalizeSnapshot(
  snapshot: PerformanceSnapshot,
  assetDurationSeconds: number = 30
): NormalizedMetrics {
  const views = Math.max(0, snapshot.views);
  const platformWeight = PLATFORM_VIEW_WEIGHTS[snapshot.platform] || 1.0;
  
  // Standardized Views = views * platform friction weight
  const standardizedViews = Math.round(views * platformWeight);

  // Weighted Engagement Formula:
  // Comments (2.0x), Shares (3.0x), Saves (2.5x), Likes (1.0x)
  const weightedEngagements =
    snapshot.likes * 1.0 +
    snapshot.comments * 2.0 +
    snapshot.shares * 3.0 +
    snapshot.saves * 2.5;

  const rawEngagementRate = views > 0 ? weightedEngagements / views : 0;
  // Normalized engagement rate capped at reasonable index 0 - 1.0
  const normalizedEngagementRate = Math.min(1.0, rawEngagementRate);

  // Watch Time Ratio (average view duration relative to asset length)
  const duration = Math.max(1, assetDurationSeconds);
  const avgDuration = Math.max(0, snapshot.averageViewDurationSeconds || 0);
  const watchTimeRatio = Math.min(2.0, avgDuration / duration); // can exceed 1.0 if looped!

  // Completion Rate (from snapshot or calculated from watchTimeRatio)
  let normalizedCompletionRate = snapshot.completionRate ?? 0;
  if (normalizedCompletionRate <= 0) {
    normalizedCompletionRate = Math.min(1.0, watchTimeRatio >= 0.9 ? 0.85 : watchTimeRatio * 0.7);
  }

  // Composite Performance Score (0 - 100 Index)
  // 35% Engagement, 35% Watch Time Ratio, 30% Completion
  const engagementIndex = Math.min(100, (normalizedEngagementRate / 0.15) * 100); // 15% weighted engagement is 100
  const watchTimeIndex = Math.min(100, (watchTimeRatio / 0.85) * 100);          // 85% retention is 100
  const completionIndex = Math.min(100, normalizedCompletionRate * 100);

  const compositeScore = Math.round(
    0.35 * engagementIndex + 0.35 * watchTimeIndex + 0.30 * completionIndex
  );

  return {
    standardizedViews,
    normalizedEngagementRate: Number(normalizedEngagementRate.toFixed(4)),
    normalizedCompletionRate: Number(normalizedCompletionRate.toFixed(4)),
    watchTimeRatio: Number(watchTimeRatio.toFixed(4)),
    compositePerformanceScore: Math.max(0, Math.min(100, compositeScore)),
  };
}
