import { spawn } from 'child_process';
import fs from 'fs';
import { getFfmpegPath } from '../../renderEngine';
import { extractVideoMetadata } from '../../reframe/reframeEngine';
import { ClipperError } from '../../errors';
import { Scene, SceneType, MotionLevel } from '../types';

export interface SceneDetectionOptions {
  filePath: string;
  projectId: string;
  threshold?: number; // 0.2 to 0.4 standard
  totalDurationSeconds?: number;
  ffmpegPath?: string;
}

/**
 * Real FFmpeg Scene Segmentation Engine
 * Uses FFmpeg scene filter (`gt(scene, threshold)`) to detect exact visual cuts and camera changes.
 */
export async function detectVideoScenes(options: SceneDetectionOptions): Promise<Scene[]> {
  const { filePath, projectId, threshold = 0.28 } = options;

  if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    throw new ClipperError('MEDIA_UNAVAILABLE', 'Cannot perform scene detection: video file does not exist', 404);
  }

  // 1. Authoritative Video Duration Resolution (No synthetic defaults)
  let videoDuration: number;
  if (options.totalDurationSeconds !== undefined) {
    const d = options.totalDurationSeconds;
    if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) {
      throw new ClipperError('VALIDATION_ERROR', `Invalid video duration: ${d}. Must be a positive finite number.`, 400);
    }
    videoDuration = d;
  } else {
    try {
      const meta = extractVideoMetadata(filePath);
      if (!Number.isFinite(meta.duration) || meta.duration <= 0) {
        throw new ClipperError('MEDIA_INVALID', 'Failed to probe positive finite video duration from media source', 400);
      }
      videoDuration = meta.duration;
    } catch (err) {
      if (err instanceof ClipperError) {
        throw err;
      }
      throw new ClipperError('MEDIA_INVALID', 'Failed to probe valid video duration from media source', 400);
    }
  }

  const ffmpegPath = options.ffmpegPath || getFfmpegPath();

  return new Promise<Scene[]>((resolve, reject) => {
    // Run FFmpeg to detect real frame-level scene changes with scene score metadata
    const args = [
      '-nostats',
      '-i', filePath,
      '-filter_complex', `select='gt(scene\\,${threshold})',metadata=print:key=lavfi.scene_score,showinfo`,
      '-f', 'null',
      '-',
    ];

    let settled = false;
    let proc: ReturnType<typeof spawn>;

    try {
      proc = spawn(/*turbopackIgnore: true*/ ffmpegPath, args);
    } catch (spawnErr) {
      settled = true;
      const sanitized = sanitizeSceneFailureReason(spawnErr);
      if (sanitized === 'SCENE_DETECTOR_UNAVAILABLE') {
        return reject(new ClipperError('MEDIA_UNAVAILABLE', 'Scene detector binary unavailable or spawn failed', 503));
      }
      return reject(new ClipperError('ANALYSIS_FAILED', 'Scene detector process failed to launch', 500));
    }

    let stderr = '';

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      const sanitized = sanitizeSceneFailureReason(err);
      if (sanitized === 'SCENE_DETECTOR_UNAVAILABLE') {
        return reject(new ClipperError('MEDIA_UNAVAILABLE', 'Scene detector binary unavailable or spawn failed', 503));
      }
      return reject(new ClipperError('ANALYSIS_FAILED', 'Scene detector process failed to launch', 500));
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;

      if (code !== 0) {
        // FFmpeg non-zero exit code: FAIL CONTROLLED. NEVER return continuous_sequence.
        const sanitized = sanitizeSceneFailureReason(stderr);
        if (sanitized === 'SCENE_DETECTOR_INVALID_MEDIA') {
          return reject(new ClipperError('MEDIA_INVALID', 'Scene detection failed: invalid or corrupt media stream', 400));
        }
        if (sanitized === 'SCENE_DETECTOR_TIMEOUT') {
          return reject(new ClipperError('ANALYSIS_FAILED', 'Scene detection process timed out', 504));
        }
        if (sanitized === 'SCENE_DETECTOR_UNAVAILABLE') {
          return reject(new ClipperError('MEDIA_UNAVAILABLE', 'Scene detection media or binary unavailable', 404));
        }
        return reject(new ClipperError('ANALYSIS_FAILED', 'Scene detection process failed', 500));
      }

      const cuts: { timestamp: number; score?: number }[] = [];
      const lines = stderr.split(/\r?\n/);
      let pendingScore: number | undefined = undefined;

      for (const line of lines) {
        const scoreMatch = line.match(/lavfi\.scene_score=([\d.]+)/);
        if (scoreMatch) {
          const parsed = parseFloat(scoreMatch[1]);
          if (Number.isFinite(parsed)) {
            pendingScore = Math.max(0, Math.min(1, Number(parsed.toFixed(4))));
          }
        }

        const ptsMatch = line.match(/pts_time:\s*([\d.]+)/);
        if (ptsMatch) {
          const isShowinfo = line.includes('showinfo');
          const isMetadata = line.includes('metadata');
          if (isShowinfo || !isMetadata) {
            const time = parseFloat(ptsMatch[1]);
            // Strictly reject any cut <= 0.1 or >= videoDuration (must never exceed video duration)
            if (Number.isFinite(time) && time > 0.1 && time < videoDuration) {
              // Avoid duplicate cuts within 0.3s
              if (cuts.length === 0 || time - cuts[cuts.length - 1].timestamp > 0.3) {
                cuts.push({
                  timestamp: Number(time.toFixed(3)),
                  score: pendingScore,
                });
              }
            }
            pendingScore = undefined;
          }
        }
      }

      // If no cuts detected, return single continuous scene
      if (cuts.length === 0) {
        const continuousScene: Scene = {
          id: `scene-1-${Date.now()}`,
          projectId,
          source: 'video',
          start: 0,
          end: Number(videoDuration.toFixed(2)),
          sceneType: 'environment_change',
          visualSummary: `Continuous uninterrupted scene (${videoDuration.toFixed(1)}s)`,
          dominantObjects: [],
          dominantFacesCount: 0,
          dominantColors: [],
          motionLevel: videoDuration > 15 ? 'low' : videoDuration < 2.5 ? 'high' : 'medium',
          evidence: 'continuous_sequence',
          createdAt: new Date().toISOString(),
          providerMetadata: {
            provider: 'ffmpeg-native-scene-filter',
            model: `gt(scene,${threshold})`,
          },
        };
        return resolve([continuousScene]);
      }

      // Build scenes bounded by real cuts: [0, cuts[0], cuts[1], ..., videoDuration]
      const boundaryPoints = [0, ...cuts.map(c => c.timestamp), videoDuration];
      const uniquePoints = Array.from(new Set(boundaryPoints))
        .filter(p => Number.isFinite(p) && p >= 0 && p <= videoDuration)
        .sort((a, b) => a - b);

      const scenes: Scene[] = [];

      for (let i = 0; i < uniquePoints.length - 1; i++) {
        const start = uniquePoints[i];
        const end = uniquePoints[i + 1];
        const duration = end - start;

        if (duration < 0.2) continue; // Skip micro-artifacts

        let motionLevel: MotionLevel = 'medium';
        if (duration > 15) {
          motionLevel = 'low';
        } else if (duration < 2.5) {
          motionLevel = 'high';
        }

        const sceneType: SceneType = duration < 1.0 ? 'hard_cut' : 'environment_change';

        // Initial scene (t=0) has evidence 'scene_start' and no cut score (no cut occurred at t=0).
        // Subsequent scenes have evidence 'ffmpeg_scene_change' and cutIntensityScore from the cut.
        const isInitialScene = i === 0;
        const matchingCut = isInitialScene ? undefined : cuts.find(c => Math.abs(c.timestamp - start) < 0.05);

        scenes.push({
          id: `scene-${i + 1}-${Date.now()}`,
          projectId,
          source: 'video',
          start: Number(start.toFixed(2)),
          end: Number(end.toFixed(2)),
          sceneType,
          visualSummary: `Visual segment from ${start.toFixed(1)}s to ${end.toFixed(1)}s (${motionLevel} motion)`,
          dominantObjects: [],
          dominantFacesCount: 0,
          dominantColors: [],
          motionLevel,
          cutIntensityScore: matchingCut?.score,
          evidence: isInitialScene ? 'scene_start' : 'ffmpeg_scene_change',
          createdAt: new Date().toISOString(),
          providerMetadata: {
            provider: 'ffmpeg-native-scene-filter',
            model: `gt(scene,${threshold})`,
          },
        });
      }

      // Fallback: If micro-artifacts filtered everything, emit full continuous scene
      if (scenes.length === 0) {
        scenes.push({
          id: `scene-1-${Date.now()}`,
          projectId,
          source: 'video',
          start: 0,
          end: Number(videoDuration.toFixed(2)),
          sceneType: 'environment_change',
          visualSummary: `Continuous uninterrupted scene (${videoDuration.toFixed(1)}s)`,
          dominantObjects: [],
          dominantFacesCount: 0,
          dominantColors: [],
          motionLevel: 'low',
          evidence: 'continuous_sequence',
          createdAt: new Date().toISOString(),
          providerMetadata: {
            provider: 'ffmpeg-native-scene-filter',
            model: `gt(scene,${threshold})`,
          },
        });
      }

      resolve(scenes);
    });
  });
}

/**
 * Deterministically sanitizes scene detector failure reasons into bounded semantic codes.
 * Ensures zero filesystem paths, command lines, stack traces, or raw error messages are leaked.
 */
export function sanitizeSceneFailureReason(error: unknown): string {
  if (!error) return 'SCENE_DETECTOR_FAILED';
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) {
    return 'SCENE_DETECTOR_TIMEOUT';
  }
  if (
    msg.includes('invalid') ||
    msg.includes('corrupt') ||
    msg.includes('format') ||
    msg.includes('moov atom') ||
    msg.includes('no streams') ||
    msg.includes('unsupported')
  ) {
    return 'SCENE_DETECTOR_INVALID_MEDIA';
  }
  if (
    msg.includes('not exist') ||
    msg.includes('enoent') ||
    msg.includes('not found') ||
    msg.includes('unavailable') ||
    msg.includes('unreadable') ||
    msg.includes('eacces') ||
    msg.includes('permission')
  ) {
    return 'SCENE_DETECTOR_UNAVAILABLE';
  }
  return 'SCENE_DETECTOR_FAILED';
}
