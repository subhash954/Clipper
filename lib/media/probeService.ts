import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export interface MediaProbeResult {
  isValid: boolean;
  format: string;
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec?: string;
  hasAudio: boolean;
  hasVideo: boolean;
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
  rotation?: number;
  colorSpace?: string;
  error?: string;
}

/**
 * Resolves ffprobe executable binary across environments
 */
export function getFfprobePath(): string {
  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
    return process.env.FFPROBE_PATH;
  }
  const candidates = [
    path.join(process.cwd(), 'node_modules', '@ffprobe-installer', 'darwin-arm64', 'ffprobe'),
    path.join(process.cwd(), 'node_modules', '@ffprobe-installer', 'darwin-x64', 'ffprobe'),
    path.join(process.cwd(), 'node_modules', '@ffprobe-installer', 'linux-x64', 'ffprobe'),
    path.join(process.cwd(), 'node_modules', '@ffprobe-installer', 'win32-x64', 'ffprobe.exe'),
    '/opt/homebrew/bin/ffprobe',
    '/usr/local/bin/ffprobe',
    '/usr/bin/ffprobe',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      return candidate;
    }
  }
  return 'ffprobe';
}

/**
 * Validates file signature (magic bytes) to prevent extension spoofing
 */
export function validateMediaFileSignature(filePath: string): { isValid: boolean; detectedType?: string } {
  if (!fs.existsSync(filePath)) {
    return { isValid: false };
  }

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(32);
  const bytesRead = fs.readSync(fd, buffer, 0, 32, 0);
  fs.closeSync(fd);

  if (bytesRead < 8) {
    return { isValid: false };
  }

  // 1. MP4 / MOV: bytes 4-7 are 'ftyp'
  const brand = buffer.toString('ascii', 4, 8);
  if (brand === 'ftyp') {
    const majorBrand = buffer.toString('ascii', 8, 12).trim();
    return { isValid: true, detectedType: `video/mp4 (${majorBrand})` };
  }

  // 2. QuickTime MOV legacy tags (mdat, moov, wide)
  const legacyTag = buffer.toString('ascii', 4, 8);
  if (legacyTag === 'moov' || legacyTag === 'mdat' || legacyTag === 'wide') {
    return { isValid: true, detectedType: 'video/quicktime' };
  }

  // 3. WebM / Matroska: 0x1A 0x45 0xDF 0xA3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { isValid: true, detectedType: 'video/webm' };
  }

  return { isValid: false };
}

/**
 * Deep media inspection using ffprobe with JSON output.
 * Extracts duration, resolution, codecs, frame rates, and audio streams.
 */
export async function probeMedia(filePath: string): Promise<MediaProbeResult> {
  if (!fs.existsSync(filePath)) {
    return {
      isValid: false,
      format: 'unknown',
      duration: 0,
      width: 0,
      height: 0,
      fps: 0,
      codec: 'none',
      hasAudio: false,
      hasVideo: false,
      error: `File does not exist: ${filePath}`,
    };
  }

  // Verify magic bytes
  const sig = validateMediaFileSignature(filePath);
  if (!sig.isValid) {
    return {
      isValid: false,
      format: 'unknown',
      duration: 0,
      width: 0,
      height: 0,
      fps: 0,
      codec: 'none',
      hasAudio: false,
      hasVideo: false,
      error: 'Invalid media file: Failed magic byte signature check (not an MP4, MOV, or WebM).',
    };
  }

  const ffprobePath = getFfprobePath();

  return new Promise((resolve) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const proc = spawn(/*turbopackIgnore: true*/ ffprobePath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        resolve({
          isValid: false,
          format: 'corrupt',
          duration: 0,
          width: 0,
          height: 0,
          fps: 0,
          codec: 'unknown',
          hasAudio: false,
          hasVideo: false,
          error: stderr.trim() || 'FFprobe failed to inspect media container.',
        });
        return;
      }

      try {
        const metadata = JSON.parse(stdout);
        const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
        const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');

        if (!videoStream && !audioStream) {
          resolve({
            isValid: false,
            format: metadata.format?.format_name || 'unknown',
            duration: 0,
            width: 0,
            height: 0,
            fps: 0,
            codec: 'none',
            hasAudio: false,
            hasVideo: false,
            error: 'No valid video or audio streams detected in file.',
          });
          return;
        }

        // Parse frame rate (e.g. "30/1" or "29.97")
        let fps = 30;
        if (videoStream?.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          if (parts.length === 2 && Number(parts[1]) > 0) {
            fps = Number((Number(parts[0]) / Number(parts[1])).toFixed(2));
          } else {
            fps = Number(videoStream.r_frame_rate) || 30;
          }
        }

        const duration = Number(
          videoStream?.duration ||
          audioStream?.duration ||
          metadata.format?.duration ||
          0
        );

        const width = Number(videoStream?.width || 0);
        const height = Number(videoStream?.height || 0);
        const codec = videoStream?.codec_name || 'none';
        const audioCodec = audioStream?.codec_name;
        const sampleRate = audioStream?.sample_rate ? Number(audioStream.sample_rate) : undefined;
        const channels = audioStream?.channels ? Number(audioStream.channels) : undefined;
        const bitrate = metadata.format?.bit_rate ? Number(metadata.format.bit_rate) : undefined;

        // Check rotation in side data or tags
        let rotation = 0;
        if (videoStream?.tags?.rotate) {
          rotation = Number(videoStream.tags.rotate) || 0;
        }

        resolve({
          isValid: true,
          format: metadata.format?.format_name || 'mp4',
          duration: Number(duration.toFixed(3)),
          width,
          height,
          fps,
          codec,
          audioCodec,
          hasAudio: Boolean(audioStream),
          hasVideo: Boolean(videoStream),
          sampleRate,
          channels,
          bitrate,
          rotation,
          colorSpace: videoStream?.color_space,
        });
      } catch (err: any) {
        resolve({
          isValid: false,
          format: 'corrupt',
          duration: 0,
          width: 0,
          height: 0,
          fps: 0,
          codec: 'unknown',
          hasAudio: false,
          hasVideo: false,
          error: `Failed to parse probe JSON output: ${err.message}`,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        isValid: false,
        format: 'error',
        duration: 0,
        width: 0,
        height: 0,
        fps: 0,
        codec: 'unknown',
        hasAudio: false,
        hasVideo: false,
        error: `Could not launch ffprobe: ${err.message}`,
      });
    });
  });
}
