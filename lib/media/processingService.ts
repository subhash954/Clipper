/**
 * CLIPPER MEDIA PROCESSING SERVICE
 * Deep FFprobe inspection, real FFmpeg editing proxy generation, and thumbnail creation.
 * Zero synthetic boxes, zero fake media.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { probeMedia, validateMediaFileSignature, MediaProbeResult } from './probeService';
import { getFfmpegPath } from '../renderEngine';
import { getStorageService } from '../storage/storageService';
import { ClipperError } from '../errors';

export interface ProcessMediaResult {
  probe: MediaProbeResult;
  proxyKey?: string;
  proxyUrl?: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  audioKey?: string;
  audioUrl?: string;
}

export class MediaProcessingService {
  /**
   * Generates a fast 720p H.264 proxy video optimized for smooth scrubbing in the studio editor.
   */
  async generateEditingProxy(
    sourcePath: string,
    tempDir: string
  ): Promise<{ localPath: string; duration: number }> {
    if (!fs.existsSync(sourcePath)) {
      throw new ClipperError('MEDIA_UNAVAILABLE', `Source file not found for proxy generation: ${sourcePath}`, 404);
    }

    const proxyFileName = `proxy_${Date.now()}.mp4`;
    const proxyLocalPath = path.join(tempDir, proxyFileName);
    const ffmpeg = getFfmpegPath();

    const args = [
      '-y',
      '-i', sourcePath,
      '-vf', 'scale=-2:720',      // 720p height preserving aspect ratio
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '24',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      proxyLocalPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpeg, args);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(proxyLocalPath)) {
          resolve();
        } else {
          reject(new ClipperError('RENDER_FAILED', `FFmpeg proxy generation failed (code ${code}): ${stderr.slice(-200)}`, 500));
        }
      });
      proc.on('error', reject);
    });

    const stat = fs.statSync(proxyLocalPath);
    if (stat.size === 0) {
      throw new ClipperError('RENDER_FAILED', 'Generated proxy file has zero bytes.', 500);
    }

    return { localPath: proxyLocalPath, duration: 0 };
  }

  /**
   * Extracts an authentic high-resolution video thumbnail at 10% into the timeline.
   */
  async generateThumbnail(
    sourcePath: string,
    tempDir: string,
    captureOffsetSeconds: number = 1.0
  ): Promise<string> {
    if (!fs.existsSync(sourcePath)) {
      throw new ClipperError('MEDIA_UNAVAILABLE', `Source file not found for thumbnail generation: ${sourcePath}`, 404);
    }

    const thumbFileName = `thumb_${Date.now()}.jpg`;
    const thumbLocalPath = path.join(tempDir, thumbFileName);
    const ffmpeg = getFfmpegPath();

    const args = [
      '-y',
      '-ss', captureOffsetSeconds.toString(),
      '-i', sourcePath,
      '-vframes', '1',
      '-q:v', '2',
      thumbLocalPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpeg, args);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(thumbLocalPath)) {
          resolve();
        } else {
          // If frame extraction at offset failed, try at 0.0s
          const fallbackArgs = ['-y', '-ss', '0.0', '-i', sourcePath, '-vframes', '1', '-q:v', '2', thumbLocalPath];
          const fallbackProc = spawn(ffmpeg, fallbackArgs);
          fallbackProc.on('close', (fCode) => {
            if (fCode === 0 && fs.existsSync(thumbLocalPath)) {
              resolve();
            } else {
              reject(new ClipperError('RENDER_FAILED', `Thumbnail extraction failed: ${stderr.slice(-200)}`, 500));
            }
          });
          fallbackProc.on('error', reject);
        }
      });
      proc.on('error', reject);
    });

    return thumbLocalPath;
  }

  /**
   * Complete media verification & processing pipeline:
   * Probes metadata, generates proxy, extracts thumbnail, uploads to storage.
   */
  async processMediaAsset(params: {
    userId: string;
    projectId: string;
    mediaId: string;
    localSourcePath: string;
  }): Promise<ProcessMediaResult> {
    const { userId, projectId, mediaId, localSourcePath } = params;
    const storageService = getStorageService();

    // 1. File signature check
    const sig = validateMediaFileSignature(localSourcePath);
    if (!sig.isValid) {
      throw new ClipperError(
        'MEDIA_INVALID',
        'Invalid media file signature. Only valid MP4, QuickTime MOV, and WebM containers are supported.',
        400
      );
    }

    // 2. Deep FFprobe inspection
    const probe = await probeMedia(localSourcePath);
    if (!probe.isValid || !probe.hasVideo) {
      throw new ClipperError(
        'MEDIA_INVALID',
        `Video probe failed: ${probe.error || 'Media container has no readable video streams.'}`,
        400
      );
    }

    const tempDir = path.join(process.cwd(), 'data', 'temp_processing', mediaId);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // 3. Generate thumbnail
      const thumbOffset = Math.min(2.0, Math.max(0.5, probe.duration * 0.1));
      const thumbLocalPath = await this.generateThumbnail(localSourcePath, tempDir, thumbOffset);
      const thumbBuffer = fs.readFileSync(thumbLocalPath);

      const thumbnailKey = storageService.generateCanonicalStorageKey({
        userId,
        projectId,
        mediaId,
        artifactType: 'thumbnails',
        fileName: 'thumbnail.jpg',
      });

      const thumbUpload = await storageService.upload(thumbnailKey, thumbBuffer, {
        contentType: 'image/jpeg',
      });
      const thumbnailUrl = thumbUpload.publicUrl;

      // 4. Generate editing proxy
      const proxyResult = await this.generateEditingProxy(localSourcePath, tempDir);
      const proxyBuffer = fs.readFileSync(proxyResult.localPath);

      const proxyKey = storageService.generateCanonicalStorageKey({
        userId,
        projectId,
        mediaId,
        artifactType: 'proxy',
        fileName: 'proxy-720p.mp4',
      });

      const proxyUpload = await storageService.upload(proxyKey, proxyBuffer, {
        contentType: 'video/mp4',
      });
      const proxyUrl = proxyUpload.publicUrl;

      return {
        probe,
        proxyKey,
        proxyUrl,
        thumbnailKey,
        thumbnailUrl,
      };
    } finally {
      // Clean up temporary processing scratch
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

let mediaProcessingInstance: MediaProcessingService | null = null;

export function getMediaProcessingService(): MediaProcessingService {
  if (!mediaProcessingInstance) {
    mediaProcessingInstance = new MediaProcessingService();
  }
  return mediaProcessingInstance;
}
