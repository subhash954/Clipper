import { RenderJob, RenderJobStatus } from './types';
import { renderClipWithFfmpeg, RenderClipOptions } from './renderEngine';
import { getStorage } from './storage';

// In-memory render job registry for live async status tracking
const activeJobs = new Map<string, RenderJob>();

/**
 * Creates and registers a new render job
 */
export async function createRenderJob(params: {
  id?: string;
  projectId?: string;
  clipId?: string;
  userId?: string;
  inputUrl: string;
}): Promise<RenderJob> {
  const jobId = params.id || `render-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const job: RenderJob = {
    id: jobId,
    projectId: params.projectId,
    clipId: params.clipId,
    userId: params.userId,
    status: 'queued',
    progress: 0,
    currentStage: 'Queued in render pipeline...',
    inputUrl: params.inputUrl,
    createdAt: now,
  };

  activeJobs.set(jobId, job);

  // Sync to database
  try {
    const storage = getStorage();
    await storage.createRenderJob(job);
  } catch (err) {
    console.warn('Could not persist render job to database:', err);
  }

  return job;
}

/**
 * Retrieves a render job by ID
 */
export async function getRenderJob(jobId: string): Promise<RenderJob | null> {
  if (activeJobs.has(jobId)) {
    return activeJobs.get(jobId)!;
  }

  try {
    const storage = getStorage();
    const dbJob = await storage.getRenderJob(jobId);
    if (dbJob) {
      activeJobs.set(jobId, dbJob);
      return dbJob;
    }
  } catch (err) {
    console.warn('Could not fetch render job from storage:', err);
  }

  return null;
}

/**
 * Updates a render job's status and progress
 */
export async function updateRenderJob(
  jobId: string,
  updates: Partial<RenderJob>
): Promise<RenderJob | null> {
  const existing = await getRenderJob(jobId);
  if (!existing) return null;

  const updated: RenderJob = {
    ...existing,
    ...updates,
  };

  activeJobs.set(jobId, updated);

  try {
    const storage = getStorage();
    await storage.updateRenderJob(jobId, updates);
  } catch (err) {
    console.warn('Could not sync render job update to storage:', err);
  }

  return updated;
}

/**
 * Asynchronously executes the FFmpeg rendering pipeline for a registered job
 */
export function startRenderWorkerAsync(
  jobId: string,
  options: RenderClipOptions
): void {
  // Execute non-blocking in background
  (async () => {
    try {
      await updateRenderJob(jobId, {
        status: 'processing',
        startedAt: new Date().toISOString(),
        progress: 5,
        currentStage: 'Preparing 9:16 vertical render composition...',
      });

      const result = await renderClipWithFfmpeg(jobId, options, (progress, stage) => {
        updateRenderJob(jobId, {
          progress,
          currentStage: stage,
        });
      });

      await updateRenderJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStage: 'Export ready for download!',
        outputUrl: result.outputUrl,
        completedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`Render job ${jobId} failed:`, err);
      await updateRenderJob(jobId, {
        status: 'failed',
        progress: 0,
        currentStage: 'Rendering failed.',
        errorMessage: err?.message || 'Unknown FFmpeg rendering error',
        completedAt: new Date().toISOString(),
      });
    }
  })();
}
