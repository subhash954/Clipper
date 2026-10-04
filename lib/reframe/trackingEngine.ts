/**
 * DETERMINISTIC SUBJECT TRACKING ENGINE (Phase 6)
 * Builds stable subject trajectories across video frames with scene boundary isolation,
 * spatial association (IoU + Euclidean), missing detection interpolation, and velocity clamping.
 */

import { SubjectDetection, SubjectTrack, SceneBoundary } from './types';

export interface TrackingOptions {
  maxInterpolationGapSeconds?: number; // default 2.0s
  spatialMatchThreshold?: number;      // max normalized center distance to consider same subject (default 0.25)
  minConfidence?: number;              // minimum confidence threshold (default 0.3)
}

/**
 * Computes 2D Intersection over Union (IoU) of two normalized bounding boxes
 */
export function computeIoU(a: SubjectDetection, b: SubjectDetection): number {
  const ax1 = a.x - a.width / 2;
  const ay1 = a.y - a.height / 2;
  const ax2 = a.x + a.width / 2;
  const ay2 = a.y + a.height / 2;

  const bx1 = b.x - b.width / 2;
  const by1 = b.y - b.height / 2;
  const bx2 = b.x + b.width / 2;
  const by2 = b.y + b.height / 2;

  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersectionArea = iw * ih;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const unionArea = areaA + areaB - intersectionArea;

  if (unionArea <= 0) return 0;
  return Math.round((intersectionArea / unionArea) * 10000) / 10000;
}

/**
 * Computes Euclidean distance between normalized centroids
 */
export function computeCenterDistance(a: SubjectDetection, b: SubjectDetection): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds which scene a given timestamp belongs to
 */
export function findSceneIndex(timestamp: number, scenes: SceneBoundary[]): number {
  if (scenes.length === 0) return 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (timestamp >= s.start && timestamp < s.end) {
      return s.sceneIndex;
    }
  }
  // If at or past last boundary, associate with last scene
  return scenes[scenes.length - 1].sceneIndex;
}

/**
 * Assembles frames of detections into continuous SubjectTracks, respecting scene boundaries
 */
export function buildSubjectTracks(
  detectionFrames: SubjectDetection[][],
  scenes: SceneBoundary[],
  options: TrackingOptions = {}
): SubjectTrack[] {
  const {
    maxInterpolationGapSeconds = 2.0,
    spatialMatchThreshold = 0.25,
    minConfidence = 0.3,
  } = options;

  // Flatten and filter invalid / low-confidence detections
  const allDetections: SubjectDetection[] = [];
  for (const frame of detectionFrames) {
    for (const d of frame) {
      if (
        d.confidence >= minConfidence &&
        Number.isFinite(d.x) &&
        Number.isFinite(d.y) &&
        Number.isFinite(d.width) &&
        Number.isFinite(d.height) &&
        d.x >= 0 &&
        d.x <= 1 &&
        d.y >= 0 &&
        d.y <= 1 &&
        d.width > 0 &&
        d.width <= 1 &&
        d.height > 0 &&
        d.height <= 1
      ) {
        allDetections.push({
          ...d,
          x: Math.round(d.x * 1000) / 1000,
          y: Math.round(d.y * 1000) / 1000,
          width: Math.round(d.width * 1000) / 1000,
          height: Math.round(d.height * 1000) / 1000,
        });
      }
    }
  }

  // Sort detections deterministically by timestamp, then subjectId/x
  allDetections.sort((a, b) => {
    if (Math.abs(a.timestamp - b.timestamp) > 0.001) {
      return a.timestamp - b.timestamp;
    }
    return (a.subjectId || '').localeCompare(b.subjectId || '') || a.x - b.x;
  });

  const activeTracks: {
    trackId: string;
    subjectId?: string;
    label?: string;
    subjectType: SubjectDetection['subjectType'];
    sceneIndex: number;
    detections: SubjectDetection[];
  }[] = [];

  const completedTracks: SubjectTrack[] = [];

  let nextTrackCounter = 1;

  for (const det of allDetections) {
    const detScene = findSceneIndex(det.timestamp, scenes);

    // Find best matching active track in the same scene
    let bestMatchIdx = -1;
    let bestScore = Infinity;

    for (let i = 0; i < activeTracks.length; i++) {
      const active = activeTracks[i];
      // Rule: Never match across scene boundaries!
      if (active.sceneIndex !== detScene) {
        continue;
      }

      const lastDet = active.detections[active.detections.length - 1];
      const timeDelta = det.timestamp - lastDet.timestamp;

      // Cannot match into the past or if gap exceeds threshold
      if (timeDelta <= 0 || timeDelta > maxInterpolationGapSeconds) {
        continue;
      }

      // If subjectId is known and matches, high affinity
      if (det.subjectId && active.subjectId && det.subjectId === active.subjectId) {
        bestMatchIdx = i;
        bestScore = -1;
        break;
      }

      // Otherwise evaluate spatial proximity
      const dist = computeCenterDistance(lastDet, det);
      const iou = computeIoU(lastDet, det);

      // Score = distance - iou * 0.2
      const score = dist - (iou * 0.2);

      if (dist <= spatialMatchThreshold && score < bestScore) {
        bestScore = score;
        bestMatchIdx = i;
      }
    }

    if (bestMatchIdx !== -1) {
      // Append to matched track
      const track = activeTracks[bestMatchIdx];
      track.detections.push(det);
      if (det.subjectId && !track.subjectId) {
        track.subjectId = det.subjectId;
      }
    } else {
      // Start a new track
      const newTrackId = `track-${nextTrackCounter++}`;
      activeTracks.push({
        trackId: newTrackId,
        subjectId: det.subjectId,
        label: det.subjectType === 'face' ? 'Face' : 'Subject',
        subjectType: det.subjectType || 'centroid',
        sceneIndex: detScene,
        detections: [det],
      });
    }
  }

  // Finalize all tracks
  for (const active of activeTracks) {
    if (active.detections.length === 0) continue;

    const interpolated = interpolateTrackGaps(active.detections, maxInterpolationGapSeconds);
    const avgConf =
      interpolated.reduce((acc, d) => acc + d.confidence, 0) / interpolated.length;

    completedTracks.push({
      trackId: active.trackId,
      subjectId: active.subjectId,
      label: active.label,
      subjectType: active.subjectType,
      start: interpolated[0].timestamp,
      end: interpolated[interpolated.length - 1].timestamp,
      averageConfidence: Math.round(avgConf * 100) / 100,
      detections: interpolated,
    });
  }

  // Sort completed tracks deterministically by start time, then trackId
  return completedTracks.sort((a, b) => a.start - b.start || a.trackId.localeCompare(b.trackId));
}

/**
 * Linearly interpolates missing detections in a track for gaps up to maxGapSeconds
 */
export function interpolateTrackGaps(
  detections: SubjectDetection[],
  maxGapSeconds: number
): SubjectDetection[] {
  if (detections.length <= 1) return [...detections];

  const result: SubjectDetection[] = [];

  for (let i = 0; i < detections.length - 1; i++) {
    const cur = detections[i];
    const next = detections[i + 1];
    result.push(cur);

    const dt = next.timestamp - cur.timestamp;
    // If gap between detections is greater than 1.1s and less than maxGapSeconds, insert 1fps intermediate points
    if (dt > 1.1 && dt <= maxGapSeconds) {
      const steps = Math.floor(dt);
      for (let s = 1; s <= steps; s++) {
        const t = cur.timestamp + s;
        if (t >= next.timestamp - 0.05) break;

        const alpha = (t - cur.timestamp) / dt;
        result.push({
          timestamp: Math.round(t * 100) / 100,
          x: Math.round((cur.x + (next.x - cur.x) * alpha) * 1000) / 1000,
          y: Math.round((cur.y + (next.y - cur.y) * alpha) * 1000) / 1000,
          width: Math.round((cur.width + (next.width - cur.width) * alpha) * 1000) / 1000,
          height: Math.round((cur.height + (next.height - cur.height) * alpha) * 1000) / 1000,
          confidence: Math.round(Math.min(cur.confidence, next.confidence) * 0.85 * 100) / 100, // slightly penalize interpolated confidence
          subjectType: cur.subjectType,
          subjectId: cur.subjectId,
        });
      }
    }
  }

  result.push(detections[detections.length - 1]);
  return result;
}
