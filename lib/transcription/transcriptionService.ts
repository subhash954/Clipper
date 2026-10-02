/**
 * CLIPPER PHASE 4: CANONICAL TRANSCRIPTION SERVICE
 * Production-grade word-level speech-to-text pipeline with Deepgram Nova-2.
 * Idempotent, tenant-isolated, relational database persistence, and cost telemetry.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  Transcript,
  TranscriptSegment,
  WordTimestamp,
  NormalizedTranscriptWord,
  Project,
  MediaAsset,
} from '../types';
import { transcribeWithDeepgram, DeepgramProviderError } from '../providers/deepgramProvider';
import { extractAudioFromVideo } from '../media/audioExtraction';
import { getStorage, ensureValidUuid, DEV_DEFAULT_USER_ID, getMediaAssetById } from '../storage';
import { getStorageService } from '../storage/storageService';
import { ClipperError } from '../errors';

export interface TranscribeProjectParams {
  projectId: string;
  mediaId?: string;
  userId?: string;
  forceRerun?: boolean;
  audioBuffer?: Buffer;
  audioUrl?: string;
  mimetype?: string;
}

export interface TranscribeProjectResult {
  success: boolean;
  transcriptId: string;
  transcript: Transcript;
  isCached: boolean;
  wordsCount: number;
  durationSeconds: number;
}

/**
 * Validates array of word timestamps to guarantee chronology and non-negative boundaries.
 */
export function validateWordTimestamps(words: WordTimestamp[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(words)) {
    return { valid: false, errors: ['Words must be an array'] };
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (typeof w.word !== 'string' || w.word.trim() === '') {
      errors.push(`Word at index ${i} has empty or non-string word property`);
    }
    if (typeof w.start !== 'number' || isNaN(w.start) || w.start < 0) {
      errors.push(`Word "${w.word}" at index ${i} has invalid start time (${w.start})`);
    }
    if (typeof w.end !== 'number' || isNaN(w.end) || w.end < w.start) {
      errors.push(`Word "${w.word}" at index ${i} has invalid end time (${w.end} < start ${w.start})`);
    }
    if (w.confidence !== undefined && (w.confidence < 0 || w.confidence > 1)) {
      errors.push(`Word "${w.word}" at index ${i} has out-of-range confidence (${w.confidence})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Deterministically finds the active word given an absolute playback timecode.
 */
export function findActiveWordAtTime(words: WordTimestamp[], timeInSeconds: number): WordTimestamp | null {
  if (!words || words.length === 0 || timeInSeconds < 0) return null;

  // Exact interval check: start <= time < end
  const match = words.find((w) => timeInSeconds >= w.start && timeInSeconds <= w.end);
  if (match) return match;

  // Tolerance window of 50ms before/after word boundaries for smooth playhead tracking
  const toleranceMatch = words.find((w) => timeInSeconds >= w.start - 0.05 && timeInSeconds <= w.end + 0.05);
  return toleranceMatch || null;
}

/**
 * Deterministically finds the active transcript segment given an absolute playback timecode.
 */
export function findActiveSegmentAtTime(
  segments: TranscriptSegment[],
  timeInSeconds: number
): TranscriptSegment | null {
  if (!segments || segments.length === 0 || timeInSeconds < 0) return null;
  return segments.find((s) => timeInSeconds >= s.start && timeInSeconds <= s.end) || null;
}

/**
 * Calculates Deepgram Nova-2 dollar cost based on media duration.
 * Nova-2 standard tier: $0.0043 per audio minute ($0.00007167 per second).
 */
export function calculateDeepgramCost(durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  const minutes = durationSeconds / 60;
  return parseFloat((minutes * 0.0043).toFixed(6));
}

export class TranscriptionService {
  /**
   * Main entry point: transcribes media for a given project with tenant isolation and idempotency.
   */
  async transcribeProjectMedia(params: TranscribeProjectParams): Promise<TranscribeProjectResult> {
    const { projectId, mediaId, userId, forceRerun = false } = params;
    const storage = getStorage();

    // 1. Verify Project Existence and Ownership
    const project = await storage.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found.`, 404);
    }

    const currentUserId = userId || DEV_DEFAULT_USER_ID;
    if (project.userId && project.userId !== currentUserId) {
      throw new ClipperError('FORBIDDEN', `Access denied: you do not own project ${projectId}.`, 403);
    }

    // 2. Resolve Active Media Asset
    const targetMediaId = mediaId || project.activeMediaId;
    let mediaAsset: MediaAsset | null = null;

    if (targetMediaId) {
      mediaAsset = await getMediaAssetById(targetMediaId);
      if (!mediaAsset) {
        throw new ClipperError('NOT_FOUND', `Media asset ${targetMediaId} not found.`, 404);
      }
      if (mediaAsset.userId && mediaAsset.userId !== currentUserId) {
        throw new ClipperError(
          'MEDIA_NOT_OWNED',
          `Access denied: media asset ${targetMediaId} belongs to another user.`,
          403
        );
      }
    }

    // 3. Idempotency Check: Return existing completed transcript if valid and rerun not forced
    if (!forceRerun) {
      const existingTranscript = await storage.getTranscript(projectId);
      if (
        existingTranscript &&
        existingTranscript.status === 'completed' &&
        existingTranscript.words &&
        existingTranscript.words.length > 0 &&
        (!targetMediaId || !existingTranscript.mediaAssetId || existingTranscript.mediaAssetId === targetMediaId)
      ) {
        const dur = existingTranscript.duration || (existingTranscript.words[existingTranscript.words.length - 1]?.end ?? 0);
        return {
          success: true,
          transcriptId: existingTranscript.id || ensureValidUuid(),
          transcript: existingTranscript,
          isCached: true,
          wordsCount: existingTranscript.words.length,
          durationSeconds: dur,
        };
      }
    }

    // 4. Update Project Status to Transcribing
    try {
      project.status = 'transcribing';
      await storage.saveProject(project);
    } catch (e) {
      // Non-fatal if project update encounters optimistic concurrency
      console.warn('Status update to transcribing warning:', e);
    }

    // 5. Resolve Audio for Transcription
    let resolvedAudioBuffer = params.audioBuffer;
    let resolvedAudioUrl = params.audioUrl;
    let tempFilesToCleanup: string[] = [];

    try {
      if (!resolvedAudioBuffer && !resolvedAudioUrl) {
        if (!mediaAsset) {
          throw new ClipperError(
            'MEDIA_UNAVAILABLE',
            'No audio buffer, audio URL, or media asset provided for transcription.',
            400
          );
        }

        // Try downloading/reading media asset
        let sourceVideoPath: string | null = null;

        // Check local filesystem first
        if (mediaAsset.storagePath && fs.existsSync(mediaAsset.storagePath)) {
          sourceVideoPath = mediaAsset.storagePath;
        } else if (mediaAsset.fileUrl && !mediaAsset.fileUrl.startsWith('http')) {
          const localCandidate = path.join(process.cwd(), 'public', mediaAsset.fileUrl.replace(/^\//, ''));
          if (fs.existsSync(localCandidate)) {
            sourceVideoPath = localCandidate;
          }
        }

        // If not found locally, fetch from StorageService (Bunny Storage)
        if (!sourceVideoPath) {
          try {
            const storageService = getStorageService();
            const storageKey = mediaAsset.storageKey || mediaAsset.storagePath || `uploads/${mediaAsset.id}.mp4`;
            const mediaBuffer = await storageService.getObject(storageKey);
            const tempSourcePath = path.join(os.tmpdir(), `clipper_transcribe_${mediaAsset.id}_${Date.now()}.mp4`);
            fs.writeFileSync(tempSourcePath, mediaBuffer);
            sourceVideoPath = tempSourcePath;
            tempFilesToCleanup.push(tempSourcePath);
          } catch (storageErr: any) {
            // If storage key download failed, try downloadUrl
            if (mediaAsset.fileUrl && mediaAsset.fileUrl.startsWith('http')) {
              resolvedAudioUrl = mediaAsset.fileUrl;
            } else {
              throw new ClipperError(
                'MEDIA_UNAVAILABLE',
                `Failed to locate or download media asset ${mediaAsset.id}: ${storageErr.message}`,
                500
              );
            }
          }
        }

        // If we have a local video file, extract audio using FFmpeg
        if (sourceVideoPath) {
          const tempAudioPath = path.join(os.tmpdir(), `clipper_audio_${Date.now()}.mp3`);
          tempFilesToCleanup.push(tempAudioPath);

          const extractResult = await extractAudioFromVideo(sourceVideoPath, tempAudioPath);
          if (!extractResult.success || !fs.existsSync(tempAudioPath)) {
            throw new ClipperError(
              'TRANSCRIPTION_FAILED',
              `Failed to extract audio from video: ${extractResult.error || 'Unknown FFmpeg error'}`,
              500
            );
          }

          resolvedAudioBuffer = fs.readFileSync(tempAudioPath);
        }
      }

      // 6. Invoke Deepgram Nova-2 STT
      const rawTranscript = await transcribeWithDeepgram({
        audioBuffer: resolvedAudioBuffer,
        audioUrl: resolvedAudioUrl,
        mimetype: params.mimetype || 'audio/mp3',
      });

      // 7. Validate Word Timestamps
      const validation = validateWordTimestamps(rawTranscript.words);
      if (!validation.valid) {
        console.warn('Word timestamp validation warnings:', validation.errors);
      }

      // 8. Generate Normalized Segments & Child Relations
      const transcriptId = ensureValidUuid();
      const rawWords = rawTranscript.words || [];
      const rawUtterances = rawTranscript.utterances || [];

      // Build structured segments
      const segments: TranscriptSegment[] = [];

      if (rawUtterances.length > 0) {
        rawUtterances.forEach((u, idx) => {
          segments.push({
            id: ensureValidUuid(),
            transcriptId,
            segmentIndex: idx,
            start: u.start,
            end: u.end,
            text: u.text,
            speaker: u.speaker,
            words: u.words,
          });
        });
      } else if (rawWords.length > 0) {
        // Fallback: chunk words into segments by natural pauses (> 0.5s) or 10 words
        let currentChunk: WordTimestamp[] = [];
        let segIdx = 0;

        for (let i = 0; i < rawWords.length; i++) {
          const w = rawWords[i];
          currentChunk.push(w);

          const nextWord = rawWords[i + 1];
          const hasPause = nextWord && nextWord.start - w.end > 0.5;
          const isAtLimit = currentChunk.length >= 12;

          if (hasPause || isAtLimit || i === rawWords.length - 1) {
            const start = currentChunk[0].start;
            const end = currentChunk[currentChunk.length - 1].end;
            const text = currentChunk.map((cw) => cw.word).join(' ');

            segments.push({
              id: ensureValidUuid(),
              transcriptId,
              segmentIndex: segIdx++,
              start,
              end,
              text,
              words: [...currentChunk],
            });
            currentChunk = [];
          }
        }
      }

      const lastWord = rawWords.length > 0 ? rawWords[rawWords.length - 1] : undefined;
      const durationSeconds = rawTranscript.duration || (lastWord ? lastWord.end : 0);

      // 9. Assemble Canonical Transcript Record
      const finalTranscript: Transcript = {
        id: transcriptId,
        projectId,
        mediaAssetId: targetMediaId || undefined,
        text: rawTranscript.text,
        words: rawWords,
        utterances: rawUtterances,
        segments,
        language: rawTranscript.language || 'en',
        source: 'deepgram',
        provider: 'deepgram',
        model: 'nova-2',
        duration: durationSeconds,
        timingPrecision: 'exact_word',
        timingLabel: 'Deepgram Nova-2 Word-Level Alignment',
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 10. Persist Transcript Relational Child Tables and Project State
      await storage.saveTranscript(finalTranscript, projectId);

      project.transcript = finalTranscript;
      project.status = 'transcript_ready';
      if (targetMediaId) {
        project.activeMediaId = targetMediaId;
      }
      await storage.saveProject(project);

      // 11. Record Cost Telemetry
      const costUSD = calculateDeepgramCost(durationSeconds);
      await storage.recordCostTelemetry({
        projectId,
        userId: currentUserId,
        serviceName: 'deepgram_stt',
        model: 'nova-2',
        unitsUsed: parseFloat((durationSeconds / 60).toFixed(2)),
        unitType: 'minutes',
        costInUSD: costUSD,
        isEstimated: false,
      });

      return {
        success: true,
        transcriptId,
        transcript: finalTranscript,
        isCached: false,
        wordsCount: rawWords.length,
        durationSeconds,
      };
    } catch (err: any) {
      // Mark project failed if error occurs
      try {
        project.status = 'failed';
        project.errorMessage = err.message || 'Transcription failed';
        await storage.saveProject(project);
      } catch {}

      if (err instanceof ClipperError || err instanceof DeepgramProviderError) {
        throw err;
      }
      throw new ClipperError('TRANSCRIPTION_FAILED', `Transcription failed: ${err.message}`, 500);
    } finally {
      // Cleanup temporary extracted files
      for (const tempFile of tempFilesToCleanup) {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch {}
      }
    }
  }
}

// Singleton instance
let transcriptionServiceInstance: TranscriptionService | null = null;

export function getTranscriptionService(): TranscriptionService {
  if (!transcriptionServiceInstance) {
    transcriptionServiceInstance = new TranscriptionService();
  }
  return transcriptionServiceInstance;
}
