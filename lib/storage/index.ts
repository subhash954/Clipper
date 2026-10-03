import fs from 'fs';
import path from 'path';
import { Project, RenderJob, CostTelemetryRecord, Transcript, TranscriptSegment, NormalizedTranscriptWord, WordTimestamp, MediaAsset } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { ClipperError } from '../errors';

export const DEV_DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface IStorageAdapter {
  saveProject(project: Project, expectedVersion?: number): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjects(userId?: string): Promise<Project[]>;
  deleteProject(id: string, userId?: string): Promise<boolean>;
  duplicateProject(projectId: string, userId: string): Promise<Project>;
  createRenderJob(job: RenderJob): Promise<RenderJob>;
  getRenderJob(id: string): Promise<RenderJob | null>;
  updateRenderJob(id: string, updates: Partial<RenderJob>): Promise<RenderJob | null>;
  listRenderJobs(userId?: string): Promise<RenderJob[]>;
  recordCostTelemetry(telemetry: CostTelemetryRecord): Promise<void>;
  getCostTelemetry(userId?: string): Promise<CostTelemetryRecord[]>;
  saveTranscript(transcript: Transcript, projectId: string, userId: string): Promise<Transcript>;
  getTranscript(projectId: string): Promise<Transcript | null>;
  acquireTranscriptionLock(lockKey: string, projectId: string, mediaAssetId: string | null, userId: string, ttlSeconds?: number): Promise<boolean>;
  releaseTranscriptionLock(lockKey: string): Promise<void>;
  listTranscriptWords?(transcriptId: string): Promise<NormalizedTranscriptWord[]>;
  listTranscriptSegments?(transcriptId: string): Promise<TranscriptSegment[]>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureValidUuid(id?: string): string {
  if (id && UUID_REGEX.test(id)) {
    return id;
  }
  return crypto.randomUUID();
}

/**
 * Production Supabase PostgreSQL Storage Adapter
 */
export class SupabaseStorageAdapter implements IStorageAdapter {
  async saveProject(project: Project, expectedVersion?: number): Promise<Project> {
    if (!project.userId) {
      if (process.env.NODE_ENV === 'production') {
        throw new ClipperError('VALIDATION_ERROR', 'Project ownership (userId) is required.', 400);
      }
      project.userId = DEV_DEFAULT_USER_ID;
    }

    const validId = ensureValidUuid(project.id);
    project.id = validId;

    // Concurrency Check (Optimistic Concurrency Control)
    const { data: existing } = await supabase
      .from('projects')
      .select('version, user_id')
      .eq('id', validId)
      .maybeSingle();

    if (existing) {
      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw new ClipperError(
          'PROJECT_VERSION_CONFLICT',
          `Project version conflict: Expected version ${expectedVersion}, but database is at version ${existing.version}. Please refresh and retry.`,
          409,
          true,
          { expectedVersion, currentVersion: existing.version }
        );
      }
      project.version = (existing.version || 1) + 1;
    } else {
      project.version = project.version || 1;
    }

    // Media Asset Ownership Validation
    if (project.activeMediaId) {
      const { data: mediaRow } = await supabase
        .from('media_assets')
        .select('id, user_id')
        .eq('id', project.activeMediaId)
        .maybeSingle();

      if (!mediaRow) {
        throw new ClipperError(
          'NOT_FOUND',
          `Referenced active media asset ${project.activeMediaId} does not exist.`,
          404
        );
      }

      if (mediaRow.user_id !== project.userId) {
        throw new ClipperError(
          'MEDIA_NOT_OWNED',
          `Cannot link media asset ${project.activeMediaId} belonging to another user.`,
          403
        );
      }
    }

    const { error: projError } = await supabase.from('projects').upsert({
      id: validId,
      user_id: project.userId,
      workspace_id: project.workspaceId || null,
      source_external_id: project.sourceExternalId || null,
      title: project.title,
      description: project.description || null,
      version: project.version,
      active_media_id: project.activeMediaId || null,
      active_version_id: project.activeVersionId || null,
      channel_name: project.channelName || null,
      thumbnail_url: project.thumbnailUrl || null,
      workflow_type: project.workflowType || 'youtube_to_shorts',
      source_url: project.sourceUrl || null,
      source_type: project.sourceType || 'youtube',
      duration_seconds: project.durationSeconds || 0,
      status: project.status,
      cost_usd: project.costs?.totalCostUSD || 0,
      updated_at: new Date().toISOString(),
    });

    if (projError) {
      throw new ClipperError('DATABASE_ERROR', `Supabase saveProject failed: ${projError.message}`, 500);
    }

    // Upsert transcript if present
    if (project.transcript) {
      await this.saveTranscript(project.transcript, validId, project.userId);
    }

    // Upsert clips
    if (project.clips && project.clips.length > 0) {
      for (const clip of project.clips) {
        await supabase.from('clips').upsert({
          id: ensureValidUuid(clip.id),
          project_id: project.id,
          source_media_id: project.activeMediaId || null,
          rank: clip.rank || 1,
          title: clip.title,
          hook_summary: clip.hookSummary,
          important_line: clip.importantLine,
          why_important: clip.whyThisLineIsImportant,
          key_moment_type: clip.keyMomentType,
          viral_score: clip.viralScore,
          score_breakdown: clip.scoreBreakdown || {},
          start_time: clip.start,
          end_time: clip.end,
          duration: clip.duration,
          words: clip.words,
          thumbnail_url: clip.thumbnailUrl || project.thumbnailUrl || null,
          b_roll_keywords: clip.bRollKeywords || [],
          sound_effects_applied: clip.soundEffects || [],
        });
      }
    }

    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, clips(*), transcripts(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      workspaceId: data.workspace_id,
      sourceExternalId: data.source_external_id,
      title: data.title,
      description: data.description || undefined,
      version: data.version || 1,
      activeMediaId: data.active_media_id || undefined,
      activeVersionId: data.active_version_id || undefined,
      channelName: data.channel_name,
      thumbnailUrl: data.thumbnail_url,
      sourceUrl: data.source_url,
      sourceType: data.source_type,
      workflowType: data.workflow_type,
      durationSeconds: Number(data.duration_seconds || 0),
      status: data.status,
      errorMessage: data.error_message,
      clipsCount: data.clips?.length || 0,
      clips: (data.clips || []).map((c: any) => ({
        id: c.id,
        rank: c.rank,
        title: c.title,
        hookSummary: c.hook_summary,
        importantLine: c.important_line,
        whyThisLineIsImportant: c.why_important,
        keyMomentType: c.key_moment_type,
        start: Number(c.start_time),
        end: Number(c.end_time),
        duration: Number(c.duration),
        viralScore: c.viral_score,
        scoreBreakdown: c.score_breakdown,
        words: c.words || [],
        bRollKeywords: c.b_roll_keywords || [],
        soundEffects: c.sound_effects_applied || [],
        thumbnailUrl: c.thumbnail_url,
      })),
      transcript: data.transcripts?.[0]
        ? {
            id: data.transcripts[0].id,
            projectId: data.transcripts[0].project_id,
            mediaAssetId: data.transcripts[0].media_asset_id,
            text: data.transcripts[0].transcript_text,
            words: data.transcripts[0].words || [],
            utterances: data.transcripts[0].utterances || [],
            language: data.transcripts[0].language,
            source: data.transcripts[0].source,
            provider: data.transcripts[0].provider,
            model: data.transcripts[0].model,
            duration: data.transcripts[0].duration ? Number(data.transcripts[0].duration) : undefined,
            status: data.transcripts[0].status,
            errorMessage: data.transcripts[0].error_message,
            timingPrecision: data.transcripts[0].timing_precision,
            metadata: data.transcripts[0].metadata,
            createdAt: data.transcripts[0].created_at,
            updatedAt: data.transcripts[0].updated_at,
          }
        : undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deletedAt: data.deleted_at,
    };
  }

  async listProjects(userId?: string): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*, clips(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new ClipperError('DATABASE_ERROR', `Supabase listProjects error: ${error.message}`, 500);
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      workspaceId: p.workspace_id,
      sourceExternalId: p.source_external_id,
      title: p.title,
      description: p.description || undefined,
      version: p.version || 1,
      activeMediaId: p.active_media_id || undefined,
      activeVersionId: p.active_version_id || undefined,
      channelName: p.channel_name,
      thumbnailUrl: p.thumbnail_url,
      sourceUrl: p.source_url,
      sourceType: p.source_type,
      workflowType: p.workflow_type,
      durationSeconds: Number(p.duration_seconds || 0),
      status: p.status,
      clipsCount: p.clips?.length || 0,
      clips: (p.clips || []).map((c: any) => ({
        id: c.id,
        rank: c.rank,
        title: c.title,
        hookSummary: c.hook_summary,
        importantLine: c.important_line,
        whyThisLineIsImportant: c.why_important,
        keyMomentType: c.key_moment_type,
        start: Number(c.start_time),
        end: Number(c.end_time),
        duration: Number(c.duration),
        viralScore: c.viral_score,
        scoreBreakdown: c.score_breakdown,
        words: c.words || [],
        bRollKeywords: c.b_roll_keywords || [],
        soundEffects: c.sound_effects_applied || [],
        thumbnailUrl: c.thumbnail_url,
      })),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      deletedAt: p.deleted_at,
    }));
  }

  async deleteProject(id: string, userId?: string): Promise<boolean> {
    if (userId) {
      const existing = await this.getProject(id);
      if (existing && existing.userId && existing.userId !== userId) {
        throw new ClipperError('FORBIDDEN', 'Access denied to delete project', 403);
      }
    }

    let query = supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;
    if (error) {
      throw new ClipperError('DATABASE_ERROR', `Supabase deleteProject failed: ${error.message}`, 500);
    }
    return true;
  }

  async duplicateProject(projectId: string, userId: string): Promise<Project> {
    const source = await this.getProject(projectId);
    if (!source || source.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }

    if (source.userId && source.userId !== userId) {
      throw new ClipperError('FORBIDDEN', 'Cannot duplicate project: access denied', 403);
    }

    const newProjectId = crypto.randomUUID();
    const duplicatedProject: Project = {
      ...source,
      id: newProjectId,
      userId: userId,
      title: `${source.title} (Copy)`,
      version: 1,
      status: source.status === 'failed' ? 'ready' : source.status,
      clips: (source.clips || []).map((c) => ({
        ...c,
        id: crypto.randomUUID(),
      })),
      transcript: source.transcript ? { ...source.transcript } : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    const saved = await this.saveProject(duplicatedProject);

    if (source.activeVersionId) {
      try {
        const { data: ver } = await supabase
          .from('timeline_versions')
          .select('*')
          .eq('id', source.activeVersionId)
          .maybeSingle();

        if (ver) {
          const newVerId = crypto.randomUUID();
          await supabase.from('timeline_versions').insert({
            id: newVerId,
            project_id: newProjectId,
            user_id: userId,
            version_number: 1,
            name: ver.name || 'Duplicated Version',
            description: `Duplicated from project ${projectId}`,
            render_spec: ver.render_spec,
            created_at: new Date().toISOString(),
          });
          await supabase
            .from('projects')
            .update({ active_version_id: newVerId })
            .eq('id', newProjectId);
          saved.activeVersionId = newVerId;
        }
      } catch (verErr) {
        console.warn('Failed to duplicate timeline version:', verErr);
      }
    }

    return saved;
  }

  async createRenderJob(job: RenderJob): Promise<RenderJob> {
    if (!job.userId) {
      if (process.env.NODE_ENV === 'production') {
        throw new ClipperError('VALIDATION_ERROR', 'Render job ownership (userId) is required.', 400);
      }
      job.userId = DEV_DEFAULT_USER_ID;
    }

    const { error } = await supabase.from('render_jobs').insert({
      id: job.id,
      project_id: job.projectId || null,
      clip_id: job.clipId || null,
      user_id: job.userId,
      status: job.status,
      progress: job.progress,
      current_stage: job.currentStage,
      input_url: job.inputUrl,
      output_url: job.outputUrl || null,
      error_message: job.errorMessage || null,
      created_at: job.createdAt,
    });

    if (error) {
      throw new ClipperError('DATABASE_ERROR', `Supabase createRenderJob failed: ${error.message}`, 500);
    }
    return job;
  }

  async getRenderJob(id: string): Promise<RenderJob | null> {
    const { data, error } = await supabase
      .from('render_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      projectId: data.project_id,
      clipId: data.clip_id,
      userId: data.user_id,
      status: data.status,
      progress: data.progress,
      currentStage: data.current_stage,
      inputUrl: data.input_url,
      outputUrl: data.output_url,
      errorMessage: data.error_message,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    };
  }

  async updateRenderJob(id: string, updates: Partial<RenderJob>): Promise<RenderJob | null> {
    const { data, error } = await supabase
      .from('render_jobs')
      .update({
        status: updates.status,
        progress: updates.progress,
        current_stage: updates.currentStage,
        output_url: updates.outputUrl,
        error_message: updates.errorMessage,
        started_at: updates.startedAt,
        completed_at: updates.completedAt,
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;
    return updates as RenderJob;
  }

  async listRenderJobs(userId?: string): Promise<RenderJob[]> {
    let query = supabase
      .from('render_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data } = await query;

    return (data || []).map((d: any) => ({
      id: d.id,
      projectId: d.project_id,
      clipId: d.clip_id,
      userId: d.user_id,
      status: d.status,
      progress: d.progress,
      currentStage: d.current_stage,
      inputUrl: d.input_url,
      outputUrl: d.output_url,
      errorMessage: d.error_message,
      startedAt: d.started_at,
      completedAt: d.completed_at,
      createdAt: d.created_at,
    }));
  }

  async recordCostTelemetry(telemetry: CostTelemetryRecord): Promise<void> {
    await supabase.from('cost_telemetry').insert({
      user_id: telemetry.userId || null,
      project_id: telemetry.projectId || null,
      service_name: telemetry.serviceName,
      model: telemetry.model || null,
      units_used: telemetry.unitsUsed,
      unit_type: telemetry.unitType,
      cost_in_usd: telemetry.costInUSD,
      is_estimated: telemetry.isEstimated,
    });
  }

  async getCostTelemetry(userId?: string): Promise<CostTelemetryRecord[]> {
    let query = supabase
      .from('cost_telemetry')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      throw new ClipperError('DATABASE_ERROR', `Failed to load cost telemetry: ${error.message}`, 500);
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      projectId: d.project_id,
      serviceName: d.service_name,
      model: d.model,
      unitsUsed: Number(d.units_used),
      unitType: d.unit_type,
      costInUSD: Number(d.cost_in_usd),
      isEstimated: d.is_estimated,
      createdAt: d.created_at,
    }));
  }

  async acquireTranscriptionLock(lockKey: string, projectId: string, mediaAssetId: string | null, userId: string, ttlSeconds: number = 300): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    // 1. Clean up expired lock if exists
    await supabase.from('transcription_locks').delete().eq('lock_key', lockKey).lte('expires_at', now.toISOString());

    // 2. Attempt insert
    const { error } = await supabase.from('transcription_locks').insert({
      lock_key: lockKey,
      project_id: projectId,
      media_asset_id: mediaAssetId,
      user_id: userId,
      status: 'in_progress',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: expiresAt,
    });

    return !error;
  }

  async releaseTranscriptionLock(lockKey: string): Promise<void> {
    await supabase.from('transcription_locks').delete().eq('lock_key', lockKey);
  }

  async saveTranscript(transcript: Transcript, projectId: string, userId: string): Promise<Transcript> {
    const validTranscriptId = ensureValidUuid(transcript.id);
    const words = transcript.words || [];
    const utterances = transcript.utterances || [];
    const lastWord = words.length > 0 ? words[words.length - 1] : undefined;
    const computedDuration = transcript.duration ?? (lastWord ? lastWord.end : 0);

    // 1. Authenticated User Identity Check (Strict Fail-Closed)
    if (!userId) {
      throw new ClipperError('AUTH_REQUIRED', 'Authenticated user identity is required to save transcript.', 401);
    }

    // 2. Verify Project Existence and Ownership
    const project = await this.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found.`, 404);
    }
    if (!project.userId) {
      throw new ClipperError('FORBIDDEN', `Project ${projectId} has no owner recorded.`, 403);
    }
    if (project.userId !== userId) {
      throw new ClipperError('FORBIDDEN', `Access denied: you do not own project ${projectId}.`, 403);
    }

    // 3. Relational consistency check between words and segments
    if (words.length > 0 && transcript.segments && transcript.segments.length > 0) {
      const validSegmentIds = new Set(transcript.segments.map((s) => s.id));
      for (const w of words) {
        const segId = (w as any).segmentId;
        if (segId && !validSegmentIds.has(segId)) {
          throw new ClipperError(
            'VALIDATION_ERROR',
            `Relational consistency error: word "${w.word}" references segment "${segId}" which does not belong to transcript "${validTranscriptId}".`,
            400
          );
        }
      }
    }

    // 4. Verify Media Asset Ownership and Project Relationship
    if (transcript.mediaAssetId) {
      const media = await getMediaAssetById(transcript.mediaAssetId);
      if (!media) {
        throw new ClipperError('NOT_FOUND', `Media asset ${transcript.mediaAssetId} not found.`, 404);
      }
      if (!media.userId) {
        throw new ClipperError('MEDIA_NOT_OWNED', `Media asset ${transcript.mediaAssetId} has no owner recorded.`, 403);
      }
      if (media.userId !== userId) {
        throw new ClipperError('MEDIA_NOT_OWNED', `Media asset ${transcript.mediaAssetId} belongs to another user.`, 403);
      }
      if (!media.projectId) {
        throw new ClipperError('FORBIDDEN', `Media asset ${transcript.mediaAssetId} has no project association.`, 403);
      }
      if (media.projectId !== projectId) {
        throw new ClipperError(
          'FORBIDDEN',
          `Cannot associate transcript with media asset ${transcript.mediaAssetId} belonging to another project.`,
          403
        );
      }
      if ((media as any).deletedAt || media.status === 'deleted') {
        throw new ClipperError('MEDIA_UNAVAILABLE', `Media asset ${transcript.mediaAssetId} has been deleted.`, 410);
      }
      if (media.status === 'failed') {
        throw new ClipperError('MEDIA_UNAVAILABLE', `Media asset ${transcript.mediaAssetId} processing failed.`, 422);
      }
    }

    const segmentRows = (transcript.segments || []).map((seg, idx) => ({
      id: ensureValidUuid(seg.id),
      transcript_id: validTranscriptId,
      segment_index: seg.segmentIndex ?? idx,
      start_time: seg.start,
      end_time: seg.end,
      text: seg.text,
      confidence: seg.confidence !== undefined ? seg.confidence : null,
      speaker: seg.speaker !== undefined ? seg.speaker : null,
      metadata: seg.metadata || {},
    }));

    const wordRows = words.map((w, idx) => ({
      id: ensureValidUuid((w as any).id),
      transcript_id: validTranscriptId,
      segment_id: (w as any).segmentId || null,
      word_index: idx,
      word: w.word,
      start_time: w.start,
      end_time: w.end,
      confidence: w.confidence !== undefined ? w.confidence : null,
      speaker: w.speaker !== undefined ? w.speaker : null,
    }));

    // 5. Execute Atomic Transcript Replacement via PostgreSQL RPC
    let rpcSucceeded = false;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('replace_transcript_atomic', {
        p_user_id: userId,
        p_transcript_id: validTranscriptId,
        p_project_id: projectId,
        p_media_asset_id: transcript.mediaAssetId || null,
        p_transcript_text: transcript.text,
        p_words: words,
        p_utterances: utterances,
        p_language: transcript.language || 'en',
        p_source: transcript.source || 'deepgram',
        p_timing_precision: transcript.timingPrecision || 'exact_word',
        p_provider: transcript.provider || 'deepgram',
        p_model: transcript.model || 'nova-2',
        p_duration: computedDuration,
        p_status: transcript.status || 'completed',
        p_error_message: transcript.errorMessage || null,
        p_metadata: transcript.metadata || {},
        p_segments: segmentRows,
        p_word_rows: wordRows,
      });

      if (!rpcError) {
        rpcSucceeded = true;
      } else if (!rpcError.message?.includes('does not exist') && !rpcError.message?.includes('function')) {
        throw new ClipperError('DATABASE_ERROR', `Atomic transcript replacement failed: ${rpcError.message}`, 500);
      }
    } catch (rpcErr: any) {
      if (rpcErr instanceof ClipperError) throw rpcErr;
      if (!rpcErr.message?.includes('does not exist') && !rpcErr.message?.includes('function')) {
        throw new ClipperError('DATABASE_ERROR', `Atomic transcript replacement failed: ${rpcErr.message}`, 500);
      }
    }

    if (!rpcSucceeded) {
      // In production mode, atomic RPC failure must fail closed immediately
      if (process.env.NODE_ENV === 'production') {
        throw new ClipperError(
          'DATABASE_ERROR',
          'Atomic transcript replacement RPC is required in production and was unavailable or failed.',
          500
        );
      }

      // Non-destructive fallback path (handles mock/test databases without the RPC in non-production)
      const { error: delWordErr } = await supabase.from('transcript_words').delete().eq('transcript_id', validTranscriptId);
      if (delWordErr) {
        throw new ClipperError('DATABASE_ERROR', `Failed to clear existing transcript words: ${delWordErr.message}`, 500);
      }

      const { error: delSegErr } = await supabase.from('transcript_segments').delete().eq('transcript_id', validTranscriptId);
      if (delSegErr) {
        throw new ClipperError('DATABASE_ERROR', `Failed to clear existing transcript segments: ${delSegErr.message}`, 500);
      }

      const { error: transError } = await supabase.from('transcripts').upsert({
        id: validTranscriptId,
        project_id: projectId,
        media_asset_id: transcript.mediaAssetId || null,
        transcript_text: transcript.text,
        words: words,
        utterances: utterances,
        language: transcript.language || 'en',
        source: transcript.source || 'deepgram',
        timing_precision: transcript.timingPrecision || 'exact_word',
        provider: transcript.provider || 'deepgram',
        model: transcript.model || 'nova-2',
        duration: computedDuration,
        status: transcript.status || 'completed',
        error_message: transcript.errorMessage || null,
        metadata: transcript.metadata || {},
        updated_at: new Date().toISOString(),
      });

      if (transError) {
        throw new ClipperError('DATABASE_ERROR', `Failed to persist transcript: ${transError.message}`, 500);
      }

      if (segmentRows.length > 0) {
        const { error: segError } = await supabase
          .from('transcript_segments')
          .upsert(segmentRows);
        if (segError) {
          throw new ClipperError('DATABASE_ERROR', `Failed to persist transcript segments: ${segError.message}`, 500);
        }
      }

      if (wordRows.length > 0) {
        const { error: wordsError } = await supabase
          .from('transcript_words')
          .upsert(wordRows);
        if (wordsError) {
          throw new ClipperError('DATABASE_ERROR', `Failed to persist transcript words: ${wordsError.message}`, 500);
        }
      }
    }

    return {
      ...transcript,
      id: validTranscriptId,
      projectId,
      duration: computedDuration,
    };
  }

  async getTranscript(projectId: string): Promise<Transcript | null> {
    const { data, error } = await supabase
      .from('transcripts')
      .select('*, transcript_segments(*), transcript_words(*)')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error || !data) return null;

    const segments: TranscriptSegment[] = (data.transcript_segments || [])
      .sort((a: any, b: any) => a.segment_index - b.segment_index)
      .map((s: any) => ({
        id: s.id,
        transcriptId: s.transcript_id,
        segmentIndex: s.segment_index,
        start: Number(s.start_time),
        end: Number(s.end_time),
        text: s.text,
        confidence: s.confidence !== null ? Number(s.confidence) : undefined,
        speaker: s.speaker !== null ? Number(s.speaker) : undefined,
        metadata: s.metadata,
        createdAt: s.created_at,
      }));

    const words: WordTimestamp[] = (data.transcript_words && data.transcript_words.length > 0)
      ? data.transcript_words
          .sort((a: any, b: any) => a.word_index - b.word_index)
          .map((w: any) => ({
            id: w.id,
            word: w.word,
            start: Number(w.start_time),
            end: Number(w.end_time),
            confidence: w.confidence !== null ? Number(w.confidence) : undefined,
            speaker: w.speaker !== null ? Number(w.speaker) : undefined,
          }))
      : (data.words || []);

    return {
      id: data.id,
      projectId: data.project_id,
      mediaAssetId: data.media_asset_id,
      text: data.transcript_text,
      words,
      utterances: data.utterances || [],
      segments,
      language: data.language,
      timingPrecision: data.timing_precision,
      timingLabel: data.timing_label,
      source: data.source,
      provider: data.provider,
      model: data.model,
      duration: data.duration ? Number(data.duration) : undefined,
      status: data.status,
      errorMessage: data.error_message,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listTranscriptWords(transcriptId: string): Promise<NormalizedTranscriptWord[]> {
    const { data, error } = await supabase
      .from('transcript_words')
      .select('*')
      .eq('transcript_id', transcriptId)
      .order('word_index', { ascending: true });

    if (error || !data) return [];
    return data.map((w: any) => ({
      id: w.id,
      transcriptId: w.transcript_id,
      segmentId: w.segment_id,
      wordIndex: w.word_index,
      word: w.word,
      start: Number(w.start_time),
      end: Number(w.end_time),
      confidence: w.confidence !== null ? Number(w.confidence) : undefined,
      speaker: w.speaker !== null ? Number(w.speaker) : undefined,
      createdAt: w.created_at,
    }));
  }

  async listTranscriptSegments(transcriptId: string): Promise<TranscriptSegment[]> {
    const { data, error } = await supabase
      .from('transcript_segments')
      .select('*')
      .eq('transcript_id', transcriptId)
      .order('segment_index', { ascending: true });

    if (error || !data) return [];
    return data.map((s: any) => ({
      id: s.id,
      transcriptId: s.transcript_id,
      segmentIndex: s.segment_index,
      start: Number(s.start_time),
      end: Number(s.end_time),
      text: s.text,
      confidence: s.confidence !== null ? Number(s.confidence) : undefined,
      speaker: s.speaker !== null ? Number(s.speaker) : undefined,
      metadata: s.metadata,
      createdAt: s.created_at,
    }));
  }
}

/**
 * Local Development Storage Adapter (used only when Supabase is not configured)
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private dataDir = path.join(process.cwd(), 'data');
  private projectsFile = path.join(process.cwd(), 'data', 'projects.json');
  private mediaFile = path.join(process.cwd(), 'data', 'media_assets.json');
  private jobsFile = path.join(process.cwd(), 'data', 'render_jobs.json');
  private telemetryFile = path.join(process.cwd(), 'data', 'telemetry.json');
  private transcriptsFile = path.join(process.cwd(), 'data', 'transcripts.json');
  private segmentsFile = path.join(process.cwd(), 'data', 'transcript_segments.json');
  private wordsFile = path.join(process.cwd(), 'data', 'transcript_words.json');
  private locksFile = path.join(process.cwd(), 'data', 'transcription_locks.json');

  constructor() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  saveMediaAsset(asset: any): void {
    const list = this.readJson<any[]>(this.mediaFile, []);
    const updated = [asset, ...list.filter((m) => m.id !== asset.id)];
    this.writeJson(this.mediaFile, updated);
  }

  getMediaAsset(id: string): any | null {
    const list = this.readJson<any[]>(this.mediaFile, []);
    return list.find((m) => m.id === id) || null;
  }

  private readJson<T>(file: string, fallback: T): T {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return fallback;
  }

  private writeJson(file: string, data: any): void {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Failed to write local storage file ${file}:`, err);
    }
  }

  async saveProject(project: Project, expectedVersion?: number): Promise<Project> {
    if (!project.userId) {
      if (process.env.NODE_ENV === 'production') {
        throw new ClipperError('VALIDATION_ERROR', 'Project ownership (userId) is required.', 400);
      }
      project.userId = DEV_DEFAULT_USER_ID;
    }

    // Media Asset Ownership Validation
    if (project.activeMediaId) {
      const mediaList = this.readJson<any[]>(this.mediaFile, []);
      const media = mediaList.find((m) => m.id === project.activeMediaId);
      if (media) {
        const ownerId = media.user_id || media.userId;
        if (ownerId && ownerId !== project.userId) {
          throw new ClipperError(
            'MEDIA_NOT_OWNED',
            `Cannot link media asset ${project.activeMediaId} belonging to another user.`,
            403
          );
        }
      }
    }

    const all = this.readJson<Project[]>(this.projectsFile, []);
    const existing = all.find((p) => p.id === project.id);

    if (existing) {
      if (expectedVersion !== undefined && (existing.version || 1) !== expectedVersion) {
        throw new ClipperError(
          'PROJECT_VERSION_CONFLICT',
          `Project version conflict: Expected version ${expectedVersion}, but database is at version ${existing.version || 1}. Please refresh and retry.`,
          409,
          true,
          { expectedVersion, currentVersion: existing.version || 1 }
        );
      }
      project.version = (existing.version || 1) + 1;
    } else {
      project.version = project.version || 1;
    }

    const updated = [project, ...all.filter((p) => p.id !== project.id)];
    this.writeJson(this.projectsFile, updated);

    if (project.transcript) {
      await this.saveTranscript(project.transcript, project.id, project.userId);
    }

    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    const list = this.readJson<Project[]>(this.projectsFile, []);
    const proj = list.find((p) => p.id === id);
    if (!proj) return null;
    const transcript = await this.getTranscript(id);
    if (transcript) {
      proj.transcript = transcript;
    }
    return proj;
  }

  async listProjects(userId?: string): Promise<Project[]> {
    const all = this.readJson<Project[]>(this.projectsFile, []);
    const nonDeleted = all.filter((p) => !p.deletedAt);
    if (userId) {
      return nonDeleted.filter((p) => p.userId === userId);
    }
    return nonDeleted;
  }

  async deleteProject(id: string, userId?: string): Promise<boolean> {
    const list = this.readJson<Project[]>(this.projectsFile, []);
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    if (userId && list[idx].userId && list[idx].userId !== userId) {
      throw new ClipperError('FORBIDDEN', 'Access denied to delete project', 403);
    }
    list[idx].deletedAt = new Date().toISOString();
    this.writeJson(this.projectsFile, list);
    return true;
  }

  async duplicateProject(projectId: string, userId: string): Promise<Project> {
    const source = await this.getProject(projectId);
    if (!source || source.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }
    if (source.userId && source.userId !== userId) {
      throw new ClipperError('FORBIDDEN', 'Cannot duplicate project: access denied', 403);
    }
    const newProjectId = crypto.randomUUID();
    const duplicated: Project = {
      ...source,
      id: newProjectId,
      userId,
      title: `${source.title} (Copy)`,
      version: 1,
      status: source.status === 'failed' ? 'ready' : source.status,
      clips: (source.clips || []).map((c) => ({ ...c, id: crypto.randomUUID() })),
      transcript: source.transcript ? { ...source.transcript } : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    return this.saveProject(duplicated);
  }

  async createRenderJob(job: RenderJob): Promise<RenderJob> {
    if (!job.userId) {
      if (process.env.NODE_ENV === 'production') {
        throw new ClipperError('VALIDATION_ERROR', 'Render job ownership (userId) is required.', 400);
      }
      job.userId = DEV_DEFAULT_USER_ID;
    }
    const list = await this.listRenderJobs();
    const updated = [job, ...list.filter((j) => j.id !== job.id)];
    this.writeJson(this.jobsFile, updated);
    return job;
  }

  async getRenderJob(id: string): Promise<RenderJob | null> {
    const list = await this.listRenderJobs();
    return list.find((j) => j.id === id) || null;
  }

  async updateRenderJob(id: string, updates: Partial<RenderJob>): Promise<RenderJob | null> {
    const list = await this.listRenderJobs();
    const idx = list.findIndex((j) => j.id === id);
    if (idx === -1) return null;

    list[idx] = { ...list[idx], ...updates };
    this.writeJson(this.jobsFile, list);
    return list[idx];
  }

  async listRenderJobs(userId?: string): Promise<RenderJob[]> {
    const all = this.readJson<RenderJob[]>(this.jobsFile, []);
    if (userId) {
      return all.filter((j) => j.userId === userId);
    }
    return all;
  }

  async recordCostTelemetry(telemetry: CostTelemetryRecord): Promise<void> {
    const list = await this.getCostTelemetry();
    const updated = [{ ...telemetry, id: telemetry.id || ensureValidUuid(), userId: telemetry.userId }, ...list];
    this.writeJson(this.telemetryFile, updated);
  }

  async getCostTelemetry(userId?: string): Promise<CostTelemetryRecord[]> {
    const all = this.readJson<CostTelemetryRecord[]>(this.telemetryFile, []);
    if (userId) {
      return all.filter((t) => t.userId === userId);
    }
    return all;
  }

  async acquireTranscriptionLock(lockKey: string, projectId: string, mediaAssetId: string | null, userId: string, ttlSeconds: number = 300): Promise<boolean> {
    const locks = this.readJson<any[]>(this.locksFile, []);
    const now = Date.now();
    const activeLocks = locks.filter((l) => new Date(l.expiresAt).getTime() > now);
    const existing = activeLocks.find((l) => l.lockKey === lockKey);
    if (existing) {
      return false;
    }
    const newLock = {
      lockKey,
      projectId,
      mediaAssetId,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
    };
    this.writeJson(this.locksFile, [...activeLocks, newLock]);
    return true;
  }

  async releaseTranscriptionLock(lockKey: string): Promise<void> {
    const locks = this.readJson<any[]>(this.locksFile, []);
    const updated = locks.filter((l) => l.lockKey !== lockKey);
    this.writeJson(this.locksFile, updated);
  }

  async saveTranscript(transcript: Transcript, projectId: string, userId: string): Promise<Transcript> {
    const validId = ensureValidUuid(transcript.id);
    const words = transcript.words || [];
    const utterances = transcript.utterances || [];
    const lastWord = words.length > 0 ? words[words.length - 1] : undefined;
    const duration = transcript.duration ?? (lastWord ? lastWord.end : 0);

    // 1. Authenticated User Identity Check (Strict Fail-Closed)
    if (!userId) {
      throw new ClipperError('AUTH_REQUIRED', 'Authenticated user identity is required to save transcript.', 401);
    }

    // 2. Verify Project Existence and Ownership
    const project = await this.getProject(projectId);
    if (!project || project.deletedAt) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found.`, 404);
    }
    if (!project.userId) {
      throw new ClipperError('FORBIDDEN', `Project ${projectId} has no owner recorded.`, 403);
    }
    if (project.userId !== userId) {
      throw new ClipperError('FORBIDDEN', `Access denied: you do not own project ${projectId}.`, 403);
    }

    // 3. Relational consistency check between words and segments
    if (words.length > 0 && transcript.segments && transcript.segments.length > 0) {
      const validSegmentIds = new Set(transcript.segments.map((s) => s.id));
      for (const w of words) {
        const segId = (w as any).segmentId;
        if (segId && !validSegmentIds.has(segId)) {
          throw new ClipperError(
            'VALIDATION_ERROR',
            `Relational consistency error: word "${w.word}" references segment "${segId}" which does not belong to transcript "${validId}".`,
            400
          );
        }
      }
    }

    // 4. Verify Media Asset Ownership and Project Relationship
    if (transcript.mediaAssetId) {
      const media = await getMediaAssetById(transcript.mediaAssetId);
      if (!media) {
        throw new ClipperError('NOT_FOUND', `Media asset ${transcript.mediaAssetId} not found.`, 404);
      }
      if (!media.userId) {
        throw new ClipperError('MEDIA_NOT_OWNED', `Media asset ${transcript.mediaAssetId} has no owner recorded.`, 403);
      }
      if (media.userId !== userId) {
        throw new ClipperError(
          'MEDIA_NOT_OWNED',
          `Media asset ${transcript.mediaAssetId} belongs to another user.`,
          403
        );
      }
      if (!media.projectId) {
        throw new ClipperError('FORBIDDEN', `Media asset ${transcript.mediaAssetId} has no project association.`, 403);
      }
      if (media.projectId !== projectId) {
        throw new ClipperError(
          'FORBIDDEN',
          `Cannot associate transcript with media asset ${transcript.mediaAssetId} belonging to another project.`,
          403
        );
      }
      if ((media as any).deletedAt || media.status === 'deleted') {
        throw new ClipperError('MEDIA_UNAVAILABLE', `Media asset ${transcript.mediaAssetId} has been deleted.`, 410);
      }
      if (media.status === 'failed') {
        throw new ClipperError('MEDIA_UNAVAILABLE', `Media asset ${transcript.mediaAssetId} processing failed.`, 422);
      }
    }

    // 4. Stage all in-memory structures before any file mutation (Atomic staging)
    const record: Transcript = {
      ...transcript,
      id: validId,
      projectId,
      duration,
      status: transcript.status || 'completed',
      timingPrecision: transcript.timingPrecision || 'exact_word',
      provider: transcript.provider || 'deepgram',
      model: transcript.model || 'nova-2',
      updatedAt: new Date().toISOString(),
      createdAt: transcript.createdAt || new Date().toISOString(),
    };

    let newSegments: any[] = [];
    if (transcript.segments && transcript.segments.length > 0) {
      newSegments = transcript.segments.map((seg, idx) => ({
        id: ensureValidUuid(seg.id),
        transcriptId: validId,
        segmentIndex: seg.segmentIndex ?? idx,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        confidence: seg.confidence,
        speaker: seg.speaker,
        metadata: seg.metadata || {},
        createdAt: new Date().toISOString(),
      }));
    }

    let newWords: any[] = [];
    if (words.length > 0) {
      newWords = words.map((w, idx) => ({
        id: ensureValidUuid((w as any).id),
        transcriptId: validId,
        segmentId: (w as any).segmentId || null,
        wordIndex: idx,
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
        speaker: w.speaker,
        createdAt: new Date().toISOString(),
      }));
    }

    // 5. Commit all writes to disk (only reached if all validations and mappings succeeded)
    const transcripts = this.readJson<any[]>(this.transcriptsFile, []);
    const updatedTranscripts = [record, ...transcripts.filter((t) => t.id !== validId && t.projectId !== projectId)];
    this.writeJson(this.transcriptsFile, updatedTranscripts);

    if (newSegments.length > 0) {
      const existingSegments = this.readJson<any[]>(this.segmentsFile, []).filter((s) => s.transcriptId !== validId);
      this.writeJson(this.segmentsFile, [...existingSegments, ...newSegments]);
    }

    if (newWords.length > 0) {
      const existingWords = this.readJson<any[]>(this.wordsFile, []).filter((w) => w.transcriptId !== validId);
      this.writeJson(this.wordsFile, [...existingWords, ...newWords]);
    }

    // Also sync to projects.json if project exists
    const projects = this.readJson<Project[]>(this.projectsFile, []);
    const projIdx = projects.findIndex((p) => p.id === projectId);
    if (projIdx !== -1) {
      projects[projIdx].transcript = record;
      projects[projIdx].updatedAt = new Date().toISOString();
      this.writeJson(this.projectsFile, projects);
    }

    return record;
  }

  async getTranscript(projectId: string): Promise<Transcript | null> {
    const transcripts = this.readJson<any[]>(this.transcriptsFile, []);
    let found = transcripts.find((t) => t.projectId === projectId || t.id === projectId);

    if (!found) {
      const projects = this.readJson<Project[]>(this.projectsFile, []);
      const proj = projects.find((p) => p.id === projectId);
      if (proj?.transcript) {
        found = { ...proj.transcript, projectId };
      }
    }

    if (!found) return null;

    const segments = this.readJson<any[]>(this.segmentsFile, []).filter((s) => s.transcriptId === found.id);
    const words = this.readJson<any[]>(this.wordsFile, []).filter((w) => w.transcriptId === found.id);

    return {
      ...found,
      segments: segments.length > 0 ? segments : found.segments,
      words: words.length > 0 ? words : found.words,
    };
  }

  async listTranscriptWords(transcriptId: string): Promise<NormalizedTranscriptWord[]> {
    const words = this.readJson<any[]>(this.wordsFile, []);
    return words.filter((w) => w.transcriptId === transcriptId);
  }

  async listTranscriptSegments(transcriptId: string): Promise<TranscriptSegment[]> {
    const segments = this.readJson<any[]>(this.segmentsFile, []);
    return segments.filter((s) => s.transcriptId === transcriptId);
  }
}

// Storage singleton instance
let storageInstance: IStorageAdapter | null = null;

export function getStorage(): IStorageAdapter {
  if (!storageInstance) {
    const storageMode = process.env.STORAGE_MODE?.toLowerCase();

    if (storageMode === 'supabase') {
      if (!isSupabaseConfigured()) {
        throw new ClipperError(
          'STORAGE_UNAVAILABLE',
          'Supabase storage requested (STORAGE_MODE=supabase) but NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.',
          500
        );
      }
      storageInstance = new SupabaseStorageAdapter();
      return storageInstance;
    }

    if (process.env.NODE_ENV === 'production') {
      if (!isSupabaseConfigured()) {
        throw new ClipperError(
          'STORAGE_UNAVAILABLE',
          'CRITICAL PERSISTENCE ERROR: Database storage (Supabase PostgreSQL) is required in production mode. Local JSON persistence is forbidden.',
          500
        );
      }
      storageInstance = new SupabaseStorageAdapter();
      return storageInstance;
    }

    if (storageMode === 'local') {
      storageInstance = new LocalStorageAdapter();
    } else if (isSupabaseConfigured()) {
      storageInstance = new SupabaseStorageAdapter();
    } else {
      storageInstance = new LocalStorageAdapter();
    }
  }
  return storageInstance;
}

export function resetStorageInstance(): void {
  storageInstance = null;
}

/**
 * Media Storage Adapter Interface (Section 16: Object Storage Abstraction)
 */
export interface MediaStorageAdapter {
  upload(destinationPath: string, buffer: Buffer, mimeType: string): Promise<string>;
  download(sourcePath: string): Promise<Buffer>;
  getSignedUrl(sourcePath: string, expiresInSeconds?: number): Promise<string>;
  delete(sourcePath: string): Promise<void>;
  exists(sourcePath: string): Promise<boolean>;
  cleanupStaleMedia(maxAgeMs?: number): Promise<number>;
}

/**
 * Local Media Storage Adapter (for Development & Single-Node VPS)
 * Includes automated cleanup of ephemeral rendered exports older than 24h.
 */
export class LocalMediaStorageAdapter implements MediaStorageAdapter {
  private baseDir: string;

  constructor() {
    if (process.env.NODE_ENV === 'production' && process.env.STORAGE_PROVIDER !== 'local' && process.env.ALLOW_DEV_LOCAL_STORAGE !== 'true') {
      throw new ClipperError(
        'CONFIGURATION_ERROR',
        'LocalMediaStorageAdapter cannot be used as media storage in production. Configure STORAGE_PROVIDER=bunny.',
        500
      );
    }
    this.baseDir = path.join(process.cwd(), 'public', 'exports');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(destinationPath: string, buffer: Buffer): Promise<string> {
    const fullPath = path.join(this.baseDir, path.basename(destinationPath));
    fs.writeFileSync(fullPath, buffer);
    return `/exports/${path.basename(destinationPath)}`;
  }

  async download(sourcePath: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, path.basename(sourcePath));
    return fs.readFileSync(fullPath);
  }

  async getSignedUrl(sourcePath: string): Promise<string> {
    // In local dev, returns the accessible HTTP relative URL
    return `/exports/${path.basename(sourcePath)}`;
  }

  async delete(sourcePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, path.basename(sourcePath));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async exists(sourcePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, path.basename(sourcePath));
    return fs.existsSync(fullPath);
  }

  async cleanupStaleMedia(maxAgeMs: number = 86400000): Promise<number> {
    let deletedCount = 0;
    try {
      const files = fs.readdirSync(this.baseDir);
      const now = Date.now();
      for (const file of files) {
        if (file === '.gitkeep') continue;
        const filePath = path.join(this.baseDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    } catch (e) {
      console.warn('LocalMediaStorage cleanup warning:', e);
    }
    return deletedCount;
  }
}

import { Readable } from 'stream';
import { getStorageService } from './storageService';
export * from './types';
export { getStorageService } from './storageService';

/**
 * Cloud Media Storage Adapter (bridges MediaStorageAdapter interface to StorageService)
 */
export class CloudMediaStorageAdapter implements MediaStorageAdapter {
  async upload(destinationPath: string, buffer: Buffer, mimeType: string = 'video/mp4'): Promise<string> {
    const storage = getStorageService();
    await storage.uploadObject(destinationPath, Readable.from(buffer), {
      contentType: mimeType,
      contentLength: buffer.length,
    });
    const { downloadUrl } = await storage.getDownloadUrl(destinationPath);
    return downloadUrl;
  }

  async download(sourcePath: string): Promise<Buffer> {
    const storage = getStorageService();
    return storage.getObject(sourcePath);
  }

  async getSignedUrl(sourcePath: string, expiresInSeconds: number = 3600): Promise<string> {
    const storage = getStorageService();
    const { downloadUrl } = await storage.getDownloadUrl(sourcePath, { expiresInSeconds });
    return downloadUrl;
  }

  async delete(sourcePath: string): Promise<void> {
    const storage = getStorageService();
    await storage.deleteObject(sourcePath);
  }

  async exists(sourcePath: string): Promise<boolean> {
    const storage = getStorageService();
    return storage.exists(sourcePath);
  }

  async cleanupStaleMedia(): Promise<number> {
    return 0;
  }
}

let mediaStorageInstance: MediaStorageAdapter | null = null;

export function getMediaStorage(): MediaStorageAdapter {
  if (!mediaStorageInstance) {
    if (process.env.STORAGE_PROVIDER === 'bunny' || (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOCAL_STORAGE !== 'true')) {
      mediaStorageInstance = new CloudMediaStorageAdapter();
    } else {
      mediaStorageInstance = new LocalMediaStorageAdapter();
    }
  }
  return mediaStorageInstance;
}

export function saveLocalMediaAsset(asset: any): void {
  const mediaFile = path.join(process.cwd(), 'data', 'media_assets.json');
  try {
    const list = fs.existsSync(mediaFile) ? JSON.parse(fs.readFileSync(mediaFile, 'utf-8')) : [];
    const updated = [asset, ...list.filter((m: any) => m.id !== asset.id)];
    fs.writeFileSync(mediaFile, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save local media asset:', err);
  }
}

export function getLocalMediaAsset(id: string): any | null {
  const mediaFile = path.join(process.cwd(), 'data', 'media_assets.json');
  try {
    if (fs.existsSync(mediaFile)) {
      const list = JSON.parse(fs.readFileSync(mediaFile, 'utf-8'));
      return list.find((m: any) => m.id === id) || null;
    }
  } catch {}
  return null;
}

export async function getMediaAssetById(id: string): Promise<MediaAsset | null> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from('media_assets').select('*').eq('id', id).maybeSingle();
    if (data) {
      return {
        id: data.id,
        projectId: data.project_id,
        userId: data.user_id,
        fileName: data.file_name,
        fileUrl: data.file_url,
        storagePath: data.storage_path,
        mimeType: data.mime_type,
        sizeBytes: Number(data.size_bytes || 0),
        storageProvider: data.storage_provider,
        storageBucketOrZone: data.storage_bucket_or_zone,
        storageKey: data.storage_key,
        duration: data.duration ? Number(data.duration) : undefined,
        durationSeconds: data.duration ? Number(data.duration) : undefined,
        width: data.width ? Number(data.width) : undefined,
        height: data.height ? Number(data.height) : undefined,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  }
  return getLocalMediaAsset(id);
}



