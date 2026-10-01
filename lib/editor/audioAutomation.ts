import { WordTimestamp } from '../types';

export interface DuckingParams {
  duckAmountDb: number; // e.g. -12 dB
  attackMs: number; // e.g. 150 ms
  releaseMs: number; // e.g. 350 ms
  baseVolume: number; // 0.0 to 1.0 (default 1.0)
}

export interface VolumeKeyframe {
  time: number; // seconds
  volume: number; // multiplier 0.0 to 1.0
}

/**
 * Computes speech activity intervals from word timestamps with a merge threshold.
 */
export function extractSpeechIntervals(
  words: Array<{ start: number; end: number }>,
  mergeGapSeconds: number = 0.4
): Array<{ start: number; end: number }> {
  if (!words || words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.start - b.start);
  const intervals: Array<{ start: number; end: number }> = [];

  let current = { start: sorted[0].start, end: sorted[0].end };

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i];
    if (w.start <= current.end + mergeGapSeconds) {
      current.end = Math.max(current.end, w.end);
    } else {
      intervals.push({ ...current });
      current = { start: w.start, end: w.end };
    }
  }
  intervals.push({ ...current });

  return intervals;
}

/**
 * Converts dB attenuation to linear amplitude factor.
 * e.g. -12 dB -> 10^(-12/20) ~= 0.251
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Computes exact volume automation keyframes for smart ducking during speech intervals.
 */
export function calculateDuckingKeyframes(
  totalDuration: number,
  speechIntervals: Array<{ start: number; end: number }>,
  params: DuckingParams
): VolumeKeyframe[] {
  const { duckAmountDb, attackMs, releaseMs, baseVolume } = params;
  const duckFactor = Math.max(0.01, Math.min(1.0, baseVolume * dbToLinear(duckAmountDb)));
  const attackSec = attackMs / 1000;
  const releaseSec = releaseMs / 1000;

  const keyframes: VolumeKeyframe[] = [];

  // Start with base volume
  keyframes.push({ time: 0, volume: baseVolume });

  for (const interval of speechIntervals) {
    const duckStart = Math.max(0, interval.start - attackSec);
    const speechStart = interval.start;
    const speechEnd = Math.min(totalDuration, interval.end);
    const restoredAt = Math.min(totalDuration, interval.end + releaseSec);

    // 1. Ramp down right before speech begins
    if (duckStart > 0 && duckStart > (keyframes[keyframes.length - 1]?.time || 0)) {
      keyframes.push({ time: Number(duckStart.toFixed(3)), volume: baseVolume });
    }
    keyframes.push({ time: Number(speechStart.toFixed(3)), volume: Number(duckFactor.toFixed(3)) });

    // 2. Remain ducked during speech
    keyframes.push({ time: Number(speechEnd.toFixed(3)), volume: Number(duckFactor.toFixed(3)) });

    // 3. Smooth release after speech completes
    keyframes.push({ time: Number(restoredAt.toFixed(3)), volume: baseVolume });
  }

  // Ensure end of media has keyframe
  if (keyframes[keyframes.length - 1].time < totalDuration) {
    keyframes.push({ time: Number(totalDuration.toFixed(3)), volume: baseVolume });
  }

  return keyframes;
}

/**
 * Builds an FFmpeg volume filter expression for smart ducking
 * or generates the sidechain compressor filter string.
 */
export function buildFfmpegDuckingFilter(
  speechIntervals: Array<{ start: number; end: number }>,
  params: DuckingParams
): string {
  if (speechIntervals.length === 0) {
    return `volume=${params.baseVolume.toFixed(2)}`;
  }

  const duckLinear = (params.baseVolume * dbToLinear(params.duckAmountDb)).toFixed(3);
  const baseLinear = params.baseVolume.toFixed(3);

  // Build piecewise if-condition expression
  // e.g. volume='if(between(t,1.2,4.5)+between(t,7.1,9.0),0.25,1.0)'
  const condition = speechIntervals
    .map((int) => `between(t,${int.start.toFixed(2)},${int.end.toFixed(2)})`)
    .join('+');

  return `volume='if(${condition},${duckLinear},${baseLinear})':eval=frame`;
}
