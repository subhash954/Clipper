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
 * Validates array of word timestamps to guarantee chronology, non-negative boundaries,
 * finite numbers, and chronological sequence progression without inverted timestamps.
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
    if (typeof w.start !== 'number' || isNaN(w.start) || !isFinite(w.start) || w.start < 0) {
      errors.push(`Word "${w.word}" at index ${i} has invalid start time (${w.start})`);
    }
    if (typeof w.end !== 'number' || isNaN(w.end) || !isFinite(w.end) || w.end < w.start) {
      errors.push(`Word "${w.word}" at index ${i} has invalid end time (${w.end} < start ${w.start})`);
    }
    if (w.confidence !== undefined && (typeof w.confidence !== 'number' || isNaN(w.confidence) || !isFinite(w.confidence) || w.confidence < 0 || w.confidence > 1)) {
      errors.push(`Word "${w.word}" at index ${i} has out-of-range confidence (${w.confidence})`);
    }

    // Sequence-level chronological validation with previous word
    if (i > 0) {
      const prev = words[i - 1];
      if (typeof prev.start === 'number' && typeof w.start === 'number') {
        if (w.start < prev.start) {
          errors.push(
            `Non-chronological word sequence: word "${w.word}" at index ${i} starts at ${w.start}s, before previous word "${prev.word}" at ${prev.start}s`
          );
        }
        if (w.end < prev.start) {
          errors.push(
            `Impossible timing overlap: word "${w.word}" at index ${i} ends at ${w.end}s before previous word "${prev.word}" starts at ${prev.start}s`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates array of transcript segments for non-negative bounds, finite values, and chronological order.
 */
export function validateTranscriptSegments(segments: TranscriptSegment[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(segments)) {
    return { valid: false, errors: ['Segments must be an array'] };
  }

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (typeof s.text !== 'string' || s.text.trim() === '') {
      errors.push(`Segment at index ${i} has empty or non-string text property`);
    }
    if (typeof s.start !== 'number' || isNaN(s.start) || !isFinite(s.start) || s.start < 0) {
      errors.push(`Segment at index ${i} has invalid start time (${s.start})`);
    }
    if (typeof s.end !== 'number' || isNaN(s.end) || !isFinite(s.end) || s.end < s.start) {
      errors.push(`Segment at index ${i} has invalid end time (${s.end} < start ${s.start})`);
    }
    if (s.confidence !== undefined && (typeof s.confidence !== 'number' || isNaN(s.confidence) || !isFinite(s.confidence) || s.confidence < 0 || s.confidence > 1)) {
      errors.push(`Segment at index ${i} has out-of-range confidence (${s.confidence})`);
    }

    // Chronological progression
    if (i > 0) {
      const prev = segments[i - 1];
      if (typeof prev.start === 'number' && typeof s.start === 'number') {
        if (s.start < prev.start) {
          errors.push(
            `Non-chronological segment sequence: segment at index ${i} starts at ${s.start}s, before previous segment at ${prev.start}s`
          );
        }
      }
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
 * Calculates estimated Deepgram Nova-2 dollar cost based on media duration.
 * Nova-2 standard tier: $0.0043 per audio minute ($0.00007167 per second).
 * NOTE: This is an estimated processing cost, not actual provider billing.
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

    const isDevLocalAllowed =
      process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOCAL_STORAGE === 'true';

    // 1. Verify Authentication (Fail-closed in production)
    let currentUserId: string;
    if (userId) {
      currentUserId = userId;
    } else if (isDevLocalAllowed) {
      currentUserId = DEV_DEFAULT_USER_ID;
    } else {
      throw new ClipperError(
        'AUTH_REQUIRED',
        'Authenticated user identity is required for transcription in production.',
        401
      );
    }

    // 2. Verify Project Existence and Ownership
    const project = await storage.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found.`, 404);
    }

    if (project.userId && project.userId !== currentUserId) {
      throw new ClipperError('FORBIDDEN', `Access denied: you do not own project ${projectId}.`, 403);
    }

    // 3. Resolve Active Media Asset & Verify Tenant & Project Integrity
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
      if (mediaAsset.projectId && mediaAsset.projectId !== projectId) {
        throw new ClipperError(
          'FORBIDDEN',
          `Media asset ${targetMediaId} belongs to project ${mediaAsset.projectId}, not project ${projectId}.`,
          403
        );
      }
      if ((mediaAsset as any).deletedAt) {
        throw new ClipperError(
          'MEDIA_UNAVAILABLE',
          `Media asset ${targetMediaId} has been deleted.`,
          410
        );
      }
      if (mediaAsset.status === 'failed') {
        throw new ClipperError(
          'MEDIA_UNAVAILABLE',
          `Media asset ${targetMediaId} processing failed and cannot be transcribed.`,
          422
        );
      }
    }

    // 4. Idempotency Check: Cache key distinguishes project, targetMediaId, provider, and model
    if (!forceRerun) {
      const existingTranscript = await storage.getTranscript(projectId);
      const isMediaMatch = targetMediaId
        ? existingTranscript?.mediaAssetId === targetMediaId
        : true;
      const isProviderMatch =
        (existingTranscript?.provider || 'deepgram') === 'deepgram' &&
        (existingTranscript?.model || 'nova-2') === 'nova-2';

      if (
        existingTranscript &&
        existingTranscript.status === 'completed' &&
        existingTranscript.words &&
        existingTranscript.words.length > 0 &&
        isMediaMatch &&
        isProviderMatch
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

    // 5. Update Project Status to Transcribing
    try {
      project.status = 'transcribing';
      await storage.saveProject(project);
    } catch (e) {
      console.warn('Status update to transcribing warning:', e);
    }

    // 6. Resolve Audio for Transcription (Storage Authority: Bunny in Production)
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

        let sourceVideoPath: string | null = null;

        // In development/test mode only, inspect local file paths if explicitly permitted
        if (isDevLocalAllowed) {
          if (mediaAsset.storagePath && fs.existsSync(mediaAsset.storagePath)) {
            sourceVideoPath = mediaAsset.storagePath;
          } else if (mediaAsset.fileUrl && !mediaAsset.fileUrl.startsWith('http')) {
            const localCandidate = path.join(process.cwd(), 'public', mediaAsset.fileUrl.replace(/^\//, ''));
            if (fs.existsSync(localCandidate)) {
              sourceVideoPath = localCandidate;
            }
          }
        }

        // Authoritative storage resolution: Bunny StorageService
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

        // Extract audio container using FFmpeg
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

      // 7. Invoke Deepgram Nova-2 STT
      const rawTranscript = await transcribeWithDeepgram({
        audioBuffer: resolvedAudioBuffer,
        audioUrl: resolvedAudioUrl,
        mimetype: params.mimetype || 'audio/mp3',
      });

      // 8. Validate Word Timestamps with sequence checks (Fail closed on malformed data)
      const validation = validateWordTimestamps(rawTranscript.words);
      if (!validation.valid) {
        throw new ClipperError(
          'TRANSCRIPTION_FAILED',
          `Provider returned malformed word timestamps: ${validation.errors.join('; ')}`,
          502
        );
      }

      // 9. Generate Normalized Segments & Relational Words
      const transcriptId = ensureValidUuid();
      const rawUtterances = rawTranscript.utterances || [];
      const segments: TranscriptSegment[] = [];
      let finalWords: NormalizedTranscriptWord[] = [];

      if (rawUtterances.length > 0) {
        rawUtterances.forEach((u, idx) => {
          const segmentId = ensureValidUuid();
          const segmentWords: WordTimestamp[] = (u.words || []).map((w: any, wIdx: number) => {
            const wordObj: NormalizedTranscriptWord = {
              id: ensureValidUuid((w as any).id),
              transcriptId,
              segmentId,
              wordIndex: finalWords.length + wIdx,
              word: w.word,
              start: w.start,
              end: w.end,
              confidence: w.confidence,
              speaker: w.speaker ?? u.speaker,
            };
            return wordObj;
          });

          segments.push({
            id: segmentId,
            transcriptId,
            segmentIndex: idx,
            start: u.start,
            end: u.end,
            text: u.text,
            speaker: u.speaker,
            words: segmentWords,
          });

          finalWords = finalWords.concat(segmentWords as NormalizedTranscriptWord[]);
        });
      } else if (rawTranscript.words && rawTranscript.words.length > 0) {
        let currentChunk: WordTimestamp[] = [];
        let segIdx = 0;

        for (let i = 0; i < rawTranscript.words.length; i++) {
          const w = rawTranscript.words[i];
          currentChunk.push(w);

          const nextWord = rawTranscript.words[i + 1];
          const hasPause = nextWord && nextWord.start - w.end > 0.5;
          const isAtLimit = currentChunk.length >= 12;

          if (hasPause || isAtLimit || i === rawTranscript.words.length - 1) {
            const segId = ensureValidUuid();
            const start = currentChunk[0].start;
            const end = currentChunk[currentChunk.length - 1].end;
            const text = currentChunk.map((cw) => cw.word).join(' ');

            const segmentWords: WordTimestamp[] = currentChunk.map((cw, cwIdx) => {
              const wordObj: NormalizedTranscriptWord = {
                id: ensureValidUuid((cw as any).id),
                transcriptId,
                segmentId: segId,
                wordIndex: finalWords.length + cwIdx,
                word: cw.word,
                start: cw.start,
                end: cw.end,
                confidence: cw.confidence,
                speaker: cw.speaker,
              };
              return wordObj;
            });

            segments.push({
              id: segId,
              transcriptId,
              segmentIndex: segIdx++,
              start,
              end,
              text,
              words: segmentWords,
            });

            finalWords = finalWords.concat(segmentWords as NormalizedTranscriptWord[]);
            currentChunk = [];
          }
        }
      }

      // If words were not partitioned into segments, use rawTranscript.words directly
      if (finalWords.length === 0 && rawTranscript.words) {
        finalWords = rawTranscript.words.map((w, idx) => ({
          id: ensureValidUuid((w as any).id),
          transcriptId,
          wordIndex: idx,
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
          speaker: w.speaker,
        }));
      }

      // Validate segment sequence
      if (segments.length > 0) {
        const segValidation = validateTranscriptSegments(segments);
        if (!segValidation.valid) {
          throw new ClipperError(
            'TRANSCRIPTION_FAILED',
            `Provider returned malformed segment sequence: ${segValidation.errors.join('; ')}`,
            502
          );
        }
      }

      const lastWord = finalWords.length > 0 ? finalWords[finalWords.length - 1] : undefined;
      const durationSeconds = rawTranscript.duration || (lastWord ? lastWord.end : 0);

      // 10. Assemble Canonical Transcript Record
      const finalTranscript: Transcript = {
        id: transcriptId,
        projectId,
        mediaAssetId: targetMediaId || undefined,
        text: rawTranscript.text,
        words: finalWords,
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

      // 11. Persist Transcript Relational Child Tables and Project State
      await storage.saveTranscript(finalTranscript, projectId);

      project.transcript = finalTranscript;
      project.status = 'transcript_ready';
      if (targetMediaId) {
        project.activeMediaId = targetMediaId;
      }
      await storage.saveProject(project);

      // 12. Record Cost Telemetry (Estimated Processing Cost)
      const costUSD = calculateDeepgramCost(durationSeconds);
      await storage.recordCostTelemetry({
        projectId,
        userId: currentUserId,
        serviceName: 'deepgram_stt',
        model: 'nova-2',
        unitsUsed: parseFloat((durationSeconds / 60).toFixed(2)),
        unitType: 'minutes',
        costInUSD: costUSD,
        isEstimated: true,
      });

      return {
        success: true,
        transcriptId,
        transcript: finalTranscript,
        isCached: false,
        wordsCount: finalWords.length,
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
