/**
 * CLIPPER CONTENT FACTORY & MULTI-PLATFORM CONTENT ENGINE
 * Canonical Data Models and Type Definitions (Mission 5)
 */

import { CanonicalRenderSpec } from '@/lib/editor/types';
import { WordTimestamp } from '@/lib/types';

// ============================================================================
// CONTENT TYPES (Phase 2)
// ============================================================================

export type ContentType =
  | 'SHORT_VIDEO'
  | 'REEL'
  | 'TIKTOK'
  | 'YOUTUBE_SHORT'
  | 'LINKEDIN_VIDEO'
  | 'X_VIDEO'
  | 'QUOTE_CARD'
  | 'TEXT_POST'
  | 'CAROUSEL'
  | 'THREAD'
  | 'COMMUNITY_POST'
  | 'EMAIL_ANGLE'
  | 'BLOG_ANGLE'
  | 'THUMBNAIL_CONCEPT';

export type SupportedPlatform =
  | 'youtube_shorts'
  | 'instagram_reels'
  | 'tiktok'
  | 'linkedin'
  | 'x'
  | 'facebook';

export type OpportunityStatus =
  | 'DISCOVERED'
  | 'SELECTED'
  | 'BRIEFED'
  | 'IN_PRODUCTION'
  | 'COMPLETED'
  | 'DISCARDED';

export type AssetStatus =
  | 'IDEA'
  | 'DRAFT'
  | 'READY'
  | 'NEEDS_REVIEW'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

export type HookCategory =
  | 'Question'
  | 'Contrarian'
  | 'Curiosity'
  | 'Problem'
  | 'Outcome'
  | 'Story'
  | 'Statistic'
  | 'Mistake'
  | 'Warning'
  | 'Challenge';

// ============================================================================
// LINEAGE & AUDITING (Phase 30 & 31)
// ============================================================================

export interface ContentLineage {
  sourceProjectId: string;
  sourceClipId?: string;
  sourceTimelineVersionId?: string;
  renderSpecVersionId?: string;
  variantId?: string;
  sourceMediaChecksum?: string;
  sourceStart: number;
  sourceEnd: number;
  wordCount: number;
  extractedAt: string;
}

// ============================================================================
// CONTENT OPPORTUNITY GRAPH (Phase 1, 3, 4, 5, 37)
// ============================================================================

export interface ContentOpportunity {
  id: string;
  projectId: string;
  sourceStart: number;
  sourceEnd: number;
  sourceTranscript: string;
  topic: string;
  subtopic: string;
  contentType: ContentType;
  hook: string;
  payoff: string;
  audience?: string;
  score: number; // 0 - 100 AI Editorial Score
  confidence?: number; // 0.0 - 1.0 (optional when uncalibrated)
  evidence: {
    start: number;
    end: number;
    quote: string;
    speakerId?: string;
    segmentType?: string;
  };
  platformFit: Record<SupportedPlatform, number>; // 0 - 100 fit rating
  pillars: string[];
  status: OpportunityStatus;
  lockedFields?: string[];
  lineage: ContentLineage;
  createdAt: string;
  updatedAt: string;
}

// Hierarchical Topic Tree / Content Map (Phase 3)
export interface ContentMapTopic {
  id: string;
  title: string;
  description: string;
  evidenceStart: number;
  evidenceEnd: number;
  opportunities: ContentOpportunity[];
}

export interface ContentMap {
  projectId: string;
  sourceDuration: number;
  topics: ContentMapTopic[];
  totalOpportunitiesCount: number;
  generatedAt: string;
}

// ============================================================================
// BRAND KIT & BRAND VOICE (Phase 18 & 19)
// ============================================================================

export interface BrandKit {
  id: string;
  workspaceId: string;
  name: string;
  logoUrl?: string;
  fonts: {
    heading: string;
    body: string;
    captions: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  captionPreset: string;
  watermarkUrl?: string;
  introMediaUrl?: string;
  outroMediaUrl?: string;
  defaultCta?: string;
  socialHandles: {
    youtube?: string;
    instagram?: string;
    tiktok?: string;
    linkedin?: string;
    x?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BrandVoice {
  id: string;
  workspaceId: string;
  name: string;
  tone: 'Professional' | 'Friendly' | 'Educational' | 'Direct' | 'Inspirational' | 'Contrarian';
  sentenceLength: 'punchy' | 'moderate' | 'detailed';
  vocabulary: 'simplified' | 'industry_standard' | 'academic';
  formality: 'casual' | 'semi-formal' | 'formal';
  energy: 'calm' | 'confident' | 'high_energy';
  ctaStyle: 'subtle' | 'direct' | 'question_based';
  bannedPhrases: string[];
  preferredPhrases: string[];
}

export interface AudiencePersona {
  id: string;
  workspaceId: string;
  audienceName: string;
  ageRange: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'executive';
  industry: string;
  interests: string[];
  painPoints: string[];
  goals: string[];
  language: string;
  tone: string;
}

export interface ContentPillar {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
}

// ============================================================================
// HOOK FACTORY & VARIANTS (Phase 7 & 8)
// ============================================================================

export interface GeneratedHook {
  id: string;
  hookText: string;
  hookType: HookCategory;
  sourceEvidence: string;
  confidence: number;
  estimatedCuriosityGap: number; // 0 - 100
}

export interface HookVariantTest {
  id: string;
  opportunityId: string;
  variants: {
    variantId: 'Variant A' | 'Variant B' | 'Variant C' | 'Variant D' | 'Variant E';
    hook: GeneratedHook;
    status: 'DRAFT' | 'READY' | 'TESTING';
    notes?: string;
  }[];
}

// ============================================================================
// AI CONTENT BRIEF (Phase 40)
// ============================================================================

export interface ContentBrief {
  id: string;
  opportunityId: string;
  objective: 'Brand Awareness' | 'Audience Growth' | 'Lead Generation' | 'Community Engagement' | 'Product Conversion';
  audience: string;
  topic: string;
  hook: string;
  coreIdea: string;
  supportingEvidence: string;
  payoff: string;
  cta: string;
  platform: SupportedPlatform;
  targetDurationSeconds: number;
  visualStrategy: string;
  captionStrategy: string;
  brandVoice: string;
  createdAt: string;
}

// ============================================================================
// SUPPORTING ASSET STRUCTURES (Phases 20 - 27)
// ============================================================================

export interface GeneratedTitle {
  title: string;
  type: 'Direct' | 'Curiosity' | 'Educational' | 'Contrarian' | 'Outcome' | 'Story';
  sourceEvidence: string;
  confidence: number;
}

export interface GeneratedCopy {
  youtubeDescription?: string;
  instagramCaption?: string;
  tiktokCaption?: string;
  linkedinPost?: string;
  xPost?: string;
}

export interface HashtagSet {
  broad: string[];
  niche: string[];
  topic: string[];
  brand: string[];
  all: string[];
}

export interface ThumbnailConcept {
  id: string;
  opportunityId: string;
  headline: string;
  visualSubject: string;
  composition: string;
  emotionOrAction: string;
  background: string;
  contrast: string;
  branding: string;
  layout: string;
  isGeneratedImage: false; // Strictly marked as CONCEPT, not fake image
}

export interface TextPostStructure {
  id: string;
  hook: string;
  insight: string;
  explanation: string;
  example: string;
  conclusion: string;
  cta: string;
  formattedText: string;
  sourceEvidence: string;
}

export interface CarouselSlide {
  slideNumber: number;
  purpose: 'Hook' | 'Problem' | 'Mistake' | 'Framework' | 'Example' | 'Action' | 'CTA';
  headline: string;
  bodyText: string;
  sourceEvidence: string;
  visualCue?: string;
}

export interface CarouselPlan {
  id: string;
  opportunityId: string;
  title: string;
  slides: CarouselSlide[];
  totalSlides: number;
}

export interface ThreadPost {
  postNumber: number;
  text: string;
  sourceEvidence: string;
}

export interface ThreadPlan {
  id: string;
  opportunityId: string;
  posts: ThreadPost[];
  totalPosts: number;
}

export interface EmailAngle {
  id: string;
  subject: string;
  hook: string;
  story: string;
  insight: string;
  action: string;
  cta: string;
  fullBody: string;
  sourceEvidence: string;
}

// ============================================================================
// CONTENT ASSET & VARIANTS (Phase 9, 12, 16, 39, 44)
// ============================================================================

export interface ContentAsset {
  id: string;
  projectId: string;
  opportunityId: string;
  briefId?: string;
  title: string;
  description: string;
  contentType: ContentType;
  platform: SupportedPlatform;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  durationSeconds: number;
  status: AssetStatus;
  
  // Editorial and Copy Metadata
  titles: GeneratedTitle[];
  copy: GeneratedCopy;
  hashtags: HashtagSet;
  cta: string;
  thumbnailConcept?: ThumbnailConcept;
  textPost?: TextPostStructure;
  carousel?: CarouselPlan;
  thread?: ThreadPlan;
  emailAngle?: EmailAngle;

  // Video Timeline & RenderSpec
  renderSpec?: CanonicalRenderSpec;
  renderedVideoPath?: string;
  renderedVideoChecksum?: string;
  
  // Auditing & Quality
  qualityAudit?: ContentQualityGateResult;
  externalContextFlags?: {
    field: string;
    flag: 'EXTERNAL_CONTEXT';
    explanation: string;
  }[];
  lockedFields: string[]; // ['hook', 'caption', 'cta', 'title', 'renderSpec']
  lineage: ContentLineage;
  
  createdAt: string;
  updatedAt: string;
}

export interface ContentVariant {
  id: string;
  assetId: string;
  name: string;
  variantType: 'HOOK' | 'CAPTION' | 'ASPECT_RATIO' | 'AUDIO' | 'BROLL';
  hookOverride?: GeneratedHook;
  captionStyleOverride?: string;
  aspectRatioOverride?: '9:16' | '16:9' | '1:1' | '4:5';
  audioMixOverride?: string;
  renderSpecOverride?: CanonicalRenderSpec;
  status: 'DRAFT' | 'READY' | 'RENDERED';
  renderedPath?: string;
  renderedChecksum?: string;
  createdAt: string;
}

// ============================================================================
// PLATFORM CONSTRAINTS ENGINE (Phase 11, 13, 50)
// ============================================================================

export interface PlatformProfile {
  platform: SupportedPlatform;
  displayName: string;
  maxDurationSeconds: number;
  minDurationSeconds: number;
  recommendedAspectRatios: ('9:16' | '16:9' | '1:1' | '4:5')[];
  captionSafeAreas: {
    topPercent: number;
    bottomPercent: number;
    leftPercent: number;
    rightPercent: number;
  };
  titleLimits: {
    maxCharacters: number;
    optimalCharacters: number;
  };
  descriptionLimits: {
    maxCharacters: number;
  };
  hashtagRules: {
    maxCount: number;
    placement: 'title' | 'description_end' | 'first_comment';
  };
  thumbnailRules: {
    width: number;
    height: number;
    maxBytes: number;
  };
  editorialProfile: {
    openingPacing: 'fast' | 'measured' | 'cinematic';
    captionDensity: 'high' | 'medium' | 'minimal';
    visualDensity: 'high' | 'medium' | 'low';
    formalityPreference: 'casual' | 'professional' | 'energetic' | 'direct';
  };
}

// ============================================================================
// QUALITY GATES & BATCH PROCESSING (Phase 32, 33, 34, 35)
// ============================================================================

export interface ContentQualityGateResult {
  passed: boolean;
  score: number;
  checks: {
    sourceAlignment: boolean;
    narrativeCompleteness: boolean;
    hookValidity: boolean;
    noHallucinatedFacts: boolean;
    durationValidity: boolean;
    platformValidity: boolean;
    captionTimingValid: boolean;
    renderSpecValid: boolean;
  };
  reasons: string[];
}

export interface ContentBatchJob {
  id: string;
  projectId: string;
  requestedCount: number;
  generatedCount: number;
  rejectedCount: number;
  duplicatesCount: number;
  needsReviewCount: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  estimatedCostUsd: number;
  actualCostUsd: number;
  maxBudgetUsd: number;
  budgetExceeded: boolean;
  assetIds: string[];
  failureReason?: string;
  createdAt: string;
  completedAt?: string;
}

// ============================================================================
// CONTENT CALENDAR (Phase 28)
// ============================================================================

export interface ContentCalendarItem {
  id: string;
  assetId: string;
  projectId: string;
  platform: SupportedPlatform;
  scheduledAt: string;
  status: 'idea' | 'draft' | 'ready' | 'scheduled' | 'publishing' | 'published' | 'failed';
  campaign?: string;
  pillar?: string;
  notes?: string;
  publicationReferenceId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SEARCH & QUERY FILTERS (Phase 29 & 45)
// ============================================================================

export interface ContentLibraryFilter {
  query?: string;
  projectId?: string;
  platform?: SupportedPlatform;
  contentType?: ContentType;
  status?: AssetStatus;
  pillar?: string;
  minScore?: number;
  maxDuration?: number;
  hasRenderedVideo?: boolean;
}
