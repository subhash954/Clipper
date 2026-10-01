import { RenderJob, RenderJobStatus } from './types';
import { renderClipWithFfmpeg, RenderClipOptions } from './renderEngine';
import { getStorage } from './storage';

// In-memory render job registry for live async status tracking
const activeJobs = new Map<string, RenderJob>();

/**
 * Creates and registers a new durable render job with idempotency
 */
export async function createRenderJob(params: {
  id?: string;
  projectId?: string;
  clipId?: string;
  userId?: string;
  inputUrl: string;
  idempotencyKey?: string;
}): Promise<RenderJob> {
  const jobId = params.id || params.idempotencyKey || `render-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Idempotency check: if job exists and is still processing/queued, return it
  const existing = await getRenderJob(jobId);
  if (existing && (existing.status === 'processing' || existing.status === 'queued')) {
    return existing;
  }

  const job: RenderJob = {
    id: jobId,
    projectId: params.projectId,
    clipId: params.clipId,
    userId: params.userId,
    status: 'queued',
    progress: 0,
    currentStage: 'Queued in render pipeline...',
    inputUrl: params.inputUrl,
    retryCount: 0,
    maxRetries: 2,
    heartbeatAt: now,
    createdAt: now,
  };

  activeJobs.set(jobId, job);

  // Sync to database / persistent storage
  try {
    const storage = getStorage();
    await storage.createRenderJob(job);
  } catch (err) {
    console.warn('Could not persist render job to database:', err);
  }

  return job;
}

/**
 * Retrieves a render job by ID from memory or persistent storage
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
 * Updates a render job's status, progress, and heartbeat
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
    heartbeatAt: new Date().toISOString(),
  };

  activeJobs.set(jobId, updated);

  try {
    const storage = getStorage();
    await storage.updateRenderJob(jobId, updated);
  } catch (err) {
    console.warn('Could not sync render job update to storage:', err);
  }

  return updated;
}

/**
 * Cancels a pending or processing render job
 */
export async function cancelRenderJob(jobId: string): Promise<RenderJob | null> {
  return updateRenderJob(jobId, {
    status: 'cancelled',
    currentStage: 'Render cancelled by user.',
    completedAt: new Date().toISOString(),
  });
}

/**
 * Scans for stale jobs that lost heartbeat and recovers them
 */
export async function reclaimStaleJobs(staleThresholdMs: number = 600000): Promise<number> {
  let reclaimed = 0;
  const now = Date.now();

  for (const [id, job] of activeJobs.entries()) {
    if (job.status === 'processing') {
      const lastBeat = job.heartbeatAt ? new Date(job.heartbeatAt).getTime() : 0;
      if (now - lastBeat > staleThresholdMs) {
        await updateRenderJob(id, {
          status: 'failed',
          errorMessage: 'Worker heartbeat timeout: render process crashed or stalled.',
          completedAt: new Date().toISOString(),
        });
        reclaimed++;
      }
    }
  }

  return reclaimed;
}

/**
 * Asynchronously executes the FFmpeg rendering pipeline for a registered job with retries
 */
export function startRenderWorkerAsync(
  jobId: string,
  options: RenderClipOptions
): void {
  // Execute non-blocking in background
  (async () => {
    let job = await getRenderJob(jobId);
    if (!job) return;

    const maxRetries = job.maxRetries ?? 2;

    while ((job.retryCount ?? 0) <= maxRetries) {
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

        return; // Success, exit retry loop
      } catch (err: any) {
        console.error(`Render job ${jobId} attempt ${job.retryCount ?? 0} failed:`, err);
        const nextRetry = (job.retryCount ?? 0) + 1;

        if (nextRetry <= maxRetries) {
          await updateRenderJob(jobId, {
            retryCount: nextRetry,
            progress: 10,
            currentStage: `Encoding hiccup encountered. Retrying render (Attempt ${nextRetry}/${maxRetries})...`,
          });
          job = await getRenderJob(jobId);
          if (!job || job.status === 'cancelled') return;
        } else {
          await updateRenderJob(jobId, {
            status: 'failed',
            progress: 0,
            currentStage: 'Rendering failed after maximum retry attempts.',
            errorMessage: err?.message || 'FFmpeg rendering failed.',
            completedAt: new Date().toISOString(),
          });
          return;
        }
      }
    }
  })();
}
