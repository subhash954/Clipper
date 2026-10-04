/**
 * DETERMINISTIC CAMERA PATH & REFRAME PLANNER (Phase 6)
 * Generates smooth, safe, boundary-respecting camera keyframes for 16:9, 9:16, 1:1, and 4:5 targets.
 * Supports SINGLE, DUAL, GROUP, and GENERAL multi-person framing modes with scene cut re-anchoring.
 */

import {
  AspectRatio,
  MultiPersonMode,
  ReframeConfig,
  ReframeKeyframe,
  CameraPath,
  SubjectTrack,
  SubjectDetection,
  SceneBoundary,
  ASPECT_RATIO_CONFIGS,
} from './types';
import { calculateCropDimensions } from './reframeEngine';

export interface PlanOptions {
  sourceWidth: number;
  sourceHeight: number;
  duration: number;
  scenes?: SceneBoundary[];
  subjectTracks?: SubjectTrack[];
  config?: Partial<ReframeConfig>;
}

/**
 * Calculates focal center for a multi-person scene according to framing mode
 */
export function computeTargetFocalPoint(
  activeDetections: SubjectDetection[],
  mode: MultiPersonMode,
  cropWidthNorm: number,
  headroom = 0.35
): { x: number; y: number; scale: number; confidence: number } {
  if (activeDetections.length === 0) {
    return { x: 0.5, y: 0.5, scale: 1.0, confidence: 0.5 };
  }

  // Single person
  if (activeDetections.length === 1 || mode === 'SINGLE') {
    // Score subjects by confidence, area, and center proximity
    const sorted = [...activeDetections].sort((a, b) => {
      const scoreA = a.confidence * 2 + (a.width * a.height) - Math.abs(a.x - 0.5) * 0.5;
      const scoreB = b.confidence * 2 + (b.width * b.height) - Math.abs(b.x - 0.5) * 0.5;
      return scoreB - scoreA;
    });

    const primary = sorted[0];
    const adjustedY = Math.max(0.2, Math.min(0.8, primary.y - (primary.height * 0.1) + (headroom - 0.35)));

    return {
      x: primary.x,
      y: adjustedY,
      scale: 1.0,
      confidence: primary.confidence,
    };
  }

  // Dual speakers (Two shot)
  if (mode === 'DUAL' || activeDetections.length === 2) {
    const d1 = activeDetections[0];
    const d2 = activeDetections[1];

    const minX = Math.min(d1.x - d1.width / 2, d2.x - d2.width / 2);
    const maxX = Math.max(d1.x + d1.width / 2, d2.x + d2.width / 2);
    const spanWidth = maxX - minX;

    // Check if both fit comfortably inside crop window with 10% padding
    if (spanWidth <= cropWidthNorm * 0.9) {
      const midX = (minX + maxX) / 2;
      const midY = (d1.y + d2.y) / 2;
      return {
        x: midX,
        y: Math.max(0.25, Math.min(0.75, midY)),
        scale: 1.0,
        confidence: (d1.confidence + d2.confidence) / 2,
      };
    } else {
      // Span is too wide for single 9:16 crop without excessive framing
      // Deterministically select primary speaker based on confidence and area
      const primary = d1.confidence * d1.width * d1.height >= d2.confidence * d2.width * d2.height ? d1 : d2;
      return {
        x: primary.x,
        y: primary.y,
        scale: 1.0,
        confidence: primary.confidence,
      };
    }
  }

  // Group / Wide
  if (mode === 'GROUP' || activeDetections.length > 2) {
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    let sumConf = 0;

    for (const d of activeDetections) {
      minX = Math.min(minX, d.x - d.width / 2);
      maxX = Math.max(maxX, d.x + d.width / 2);
      minY = Math.min(minY, d.y - d.height / 2);
      maxY = Math.max(maxY, d.y + d.height / 2);
      sumConf += d.confidence;
    }

    const groupSpanW = maxX - minX;
    // Mild zoom out if needed, capped at 1.0
    const groupMidX = (minX + maxX) / 2;
    const groupMidY = (minY + maxY) / 2;

    return {
      x: Math.max(0.15, Math.min(0.85, groupMidX)),
      y: Math.max(0.2, Math.min(0.8, groupMidY)),
      scale: 1.0,
      confidence: sumConf / activeDetections.length,
    };
  }

  // General fallback
  return { x: 0.5, y: 0.5, scale: 1.0, confidence: 0.5 };
}

/**
 * Generates a complete CameraPath with scene boundary awareness, multi-person handling,
 * and temporal dead-zone smoothing.
 */
export function generateCameraPath(options: PlanOptions): CameraPath {
  const {
    sourceWidth,
    sourceHeight,
    duration,
    scenes = [{ sceneIndex: 0, start: 0, end: duration }],
    subjectTracks = [],
    config = {},
  } = options;

  const targetAspect: AspectRatio = config.targetAspectRatio || '9:16';
  const multiPersonMode: MultiPersonMode = config.multiPersonMode || 'GENERAL';
  const trackingMode = config.trackingMode || 'smart';
  const smoothingAlpha = config.smoothingAlpha ?? 0.25;
  const deadZone = config.deadZone ?? 0.035;
  const headroom = config.headroom ?? 0.35;

  const { cropWidth, cropHeight, targetWidth, targetHeight } = calculateCropDimensions(
    sourceWidth,
    sourceHeight,
    targetAspect
  );

  const cropWidthNorm = cropWidth / sourceWidth;
  const cropHeightNorm = cropHeight / sourceHeight;

  const defaultNormW = Math.round(cropWidthNorm * 10000) / 10000;
  const defaultNormH = Math.round(cropHeightNorm * 10000) / 10000;

  // Handle center or manual tracking modes directly
  if (trackingMode === 'center') {
    const keyframes: ReframeKeyframe[] = [
      { time: 0, x: 0.5, y: 0.5, scale: 1.0, confidence: 1.0, timestamp: 0, centerX: 0.5, centerY: 0.5, width: defaultNormW, height: defaultNormH, sceneIndex: 0 },
      { time: duration, x: 0.5, y: 0.5, scale: 1.0, confidence: 1.0, timestamp: duration, centerX: 0.5, centerY: 0.5, width: defaultNormW, height: defaultNormH, sceneIndex: 0 },
    ];
    return {
      targetAspectRatio: targetAspect,
      cropWidth,
      cropHeight,
      targetWidth,
      targetHeight,
      multiPersonMode,
      keyframes,
      version: 1,
    };
  }

  if (trackingMode === 'manual' && config.manualSettings) {
    const mx = config.manualSettings.x;
    const my = config.manualSettings.y;
    const mz = config.manualSettings.zoom;
    const keyframes: ReframeKeyframe[] = [
      {
        time: 0,
        x: mx,
        y: my,
        scale: mz,
        confidence: 1.0,
        timestamp: 0,
        centerX: mx,
        centerY: my,
        width: Math.round((cropWidthNorm / mz) * 10000) / 10000,
        height: Math.round((cropHeightNorm / mz) * 10000) / 10000,
        sceneIndex: 0,
      },
      {
        time: duration,
        x: mx,
        y: my,
        scale: mz,
        confidence: 1.0,
        timestamp: duration,
        centerX: mx,
        centerY: my,
        width: Math.round((cropWidthNorm / mz) * 10000) / 10000,
        height: Math.round((cropHeightNorm / mz) * 10000) / 10000,
        sceneIndex: 0,
      },
    ];
    return {
      targetAspectRatio: targetAspect,
      cropWidth,
      cropHeight,
      targetWidth,
      targetHeight,
      multiPersonMode,
      keyframes,
      version: 1,
    };
  }

  // Smart Mode: Assemble camera path per scene to enforce scene cut boundaries!
  const finalKeyframes: ReframeKeyframe[] = [];

  for (const scene of scenes) {
    const sceneStart = scene.start;
    const sceneEnd = Math.min(duration, scene.end);
    if (sceneEnd <= sceneStart) continue;

    // Collect all detections belonging to this scene
    const detectionsAtTimestamp = new Map<number, SubjectDetection[]>();

    for (const track of subjectTracks) {
      for (const d of track.detections) {
        if (d.timestamp >= sceneStart - 0.05 && d.timestamp <= sceneEnd + 0.05) {
          const tKey = Math.round(d.timestamp * 10) / 10;
          const existing = detectionsAtTimestamp.get(tKey) || [];
          existing.push(d);
          detectionsAtTimestamp.set(tKey, existing);
        }
      }
    }

    // Generate sample timestamps for this scene at 1 fps
    const timestamps: number[] = [];
    for (let t = sceneStart; t < sceneEnd; t += 1.0) {
      timestamps.push(Math.round(t * 10) / 10);
    }
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < sceneEnd - 0.2) {
      timestamps.push(Math.round(sceneEnd * 10) / 10);
    }

    // Generate raw keyframes for this scene
    const sceneRawKeyframes: ReframeKeyframe[] = [];

    for (const t of timestamps) {
      const active = detectionsAtTimestamp.get(t) || [];
      const focal = computeTargetFocalPoint(active, multiPersonMode, cropWidthNorm, headroom);

      // Clamp focal point so crop window stays inside source media frame
      const minNormX = cropWidthNorm / 2;
      const maxNormX = 1.0 - minNormX;
      const minNormY = cropHeightNorm / 2;
      const maxNormY = 1.0 - minNormY;

      const safeX = Math.max(minNormX, Math.min(maxNormX, focal.x));
      const safeY = Math.max(minNormY, Math.min(maxNormY, focal.y));

      sceneRawKeyframes.push({
        time: t,
        x: Math.round(safeX * 10000) / 10000,
        y: Math.round(safeY * 10000) / 10000,
        scale: focal.scale,
        confidence: Math.round(focal.confidence * 100) / 100,
      });
    }

    // Apply temporal EMA smoothing independently per scene
    if (sceneRawKeyframes.length > 0) {
      let currentX = sceneRawKeyframes[0].x;
      let currentY = sceneRawKeyframes[0].y;
      let currentScale = sceneRawKeyframes[0].scale;

      for (let i = 0; i < sceneRawKeyframes.length; i++) {
        const raw = sceneRawKeyframes[i];
        const diffX = raw.x - currentX;
        const diffY = raw.y - currentY;

        if (Math.abs(diffX) > deadZone) {
          currentX += diffX * smoothingAlpha;
        }
        if (Math.abs(diffY) > deadZone) {
          currentY += diffY * smoothingAlpha;
        }

        const diffScale = raw.scale - currentScale;
        currentScale += diffScale * smoothingAlpha;

        const roundedX = Math.round(currentX * 10000) / 10000;
        const roundedY = Math.round(currentY * 10000) / 10000;
        const roundedScale = Math.round(currentScale * 100) / 100;

        finalKeyframes.push({
          time: raw.time,
          x: roundedX,
          y: roundedY,
          scale: roundedScale,
          confidence: raw.confidence,
          timestamp: raw.time,
          centerX: roundedX,
          centerY: roundedY,
          width: Math.round((cropWidthNorm / roundedScale) * 10000) / 10000,
          height: Math.round((cropHeightNorm / roundedScale) * 10000) / 10000,
          sceneIndex: scene.sceneIndex,
        });
      }
    }
  }

  // Ensure start at 0 and end at duration
  if (finalKeyframes.length === 0) {
    const defaultW = Math.round(cropWidthNorm * 10000) / 10000;
    const defaultH = Math.round(cropHeightNorm * 10000) / 10000;
    finalKeyframes.push(
      { time: 0, x: 0.5, y: 0.5, scale: 1.0, confidence: 0.5, timestamp: 0, centerX: 0.5, centerY: 0.5, width: defaultW, height: defaultH, sceneIndex: 0 },
      { time: duration, x: 0.5, y: 0.5, scale: 1.0, confidence: 0.5, timestamp: duration, centerX: 0.5, centerY: 0.5, width: defaultW, height: defaultH, sceneIndex: 0 }
    );
  } else {
    if (finalKeyframes[0].time > 0.05) {
      finalKeyframes.unshift({
        ...finalKeyframes[0],
        time: 0,
        timestamp: 0,
      });
    }
    if (finalKeyframes[finalKeyframes.length - 1].time < duration - 0.05) {
      finalKeyframes.push({
        ...finalKeyframes[finalKeyframes.length - 1],
        time: duration,
        timestamp: duration,
      });
    }
  }

  return {
    targetAspectRatio: targetAspect,
    cropWidth,
    cropHeight,
    targetWidth,
    targetHeight,
    multiPersonMode,
    keyframes: finalKeyframes,
    version: 1,
  };
}
