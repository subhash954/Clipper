/**
 * Reframe & Subject Tracking Data Models
 */

export const MAX_REFRAME_MEDIA_BYTES = 500 * 1024 * 1024; // 500 MB = 524,288,000 bytes

export type AspectRatio = '9:16' | '1:1' | '16:9' | '4:5';

export type TrackingMode = 'center' | 'smart' | 'manual';

export interface BoundingBox {
  x: number;      // normalized left (0.0 to 1.0)
  y: number;      // normalized top (0.0 to 1.0)
  width: number;  // normalized width (0.0 to 1.0)
  height: number; // normalized height (0.0 to 1.0)
}

export interface DetectedSubject {
  time: number;          // timestamp in seconds
  x: number;             // normalized center X (0.0 to 1.0)
  y: number;             // normalized center Y (0.0 to 1.0)
  width: number;         // normalized bbox width
  height: number;        // normalized bbox height
  confidence: number;    // 0.0 to 1.0
  subjectType: 'face' | 'person' | 'centroid' | 'fallback';
}

export interface ReframeKeyframe {
  time: number;          // seconds relative to clip start
  x: number;             // normalized center X (0.0 to 1.0)
  y: number;             // normalized center Y (0.0 to 1.0)
  scale: number;         // zoom factor (>= 1.0)
  confidence: number;    // 0.0 to 1.0
  sourceBbox?: BoundingBox;
  isFallback?: boolean;
  timestamp?: number;
  centerX?: number;
  centerY?: number;
  width?: number;
  height?: number;
  sceneIndex?: number;
}

export interface ManualReframeSettings {
  x: number;    // 0.0 to 1.0 (default: 0.5)
  y: number;    // 0.0 to 1.0 (default: 0.5)
  zoom: number; // 1.0 to 2.5 (default: 1.0)
}

export interface ReframeTrack {
  id: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  aspectRatio: AspectRatio;
  trackingMode: TrackingMode;
  keyframes: ReframeKeyframe[];
  manualSettings?: ManualReframeSettings;
  locked?: boolean;
  focalPoint?: { x: number; y: number };
  version: string;
  createdAt: string;
}

export interface AspectRatioDimensions {
  targetWidth: number;
  targetHeight: number;
  aspectRatio: AspectRatio;
}

export const ASPECT_RATIO_CONFIGS: Record<AspectRatio, { width: number; height: number; ratio: number; label: string }> = {
  '9:16': { width: 1080, height: 1920, ratio: 9 / 16, label: '9:16 Shorts / Reels' },
  '1:1': { width: 1080, height: 1080, ratio: 1.0, label: '1:1 Square Feed' },
  '16:9': { width: 1920, height: 1080, ratio: 16 / 9, label: '16:9 Landscape' },
  '4:5': { width: 1080, height: 1350, ratio: 4 / 5, label: '4:5 Social Portrait' },
};
export const CANONICAL_ASPECT_RATIOS: readonly AspectRatio[] = ['16:9', '9:16', '1:1', '4:5'] as const;

export type MultiPersonMode = 'SINGLE' | 'DUAL' | 'GROUP' | 'GENERAL';

export interface SubjectDetection {
  timestamp: number;          // seconds relative to media start
  x: number;                  // normalized center X (0.0 to 1.0)
  y: number;                  // normalized center Y (0.0 to 1.0)
  width: number;              // normalized bbox width (0.0 to 1.0)
  height: number;             // normalized bbox height (0.0 to 1.0)
  confidence: number;         // 0.0 to 1.0
  subjectType?: 'face' | 'person' | 'object' | 'centroid' | 'fallback';
  subjectId?: string;         // persistent identifier across frames when available
}

export interface SceneBoundary {
  sceneIndex: number;
  start: number;              // seconds
  end: number;                // seconds
  cutConfidence?: number;     // 0.0 to 1.0
}

export interface SubjectTrack {
  trackId: string;
  subjectId?: string;
  label?: string;
  subjectType?: 'face' | 'person' | 'object' | 'centroid' | 'fallback';
  start: number;              // seconds
  end: number;                // seconds
  averageConfidence: number;
  detections: SubjectDetection[];
}

export interface ReframeConfig {
  id: string;
  projectId: string;
  targetAspectRatio: AspectRatio;
  trackingMode: TrackingMode;
  multiPersonMode: MultiPersonMode;
  manualSettings?: ManualReframeSettings;
  smoothingAlpha?: number;    // default 0.25
  deadZone?: number;          // default 0.035
  headroom?: number;          // normalized anchor from top (default 0.35)
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReframeAnalysisMetadata {
  engineVersion: string;
  analysisSchemaVersion: string;
  detectorProvider: string;
  detectorMode: 'ml-vision' | 'heuristic' | 'fixture' | 'hybrid';
  capabilities?: string[];
  degraded: boolean;
  fallbackReason?: string;
  providersUsed?: string[];
  fallbackEvents?: Array<{
    timestamp?: number;
    fromProvider: string;
    toProvider: string;
    reason: string;
  }>;
  sceneDetection?: {
    status: 'normal' | 'degraded';
    reason?: string;
    fallback?: string;
  };
  configVersion?: number;
}

export interface ReframeAnalysis {
  id: string;
  projectId: string;
  mediaAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  duration: number;
  scenes: SceneBoundary[];
  subjectTracks: SubjectTrack[];
  provider: string;           // 'gemini-vision' | 'local-centroid' | 'fixture' | 'hybrid'
  version: string;
  createdAt: string;
  metadata?: ReframeAnalysisMetadata;
  degraded?: boolean;
}

export interface CameraPath {
  targetAspectRatio: AspectRatio;
  cropWidth: number;
  cropHeight: number;
  targetWidth: number;
  targetHeight: number;
  multiPersonMode: MultiPersonMode;
  keyframes: ReframeKeyframe[];
  version: number;
}

