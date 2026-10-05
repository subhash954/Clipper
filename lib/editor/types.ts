import { AspectRatio, TrackingMode, ReframeTrack } from '../reframe/types';
import { SubtitleStyle, MediaAsset } from '../types';
import { CaptionCue } from '../captions/types';

export type TrackType =
  | 'VIDEO'
  | 'BROLL'
  | 'IMAGE'
  | 'CAPTION'
  | 'VOICE'
  | 'MUSIC'
  | 'SFX'
  | 'OVERLAY';

export type TransitionType = 'cut' | 'fade' | 'crossfade' | 'slide' | 'zoom';

export interface TimelineTransition {
  type: TransitionType;
  durationSeconds: number;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  trackType: TrackType;
  title: string;
  start: number; // Position on timeline in seconds
  end: number; // Timeline end in seconds
  sourceStart: number; // In-point in source asset
  sourceEnd: number; // Out-point in source asset
  sourceUrl?: string;
  mediaAssetId?: string;
  volume?: number; // 0.0 to 1.0
  opacity?: number; // 0.0 to 1.0
  isMuted?: boolean;
  isDisabled?: boolean;
  isLocked?: boolean;
  layout?: {
    x: number; // 0.0 - 1.0 relative
    y: number; // 0.0 - 1.0 relative
    width: number;
    height: number;
    fit: 'cover' | 'contain' | 'pip' | 'fullscreen';
    roundedCorners?: number;
    shadow?: boolean;
  };
  transitionIn?: TimelineTransition;
  transitionOut?: TimelineTransition;
  payload?: any;
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  name: string;
  order: number;
  isMuted: boolean;
  isSolo: boolean;
  isLocked: boolean;
  clips: TimelineClip[];
}

export interface AudioMixSettings {
  masterVolume: number; // 0 to 1
  studioCleanEnabled: boolean;
  loudnormEnabled: boolean;
  targetLufs: number; // -14 for TikTok/Reels/Shorts
  smartDucking: {
    enabled: boolean;
    duckAmountDb: number; // -12dB standard
    attackMs: number;
    releaseMs: number;
  };
}

export interface TextOverlaySpec {
  id: string;
  type: 'title' | 'subtitle' | 'lower_third' | 'callout' | 'cta' | 'stat_badge';
  text: string;
  start: number;
  end: number;
  x: number; // relative 0-1
  y: number; // relative 0-1
  fontSize: number;
  textColor: string;
  backgroundColor?: string;
  animation?: 'fade' | 'pop' | 'slide_up' | 'none';
}

export interface ImageOverlaySpec {
  id: string;
  url: string;
  start: number;
  end: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

export interface ExportSettings {
  resolution: '1080p' | '720p' | '4k';
  targetWidth: number;
  targetHeight: number;
  fps: 30 | 60;
  codec: 'h264' | 'hevc';
  bitrateKbps: number;
  captionBurnIn: boolean;
  filename: string;
  preset: 'Shorts' | 'Reels' | 'TikTok' | 'Landscape' | 'Square';
}

/**
 * CANONICAL RENDERSPEC (Phase 2)
 * Single authoritative specification that drives Canvas preview, Studio Timeline,
 * and Native FFmpeg rendering.
 */
export interface CanonicalRenderSpec {
  id: string;
  projectId: string;
  version: number;
  sourceAsset: {
    url: string;
    duration: number;
    width: number;
    height: number;
    fps?: number;
    id?: string;
  };
  duration: number;
  canvas: {
    aspectRatio: AspectRatio;
    width: number;
    height: number;
    backgroundColor: string;
  };
  tracks: TimelineTrack[];
  cuts: Array<{
    id: string;
    type: 'silence' | 'filler' | 'manual';
    start: number;
    end: number;
    reason?: string;
  }>;
  captions: {
    enabled: boolean;
    style: SubtitleStyle;
    safeAreaEnabled: boolean;
    trackId?: string;
    cues?: CaptionCue[];
    words: Array<{
      word: string;
      start: number;
      end: number;
      highlighted?: boolean;
      emphasisStyle?: 'highlight_yellow' | 'highlight_red' | 'box_badge';
    }>;
  };
  reframe: {
    mode: TrackingMode;
    track?: ReframeTrack;
    safeMargins: boolean;
    multiSpeakerMode?: 'single' | 'active_speaker' | 'two_shot_split' | 'wide';
  };
  audioMix: AudioMixSettings;
  textOverlays: TextOverlaySpec[];
  imageOverlays: ImageOverlaySpec[];
  exportSettings: ExportSettings;
  createdAt: string;
  updatedAt: string;
}

export type EditorCommandType =
  | 'TRIM_CLIP'
  | 'SPLIT_CLIP'
  | 'DELETE_CLIP'
  | 'MOVE_CLIP'
  | 'ADD_CLIP'
  | 'ADD_CAPTION'
  | 'CHANGE_CAPTION_STYLE'
  | 'DYNAMIC_CAPTIONS'
  | 'ADD_BROLL'
  | 'REMOVE_BROLL'
  | 'CHANGE_REFRAME'
  | 'CHANGE_AUDIO'
  | 'REMOVE_SILENCE'
  | 'SET_ASPECT_RATIO';

export interface EditorCommand {
  id: string;
  type: EditorCommandType;
  description: string;
  execute: (spec: CanonicalRenderSpec) => CanonicalRenderSpec;
  undo: (spec: CanonicalRenderSpec) => CanonicalRenderSpec;
  timestamp: string;
}

export interface StudioVersionSnapshot {
  id: string;
  versionNumber: number;
  description: string;
  renderSpec: CanonicalRenderSpec;
  createdAt: string;
  createdBy: string;
}

export interface StudioEditorState {
  currentTime: number;
  isPlaying: boolean;
  zoomLevel: number;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  markIn: number | null;
  markOut: number | null;
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string | null;
  historyIndex: number;
}
