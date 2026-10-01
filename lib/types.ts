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

export interface Transcript {
  text: string;
  words: WordTimestamp[];
  utterances?: TranscriptUtterance[];
  language?: string;
  source: 'deepgram' | 'youtube_captions' | 'user_upload';
}

export interface ViralScoreBreakdown {
  hook: number;         // 0-100: opening retention spike
  curiosity: number;    // 0-100: contrarian angle, unanswered question
  value: number;        // 0-100: actionable takeaway / framework
  emotion: number;      // 0-100: vocal energy & conviction
  standalone: number;   // 0-100: clarity without surrounding context
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
  words: WordTimestamp[];
  tags?: string[];
  hookStrength?: number;
  retentionEstimate?: number;
  energyLevel?: 'Medium' | 'High' | 'Extreme';
  thumbnailUrl?: string;
  videoUrl?: string;
  bRollKeywords?: string[];
  soundEffects?: string[];
  aiImagePrompt?: string;
  youtubeScheduleTime?: string;
}

export type ProjectStatus = 
  | 'created' 
  | 'ingesting' 
  | 'transcribing' 
  | 'analyzing' 
  | 'clips_ready' 
  | 'rendering' 
  | 'completed' 
  | 'failed';

export interface CostTelemetryRecord {
  id?: string;
  projectId?: string;
  serviceName: 'deepgram_stt' | 'gemini_flash' | 'pexels_broll' | 'pixabay_broll' | 'ffmpeg_render' | 'flux_image' | 'r2_storage';
  model?: string;
  unitsUsed: number;
  unitType: 'minutes' | 'tokens' | 'renders' | 'requests';
  costInUSD: number;
  isEstimated: boolean;
  createdAt?: string;
}

export interface Project {
  id: string;
  userId?: string;
  title: string;
  channelName?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  sourceType: 'youtube' | 'upload' | 'script';
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

export type SubtitlePreset = 'hormozi' | 'beast' | 'minimal' | 'neon';
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
}

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
