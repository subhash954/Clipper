import { getStorage } from '../storage';
import { ClipperError } from '../errors';
import { SubtitleStyle, SubtitleLanguage } from '../types';
import {
  CaptionTrack,
  CaptionCue,
  CaptionSegmentationConfig,
  CaptionFormat,
} from './types';
import { segmentTranscriptIntoCues } from './segmentationEngine';
import { validateCaptionCues } from './validation';
import { generateSrt } from './serializers/srt';
import { generateWebVtt } from './serializers/vtt';
import { generateAss } from './serializers/ass';
import { extractCaptionEmphases } from '../intelligence/engines/captionEmphasisEngine';

export interface GenerateCaptionsParams {
  projectId: string;
  userId: string;
  transcriptId?: string;
  mediaAssetId?: string;
  language?: SubtitleLanguage;
  style?: SubtitleStyle;
  config?: Partial<CaptionSegmentationConfig>;
  forceRegenerate?: boolean;
}

export interface UpdateCueParams {
  projectId: string;
  trackId: string;
  cueId: string;
  userId: string;
  updates: Partial<CaptionCue>;
}

export interface ExportCaptionsParams {
  projectId: string;
  trackId?: string;
  version?: number;
  userId: string;
  format: CaptionFormat;
  styleOverride?: Partial<SubtitleStyle>;
}

export class CaptionService {
  /**
   * Generates a canonical caption track from the authoritative transcript of a project.
   */
  async generateCaptionTrack(params: GenerateCaptionsParams): Promise<CaptionTrack> {
    const {
      projectId,
      userId,
      transcriptId,
      mediaAssetId,
      language = 'en',
      style,
      config,
      forceRegenerate = false,
    } = params;

    if (!userId) {
      throw new ClipperError('AUTH_REQUIRED', 'Authenticated user identity is required for captions.', 401);
    }

    const storage = getStorage();

    // 1. Verify Project and Ownership
    const project = await storage.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }
    if (project.userId && project.userId !== userId) {
      throw new ClipperError('FORBIDDEN', `Access denied: you do not own project ${projectId}`, 403);
    }

    // 2. Idempotency Check: if already exists and not forced, return existing
    if (!forceRegenerate && storage.getCaptionTrack) {
      const existing = await storage.getCaptionTrack(projectId);
      if (existing && existing.cues && existing.cues.length > 0) {
        return existing;
      }
    }

    // 3. Resolve Authoritative Transcript
    const transcript = await storage.getTranscript(projectId);
    if (!transcript) {
      throw new ClipperError(
        'NOT_FOUND',
        `No authoritative transcript exists for project ${projectId}. Run transcription first.`,
        404
      );
    }

    if (transcriptId && transcript.id !== transcriptId) {
      throw new ClipperError(
        'FORBIDDEN',
        `Transcript ${transcriptId} does not belong to project ${projectId}`,
        403
      );
    }

    const words = transcript.words || [];
    if (words.length === 0) {
      // Empty transcript produces an empty ready track
      const emptyTrack: CaptionTrack = {
        id: crypto.randomUUID(),
        projectId,
        transcriptId: transcript.id,
        mediaAssetId: mediaAssetId || transcript.mediaAssetId || project.activeMediaId,
        userId,
        language: (transcript.language as SubtitleLanguage) || language,
        version: 1,
        source: 'generated',
        status: 'ready',
        style,
        cues: [],
        cuesCount: 0,
        durationSeconds: transcript.duration || project.durationSeconds || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (storage.saveCaptionTrack) {
        return await storage.saveCaptionTrack(emptyTrack, userId);
      }
      return emptyTrack;
    }

    // 4. Extract Caption Emphases if appropriate
    const emphases = extractCaptionEmphases({
      projectId,
      words: words.map((w) => ({ word: w.word, start: w.start, end: w.end })),
    });

    // 5. Segment Words into Canonical Caption Cues
    const mediaDuration = transcript.duration || project.durationSeconds;
    const cues = segmentTranscriptIntoCues({
      projectId,
      transcriptId: transcript.id,
      words,
      mediaDuration,
      language: (transcript.language as SubtitleLanguage) || language,
      timingPrecision: transcript.timingPrecision || 'exact_word',
      config,
      emphases,
    });

    // 6. Validate Generated Cues
    const validation = validateCaptionCues(cues, { mediaDuration });
    if (!validation.valid) {
      throw new ClipperError(
        'VALIDATION_ERROR',
        `Caption segmentation produced invalid cues: ${validation.errors.join('; ')}`,
        500
      );
    }

    // 7. Assemble Canonical CaptionTrack
    const trackDuration = cues.length > 0 ? cues[cues.length - 1].end : (mediaDuration || 0);
    const newTrack: CaptionTrack = {
      id: crypto.randomUUID(),
      projectId,
      transcriptId: transcript.id,
      mediaAssetId: mediaAssetId || transcript.mediaAssetId || project.activeMediaId,
      userId,
      language: (transcript.language as SubtitleLanguage) || language,
      version: 1,
      source: 'generated',
      status: 'ready',
      style,
      cues,
      cuesCount: cues.length,
      durationSeconds: trackDuration,
      metadata: {
        segmentedAt: new Date().toISOString(),
        timingPrecision: transcript.timingPrecision || 'exact_word',
        provider: transcript.provider,
        model: transcript.model,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (storage.saveCaptionTrack) {
      return await storage.saveCaptionTrack(newTrack, userId);
    }

    return newTrack;
  }

  /**
   * Retrieves a caption track by project ID and optional version.
   */
  async getCaptionTrack(projectId: string, version?: number, userId?: string): Promise<CaptionTrack | null> {
    const storage = getStorage();

    const project = await storage.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }
    if (userId && project.userId && project.userId !== userId) {
      throw new ClipperError('FORBIDDEN', `Access denied: you do not own project ${projectId}`, 403);
    }

    if (storage.getCaptionTrack) {
      return await storage.getCaptionTrack(projectId, version);
    }
    return null;
  }

  /**
   * Updates an individual cue and creates a new edited version of the caption track,
   * preserving lineage and historical versions.
   */
  async updateCaptionCue(params: UpdateCueParams): Promise<CaptionTrack> {
    const { projectId, trackId, cueId, userId, updates } = params;

    const storage = getStorage();

    const project = await storage.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }
    if (project.userId && project.userId !== userId) {
      throw new ClipperError('FORBIDDEN', `Access denied: you do not own project ${projectId}`, 403);
    }

    if (!storage.getCaptionTrack || !storage.saveCaptionTrack) {
      throw new ClipperError('STORAGE_UNAVAILABLE', 'Caption storage is not available', 500);
    }

    const currentTrack = await storage.getCaptionTrack(projectId);
    if (!currentTrack || currentTrack.id !== trackId) {
      throw new ClipperError('NOT_FOUND', `Caption track ${trackId} not found for project ${projectId}`, 404);
    }

    const cueIndex = currentTrack.cues.findIndex((c) => c.id === cueId);
    if (cueIndex === -1) {
      throw new ClipperError('NOT_FOUND', `Cue ${cueId} not found in caption track`, 404);
    }

    const originalCue = currentTrack.cues[cueIndex];
    const updatedCue: CaptionCue = {
      ...originalCue,
      ...updates,
      id: originalCue.id,
      sequence: originalCue.sequence,
      source: 'edited',
      updatedAt: new Date().toISOString(),
    };

    // Replace in array
    const updatedCues = [...currentTrack.cues];
    updatedCues[cueIndex] = updatedCue;

    // Validate updated cue array
    const mediaDuration = project.durationSeconds || currentTrack.durationSeconds;
    const validation = validateCaptionCues(updatedCues, { mediaDuration });
    if (!validation.valid) {
      throw new ClipperError(
        'VALIDATION_ERROR',
        `Cue update violates timing constraints: ${validation.errors.join('; ')}`,
        400
      );
    }

    // Increment version to preserve immutable version history
    const nextVersion = (currentTrack.version || 1) + 1;
    const newEditedTrack: CaptionTrack = {
      ...currentTrack,
      id: crypto.randomUUID(),
      version: nextVersion,
      source: 'edited',
      cues: updatedCues,
      cuesCount: updatedCues.length,
      updatedAt: new Date().toISOString(),
    };

    return await storage.saveCaptionTrack(newEditedTrack, userId);
  }

  /**
   * Pure deterministic export of captions into SRT, WebVTT, or ASS format.
   */
  async exportCaptions(params: ExportCaptionsParams): Promise<string> {
    const { projectId, version, userId, format, styleOverride } = params;

    const track = await this.getCaptionTrack(projectId, version, userId);
    if (!track) {
      throw new ClipperError('NOT_FOUND', `No caption track found for project ${projectId}`, 404);
    }

    const activeStyle: SubtitleStyle = {
      ...(track.style || {
        preset: 'impact',
        fontFamily: 'Impact, sans-serif',
        fontSize: 52,
        primaryColor: '#FFFFFF',
        highlightColor: '#FACC15',
        strokeColor: '#000000',
        strokeWidth: 3,
        position: 'bottom',
        uppercase: true,
        showEmojis: false,
        animation: 'karaoke',
        language: track.language || 'en',
        showDualLanguage: false,
        enableSFX: false,
      }),
      ...styleOverride,
    };

    switch (format) {
      case 'srt':
        return generateSrt(track.cues);
      case 'vtt':
        return generateWebVtt(track.cues);
      case 'ass':
        return generateAss(track.cues, { style: activeStyle });
      default:
        throw new ClipperError('VALIDATION_ERROR', `Unsupported export format: ${format}`, 400);
    }
  }
}

// Singleton instance
let captionServiceInstance: CaptionService | null = null;

export function getCaptionService(): CaptionService {
  if (!captionServiceInstance) {
    captionServiceInstance = new CaptionService();
  }
  return captionServiceInstance;
}
