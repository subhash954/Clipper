import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  EnterpriseJob,
  JobPriority,
  JobStatus,
  WorkerHeartbeatPayload,
} from './types';

const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export class EnterpriseJobQueue {
  private baseDir = path.join(process.cwd(), 'data', 'enterprise');
  private queueFile = path.join(process.cwd(), 'data', 'enterprise', 'job_queue.json');
  private dlqFile = path.join(process.cwd(), 'data', 'enterprise', 'dead_letter_queue.json');

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private read<T>(filePath: string): T[] {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private write<T>(filePath: string, data: T[]): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Enqueues an enterprise job with priority and retry configuration
   */
  async enqueueJob<TData = any>(
    type: string,
    organizationId: string,
    workspaceId: string,
    data: TData,
    priority: JobPriority = 'NORMAL',
    maxRetries: number = 3,
    userId?: string
  ): Promise<EnterpriseJob<TData>> {
    const queue = this.read<EnterpriseJob>(this.queueFile);

    const job: EnterpriseJob<TData> = {
      id: crypto.randomUUID(),
      type,
      priority,
      status: 'QUEUED',
      organizationId,
      workspaceId,
      userId,
      data,
      attempts: 0,
      maxRetries,
      backoffMs: 1000,
      errorHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    queue.push(job);
    this.write(this.queueFile, queue);
    return job;
  }

  /**
   * Leases the highest priority available job for a worker
   * Implements fairness by prioritizing high priority jobs and balancing org concurrency
   */
  async leaseNextJob(
    workerId: string,
    supportedTypes: string[],
    leaseDurationMs: number = 30_000,
    maxConcurrentPerOrg: number = 5
  ): Promise<EnterpriseJob | null> {
    const queue = this.read<EnterpriseJob>(this.queueFile);
    const now = Date.now();

    // Recover expired leases first
    for (const j of queue) {
      if (j.status === 'LEASED' && j.leaseExpiresAt && new Date(j.leaseExpiresAt).getTime() < now) {
        j.status = 'QUEUED';
        j.workerId = undefined;
        j.leaseExpiresAt = undefined;
        j.updatedAt = new Date().toISOString();
      }
    }

    // Count active leased jobs per organization to prevent starvation
    const activePerOrg = new Map<string, number>();
    for (const j of queue) {
      if (j.status === 'LEASED' || j.status === 'PROCESSING') {
        activePerOrg.set(j.organizationId, (activePerOrg.get(j.organizationId) || 0) + 1);
      }
    }

    // Filter candidate jobs
    const candidates = queue.filter(j => {
      if (j.status !== 'QUEUED') return false;
      if (!supportedTypes.includes(j.type)) return false;
      const orgActive = activePerOrg.get(j.organizationId) || 0;
      if (orgActive >= maxConcurrentPerOrg) return false;
      return true;
    });

    if (candidates.length === 0) {
      this.write(this.queueFile, queue);
      return null;
    }

    // Sort candidates by priority (CRITICAL > HIGH > NORMAL > LOW) then by createdAt (FIFO)
    candidates.sort((a, b) => {
      const pDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const selected = candidates[0];
    selected.status = 'LEASED';
    selected.workerId = workerId;
    selected.leaseExpiresAt = new Date(now + leaseDurationMs).toISOString();
    selected.startedAt = new Date().toISOString();
    selected.updatedAt = new Date().toISOString();

    this.write(this.queueFile, queue);
    return selected;
  }

  /**
   * Worker sends heartbeat to renew lease and report progress
   */
  async recordHeartbeat(
    workerId: string,
    jobId: string,
    progressPercent: number,
    stage: string,
    leaseRenewalMs: number = 30_000
  ): Promise<boolean> {
    const queue = this.read<EnterpriseJob>(this.queueFile);
    const job = queue.find(j => j.id === jobId && j.workerId === workerId);
    if (!job) return false;

    job.status = 'PROCESSING';
    job.heartbeatAt = new Date().toISOString();
    job.leaseExpiresAt = new Date(Date.now() + leaseRenewalMs).toISOString();
    job.updatedAt = new Date().toISOString();

    this.write(this.queueFile, queue);
    return true;
  }

  /**
   * Successfully completes a job
   */
  async completeJob(jobId: string, workerId: string, result?: any): Promise<EnterpriseJob | null> {
    const queue = this.read<EnterpriseJob>(this.queueFile);
    const job = queue.find(j => j.id === jobId && j.workerId === workerId);
    if (!job) return null;

    job.status = 'COMPLETED';
    job.result = result;
    job.completedAt = new Date().toISOString();
    job.leaseExpiresAt = undefined;
    job.updatedAt = new Date().toISOString();

    this.write(this.queueFile, queue);
    return job;
  }

  /**
   * Fails a job; handles exponential backoff retry or sends to Dead Letter Queue (DLQ)
   */
  async failJob(jobId: string, workerId: string, error: string): Promise<EnterpriseJob | null> {
    const queue = this.read<EnterpriseJob>(this.queueFile);
    const job = queue.find(j => j.id === jobId && j.workerId === workerId);
    if (!job) return null;

    job.attempts += 1;
    job.lastError = error;
    job.errorHistory.push({
      error,
      attempt: job.attempts,
      timestamp: new Date().toISOString(),
    });

    if (job.attempts >= job.maxRetries) {
      // Sent to Dead Letter Queue (DLQ)
      job.status = 'DEAD_LETTER';
      job.leaseExpiresAt = undefined;
      job.updatedAt = new Date().toISOString();

      const dlq = this.read<EnterpriseJob>(this.dlqFile);
      dlq.push(job);
      this.write(this.dlqFile, dlq);
    } else {
      // Re-queue with exponential backoff
      job.status = 'QUEUED';
      job.workerId = undefined;
      job.leaseExpiresAt = undefined;
      job.backoffMs = Math.min(60_000, job.backoffMs * 2);
      job.updatedAt = new Date().toISOString();
    }

    this.write(this.queueFile, queue);
    return job;
  }

  /**
   * Admin operation: retry a job in the Dead Letter Queue
   */
  async retryDeadLetterJob(jobId: string): Promise<EnterpriseJob | null> {
    let dlq = this.read<EnterpriseJob>(this.dlqFile);
    const job = dlq.find(j => j.id === jobId);
    if (!job) return null;

    dlq = dlq.filter(j => j.id !== jobId);
    this.write(this.dlqFile, dlq);

    job.status = 'QUEUED';
    job.attempts = 0;
    job.workerId = undefined;
    job.leaseExpiresAt = undefined;
    job.updatedAt = new Date().toISOString();

    const queue = this.read<EnterpriseJob>(this.queueFile);
    const existingIdx = queue.findIndex(j => j.id === jobId);
    if (existingIdx !== -1) queue[existingIdx] = job;
    else queue.push(job);

    this.write(this.queueFile, queue);
    return job;
  }

  async getJob(jobId: string): Promise<EnterpriseJob | null> {
    const queue = this.read<EnterpriseJob>(this.queueFile);
    return queue.find(j => j.id === jobId) || null;
  }

  async listDeadLetters(organizationId?: string): Promise<EnterpriseJob[]> {
    const dlq = this.read<EnterpriseJob>(this.dlqFile);
    if (organizationId) {
      return dlq.filter(j => j.organizationId === organizationId);
    }
    return dlq;
  }
}

// Singleton
let jobQueueInstance: EnterpriseJobQueue | null = null;

export function getEnterpriseJobQueue(): EnterpriseJobQueue {
  if (!jobQueueInstance) {
    jobQueueInstance = new EnterpriseJobQueue();
  }
  return jobQueueInstance;
}
