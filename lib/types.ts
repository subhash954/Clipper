export interface WordTimestamp {
  word: string;
  start: number; // in seconds (absolute media time)
  end: number;   // in seconds (absolute media time)
  confidence?: number;
  speaker?: number;
}

export interface TranscriptUtterance {
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
  speaker?: number;
}

export type TranscriptTimingPrecision = 'exact_word' | 'approximate_cue';

export interface Transcript {
  text: string;
  words: WordTimestamp[];
  utterances?: TranscriptUtterance[];
  language?: string;
  source: 'deepgram' | 'youtube_captions' | 'user_upload';
  timingPrecision?: TranscriptTimingPrecision;
  timingLabel?: string;
}

export interface ViralScoreBreakdown {
  hook: number;         // 0-100: opening retention spike
  curiosity: number;    // 0-100: contrarian angle, unanswered question
  value: number;        // 0-100: actionable takeaway / framework
  emotion: number;      // 0-100: vocal energy & conviction
  standalone: number;   // 0-100: clarity without surrounding context
}

export type ClipAlignmentStatus = 'verified' | 'approximate' | 'needs_review' | 'rejected';
export type ClipQualityStatus = 'candidate' | 'aligned' | 'verified' | 'editing' | 'rendering' | 'rendered' | 'published' | 'rejected' | 'needs_review';

export interface EditOperation {
  id: string;
  type: 'CUT' | 'KEEP' | 'TRIM' | 'CAPTION' | 'BROLL' | 'ZOOM' | 'TRANSITION' | 'MUSIC' | 'SFX' | 'OVERLAY';
  start: number;
  end: number;
  reason?: 'filler' | 'silence' | 'manual_cut' | 'trim';
  confidence?: number;
  enabled: boolean;
  word?: string;
  label?: string;
  mediaUrl?: string;
}

export interface ViralClip {
  id: string;
  rank?: number;
  title: string;
  hookSummary: string;
  importantLine: string;
  whyThisLineIsImportant: string;
  keyMomentType: string;
  start: number;        // in seconds (absolute media time)
  end: number;          // in seconds (absolute media time)
  duration: number;     // in seconds
  viralScore: number;   // 0 to 100 (weighted AI editorial score)
  scoreBreakdown?: ViralScoreBreakdown;
  confidence?: number;  // 0.0 to 1.0
  alignmentStatus?: ClipAlignmentStatus;
  alignmentConfidence?: number;
  qualityStatus?: ClipQualityStatus;
  words: WordTimestamp[];
  tags?: string[];
  hookStrength?: number;
  retentionEstimate?: number; // Labeled in UI as "Predicted Retention Potential"
  energyLevel?: 'Medium' | 'High' | 'Extreme';
  thumbnailUrl?: string;
  videoUrl?: string;
  bRollKeywords?: string[];
  soundEffects?: string[];
  aiImagePrompt?: string;
  youtubeScheduleTime?: string;
  cuts?: EditOperation[];
}

export type ProjectStatus = 
  | 'created' 
  | 'ingesting' 
  | 'media_ready'
  | 'transcribing' 
  | 'transcript_ready'
  | 'analyzing' 
  | 'clips_ready' 
  | 'editing'
  | 'render_queued'
  | 'rendering' 
  | 'completed' 
  | 'export_ready'
  | 'failed';

export interface CostTelemetryRecord {
  id?: string;
  projectId?: string;
  userId?: string;
  serviceName: 'deepgram_stt' | 'gemini_flash' | 'pexels_broll' | 'pixabay_broll' | 'ffmpeg_render' | 'flux_image' | 'r2_storage';
  model?: string;
  unitsUsed: number;
  unitType: 'minutes' | 'tokens' | 'renders' | 'requests';
  costInUSD: number;
  isEstimated: boolean;
  currency?: string;
  requestId?: string;
  createdAt?: string;
}

export interface ProjectMedia {
  sourceUrl?: string;
  sourceType: 'youtube' | 'upload' | 'sample';
  sourceMetadata?: {
    title?: string;
    duration?: number;
    author?: string;
    thumbnail?: string;
  };
  mediaSourceUrl?: string;
  isMediaAvailable: boolean;
}

export interface Project {
  id: string; // RFC 4122 UUID
  userId?: string;
  workspaceId?: string;
  title: string;
  channelName?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  sourceType: 'youtube' | 'upload' | 'script';
  sourceExternalId?: string; // YouTube Video ID, TikTok ID, or external file ID
  media?: ProjectMedia;
  isMediaAvailable?: boolean;
  workflowType: 'youtube_to_shorts' | 'one_finger_reel' | 'ai_documentary';
  durationSeconds: number;
  status: ProjectStatus;
  errorMessage?: string;
  clipsCount?: number;
  clips: ViralClip[];
  transcript?: Transcript;
  costTelemetry?: CostTelemetryRecord[];
  costs?: {
    deepgramSTTCost: number;
    geminiFlashLLMCost: number;
    stockBRollCost: number;
    fluxImageGenCost: number;
    ffmpegRenderCost: number;
    r2StorageCost: number;
    totalCostUSD: number;
    totalCostINR: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  projectId?: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  audioCodec?: string;
  fps?: number;
  createdAt: string;
}

export interface TimelineVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  renderSpec: RenderSpec;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface PlatformIntegration {
  id: string;
  userId: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  accountName?: string;
  channelId?: string;
  status: 'connected' | 'expired' | 'disconnected';
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
}

export type RenderJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface RenderJob {
  id: string;
  projectId?: string;
  clipId?: string;
  userId?: string;
  status: RenderJobStatus;
  progress: number; // 0 to 100
  currentStage: string;
  inputUrl: string;
  outputUrl?: string;
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
  heartbeatAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface BrollAsset {
  provider: 'pexels' | 'pixabay' | 'curated';
  assetId: string | number;
  sourceUrl: string;
  licenseUrl: string;
  previewUrl: string;
  downloadUrl: string;
  orientation: 'portrait' | 'landscape';
  duration?: number;
  width?: number;
  height?: number;
}

// Original Clipper & Modern Creator Caption Presets
export type SubtitlePreset = 
  | 'signal' 
  | 'punch' 
  | 'minimal' 
  | 'focus' 
  | 'studio' 
  | 'kinetic' 
  | 'mono' 
  | 'highlight' 
  | 'impact' 
  | 'pulse' 
  | 'clean' 
  | 'bold' 
  | 'neon'
  | 'kendrick'
  | 'hormozi'
  | 'adrian'
  | 'nora'
  | 'benie'
  | 'dan'
  | 'beast'
  | 'ella';

export type SubtitleLanguage = 'en' | 'hi' | 'es' | 'fr' | 'de';

export interface SubtitleStyle {
  preset: SubtitlePreset;
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  position: 'bottom' | 'middle' | 'top';
  uppercase: boolean;
  showEmojis: boolean;
  animation: 'pop' | 'glow' | 'bounce' | 'karaoke';
  language: SubtitleLanguage;
  showDualLanguage: boolean;
  translatedText?: string;
  enableSFX: boolean;
  badgeColor?: string;
  badgeTextColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
}

import { AspectRatio, TrackingMode, ManualReframeSettings, ReframeTrack } from './reframe/types';
export type { AspectRatio, TrackingMode, ManualReframeSettings, ReframeTrack };

export interface VisualLayoutSettings {
  splitScreenEnabled: boolean;
  satisfyingVideoType: 'subway' | 'minecraft' | 'gta' | 'none';
  showProgressBar: boolean;
  progressBarColor: string;
  progressBarHeight: number;
  showCustomLogo: boolean;
  customLogoText: string;
  logoPosition: 'top-right' | 'top-left' | 'bottom-right';
  showIntroHook: boolean;
  introHookText: string;
  backgroundBlur: boolean;
  aspectRatio?: AspectRatio;
  trackingMode?: TrackingMode;
  manualPosition?: ManualReframeSettings;
  lockFraming?: boolean;
  reframeTrack?: ReframeTrack;
  autoZoomsEnabled?: boolean;
  autoBrollEnabled?: boolean;
  removeSilencesEnabled?: boolean;
  cleanAudioEnabled?: boolean;
  removeBadTakesEnabled?: boolean;
  correctEyeContactEnabled?: boolean;
}

export interface AudioStudioSettings {
  studioSoundEnabled: boolean;
  backgroundMusicEnabled: boolean;
  musicTrack: 'lofi' | 'phonk' | 'cinematic' | 'synthwave';
  musicVolume: number; // 0 to 1
  autoDucking: boolean;
  dubbingEnabled: boolean;
  dubbingLanguage: SubtitleLanguage;
  volumeNormalization: boolean;
}

export interface SocialPublishSettings {
  accounts: {
    tiktok: boolean;
    youtubeShorts: boolean;
    instagramReels: boolean;
  };
  scheduledTime: string;
  viralTitle: string;
  viralDescription: string;
  hashtags: string[];
}

export interface AgencySettings {
  workspaceName: string;
  clientName: string;
  whiteLabelEnabled: boolean;
  affiliateEarnings: number;
  referralCode: string;
  referralCount: number;
}

/**
 * Canonical Render Specification
 * Shared between HTML5/Canvas preview and FFmpeg video compositing.
 */
export interface RenderSpec {
  crop: {
    aspectRatio: AspectRatio;
    targetWidth: number;
    targetHeight: number;
  };
  captions: SubtitleStyle;
  cuts: EditOperation[];
  audio: AudioStudioSettings;
  visual: VisualLayoutSettings;
  reframe?: ReframeTrack;
  broll?: EditOperation[];
}
