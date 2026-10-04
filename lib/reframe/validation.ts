/**
 * CLIPPER PHASE 6.1: RUNTIME INPUT & DATA VALIDATION
 * Strict schema & value boundary assertions to ensure no malformed,
 * NaN, infinite, or out-of-bounds parameters reach engine, planners, or DB.
 */

import {
  AspectRatio,
  MultiPersonMode,
  TrackingMode,
  CANONICAL_ASPECT_RATIOS,
  SubjectDetection,
  SubjectTrack,
  SceneBoundary,
  ReframeKeyframe,
  CameraPath,
  ReframeConfig,
  ReframeAnalysis,
} from './types';
import { ClipperError } from '../errors';

export function isFiniteNumber(val: any, min?: number, max?: number): val is number {
  if (typeof val !== 'number') return false;
  if (!Number.isFinite(val)) return false;
  if (Number.isNaN(val)) return false;
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
}

export function isPositiveInteger(val: any, min = 1): val is number {
  if (typeof val !== 'number') return false;
  if (!Number.isFinite(val)) return false;
  if (!Number.isInteger(val)) return false;
  return val >= min;
}

export function isNormalizedCoordinate(val: any): boolean {
  return isFiniteNumber(val, 0, 1);
}

export function validateSubjectDetection(d: any): SubjectDetection {
  if (!d || typeof d !== 'object') {
    throw new ClipperError('VALIDATION_ERROR', 'SubjectDetection must be an object', 400);
  }

  const timestamp = d.timestamp !== undefined ? d.timestamp : d.time;
  if (!isFiniteNumber(timestamp, 0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid detection timestamp: ${timestamp}`, 400);
  }

  if (!isNormalizedCoordinate(d.x)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid detection x coordinate: ${d.x} (must be in [0, 1])`, 400);
  }

  if (!isNormalizedCoordinate(d.y)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid detection y coordinate: ${d.y} (must be in [0, 1])`, 400);
  }

  if (!isFiniteNumber(d.width, 0, 1)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid detection width: ${d.width} (must be in [0, 1])`, 400);
  }

  if (!isFiniteNumber(d.height, 0, 1)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid detection height: ${d.height} (must be in [0, 1])`, 400);
  }

  if (!isFiniteNumber(d.confidence, 0, 1)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid detection confidence: ${d.confidence} (must be in [0, 1])`, 400);
  }

  const allowedTypes = ['face', 'person', 'object', 'centroid', 'fallback'];
  if (d.subjectType && !allowedTypes.includes(d.subjectType)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid detection subjectType: ${d.subjectType}`, 400);
  }

  return {
    timestamp,
    x: d.x,
    y: d.y,
    width: d.width,
    height: d.height,
    confidence: d.confidence,
    subjectType: d.subjectType,
    subjectId: typeof d.subjectId === 'string' ? d.subjectId : undefined,
  };
}

export function validateSceneBoundary(s: any, duration?: number): SceneBoundary {
  if (!s || typeof s !== 'object') {
    throw new ClipperError('VALIDATION_ERROR', 'SceneBoundary must be an object', 400);
  }

  if (!isPositiveInteger(s.sceneIndex, 0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid sceneIndex: ${s.sceneIndex} (must be integer >= 0)`, 400);
  }

  if (!isFiniteNumber(s.start, 0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid scene start time: ${s.start}`, 400);
  }

  if (!isFiniteNumber(s.end, 0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid scene end time: ${s.end}`, 400);
  }

  if (s.start >= s.end) {
    throw new ClipperError('VALIDATION_ERROR', `Scene start must be strictly before end: start=${s.start}, end=${s.end}`, 400);
  }

  if (duration !== undefined && isFiniteNumber(duration, 0) && s.end > duration + 1.0) {
    throw new ClipperError('VALIDATION_ERROR', `Scene end exceeds video duration: end=${s.end}, duration=${duration}`, 400);
  }

  if (s.cutConfidence !== undefined && !isFiniteNumber(s.cutConfidence, 0, 1)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid scene cutConfidence: ${s.cutConfidence} (must be in [0, 1])`, 400);
  }

  return {
    sceneIndex: s.sceneIndex,
    start: s.start,
    end: s.end,
    cutConfidence: s.cutConfidence,
  };
}

export function validateSubjectTrack(t: any): SubjectTrack {
  if (!t || typeof t !== 'object') {
    throw new ClipperError('VALIDATION_ERROR', 'SubjectTrack must be an object', 400);
  }

  if (typeof t.trackId !== 'string' || !t.trackId.trim()) {
    throw new ClipperError('VALIDATION_ERROR', 'SubjectTrack trackId must be a non-empty string', 400);
  }

  if (!isFiniteNumber(t.start, 0) || !isFiniteNumber(t.end, 0) || t.start > t.end) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid track start/end range: [${t.start}, ${t.end}]`, 400);
  }

  if (!isFiniteNumber(t.averageConfidence, 0, 1)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid track averageConfidence: ${t.averageConfidence}`, 400);
  }

  if (!Array.isArray(t.detections)) {
    throw new ClipperError('VALIDATION_ERROR', 'SubjectTrack detections must be an array', 400);
  }

  const detections = t.detections.map(validateSubjectDetection);

  return {
    trackId: t.trackId,
    subjectId: typeof t.subjectId === 'string' ? t.subjectId : undefined,
    label: typeof t.label === 'string' ? t.label : undefined,
    subjectType: t.subjectType,
    start: t.start,
    end: t.end,
    averageConfidence: t.averageConfidence,
    detections,
  };
}

export function validateReframeKeyframe(k: any, duration?: number): ReframeKeyframe {
  if (!k || typeof k !== 'object') {
    throw new ClipperError('VALIDATION_ERROR', 'ReframeKeyframe must be an object', 400);
  }

  const time = k.time !== undefined ? k.time : k.timestamp;
  if (!isFiniteNumber(time, 0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid keyframe time: ${time}`, 400);
  }

  if (duration !== undefined && isFiniteNumber(duration, 0) && time > duration + 1.0) {
    throw new ClipperError('VALIDATION_ERROR', `Keyframe time exceeds media duration: time=${time}, duration=${duration}`, 400);
  }

  if (!isNormalizedCoordinate(k.x)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid keyframe x: ${k.x} (must be in [0, 1])`, 400);
  }

  if (!isNormalizedCoordinate(k.y)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid keyframe y: ${k.y} (must be in [0, 1])`, 400);
  }

  const scale = k.scale !== undefined ? k.scale : 1.0;
  if (!isFiniteNumber(scale, 1.0, 10.0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid keyframe scale: ${scale} (must be >= 1.0)`, 400);
  }

  const confidence = k.confidence !== undefined ? k.confidence : 1.0;
  if (!isFiniteNumber(confidence, 0, 1.0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid keyframe confidence: ${confidence} (must be in [0, 1])`, 400);
  }

  return {
    time,
    x: k.x,
    y: k.y,
    scale,
    confidence,
    isFallback: Boolean(k.isFallback),
    sourceBbox: k.sourceBbox,
    timestamp: time,
    centerX: k.centerX !== undefined ? k.centerX : k.x,
    centerY: k.centerY !== undefined ? k.centerY : k.y,
    width: k.width,
    height: k.height,
    sceneIndex: k.sceneIndex,
  };
}

export function validateCameraPath(cameraPath: any, duration?: number): CameraPath {
  if (!cameraPath || typeof cameraPath !== 'object') {
    throw new ClipperError('VALIDATION_ERROR', 'CameraPath must be an object', 400);
  }

  if (!CANONICAL_ASPECT_RATIOS.includes(cameraPath.targetAspectRatio)) {
    throw new ClipperError(
      'VALIDATION_ERROR',
      `Invalid cameraPath targetAspectRatio: ${cameraPath.targetAspectRatio}. Must be one of: ${CANONICAL_ASPECT_RATIOS.join(', ')}`,
      400
    );
  }

  if (!isPositiveInteger(cameraPath.cropWidth, 2)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid cameraPath cropWidth: ${cameraPath.cropWidth}`, 400);
  }

  if (!isPositiveInteger(cameraPath.cropHeight, 2)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid cameraPath cropHeight: ${cameraPath.cropHeight}`, 400);
  }

  if (!isPositiveInteger(cameraPath.targetWidth, 2)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid cameraPath targetWidth: ${cameraPath.targetWidth}`, 400);
  }

  if (!isPositiveInteger(cameraPath.targetHeight, 2)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid cameraPath targetHeight: ${cameraPath.targetHeight}`, 400);
  }

  const allowedModes: MultiPersonMode[] = ['SINGLE', 'DUAL', 'GROUP', 'GENERAL'];
  if (cameraPath.multiPersonMode && !allowedModes.includes(cameraPath.multiPersonMode)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid cameraPath multiPersonMode: ${cameraPath.multiPersonMode}`, 400);
  }

  if (!Array.isArray(cameraPath.keyframes) || cameraPath.keyframes.length === 0) {
    throw new ClipperError('VALIDATION_ERROR', 'CameraPath must contain at least one keyframe', 400);
  }

  if (cameraPath.keyframes.length > 10000) {
    throw new ClipperError('VALIDATION_ERROR', `CameraPath contains too many keyframes (${cameraPath.keyframes.length})`, 400);
  }

  const validatedKeyframes: ReframeKeyframe[] = [];
  let prevTime = -Infinity;

  for (let i = 0; i < cameraPath.keyframes.length; i++) {
    const kf = validateReframeKeyframe(cameraPath.keyframes[i], duration);
    if (kf.time < prevTime) {
      throw new ClipperError(
        'VALIDATION_ERROR',
        `CameraPath keyframes must have monotonically non-decreasing timestamps (kf[${i}].time=${kf.time} < prev=${prevTime})`,
        400
      );
    }
    prevTime = kf.time;
    validatedKeyframes.push(kf);
  }

  return {
    targetAspectRatio: cameraPath.targetAspectRatio,
    cropWidth: cameraPath.cropWidth,
    cropHeight: cameraPath.cropHeight,
    targetWidth: cameraPath.targetWidth,
    targetHeight: cameraPath.targetHeight,
    multiPersonMode: cameraPath.multiPersonMode || 'GENERAL',
    keyframes: validatedKeyframes,
    version: isPositiveInteger(cameraPath.version, 1) ? cameraPath.version : 1,
  };
}

export function validateReframeConfig(cfg: any): Partial<ReframeConfig> {
  if (!cfg || typeof cfg !== 'object') {
    throw new ClipperError('VALIDATION_ERROR', 'ReframeConfig must be an object', 400);
  }

  if (cfg.targetAspectRatio !== undefined && !CANONICAL_ASPECT_RATIOS.includes(cfg.targetAspectRatio)) {
    throw new ClipperError(
      'VALIDATION_ERROR',
      `Invalid targetAspectRatio: ${cfg.targetAspectRatio}. Must be one of ${CANONICAL_ASPECT_RATIOS.join(', ')}`,
      400
    );
  }

  const allowedTracking: TrackingMode[] = ['center', 'smart', 'manual'];
  if (cfg.trackingMode !== undefined && !allowedTracking.includes(cfg.trackingMode)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid trackingMode: ${cfg.trackingMode}. Must be center, smart, or manual`, 400);
  }

  const allowedMulti: MultiPersonMode[] = ['SINGLE', 'DUAL', 'GROUP', 'GENERAL'];
  if (cfg.multiPersonMode !== undefined && !allowedMulti.includes(cfg.multiPersonMode)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid multiPersonMode: ${cfg.multiPersonMode}`, 400);
  }

  if (cfg.smoothingAlpha !== undefined && !isFiniteNumber(cfg.smoothingAlpha, 0.001, 1.0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid smoothingAlpha: ${cfg.smoothingAlpha} (must be in (0, 1])`, 400);
  }

  if (cfg.deadZone !== undefined && !isFiniteNumber(cfg.deadZone, 0, 0.5)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid deadZone: ${cfg.deadZone} (must be in [0, 0.5])`, 400);
  }

  if (cfg.headroom !== undefined && !isFiniteNumber(cfg.headroom, 0, 1.0)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid headroom: ${cfg.headroom} (must be in [0, 1.0])`, 400);
  }

  if (cfg.manualSettings) {
    if (!isNormalizedCoordinate(cfg.manualSettings.x) || !isNormalizedCoordinate(cfg.manualSettings.y)) {
      throw new ClipperError('VALIDATION_ERROR', 'ManualSettings x and y must be normalized in [0, 1]', 400);
    }
    if (!isFiniteNumber(cfg.manualSettings.zoom, 1.0, 2.5)) {
      throw new ClipperError('VALIDATION_ERROR', 'ManualSettings zoom must be in range [1.0, 2.5]', 400);
    }
  }

  return cfg;
}

export function validateReframeAnalysis(analysis: any): ReframeAnalysis {
  if (!analysis || typeof analysis !== 'object') {
    throw new ClipperError('VALIDATION_ERROR', 'ReframeAnalysis must be an object', 400);
  }

  if (!isPositiveInteger(analysis.sourceWidth, 1)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid sourceWidth: ${analysis.sourceWidth}`, 400);
  }

  if (!isPositiveInteger(analysis.sourceHeight, 1)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid sourceHeight: ${analysis.sourceHeight}`, 400);
  }

  if (!isFiniteNumber(analysis.duration, 0.001)) {
    throw new ClipperError('VALIDATION_ERROR', `Invalid duration: ${analysis.duration}`, 400);
  }

  if (!Array.isArray(analysis.scenes)) {
    throw new ClipperError('VALIDATION_ERROR', 'ReframeAnalysis scenes must be an array', 400);
  }

  if (!Array.isArray(analysis.subjectTracks)) {
    throw new ClipperError('VALIDATION_ERROR', 'ReframeAnalysis subjectTracks must be an array', 400);
  }

  const scenes = analysis.scenes.map((s: any) => validateSceneBoundary(s, analysis.duration));
  const subjectTracks = analysis.subjectTracks.map(validateSubjectTrack);

  return {
    id: typeof analysis.id === 'string' ? analysis.id : crypto.randomUUID(),
    projectId: analysis.projectId,
    mediaAssetId: analysis.mediaAssetId,
    sourceWidth: analysis.sourceWidth,
    sourceHeight: analysis.sourceHeight,
    duration: analysis.duration,
    scenes,
    subjectTracks,
    provider: typeof analysis.provider === 'string' ? analysis.provider : 'hybrid',
    version: typeof analysis.version === 'string' ? analysis.version : '1.0.0',
    createdAt: analysis.createdAt || new Date().toISOString(),
    metadata: analysis.metadata,
    degraded: Boolean(analysis.degraded),
  };
}
