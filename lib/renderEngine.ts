import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { WordTimestamp, SubtitleStyle, VisualLayoutSettings, EditOperation } from './types';
import {
  AspectRatio,
  TrackingMode,
  ManualReframeSettings,
  ReframeTrack,
  ASPECT_RATIO_CONFIGS,
} from './reframe/types';
import {
  extractVideoMetadata,
  generateReframeTrack,
  buildFfmpegReframeCropFilter,
} from './reframe/reframeEngine';

// Statically resolve ffmpeg binary without Turbopack require issues
export function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const candidates = [
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'darwin-x64', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      return candidate;
    }
  }
  return 'ffmpeg';
}

const ffmpegPath: string = getFfmpegPath();

export interface RenderClipOptions {
  inputMedia: string; // File path or HTTP video URL
  startTime: number;  // Seconds
  duration: number;   // Seconds
  words: WordTimestamp[];
  subtitleStyle?: SubtitleStyle;
  visualSettings?: VisualLayoutSettings;
  isProUser?: boolean;
  reframeTrack?: ReframeTrack;
  aspectRatio?: AspectRatio;
  trackingMode?: TrackingMode;
  manualSettings?: ManualReframeSettings;
  brollOperations?: EditOperation[];
}

export interface RenderResult {
  jobId: string;
  outputUrl: string;
  filePath: string;
  duration: number;
  fileSizeBytes: number;
}

/**
 * Formats seconds into ASS timestamp format: H:MM:SS.CC (centiseconds)
 */
function formatAssTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds - Math.floor(seconds)) * 100);
  return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}

/**
 * Converts Hex/RGB color to ASS &HBBGGRR& format
 */
function hexToAssColor(hex: string): string {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 6) {
    const r = cleanHex.slice(0, 2);
    const g = cleanHex.slice(2, 4);
    const b = cleanHex.slice(4, 6);
    return `&H00${b}${g}${r}&`; // ASS uses BGR order
  }
  return '&H00FFFFFF&';
}

/**
 * Generates an Advanced SubStation Alpha (.ass) subtitle file for burned-in styling
 */
export function generateAssSubtitleFile(params: {
  words: WordTimestamp[];
  clipStartTime: number;
  style?: SubtitleStyle;
  visualSettings?: VisualLayoutSettings;
  isProUser?: boolean;
  outputPath: string;
  targetWidth?: number;
  targetHeight?: number;
}): void {
  const {
    words,
    clipStartTime,
    style,
    visualSettings,
    isProUser,
    outputPath,
    targetWidth = 1080,
    targetHeight = 1920,
  } = params;

  const fontName = style?.fontFamily || 'Arial Black';
  const baseScale = targetHeight / 1920;
  const fontSize = style?.fontSize
    ? Math.round(style.fontSize * 1.5 * baseScale)
    : Math.round(68 * baseScale);
  const primaryColor = hexToAssColor(style?.primaryColor || '#FFFFFF');
  const highlightColor = hexToAssColor(style?.highlightColor || '#FACC15');
  const outlineColor = hexToAssColor(style?.strokeColor || '#000000');
  const strokeWidth = style?.strokeWidth
    ? Math.min(8, Math.max(2, Math.round(style.strokeWidth * baseScale)))
    : 4;

  // MarginV relative to targetHeight
  let marginV = Math.round(targetHeight * 0.18); // bottom
  if (style?.position === 'top') {
    marginV = Math.round(targetHeight * 0.75);
  } else if (style?.position === 'middle') {
    marginV = Math.round(targetHeight * 0.46);
  }

  const assContent: string[] = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${targetWidth}`,
    `PlayResY: ${targetHeight}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,${strokeWidth},2,2,40,40,${marginV},1`,
    `Style: Watermark,Arial,${Math.round(32 * baseScale)},&H70FFFFFF,&H00000000,&H90000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,40,40,60,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  // Group relative words into 2-3 word punchy chunks (high-retention style)
  const chunkSize = 3;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const chunkStartSec = Math.max(0, chunk[0].start - clipStartTime);
    const chunkEndSec = Math.max(chunkStartSec + 0.3, chunk[chunk.length - 1].end - clipStartTime);

    const chunkText = chunk
      .map((w) => (style?.uppercase ? w.word.toUpperCase() : w.word))
      .join(' ')
      .trim();

    if (chunkText) {
      assContent.push(
        `Dialogue: 0,${formatAssTime(chunkStartSec)},${formatAssTime(chunkEndSec)},Default,,0,0,0,,${chunkText}`
      );
    }
  }

  // Free Plan Watermark
  if (!isProUser) {
    assContent.push(
      `Dialogue: 1,0:00:00.00,1:00:00.00,Watermark,,0,0,0,,⚡ Created with Clipper AI`
    );
  } else if (visualSettings?.showCustomLogo && visualSettings.customLogoText) {
    assContent.push(
      `Dialogue: 1,0:00:00.00,1:00:00.00,Watermark,,0,0,0,,${visualSettings.customLogoText}`
    );
  }

  fs.writeFileSync(outputPath, assContent.join('\n'), 'utf-8');
}

/**
 * Downloads a remote video to a local temp file if input is an HTTP URL
 */
async function resolveLocalMediaInput(inputUrl: string, tempDir: string): Promise<string> {
  if (fs.existsSync(inputUrl)) {
    return inputUrl;
  }

  if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
    const fileName = `input_${Date.now()}.mp4`;
    const destPath = path.join(tempDir, fileName);

    const response = await fetch(inputUrl);
    if (!response.ok) {
      throw new Error(`Failed to download source media from URL: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
    return destPath;
  }

  // If file doesn't exist, try public folder
  const publicCandidate = path.join(process.cwd(), 'public', inputUrl.replace(/^\//, ''));
  if (fs.existsSync(publicCandidate)) {
    return publicCandidate;
  }

  // Try data folder
  const dataCandidate = path.join(process.cwd(), 'data', inputUrl.replace(/^(\/)?(data\/)?/, ''));
  if (fs.existsSync(dataCandidate)) {
    return dataCandidate;
  }

  throw new Error(`Media source could not be resolved: ${inputUrl}`);
}

/**
 * Renders an exact reframed video with real FFmpeg subject tracking and burned-in subtitles.
 */
export async function renderClipWithFfmpeg(
  jobId: string,
  options: RenderClipOptions,
  onProgress?: (progress: number, stage: string) => void
): Promise<RenderResult> {
  const {
    inputMedia,
    startTime,
    duration,
    words,
    subtitleStyle,
    visualSettings,
    isProUser,
    reframeTrack: explicitReframeTrack,
    aspectRatio: explicitAspect,
    trackingMode: explicitTrackingMode,
    manualSettings: explicitManualSettings,
    brollOperations = [],
  } = options;

  const tempDir = path.join(process.cwd(), 'data', 'temp_renders', jobId);
  const exportsDir = path.join(process.cwd(), 'public', 'exports');

  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(exportsDir, { recursive: true });

  const finalMp4Path = path.join(exportsDir, `${jobId}.mp4`);
  const assFilePath = path.join(tempDir, 'subtitles.ass');

  try {
    // Stage 1: Preparing workspace
    onProgress?.(10, 'Preparing render workspace & fonts...');

    // Stage 2: Sourcing media
    onProgress?.(20, 'Acquiring source video media...');
    let localInputPath: string;
    try {
      localInputPath = await resolveLocalMediaInput(inputMedia, tempDir);
    } catch (err: any) {
      // Production Rule: Never generate fake/synthetic color boxes when real media is missing!
      throw new Error(
        `Cannot render clip: Source media file could not be acquired or is missing (${err.message}). Synthetic fallback is disabled in production.`
      );
    }

    // Determine target aspect ratio and tracking mode
    const targetAspect: AspectRatio =
      explicitAspect ||
      explicitReframeTrack?.aspectRatio ||
      visualSettings?.aspectRatio ||
      '9:16';

    const trackingMode: TrackingMode =
      explicitTrackingMode ||
      explicitReframeTrack?.trackingMode ||
      visualSettings?.trackingMode ||
      'center';

    const manualSettings =
      explicitManualSettings ||
      explicitReframeTrack?.manualSettings ||
      visualSettings?.manualPosition ||
      { x: 0.5, y: 0.5, zoom: 1.0 };

    // Stage 3: Resolving Reframe Track
    onProgress?.(30, `Calculating subject tracking & ${targetAspect} crop path...`);

    let reframeTrack: ReframeTrack;
    if (explicitReframeTrack && explicitReframeTrack.aspectRatio === targetAspect) {
      reframeTrack = explicitReframeTrack;
    } else {
      reframeTrack = await generateReframeTrack({
        videoPath: localInputPath,
        startTime,
        duration,
        aspectRatio: targetAspect,
        trackingMode,
        manualSettings,
        locked: visualSettings?.lockFraming,
      });
    }

    const { targetWidth, targetHeight } = reframeTrack;

    // Stage 4: Preparing subtitles with correct aspect geometry
    onProgress?.(45, 'Generating word-synchronized subtitle timeline...');
    generateAssSubtitleFile({
      words,
      clipStartTime: startTime,
      style: subtitleStyle,
      visualSettings,
      isProUser,
      outputPath: assFilePath,
      targetWidth,
      targetHeight,
    });

    // Stage 5: Build Reframe Crop Filtergraph
    onProgress?.(55, `Composing ${targetAspect} frame (${targetWidth}x${targetHeight}) & burning subtitles...`);

    const cropFilter = buildFfmpegReframeCropFilter(reframeTrack);
    const escapedAssPath = assFilePath.replace(/\\/g, '/').replace(/:/g, '\\:');
    
    // Combine crop + subtitle burn-in
    let videoFilter = `${cropFilter},ass='${escapedAssPath}'`;

    // Stage 6: Render via FFmpeg
    const args = [
      '-y',
      '-ss', startTime.toFixed(2),
      '-t', duration.toFixed(2),
      '-i', localInputPath,
      '-vf', videoFilter,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      finalMp4Path,
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(/*turbopackIgnore: true*/ ffmpegPath, args);

      child.stderr.on('data', (data) => {
        const text = data.toString();
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch && duration > 0) {
          const currentSecs =
            parseInt(timeMatch[1], 10) * 3600 +
            parseInt(timeMatch[2], 10) * 60 +
            parseFloat(timeMatch[3]);
          const renderProgress = Math.min(95, Math.max(55, 55 + Math.round((currentSecs / duration) * 40)));
          onProgress?.(renderProgress, `Encoding ${targetAspect} H.264 video frames...`);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg process exited with error code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });

    // Stage 7: Finalizing
    onProgress?.(95, 'Finalizing MP4 file & audio streams...');

    if (!fs.existsSync(finalMp4Path)) {
      throw new Error('Render output file was not created by FFmpeg.');
    }

    const stat = fs.statSync(finalMp4Path);
    if (stat.size === 0) {
      throw new Error('Render output file has zero bytes.');
    }

    onProgress?.(100, 'Rendering completed successfully!');

    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup errors
    }

    return {
      jobId,
      outputUrl: `/exports/${jobId}.mp4`,
      filePath: finalMp4Path,
      duration,
      fileSizeBytes: stat.size,
    };
  } catch (error: any) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    throw error;
  }
}
