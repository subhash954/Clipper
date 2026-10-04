/**
 * CLIPPER MULTIMODAL CONTENT INTELLIGENCE ENGINE — CANONICAL DATA MODELS
 * Strongly typed schemas for Phase 1 - Phase 28
 */

export interface IntelligenceItemMetadata {
  id: string;
  projectId: string;
  source: 'audio' | 'video' | 'transcript' | 'multimodal' | 'ai_editorial';
  start: number;
  end: number;
  confidence?: number; // 0.0 - 1.0 (optional when uncalibrated)
  evidence?: string;
  createdAt: string;
  providerMetadata?: {
    provider: string;
    model: string;
    latencyMs?: number;
    tokensUsed?: number;
    requestId?: string;
  };
}

// -------------------------------------------------------------
// TRANSCRIPT & SEMANTIC INTELLIGENCE (Phase 1 & Phase 2)
// -------------------------------------------------------------

export type SemanticSegmentType =
  | 'claim'
  | 'contrarian_statement'
  | 'core_framework'
  | 'actionable_advice'
  | 'statistic'
  | 'surprising_fact'
  | 'story'
  | 'analogy'
  | 'example'
  | 'question'
  | 'answer'
  | 'emotional_statement'
  | 'punchline'
  | 'conclusion'
  | 'general_statement';

export interface SemanticSegment extends IntelligenceItemMetadata {
  text: string;
  speakerId: string;
  topic: string;
  subtopic: string;
  segmentType: SemanticSegmentType;
  importance: number; // 0 - 100
  wordsCount: number;
}

// -------------------------------------------------------------
// SPEAKER INTELLIGENCE (Phase 3)
// -------------------------------------------------------------

export interface SpeakerSegment {
  speakerId: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface DialogueExchange {
  id: string;
  questionSpeakerId: string;
  answerSpeakerId: string;
  questionStart: number;
  questionEnd: number;
  answerStart: number;
  answerEnd: number;
  topic: string;
}

export interface SpeakerProfile {
  speakerId: string;
  displayLabel: string;
  totalSpeakingTimeSeconds: number;
  segmentsCount: number;
  dominantSpeakingRateWpm: number;
  confidence: number;
  detectedInterruptionCount: number;
}

// -------------------------------------------------------------
// SCENE & VISUAL INTELLIGENCE (Phase 4 & Phase 5)
// -------------------------------------------------------------

export type SceneType =
  | 'talking_head'
  | 'two_shot'
  | 'wide_shot'
  | 'presentation_slide'
  | 'screen_share'
  | 'whiteboard'
  | 'product_demo'
  | 'b_roll_scenery'
  | 'hard_cut'
  | 'environment_change';

export type MotionLevel = 'static' | 'low' | 'medium' | 'high';

export interface Scene extends IntelligenceItemMetadata {
  sceneType: SceneType;
  visualSummary: string;
  dominantObjects: string[];
  dominantFacesCount: number;
  dominantColors: string[];
  motionLevel: MotionLevel;
  cutIntensityScore?: number; // 0.0 - 1.0 (from FFmpeg scene score when available)
}

export type VisualEventType =
  | 'person_appears'
  | 'person_disappears'
  | 'face_appears'
  | 'screen_appears'
  | 'phone_appears'
  | 'laptop_appears'
  | 'product_appears'
  | 'text_appears'
  | 'chart_appears'
  | 'slide_appears'
  | 'camera_angle_changed'
  | 'visual_emphasis_shift';

export interface BoundingBox {
  x: number; // 0.0 - 1.0 relative
  y: number; // 0.0 - 1.0 relative
  width: number; // 0.0 - 1.0 relative
  height: number; // 0.0 - 1.0 relative
}

export interface VisualEvent extends IntelligenceItemMetadata {
  type: VisualEventType;
  boundingBox?: BoundingBox;
  sourceFrameTimestamp?: number;
  description: string;
}

// -------------------------------------------------------------
// FACE + SUBJECT TRACKING & ACTIVE SPEAKER (Phase 6 & Phase 7)
// -------------------------------------------------------------

export interface TrackedBoundingBox {
  timestamp: number;
  box: BoundingBox;
  confidence: number;
}

export interface SubjectTrack {
  subjectId: string;
  trackType: 'face' | 'person' | 'object' | 'screen';
  label?: string;
  start: number;
  end: number;
  averageConfidence: number;
  keyframes: TrackedBoundingBox[];
}

export interface ActiveSpeakerEvent extends IntelligenceItemMetadata {
  speakerId: string;
  subjectId?: string;
  faceBoundingBox?: BoundingBox;
  speakingConfidence: number;
}

// -------------------------------------------------------------
// AUDIO INTELLIGENCE (Phase 8)
// -------------------------------------------------------------

export type AudioEventType =
  | 'high_vocal_energy'
  | 'speech_burst'
  | 'extended_silence'
  | 'laughter'
  | 'music_detected'
  | 'vocal_pause'
  | 'abrupt_silence';

export interface AudioMetrics {
  integratedLufs: number; // EBU R128 integrated loudness
  loudnessRangeLra: number;
  peakDbfs: number;
  rmsDbfs: number;
  averageSpeechDensity: number; // 0.0 - 1.0
  wordsPerSecond: number;
  silenceCount: number;
  totalSilenceDurationSeconds: number;
}

export interface AudioEvent extends IntelligenceItemMetadata {
  type: AudioEventType;
  intensity: number; // 0.0 - 1.0
  measuredLufs?: number;
  description: string;
}

// -------------------------------------------------------------
// HOOKS & STORY STRUCTURE (Phase 9 & Phase 10)
// -------------------------------------------------------------

export type HookType =
  | 'Question'
  | 'Contrarian'
  | 'Curiosity'
  | 'Problem'
  | 'Promise'
  | 'Shock'
  | 'Story'
  | 'Statistic'
  | 'Transformation';

export interface HookCandidate extends IntelligenceItemMetadata {
  text: string;
  hookType: HookType;
  score: number; // 0 - 100
  pacingWps: number;
  curiosityGapExplanation: string;
}

export type StoryBeatType =
  | 'Hook'
  | 'Context'
  | 'Problem'
  | 'Tension'
  | 'Insight'
  | 'Example'
  | 'Proof'
  | 'Transformation'
  | 'Payoff'
  | 'Conclusion'
  | 'CTA';

export interface StoryBeat extends IntelligenceItemMetadata {
  type: StoryBeatType;
  summary: string;
  importance: number; // 0 - 100
}

export interface StoryArc {
  overallStructure: string;
  beats: StoryBeat[];
  narrativeClimaxTimestamp: number;
  primaryPayoffTimestamp: number;
  completenessScore: number; // 0 - 100
}

// -------------------------------------------------------------
// STANDALONE EVALUATION & BOUNDARIES (Phase 12 & Phase 13)
// -------------------------------------------------------------

export interface StandaloneEvaluation {
  contextRequired: boolean;
  contextScore: number; // 0 - 100
  standaloneScore: number; // 0 - 100
  payoffCompleteness: number; // 0 - 100
  danglingReferenceDetected?: string;
  recommendedAdjustment?: {
    action: 'none' | 'expand_backward' | 'expand_forward' | 'reject';
    adjustedStart?: number;
    adjustedEnd?: number;
    reason: string;
  };
}

export interface OptimizedBoundary {
  originalStart: number;
  originalEnd: number;
  recommendedStart: number;
  recommendedEnd: number;
  leadingPaddingSeconds: number;
  trailingPaddingSeconds: number;
  confidence: number;
  boundaryNotes: string[];
}

// -------------------------------------------------------------
// AI EDITORIAL SCORING (Phase 14)
// -------------------------------------------------------------

export interface EditorialDimensionScores {
  hookQuality: number; // 0 - 100
  curiosity: number; // 0 - 100
  standaloneValue: number; // 0 - 100
  conceptualIntensity: number; // 0 - 100
  informationDensity: number; // 0 - 100
  specificity: number; // 0 - 100
  novelty: number; // 0 - 100
  narrativeCompleteness: number; // 0 - 100
  payoffQuality: number; // 0 - 100
  visualPotential: number; // 0 - 100
  platformFit: number; // 0 - 100
}

export interface AIEditorialScore {
  overallScore: number; // 0 - 100
  dimensionScores: EditorialDimensionScores;
  label: 'AI EDITORIAL ANALYSIS';
  editorialSummary: string;
  confidence: number; // 0.0 - 1.0
}

// -------------------------------------------------------------
// QUALITY GATES & CANDIDATE CLIPS (Phase 11 & Phase 15)
// -------------------------------------------------------------

export type ClipQualityGateStatus = 'verified' | 'needs_review' | 'rejected';

export interface QualityGateAudit {
  status: ClipQualityGateStatus;
  passedGates: string[];
  failedGates: string[];
  reasons: string[];
}

export interface CandidateClip extends IntelligenceItemMetadata {
  title: string;
  transcript: string;
  words: Array<{ word: string; start: number; end: number; confidence?: number }>;
  hook: HookCandidate;
  payoff: {
    text: string;
    timestamp: number;
    summary: string;
  };
  context: {
    summary: string;
    needsExpansion: boolean;
  };
  editorialScore: AIEditorialScore;
  qualityGate: QualityGateAudit;
  standaloneEvaluation: StandaloneEvaluation;
  boundary: OptimizedBoundary;
  clusterId?: string;
  isPrimaryInCluster?: boolean;
}

// -------------------------------------------------------------
// OPPORTUNITIES, B-ROLL & CAPTIONS (Phase 17, 18, 19)
// -------------------------------------------------------------

export type VisualOpportunityType =
  | 'tech_graphic'
  | 'money_stat_graphic'
  | 'list_infographic'
  | 'visual_emphasis_zoom'
  | 'screen_callout'
  | 'quote_card';

export interface VisualOpportunity extends IntelligenceItemMetadata {
  type: VisualOpportunityType;
  keyword: string;
  reason: string;
  suggestedAssetPrompt?: string;
}

export interface BRollQuery extends IntelligenceItemMetadata {
  query: string;
  reason: string;
  visualType: 'cinematic_b_roll' | 'stock_footage' | 'motion_graphic' | 'reaction';
  targetDurationSeconds: number;
}

export interface CaptionEmphasis extends IntelligenceItemMetadata {
  text: string;
  style: 'highlight_yellow' | 'highlight_red' | 'enlarge' | 'box_badge' | 'uppercase';
  reason: string;
}

// -------------------------------------------------------------
// PACE & CLASSIFICATION & PLATFORM FIT (Phase 20, 21, 22)
// -------------------------------------------------------------

export interface EditorialPaceSegment extends IntelligenceItemMetadata {
  wordsPerSecond: number;
  averagePauseDurationSeconds: number;
  energyLevel: 'low' | 'normal' | 'high';
  pacingCategory: 'slow_deliberate' | 'balanced' | 'fast_urgent' | 'dense_framework';
}

export type ContentPrimaryType =
  | 'Podcast'
  | 'Interview'
  | 'Talking Head'
  | 'Tutorial'
  | 'Webinar'
  | 'Lecture'
  | 'Documentary'
  | 'Presentation'
  | 'Product Demo'
  | 'Story'
  | 'Debate'
  | 'Educational'
  | 'Motivational';

export interface ContentTypeClassification {
  primaryType: ContentPrimaryType;
  secondaryType?: string;
  confidence: number;
  detectedSignals: string[];
}

export type TargetSocialPlatform =
  | 'YouTube Shorts'
  | 'Instagram Reels'
  | 'TikTok'
  | 'LinkedIn'
  | 'X'
  | 'Facebook';

export interface PlatformFitAssessment {
  platform: TargetSocialPlatform;
  score: number; // 0 - 100
  suitability: 'exceptional' | 'good' | 'average' | 'poor';
  rationale: string[];
  recommendations: string[];
}

// -------------------------------------------------------------
// COST, OBSERVABILITY & CACHE (Phase 26, 27, 28)
// -------------------------------------------------------------

export interface ProviderUsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  imagesAnalyzed: number;
  audioDurationSeconds: number;
  latencyMs: number;
  requestId: string;
  costUsd: number;
  isEstimatedCost: boolean;
}

export interface FailureRecord {
  errorCode: string;
  errorMessage: string;
  provider: string;
  phase: string;
  retryable: boolean;
  attemptCount: number;
  timestamp: string;
}

// -------------------------------------------------------------
// CANONICAL INTELLIGENCE REPORT (Phase 1)
// -------------------------------------------------------------

export interface IntelligenceReport {
  id: string;
  projectId: string;
  analysisHash: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  classification: ContentTypeClassification;
  audioMetrics: AudioMetrics;
  speakers: SpeakerProfile[];
  dialogueExchanges: DialogueExchange[];
  scenes: Scene[];
  visualEvents: VisualEvent[];
  subjectTracks: SubjectTrack[];
  activeSpeakers: ActiveSpeakerEvent[];
  audioEvents: AudioEvent[];
  semanticSegments: SemanticSegment[];
  storyArc: StoryArc;
  candidateClips: CandidateClip[];
  visualOpportunities: VisualOpportunity[];
  bRollQueries: BRollQuery[];
  captionEmphases: CaptionEmphasis[];
  paceSegments: EditorialPaceSegment[];
  platformFit: Record<string, PlatformFitAssessment>;
  usageRecords: ProviderUsageRecord[];
  failures: FailureRecord[];
}
