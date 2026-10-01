export interface WordTimestamp {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface ViralClip {
  id: string;
  title: string;
  hookSummary: string;
  start: number; // in seconds
  end: number;   // in seconds
  viralScore: number; // 0 to 100
  tags: string[];
  hookStrength: number;
  retentionEstimate: number;
  energyLevel: 'Medium' | 'High' | 'Extreme';
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
  // Feature 10 & 11: Multi-language & Dual-language
  language: SubtitleLanguage;
  showDualLanguage: boolean;
  translatedText?: string;
  // Feature 9: Sound effects on keyword
  enableSFX: boolean;
}

export interface VisualLayoutSettings {
  // Feature 18: Split screen satisfying video
  splitScreenEnabled: boolean;
  satisfyingVideoType: 'subway' | 'minecraft' | 'gta' | 'none';
  // Feature 19: Dynamic progress bar
  showProgressBar: boolean;
  progressBarColor: string;
  progressBarHeight: number;
  // Feature 20: Custom logo watermark
  showCustomLogo: boolean;
  customLogoText: string;
  logoPosition: 'top-right' | 'top-left' | 'bottom-right';
  // Feature 22: Intro hook banner
  showIntroHook: boolean;
  introHookText: string;
  // Feature 21: Background blur
  backgroundBlur: boolean;
}

export interface AudioStudioSettings {
  // Feature 13: Studio noise cleaner
  studioSoundEnabled: boolean;
  // Feature 14: Trending background music with auto-ducking
  backgroundMusicEnabled: boolean;
  musicTrack: 'lofi' | 'phonk' | 'cinematic' | 'synthwave';
  musicVolume: number; // 0 to 1
  autoDucking: boolean;
  // Feature 15: AI Voice Dubbing
  dubbingEnabled: boolean;
  dubbingLanguage: SubtitleLanguage;
  // Feature 17: Audio normalization
  volumeNormalization: boolean;
}

export interface SocialPublishSettings {
  // Feature 23: 1-Click Auto Post
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
