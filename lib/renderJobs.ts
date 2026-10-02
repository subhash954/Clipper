import { RenderJob, RenderJobStatus } from './types';
import { renderClipWithFfmpeg, RenderClipOptions } from './renderEngine';
import { getStorage } from './storage';
import { ClipperError } from './errors';

// In-memory render job cache for fast status retrieval
const activeJobs = new Map<string, RenderJob>();

export function clearActiveJobsMemoryCache(): void {
  activeJobs.clear();
}

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
  const effectiveUserId =
    params.userId ||
    (process.env.NODE_ENV !== 'production'
      ? '00000000-0000-0000-0000-000000000001'
      : undefined);

  if (!effectiveUserId) {
    throw new ClipperError('VALIDATION_ERROR', 'userId is required to create a render job.', 400);
  }

  const jobId =
    params.id ||
    params.idempotencyKey ||
    `render-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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
    userId: effectiveUserId,
    status: 'queued',
    progress: 0,
    currentStage: 'Queued in render pipeline...',
    inputUrl: params.inputUrl,
    retryCount: 0,
    maxRetries: 2,
    heartbeatAt: now,
    createdAt: now,
  };

  // Authoritative persistent storage: fail immediately if persistence fails
  const storage = getStorage();
  try {
    await storage.createRenderJob(job);
  } catch (err: any) {
    if (err instanceof ClipperError) throw err;
    throw new ClipperError(
      'STORAGE_UNAVAILABLE',
      `Could not persist render job to durable storage: ${err.message}`,
      500
    );
  }

  activeJobs.set(jobId, job);
  return job;
}

/**
 * Retrieves a render job by ID from authoritative storage with memory cache fallback
 */
export async function getRenderJob(jobId: string): Promise<RenderJob | null> {
  try {
    const storage = getStorage();
    const dbJob = await storage.getRenderJob(jobId);
    if (dbJob) {
      activeJobs.set(jobId, dbJob);
      return dbJob;
    }
  } catch (err) {
    // If storage query fails, fall back to memory cache
  }

  return activeJobs.get(jobId) || null;
}

/**
 * Updates a render job's status, progress, and heartbeat with state transition validation
 */
export async function updateRenderJob(
  jobId: string,
  updates: Partial<RenderJob>
): Promise<RenderJob | null> {
  const existing = await getRenderJob(jobId);
  if (!existing) return null;

  // State Machine Validation: Disallow transition away from terminal states
  const TERMINAL_STATES: RenderJobStatus[] = ['completed', 'failed', 'cancelled'];
  if (
    TERMINAL_STATES.includes(existing.status) &&
    updates.status &&
    updates.status !== existing.status
  ) {
    throw new ClipperError(
      'VALIDATION_ERROR',
      `Illegal render job state transition: cannot transition from terminal state '${existing.status}' to '${updates.status}'.`,
      400
    );
  }

  const updated: RenderJob = {
    ...existing,
    ...updates,
    heartbeatAt: new Date().toISOString(),
  };

  const storage = getStorage();
  try {
    const persisted = await storage.updateRenderJob(jobId, updated);
    if (persisted) {
      activeJobs.set(jobId, persisted);
      return persisted;
    }
  } catch (err: any) {
    if (err instanceof ClipperError) throw err;
    throw new ClipperError(
      'STORAGE_UNAVAILABLE',
      `Could not persist render job update: ${err.message}`,
      500
    );
  }

  activeJobs.set(jobId, updated);
  return updated;
}

/**
 * Cancels a pending or processing render job
 */
export async function cancelRenderJob(jobId: string): Promise<RenderJob | null> {
  const existing = await getRenderJob(jobId);
  if (!existing) return null;
  if (existing.status === 'completed') {
    throw new ClipperError('VALIDATION_ERROR', `Cannot cancel already completed render job ${jobId}.`, 400);
  }
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
