import { getStorage } from '../storage';
import { ClipperError } from '../errors';
import { SubtitleStyle, SubtitleLanguage, Project } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import {
  CaptionTrack,
  CaptionCue,
  CaptionSegmentationConfig,
  CaptionFormat,
  CaptionCueUpdate,
  IMMUTABLE_CUE_FIELDS,
  ExportCaptionsParams,
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
  updates: CaptionCueUpdate;
}

export class CaptionService {
  private async checkProjectAccess(
    project: Project,
    userId?: string,
    requiredRole: 'editor' | 'viewer' = 'editor'
  ): Promise<void> {
    if (!userId) return;
    if (project.userId === userId) return;

    if (isSupabaseConfigured()) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (userProfile?.role === 'admin') return;
      if (userProfile?.role === 'viewer' && requiredRole === 'editor') {
        throw new ClipperError('FORBIDDEN', `Viewer is not permitted to mutate captions on project ${project.id}`, 403);
      }

      if (project.workspaceId) {
        const { data: member } = await supabase
          .from('organization_members')
          .select('role, status')
          .eq('workspace_id', project.workspaceId)
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (member) {
          const role = member.role.toLowerCase();
          if (requiredRole === 'viewer') return;
          if (['owner', 'admin', 'manager', 'editor'].includes(role)) return;
        }
      }
    }

    throw new ClipperError('FORBIDDEN', `Access denied: you do not have permission for project ${project.id}`, 403);
  }

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

    // 1. Verify Project and Ownership/RBAC
    const project = await storage.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }
    await this.checkProjectAccess(project, userId, 'editor');

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
      version: forceRegenerate ? undefined : 1,
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
    await this.checkProjectAccess(project, userId, 'viewer');

    if (storage.getCaptionTrack) {
      return await storage.getCaptionTrack(projectId, version);
    }
    return null;
  }

  /**
   * Retrieves a caption track by track ID with tenancy and authorization verification.
   */
  async getCaptionTrackById(trackId: string, userId?: string, expectedProjectId?: string): Promise<CaptionTrack | null> {
    const storage = getStorage();
    if (!storage.getCaptionTrackById) {
      throw new ClipperError('STORAGE_UNAVAILABLE', 'Caption track retrieval by ID is not supported', 500);
    }

    const track = await storage.getCaptionTrackById(trackId, userId);
    if (!track) return null;

    if (expectedProjectId && track.projectId !== expectedProjectId) {
      throw new ClipperError(
        'FORBIDDEN',
        `Caption track ${trackId} belongs to project ${track.projectId}, not ${expectedProjectId}`,
        403
      );
    }

    return track;
  }

  /**
   * Updates an individual cue and creates a new edited version of the caption track,
   * preserving lineage and historical versions.
   */
  async updateCaptionCue(params: UpdateCueParams): Promise<CaptionTrack> {
    const { projectId, trackId, cueId, userId, updates } = params;

    if (!updates || typeof updates !== 'object') {
      throw new ClipperError('VALIDATION_ERROR', 'Updates payload is required', 400);
    }

    // Security Gate: Reject injection or mutation of immutable lineage and identity fields
    for (const field of IMMUTABLE_CUE_FIELDS) {
      if (field in updates) {
        throw new ClipperError(
          'VALIDATION_ERROR',
          `Field '${field}' is immutable and cannot be updated by client`,
          400
        );
      }
    }

    const storage = getStorage();

    const project = await storage.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }
    await this.checkProjectAccess(project, userId, 'editor');

    if (!storage.getCaptionTrack || !storage.saveCaptionTrack) {
      throw new ClipperError('STORAGE_UNAVAILABLE', 'Caption storage is not available', 500);
    }

    // Resolve track by ID first, or fallback to current project track
    let currentTrack: CaptionTrack | null = null;
    if (storage.getCaptionTrackById) {
      currentTrack = await storage.getCaptionTrackById(trackId, userId);
    }
    if (!currentTrack) {
      currentTrack = await storage.getCaptionTrack(projectId);
    }

    if (!currentTrack || currentTrack.id !== trackId) {
      throw new ClipperError('NOT_FOUND', `Caption track ${trackId} not found for project ${projectId}`, 404);
    }

    const cueIndex = currentTrack.cues.findIndex((c) => c.id === cueId);
    if (cueIndex === -1) {
      throw new ClipperError('NOT_FOUND', `Cue ${cueId} not found in caption track`, 404);
    }

    const originalCue = currentTrack.cues[cueIndex];

    // Validate updated start/end if provided
    const newStart = updates.start !== undefined ? updates.start : originalCue.start;
    const newEnd = updates.end !== undefined ? updates.end : originalCue.end;

    if (typeof newStart !== 'number' || isNaN(newStart) || !isFinite(newStart) || newStart < 0) {
      throw new ClipperError('VALIDATION_ERROR', `Invalid cue start timestamp: ${newStart}`, 400);
    }
    if (typeof newEnd !== 'number' || isNaN(newEnd) || !isFinite(newEnd) || newEnd <= newStart) {
      throw new ClipperError('VALIDATION_ERROR', `Invalid cue end timestamp: ${newEnd} (start: ${newStart})`, 400);
    }

    // Validate words bounds if words updated
    if (updates.words !== undefined) {
      if (!Array.isArray(updates.words)) {
        throw new ClipperError('VALIDATION_ERROR', 'words must be an array', 400);
      }
      for (let wIdx = 0; wIdx < updates.words.length; wIdx++) {
        const w = updates.words[wIdx];
        if (!w || typeof w.word !== 'string' || w.word.trim().length === 0) {
          throw new ClipperError('VALIDATION_ERROR', `Word at index ${wIdx} has empty text`, 400);
        }
        if (typeof w.start !== 'number' || isNaN(w.start) || !isFinite(w.start) || w.start < 0) {
          throw new ClipperError('VALIDATION_ERROR', `Word at index ${wIdx} has invalid start timestamp`, 400);
        }
        if (typeof w.end !== 'number' || isNaN(w.end) || !isFinite(w.end) || w.end <= w.start) {
          throw new ClipperError('VALIDATION_ERROR', `Word at index ${wIdx} has invalid end timestamp`, 400);
        }
        if (w.start < newStart - 0.05 || w.end > newEnd + 0.05) {
          throw new ClipperError(
            'VALIDATION_ERROR',
            `Word at index ${wIdx} timing [${w.start}, ${w.end}] exceeds cue bounds [${newStart}, ${newEnd}]`,
            400
          );
        }
      }
    }

    let finalWords = updates.words !== undefined ? updates.words : originalCue.words;
    let timingPrecision = updates.timingPrecision || originalCue.timingPrecision;
    if (updates.text !== undefined && updates.words === undefined) {
      // If user modified cue text without supplying new word-level timings,
      // invalidate stale words and truthfully degrade to cue-level precision
      const wordsJoined = (originalCue.words || []).map((w) => w.word.trim()).join(' ');
      const wordTokens = wordsJoined.replace(/[^\p{L}\p{N}]/gu, '');
      const cueTokens = updates.text.trim().replace(/[^\p{L}\p{N}]/gu, '');
      if (wordTokens !== cueTokens) {
        finalWords = [];
        timingPrecision = 'approximate_cue';
      }
    }

    const updatedCue: CaptionCue = {
      ...originalCue,
      ...updates,
      start: newStart,
      end: newEnd,
      id: originalCue.id,
      sequence: originalCue.sequence,
      words: finalWords,
      timingPrecision,
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

    // Allocate next version atomically via database storage engine to eliminate concurrency races
    const newEditedTrack: CaptionTrack = {
      ...currentTrack,
      id: crypto.randomUUID(),
      version: undefined,
      source: 'edited',
      cues: updatedCues,
      cuesCount: updatedCues.length,
      updatedAt: new Date().toISOString(),
    };

    return await storage.saveCaptionTrack(newEditedTrack, userId);
  }

  /**
   * Pure deterministic export of captions into SRT, WebVTT, or ASS format.
   * Resolves deterministically: trackId -> projectId + version -> latest for projectId.
   */
  async exportCaptions(params: ExportCaptionsParams): Promise<string> {
    const { projectId, trackId, version, userId, format, styleOverride } = params;

    let track: CaptionTrack | null = null;
    if (trackId) {
      track = await this.getCaptionTrackById(trackId, userId, projectId);
    } else if (projectId) {
      track = await this.getCaptionTrack(projectId, version, userId);
    } else {
      throw new ClipperError('VALIDATION_ERROR', 'Either trackId or projectId must be provided for export', 400);
    }

    if (!track) {
      throw new ClipperError(
        'NOT_FOUND',
        `No caption track found${trackId ? ` with trackId ${trackId}` : ` for project ${projectId}`}`,
        404
      );
    }

    // Strictly validate canonical track cues before export without silent repair or reordering
    const validation = validateCaptionCues(track.cues, {
      mediaDuration: track.durationSeconds,
      allowEmpty: true,
    });
    if (!validation.valid) {
      throw new ClipperError(
        'VALIDATION_ERROR',
        `Corrupted caption track cues cannot be exported: ${validation.errors.join('; ')}`,
        400
      );
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
