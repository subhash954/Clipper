import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, execSync } from 'child_process';
import {
  AspectRatio,
  TrackingMode,
  BoundingBox,
  DetectedSubject,
  ReframeKeyframe,
  ManualReframeSettings,
  ReframeTrack,
  ASPECT_RATIO_CONFIGS,
} from './types';
import { getFfmpegPath } from '../renderEngine';

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

/**
 * Extracts width, height, and duration from video using FFmpeg/FFprobe
 */
export function extractVideoMetadata(videoPath: string): VideoMetadata {
  const ffmpeg = getFfmpegPath();
  const ffprobeCandidate = ffmpeg.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
  
  if (fs.existsSync(ffprobeCandidate)) {
    try {
      const probeCmd = `"${ffprobeCandidate}" -v error -select_streams v:0 -show_entries stream=width,height,duration -of json "${videoPath}"`;
      const out = execSync(probeCmd, { encoding: 'utf-8', timeout: 10000 });
      const parsed = JSON.parse(out);
      const stream = parsed.streams?.[0];
      if (stream && stream.width && stream.height) {
        return {
          width: parseInt(stream.width, 10),
          height: parseInt(stream.height, 10),
          duration: parseFloat(stream.duration || '30'),
        };
      }
    } catch {
      // Fallback to ffmpeg -i probe below
    }
  }

  // Fallback: run ffmpeg -i and parse stderr
  try {
    const probeCmd = `"${ffmpeg}" -i "${videoPath}" 2>&1`;
    const out = execSync(probeCmd, { encoding: 'utf-8', timeout: 10000 });
    
    let width = 1920;
    let height = 1080;
    let duration = 30;

    const resMatch = out.match(/Stream.*Video:.*,\s*(\d{2,5})x(\d{2,5})/);
    if (resMatch) {
      width = parseInt(resMatch[1], 10);
      height = parseInt(resMatch[2], 10);
    }

    const durMatch = out.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (durMatch) {
      duration =
        parseInt(durMatch[1], 10) * 3600 +
        parseInt(durMatch[2], 10) * 60 +
        parseFloat(durMatch[3]);
    }

    return { width, height, duration };
  } catch (err: any) {
    // If ffmpeg exits with code 1 after printing info, inspect err.stdout/stderr
    const output = (err.stdout || '') + (err.stderr || '');
    const resMatch = output.match(/Stream.*Video:.*,\s*(\d{2,5})x(\d{2,5})/);
    if (resMatch) {
      return {
        width: parseInt(resMatch[1], 10),
        height: parseInt(resMatch[2], 10),
        duration: 30,
      };
    }
    // Default standard HD landscape if unreadable
    return { width: 1920, height: 1080, duration: 30 };
  }
}

/**
 * Samples video frames at 1 fps into a temp folder
 */
export async function sampleFrames(
  videoPath: string,
  startTime: number,
  duration: number,
  fps = 1
): Promise<{ framePath: string; time: number }[]> {
  const ffmpeg = getFfmpegPath();
  const tempDir = path.join(process.cwd(), 'data', 'temp_frames', `sample_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const numFrames = Math.max(1, Math.min(120, Math.ceil(duration * fps)));
  const framePattern = path.join(tempDir, 'frame_%04d.jpg');

  const args = [
    '-y',
    '-ss', startTime.toFixed(2),
    '-t', duration.toFixed(2),
    '-i', videoPath,
    '-vf', `fps=${fps},scale=640:-1`,
    '-q:v', '3',
    framePattern,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ ffmpeg, args);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Frame extraction failed with code ${code}`));
    });
    child.on('error', reject);
  });

  const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.jpg')).sort();
  const frames: { framePath: string; time: number }[] = files.map((file, idx) => ({
    framePath: path.join(tempDir, file),
    time: Math.min(duration, idx / fps),
  }));

  return frames;
}

/**
 * Analyzes RGB pixel luminance and color centroids from a frame to detect subject position
 */
export function detectSubjectLocally(framePath: string): DetectedSubject {
  try {
    const ffmpeg = getFfmpegPath();
    // Downscale to 64x36 raw RGB24 to compute spatial center of activity/contrast
    const rawBuffer = execSync(
      `"${ffmpeg}" -v error -i "${framePath}" -vf "scale=64:36" -f rawvideo -pix_fmt rgb24 -`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 5000 }
    );

    const width = 64;
    const height = 36;
    let sumWeight = 0;
    let sumX = 0;
    let sumY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const r = rawBuffer[idx];
        const g = rawBuffer[idx + 1];
        const b = rawBuffer[idx + 2];

        // Luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Skin tone / portrait subject heuristic (typical skin: R > G > B with warm chroma)
        const isWarmTone = r > 90 && g > 40 && b > 20 && r > g && (r - g) > 15;
        // Central bias weight: subjects are rarely glued to extreme 5% edges
        const centerDistX = Math.abs(x / width - 0.5);
        const centerBias = 1.0 - centerDistX * 0.4;

        const weight = (isWarmTone ? 2.5 : 1.0) * (lum / 255) * centerBias;

        sumWeight += weight;
        sumX += x * weight;
        sumY += y * weight;
      }
    }

    if (sumWeight > 0) {
      const normX = Math.max(0.1, Math.min(0.9, (sumX / sumWeight) / width));
      const normY = Math.max(0.15, Math.min(0.85, (sumY / sumWeight) / height));
      return {
        time: 0,
        x: normX,
        y: normY,
        width: 0.35,
        height: 0.5,
        confidence: 0.85,
        subjectType: 'centroid',
      };
    }
  } catch (err) {
    // If local pixel analysis fails, default to centered subject
  }

  return {
    time: 0,
    x: 0.5,
    y: 0.4,
    width: 0.35,
    height: 0.5,
    confidence: 0.6,
    subjectType: 'fallback',
  };
}

/**
 * Detects primary human/speaker subject in a frame using Gemini Vision if available,
 * with fallback to local spatial centroid analysis.
 */
export async function detectSubjectInFrame(
  framePath: string,
  time: number
): Promise<DetectedSubject> {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    try {
      const imageBytes = fs.readFileSync(framePath);
      const base64Image = imageBytes.toString('base64');

      const prompt = `Analyze this video frame and return the normalized 2D bounding box [ymin, xmin, ymax, xmax] (values between 0 and 1000) of the primary human speaker or main visual subject. Respond ONLY in valid JSON format: {"box_2d": [ymin, xmin, ymax, xmax], "confidence": 0.95}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          const box = parsed.box_2d;
          if (Array.isArray(box) && box.length === 4) {
            const [ymin, xmin, ymax, xmax] = box.map((v: number) => v / 1000);
            const centerX = (xmin + xmax) / 2;
            const centerY = (ymin + ymax) / 2;
            const w = xmax - xmin;
            const h = ymax - ymin;

            return {
              time,
              x: Math.max(0.05, Math.min(0.95, centerX)),
              y: Math.max(0.1, Math.min(0.9, centerY)),
              width: w,
              height: h,
              confidence: parsed.confidence || 0.9,
              subjectType: 'person',
            };
          }
        }
      }
    } catch {
      // Gemini detection failed or timed out; fall through to local detector
    }
  }

  // Local spatial centroid detection
  const localResult = detectSubjectLocally(framePath);
  return {
    ...localResult,
    time,
  };
}

/**
 * Temporal smoothing with Exponential Moving Average (EMA) and dead zone
 */
export function smoothTrackingPath(
  rawKeyframes: ReframeKeyframe[],
  smoothingAlpha = 0.25,
  deadZone = 0.035
): ReframeKeyframe[] {
  if (rawKeyframes.length === 0) return [];
  if (rawKeyframes.length === 1) return rawKeyframes;

  const smoothed: ReframeKeyframe[] = [];
  let currentX = rawKeyframes[0].x;
  let currentY = rawKeyframes[0].y;
  let currentScale = rawKeyframes[0].scale || 1.0;

  for (let i = 0; i < rawKeyframes.length; i++) {
    const raw = rawKeyframes[i];
    const diffX = raw.x - currentX;
    const diffY = raw.y - currentY;

    // Dead zone: don't pan if subject movement is negligible (e.g. minor breathing or head tilt)
    if (Math.abs(diffX) > deadZone) {
      currentX += diffX * smoothingAlpha;
    }

    if (Math.abs(diffY) > deadZone) {
      currentY += diffY * smoothingAlpha;
    }

    const diffScale = (raw.scale || 1.0) - currentScale;
    currentScale += diffScale * smoothingAlpha;

    smoothed.push({
      time: raw.time,
      x: Math.round(currentX * 10000) / 10000,
      y: Math.round(currentY * 10000) / 10000,
      scale: Math.round(currentScale * 100) / 100,
      confidence: raw.confidence,
      sourceBbox: raw.sourceBbox,
    });
  }

  return smoothed;
}

/**
 * Calculates crop dimensions for source resolution and target aspect ratio
 */
export function calculateCropDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: AspectRatio
): { cropWidth: number; cropHeight: number; targetWidth: number; targetHeight: number } {
  const config = ASPECT_RATIO_CONFIGS[targetAspect] || ASPECT_RATIO_CONFIGS['9:16'];
  const targetRatio = config.ratio;
  const sourceRatio = sourceWidth / sourceHeight;

  let cropWidth: number;
  let cropHeight: number;

  if (sourceRatio > targetRatio) {
    // Source is wider than target (e.g. 16:9 source -> 9:16 target)
    cropHeight = sourceHeight;
    cropWidth = Math.round(sourceHeight * targetRatio);
  } else {
    // Source is taller than target (e.g. 9:16 source -> 16:9 target)
    cropWidth = sourceWidth;
    cropHeight = Math.round(sourceWidth / targetRatio);
  }

  // Ensure even dimensions for H.264
  cropWidth = Math.floor(cropWidth / 2) * 2;
  cropHeight = Math.floor(cropHeight / 2) * 2;

  return {
    cropWidth,
    cropHeight,
    targetWidth: config.width,
    targetHeight: config.height,
  };
}

/**
 * Generates a full ReframeTrack for a video clip
 */
export async function generateReframeTrack(options: {
  videoPath: string;
  startTime: number;
  duration: number;
  aspectRatio: AspectRatio;
  trackingMode: TrackingMode;
  manualSettings?: ManualReframeSettings;
  locked?: boolean;
}): Promise<ReframeTrack> {
  const {
    videoPath,
    startTime,
    duration,
    aspectRatio = '9:16',
    trackingMode = 'center',
    manualSettings = { x: 0.5, y: 0.5, zoom: 1.0 },
    locked = false,
  } = options;

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Cannot reframe video: source file does not exist at ${videoPath}`);
  }

  const meta = extractVideoMetadata(videoPath);
  const { cropWidth, cropHeight, targetWidth, targetHeight } = calculateCropDimensions(
    meta.width,
    meta.height,
    aspectRatio
  );

  const trackId = `track-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();

  // Mode 1: Center Crop
  if (trackingMode === 'center') {
    const keyframes: ReframeKeyframe[] = [
      { time: 0, x: 0.5, y: 0.5, scale: 1.0, confidence: 1.0 },
      { time: duration, x: 0.5, y: 0.5, scale: 1.0, confidence: 1.0 },
    ];

    return {
      id: trackId,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      targetWidth,
      targetHeight,
      aspectRatio,
      trackingMode: 'center',
      keyframes,
      version: '2.0.0',
      createdAt: now,
    };
  }

  // Mode 2: Manual Position
  if (trackingMode === 'manual') {
    const keyframes: ReframeKeyframe[] = [
      {
        time: 0,
        x: manualSettings.x,
        y: manualSettings.y,
        scale: manualSettings.zoom,
        confidence: 1.0,
      },
      {
        time: duration,
        x: manualSettings.x,
        y: manualSettings.y,
        scale: manualSettings.zoom,
        confidence: 1.0,
      },
    ];

    return {
      id: trackId,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      targetWidth,
      targetHeight,
      aspectRatio,
      trackingMode: 'manual',
      manualSettings,
      keyframes,
      version: '2.0.0',
      createdAt: now,
    };
  }

  // Mode 3: Smart Centering (Subject Detection + Tracking)
  // Check disk cache for this video + time interval
  const cacheKey = crypto
    .createHash('md5')
    .update(`${videoPath}-${startTime.toFixed(2)}-${duration.toFixed(2)}`)
    .digest('hex');
  const cacheDir = path.join(process.cwd(), 'data', 'reframe_cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);

  let rawKeyframes: ReframeKeyframe[] = [];

  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (Array.isArray(cached) && cached.length > 0) {
        rawKeyframes = cached;
      }
    } catch {
      // Cache corrupted, recompute below
    }
  }

  if (rawKeyframes.length === 0) {
    const samples = await sampleFrames(videoPath, startTime, duration, 1);
    
    for (const sample of samples) {
      const detection = await detectSubjectInFrame(sample.framePath, sample.time);
      
      // Apply Headroom rule: keep face anchored around 35% from the top
      let adjustedY = detection.y;
      if (detection.subjectType === 'person' || detection.subjectType === 'face') {
        adjustedY = Math.max(0.2, Math.min(0.65, detection.y - (detection.height * 0.1)));
      }

      rawKeyframes.push({
        time: sample.time,
        x: detection.x,
        y: adjustedY,
        scale: 1.0,
        confidence: detection.confidence,
        sourceBbox: {
          x: Math.max(0, detection.x - detection.width / 2),
          y: Math.max(0, detection.y - detection.height / 2),
          width: detection.width,
          height: detection.height,
        },
      });
    }

    // Clean up sample frames
    try {
      if (samples.length > 0) {
        const frameDir = path.dirname(samples[0].framePath);
        fs.rmSync(frameDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }

    // Cache raw detections
    try {
      fs.writeFileSync(cachePath, JSON.stringify(rawKeyframes), 'utf-8');
    } catch {
      // Ignore cache write error
    }
  }

  // If locked framing is requested, lock to the median subject position
  if (locked && rawKeyframes.length > 0) {
    const medianX = rawKeyframes.map((k) => k.x).sort((a, b) => a - b)[Math.floor(rawKeyframes.length / 2)];
    const medianY = rawKeyframes.map((k) => k.y).sort((a, b) => a - b)[Math.floor(rawKeyframes.length / 2)];
    
    return {
      id: trackId,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      targetWidth,
      targetHeight,
      aspectRatio,
      trackingMode: 'smart',
      locked: true,
      focalPoint: { x: medianX, y: medianY },
      keyframes: [
        { time: 0, x: medianX, y: medianY, scale: 1.0, confidence: 1.0 },
        { time: duration, x: medianX, y: medianY, scale: 1.0, confidence: 1.0 },
      ],
      version: '2.0.0',
      createdAt: now,
    };
  }

  // Smooth raw keyframes
  const smoothedKeyframes = smoothTrackingPath(rawKeyframes, 0.25, 0.035);

  return {
    id: trackId,
    sourceWidth: meta.width,
    sourceHeight: meta.height,
    targetWidth,
    targetHeight,
    aspectRatio,
    trackingMode: 'smart',
    keyframes: smoothedKeyframes,
    version: '2.0.0',
    createdAt: now,
  };
}

/**
 * Builds the exact FFmpeg video crop & scale filter for a ReframeTrack
 */
export function buildFfmpegReframeCropFilter(
  trackOrWidth: ReframeTrack | number,
  sourceHeightParam?: number,
  aspectRatioParam?: AspectRatio,
  singleKeyframe?: ReframeKeyframe
): string {
  let track: ReframeTrack;
  if (typeof trackOrWidth === 'number') {
    const sw = trackOrWidth;
    const sh = sourceHeightParam || 1080;
    const aspect = aspectRatioParam || '9:16';
    const dims = calculateCropDimensions(sw, sh, aspect);
    track = {
      id: 'kf-filter',
      sourceWidth: sw,
      sourceHeight: sh,
      targetWidth: dims.targetWidth,
      targetHeight: dims.targetHeight,
      aspectRatio: aspect,
      trackingMode: singleKeyframe ? 'smart' : 'center',
      keyframes: singleKeyframe ? [singleKeyframe] : [],
      version: '2.0.0',
      createdAt: new Date().toISOString(),
    };
  } else {
    track = trackOrWidth;
  }

  const { sourceWidth, sourceHeight, targetWidth, targetHeight, aspectRatio, trackingMode, keyframes } = track;
  const { cropWidth, cropHeight } = calculateCropDimensions(sourceWidth, sourceHeight, aspectRatio);

  // 1. Manual Position Mode
  if (trackingMode === 'manual') {
    const zoom = Math.max(1.0, Math.min(2.5, track.manualSettings?.zoom || 1.0));
    const zoomedCropW = Math.floor((cropWidth / zoom) / 2) * 2;
    const zoomedCropH = Math.floor((cropHeight / zoom) / 2) * 2;

    const posX = track.manualSettings?.x ?? 0.5;
    const posY = track.manualSettings?.y ?? 0.5;

    const rawX = Math.round(posX * sourceWidth - zoomedCropW / 2);
    const rawY = Math.round(posY * sourceHeight - zoomedCropH / 2);

    const clampedX = Math.max(0, Math.min(sourceWidth - zoomedCropW, rawX));
    const clampedY = Math.max(0, Math.min(sourceHeight - zoomedCropH, rawY));

    return `crop=${zoomedCropW}:${zoomedCropH}:${clampedX}:${clampedY},scale=${targetWidth}:${targetHeight}`;
  }

  // 2. Center Crop Mode
  if (trackingMode === 'center' || !keyframes || keyframes.length === 0) {
    const x = Math.max(0, Math.floor((sourceWidth - cropWidth) / 2));
    const y = Math.max(0, Math.floor((sourceHeight - cropHeight) / 2));
    return `crop=${cropWidth}:${cropHeight}:${x}:${y},scale=${targetWidth}:${targetHeight}`;
  }

  // 3. Smart Centering Mode (Dynamic Piecewise Linear Interpolation)
  if (keyframes.length === 1) {
    const k = keyframes[0];
    const x = Math.max(0, Math.min(sourceWidth - cropWidth, Math.round(k.x * sourceWidth - cropWidth / 2)));
    const y = Math.max(0, Math.min(sourceHeight - cropHeight, Math.round(k.y * sourceHeight - cropHeight / 2)));
    return `crop=${cropWidth}:${cropHeight}:${x}:${y},scale=${targetWidth}:${targetHeight}`;
  }

  // Construct chained if(lt(t, t_i), x_a + (x_b - x_a)*(t - t_a)/(t_b - t_a), ...)
  // For x
  const xPoints = keyframes.map((k) => ({
    t: Math.max(0, Math.round(k.time * 100) / 100),
    val: Math.max(0, Math.min(sourceWidth - cropWidth, Math.round(k.x * sourceWidth - cropWidth / 2))),
  }));

  let xExpr = `${xPoints[xPoints.length - 1].val}`;
  for (let i = xPoints.length - 2; i >= 0; i--) {
    const p1 = xPoints[i];
    const p2 = xPoints[i + 1];
    const dt = Math.max(0.01, p2.t - p1.t);
    const segment = `${p1.val}+(${p2.val}-${p1.val})*(t-${p1.t.toFixed(2)})/${dt.toFixed(2)}`;
    xExpr = `if(lt(t,${p2.t.toFixed(2)}),${segment},${xExpr})`;
  }

  // For y (if vertical travel is possible when source is taller than target)
  const yPoints = keyframes.map((k) => ({
    t: Math.max(0, Math.round(k.time * 100) / 100),
    val: Math.max(0, Math.min(sourceHeight - cropHeight, Math.round(k.y * sourceHeight - cropHeight / 2))),
  }));

  let yExpr = `${yPoints[yPoints.length - 1].val}`;
  for (let i = yPoints.length - 2; i >= 0; i--) {
    const p1 = yPoints[i];
    const p2 = yPoints[i + 1];
    const dt = Math.max(0.01, p2.t - p1.t);
    const segment = `${p1.val}+(${p2.val}-${p1.val})*(t-${p1.t.toFixed(2)})/${dt.toFixed(2)}`;
    yExpr = `if(lt(t,${p2.t.toFixed(2)}),${segment},${yExpr})`;
  }

  return `crop=${cropWidth}:${cropHeight}:x='${xExpr}':y='${yExpr}',scale=${targetWidth}:${targetHeight}`;
}
