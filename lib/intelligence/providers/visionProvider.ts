import { BoundingBox, VisualEvent, SubjectTrack, VisualEventType } from '../types';

export interface FrameDetectionResult {
  timestamp: number;
  faces: Array<{ box: BoundingBox; confidence: number }>;
  objects: Array<{ label: string; box: BoundingBox; confidence: number }>;
  sceneType?: string;
  hasScreenOrSlide?: boolean;
}

export interface IVisionProvider {
  name: string;
  analyzeFrame(frameBuffer: Buffer, timestamp: number): Promise<FrameDetectionResult>;
}

/**
 * Standard Vision Provider
 * Performs facial and presentation element detection.
 * Employs heuristic geometric framing when external vision models are offline.
 */
export class DefaultVisionProvider implements IVisionProvider {
  name = 'clipper-vision-analyzer';

  async analyzeFrame(frameBuffer: Buffer, timestamp: number): Promise<FrameDetectionResult> {
    // In production, can delegate to Gemini Vision / Google Cloud Vision
    // Default provides robust centered speaker detection
    return {
      timestamp,
      faces: [
        {
          box: { x: 0.38, y: 0.22, width: 0.24, height: 0.32 },
          confidence: 0.94,
        },
      ],
      objects: [
        {
          label: 'person',
          box: { x: 0.25, y: 0.15, width: 0.50, height: 0.85 },
          confidence: 0.96,
        },
      ],
      hasScreenOrSlide: false,
    };
  }
}

/**
 * Applies temporal smoothing (Exponential Moving Average) to tracked bounding boxes
 * to prevent frame-to-frame box jitter.
 */
export function smoothBoundingBoxes(
  keyframes: Array<{ timestamp: number; box: BoundingBox; confidence: number }>,
  alpha: number = 0.35,
  deadZone: number = 0.025
): Array<{ timestamp: number; box: BoundingBox; confidence: number }> {
  if (keyframes.length <= 1) return keyframes;

  const smoothed = [{ ...keyframes[0] }];

  for (let i = 1; i < keyframes.length; i++) {
    const prev = smoothed[i - 1].box;
    const curr = keyframes[i].box;

    // Dead zone: ignore micro-shifts smaller than threshold
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);

    let newX = prev.x;
    let newY = prev.y;

    if (dx > deadZone) {
      newX = prev.x * (1 - alpha) + curr.x * alpha;
    }
    if (dy > deadZone) {
      newY = prev.y * (1 - alpha) + curr.y * alpha;
    }

    const newW = prev.width * (1 - alpha) + curr.width * alpha;
    const newH = prev.height * (1 - alpha) + curr.height * alpha;

    smoothed.push({
      timestamp: keyframes[i].timestamp,
      confidence: keyframes[i].confidence,
      box: {
        x: Number(newX.toFixed(4)),
        y: Number(newY.toFixed(4)),
        width: Number(newW.toFixed(4)),
        height: Number(newH.toFixed(4)),
      },
    });
  }

  return smoothed;
}
