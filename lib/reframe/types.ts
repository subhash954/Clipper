/**
 * Reframe & Subject Tracking Data Models
 */

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
