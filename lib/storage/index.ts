import fs from 'fs';
import path from 'path';
import { Project, RenderJob, CostTelemetryRecord } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

export interface IStorageAdapter {
  saveProject(project: Project): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  createRenderJob(job: RenderJob): Promise<RenderJob>;
  getRenderJob(id: string): Promise<RenderJob | null>;
  updateRenderJob(id: string, updates: Partial<RenderJob>): Promise<RenderJob | null>;
  listRenderJobs(): Promise<RenderJob[]>;
  recordCostTelemetry(telemetry: CostTelemetryRecord): Promise<void>;
  getCostTelemetry(): Promise<CostTelemetryRecord[]>;
}

/**
 * Production Supabase PostgreSQL Storage Adapter
 */
export class SupabaseStorageAdapter implements IStorageAdapter {
  async saveProject(project: Project): Promise<Project> {
    const { error: projError } = await supabase.from('projects').upsert({
      id: project.id,
      user_id: project.userId || null,
      title: project.title,
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
      throw new Error(`Supabase saveProject failed: ${projError.message}`);
    }

    // Upsert transcript if present
    if (project.transcript) {
      const { error: transError } = await supabase.from('transcripts').upsert({
        project_id: project.id,
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
          id: clip.id,
          project_id: project.id,
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
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
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
    };
  }

  async listProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, clips(*)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase listProjects error: ${error.message}`);
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      title: p.title,
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
    }));
  }

  async createRenderJob(job: RenderJob): Promise<RenderJob> {
    const { error } = await supabase.from('render_jobs').insert({
      id: job.id,
      project_id: job.projectId || null,
      clip_id: job.clipId || null,
      user_id: job.userId || null,
      status: job.status,
      progress: job.progress,
      current_stage: job.currentStage,
      input_url: job.inputUrl,
      output_url: job.outputUrl || null,
      error_message: job.errorMessage || null,
      created_at: job.createdAt,
    });

    if (error) {
      console.warn('Supabase createRenderJob warning:', error.message);
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

  async listRenderJobs(): Promise<RenderJob[]> {
    const { data } = await supabase
      .from('render_jobs')
      .select('*')
      .order('created_at', { ascending: false });

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

  async saveProject(project: Project): Promise<Project> {
    const list = await this.listProjects();
    const updated = [project, ...list.filter((p) => p.id !== project.id)];
    this.writeJson(this.projectsFile, updated);
    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    const list = await this.listProjects();
    return list.find((p) => p.id === id) || null;
  }

  async listProjects(): Promise<Project[]> {
    return this.readJson<Project[]>(this.projectsFile, []);
  }

  async createRenderJob(job: RenderJob): Promise<RenderJob> {
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

  async listRenderJobs(): Promise<RenderJob[]> {
    return this.readJson<RenderJob[]>(this.jobsFile, []);
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
    if (isSupabaseConfigured()) {
      storageInstance = new SupabaseStorageAdapter();
    } else {
      storageInstance = new LocalStorageAdapter();
    }
  }
  return storageInstance;
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

let mediaStorageInstance: MediaStorageAdapter | null = null;

export function getMediaStorage(): MediaStorageAdapter {
  if (!mediaStorageInstance) {
    mediaStorageInstance = new LocalMediaStorageAdapter();
  }
  return mediaStorageInstance;
}

