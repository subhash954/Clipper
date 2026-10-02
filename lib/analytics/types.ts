/**
 * CLIPPER PERFORMANCE INTELLIGENCE & LEARNING ENGINE
 * Canonical Data Models and Type Definitions (Mission 7)
 * 
 * RULE ZERO: NEVER FABRICATE PERFORMANCE DATA.
 * AI editorial score is NOT actual performance.
 * Observed external platform metrics must remain separate.
 */

import { SupportedPlatform, HookCategory } from '@/lib/factory/types';

// ============================================================================
// PERFORMANCE SNAPSHOT (Phase 1)
// ============================================================================

export interface RetentionDataPoint {
  timestampSeconds: number;
  retentionPercent: number; // 0 - 100%
}

export interface PerformanceSnapshot {
  id: string;
  workspaceId: string;
  publicationId: string; // references PublishJob id
  assetId: string;        // references ContentAsset id
  opportunityId?: string; // references ContentOpportunity id
  projectId: string;      // references source Project id
  platform: SupportedPlatform;
  capturedAt: string;     // ISO timestamp of platform query

  // Observed Raw Platform Metrics (Only what external platform returned)
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchTimeSeconds: number;
  averageViewDurationSeconds: number;
  completionRate?: number; // 0.0 - 1.0 (if supplied by platform)
  engagementRate?: number; // 0.0 - 1.0
  followersGained?: number;
  clicks?: number;
  impressions?: number;
  reach?: number;
  
  // Platform-specific retention curve (if available)
  retentionCurve?: RetentionDataPoint[];

  // Raw platform JSON response for verification audit
  externalMetrics?: Record<string, any>;
  createdAt: string;
}

// ============================================================================
// METRIC NORMALIZATION (Phase 2)
// ============================================================================

export interface NormalizedMetrics {
  standardizedViews: number;
  normalizedEngagementRate: number; // weighted formula per view
  normalizedCompletionRate: number;
  watchTimeRatio: number;           // avg view duration / total asset duration
  compositePerformanceScore: number;// 0 - 100 relative index
}

// ============================================================================
// ATTRIBUTION & LINEAGE GRAPH (Phase 3)
// ============================================================================

export interface CreativeAttribution {
  assetId: string;
  publicationId: string;
  platform: SupportedPlatform;
  
  // Creative Dimensions
  hookCategory: HookCategory | 'UNKNOWN';
  hookText: string;
  topic: string;
  aspectRatio: string;
  durationSeconds: number;
  speakerId?: number;
  speakerName?: string;
  bRollCount: number;
  pacingWpm?: number;

  // Actual Observed Metrics
  metrics: NormalizedMetrics;
  capturedAt: string;
}

export interface DimensionLeaderboard<T = string> {
  dimension: T;
  sampleCount: number;
  totalViews: number;
  averageViews: number;
  averageEngagementRate: number;
  averageCompletionRate: number;
  relativePerformanceMultiplier: number; // e.g. 1.45x vs baseline average
}

// ============================================================================
// LEARNING ENGINE & RECOMMENDATIONS (Phase 4 & 5)
// ============================================================================

export interface PlatformDurationGuideline {
  platform: SupportedPlatform;
  optimalRangeSeconds: [number, number];
  peakEngagementDurationSeconds: number;
  sampleCount: number;
}

export interface LearnedModelWeights {
  workspaceId: string;
  lastTrainedAt: string;
  totalPublicationsAnalyzed: number;
  
  // Category weights relative to 1.0 baseline
  hookCategoryWeights: Record<string, number>;
  topicWeights: Record<string, number>;
  optimalDurations: Record<SupportedPlatform, [number, number]>;
  bRollDensityPreference: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Actionable strategic insights
  recommendations: {
    id: string;
    type: 'HOOK_STRATEGY' | 'DURATION_ADJUSTMENT' | 'TOPIC_FOCUS' | 'PLATFORM_SYNERGY';
    title: string;
    description: string;
    confidence: number; // 0 - 100
    evidenceSampleCount: number;
    expectedLiftMultiplier: number; // e.g. 1.8x
  }[];
}

// ============================================================================
// PREDICTED VS ACTUAL ACCURACY CALIBRATION (Phase 6)
// ============================================================================

export interface PerformanceCalibrationRecord {
  assetId: string;
  platform: SupportedPlatform;
  predictedAiScore: number;     // 0 - 100 Editorial Score from Factory
  actualPerformanceScore: number; // 0 - 100 Normalized Score from Platforms
  variance: number;               // actual - predicted
  calibratedAt: string;
}
