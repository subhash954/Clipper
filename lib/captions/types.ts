import { SubtitleStyle, SubtitleLanguage, TranscriptTimingPrecision } from '../types';

export interface CaptionWord {
  id?: string;
  cueId?: string;
  trackId?: string;
  wordIndex: number;
  word: string;
  start: number; // in seconds (absolute media time)
  end: number;   // in seconds (absolute media time)
  confidence?: number; // 0.0 - 1.0 (optional when uncalibrated)
  speaker?: number;
  highlighted?: boolean;
  emphasisStyle?: 'highlight_yellow' | 'highlight_red' | 'box_badge' | 'enlarge' | 'uppercase';
}

export type CaptionEmphasisStyle = 'highlight_yellow' | 'highlight_red' | 'box_badge' | 'enlarge' | 'uppercase';

export interface CaptionCue {
  id: string;
  trackId?: string;
  transcriptId?: string;
  projectId: string;
  sequence: number; // 1-based monotonic integer
  start: number;    // in seconds (absolute media time)
  end: number;      // in seconds (absolute media time)
  text: string;
  words: CaptionWord[];
  speakerId?: string | number;
  emphasis?: CaptionEmphasisStyle;
  style?: Partial<SubtitleStyle>;
  language: SubtitleLanguage;
  translatedText?: string;
  timingPrecision: TranscriptTimingPrecision;
  source: 'generated' | 'edited' | 'imported';
  createdAt: string;
  updatedAt: string;
}

export interface CaptionTrack {
  id: string;
  projectId: string;
  transcriptId?: string;
  mediaAssetId?: string;
  userId?: string;
  language: SubtitleLanguage;
  version: number;
  source: 'generated' | 'edited' | 'imported';
  status: 'ready' | 'processing' | 'failed';
  style?: SubtitleStyle;
  cues: CaptionCue[];
  cuesCount: number;
  durationSeconds: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CaptionSegmentationConfig {
  maxWordsPerCue?: number;          // Maximum words in a single cue (default: 6)
  minWordsPerCue?: number;          // Minimum words before allowing punctuation split (default: 1)
  maxCharsPerLine?: number;         // Maximum characters per line (default: 38)
  maxLinesPerCue?: number;          // Maximum lines per cue (default: 2)
  maxCueDurationSeconds?: number;   // Maximum duration of a cue in seconds (default: 3.5)
  minCueDurationSeconds?: number;   // Minimum duration of a cue in seconds (default: 0.6)
  maxCps?: number;                  // Maximum characters per second reading speed (default: 22)
  minGapBetweenCuesSeconds?: number;// Minimum gap between consecutive cues (default: 0.05)
  pauseThresholdSeconds?: number;   // Gap between words in seconds to force cue boundary (default: 0.35)
  respectSpeakerChanges?: boolean;  // Force cue break on speaker change (default: true)
  respectPunctuation?: boolean;     // Break on terminal punctuation (default: true)
}

export const DEFAULT_SEGMENTATION_CONFIG: Required<CaptionSegmentationConfig> = {
  maxWordsPerCue: 6,
  minWordsPerCue: 1,
  maxCharsPerLine: 38,
  maxLinesPerCue: 2,
  maxCueDurationSeconds: 3.5,
  minCueDurationSeconds: 0.6,
  maxCps: 22,
  minGapBetweenCuesSeconds: 0.05,
  pauseThresholdSeconds: 0.35,
  respectSpeakerChanges: true,
  respectPunctuation: true,
};

export type CaptionFormat = 'srt' | 'vtt' | 'ass';
