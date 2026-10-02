import fs from 'fs';
import path from 'path';
import { Project, RenderJob, CostTelemetryRecord } from '../types';
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
  getCostTelemetry(): Promise<CostTelemetryRecord[]>;
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
      const { error: transError } = await supabase.from('transcripts').upsert({
        project_id: project.id,
        media_asset_id: project.activeMediaId || null,
        transcript_text: project.transcript.text,
        words: project.transcript.words,
        utterances: project.transcript.utterances || [],
        language: project.transcript.language || 'en',
        source: project.transcript.source || 'deepgram',
      });
      if (transError) {
        console.warn('Supabase transcript upsert warning:', transError.message);
      }
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
            text: data.transcripts[0].transcript_text,
            words: data.transcripts[0].words,
            utterances: data.transcripts[0].utterances,
            language: data.transcripts[0].language,
            source: data.transcripts[0].source,
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

    if (source.userId && source.userId !== userId && process.env.NODE_ENV === 'production') {
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
      project_id: telemetry.projectId || null,
      service_name: telemetry.serviceName,
      model: telemetry.model || null,
      units_used: telemetry.unitsUsed,
      unit_type: telemetry.unitType,
      cost_in_usd: telemetry.costInUSD,
      is_estimated: telemetry.isEstimated,
    });
  }

  async getCostTelemetry(): Promise<CostTelemetryRecord[]> {
    const { data } = await supabase
      .from('cost_telemetry')
      .select('*')
      .order('created_at', { ascending: false });

    return (data || []).map((d: any) => ({
      id: d.id,
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
}

/**
 * Local Development Storage Adapter (used only when Supabase is not configured)
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private dataDir = path.join(process.cwd(), 'data');
  private projectsFile = path.join(process.cwd(), 'data', 'projects.json');
  private jobsFile = path.join(process.cwd(), 'data', 'render_jobs.json');
  private telemetryFile = path.join(process.cwd(), 'data', 'telemetry.json');

  constructor() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
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
    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    const list = this.readJson<Project[]>(this.projectsFile, []);
    return list.find((p) => p.id === id) || null;
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
    if (source.userId && source.userId !== userId && process.env.NODE_ENV === 'production') {
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
    const updated = [{ ...telemetry, id: `telemetry-${Date.now()}` }, ...list];
    this.writeJson(this.telemetryFile, updated);
  }

  async getCostTelemetry(): Promise<CostTelemetryRecord[]> {
    return this.readJson<CostTelemetryRecord[]>(this.telemetryFile, []);
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
      if (storageMode === 'local' && process.env.ALLOW_DEV_LOCAL_STORAGE !== 'true') {
        throw new ClipperError(
          'STORAGE_UNAVAILABLE',
          'CRITICAL PERSISTENCE ERROR: Local JSON storage is forbidden in production. Configure STORAGE_MODE=supabase with PostgreSQL.',
          500
        );
      }
      if (!isSupabaseConfigured() && process.env.ALLOW_DEV_LOCAL_STORAGE !== 'true') {
        throw new ClipperError(
          'STORAGE_UNAVAILABLE',
          'CRITICAL PERSISTENCE ERROR: Database storage (Supabase PostgreSQL) is not configured in production mode. Local JSON persistence is forbidden in production. Configure NEXT_PUBLIC_SUPABASE_URL or explicitly set ALLOW_DEV_LOCAL_STORAGE=true.',
          500
        );
      }
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

