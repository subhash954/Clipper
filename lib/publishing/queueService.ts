/**
 * CLIPPER SOCIAL PUBLISHING — QUEUE, IDEMPOTENCY & RETRY ENGINE
 * Phase 8, 9, 11, 12, 13, 20
 * 
 * Manages reliable job scheduling, duplicate prevention, exponential retry,
 * and guaranteed publication state transitions.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  PublishJob,
  PublishJobStatus,
  PublishingLog,
  ErrorClassification,
  PublishMetadata,
} from './types';
import { getConnection, updateConnectionStatus } from './connectionStore';
import { getPlatformAdapter } from './adapters';
import { runPublishingChecklist } from './checklist';
import { SupportedPlatform } from '@/lib/factory/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'publishing');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJobs(): PublishJob[] {
  ensureDataDir();
  if (!fs.existsSync(JOBS_FILE)) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJobs(jobs: PublishJob[]) {
  ensureDataDir();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

function appendLog(log: PublishingLog) {
  ensureDataDir();
  let logs: PublishingLog[] = [];
  if (fs.existsSync(LOGS_FILE)) {
    try {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    } catch {
      logs = [];
    }
  }
  logs.push(log);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

export function listPublishingLogs(workspaceId: string): PublishingLog[] {
  ensureDataDir();
  if (!fs.existsSync(LOGS_FILE)) return [];
  try {
    const logs: PublishingLog[] = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    return logs.filter((l) => l.workspaceId === workspaceId);
  } catch {
    return [];
  }
}

/**
 * Generates deterministic SHA-256 idempotency key preventing duplicate queueing.
 */
export function generateIdempotencyKey(
  workspaceId: string,
  assetId: string,
  platform: SupportedPlatform,
  scheduledAt: string
): string {
  return crypto
    .createHash('sha256')
    .update(`${workspaceId}:${assetId}:${platform}:${scheduledAt}`)
    .digest('hex');
}

export interface EnqueueJobParams {
  workspaceId: string;
  assetId: string;
  connectionId: string;
  platform: SupportedPlatform;
  scheduledAt: string;
  scheduledTimezone?: string;
  mediaFilePath: string;
  metadata: PublishMetadata;
}

/**
 * Enqueues a publishing job with duplicate prevention.
 */
export function enqueuePublishJob(params: EnqueueJobParams): { job: PublishJob; isDuplicate: boolean } {
  const jobs = readJobs();
  const idempotencyKey = generateIdempotencyKey(
    params.workspaceId,
    params.assetId,
    params.platform,
    params.scheduledAt
  );

  // Check if identical job already exists
  const existing = jobs.find((j) => j.idempotencyKey === idempotencyKey);
  if (existing) {
    return { job: existing, isDuplicate: true };
  }

  const now = new Date().toISOString();
  const job: PublishJob = {
    id: `pub-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    workspaceId: params.workspaceId,
    assetId: params.assetId,
    connectionId: params.connectionId,
    platform: params.platform,
    idempotencyKey,
    status: 'QUEUED',
    scheduledAt: params.scheduledAt,
    scheduledTimezone: params.scheduledTimezone || 'UTC',
    mediaFilePath: params.mediaFilePath,
    metadata: params.metadata,
    attemptCount: 0,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now,
  };

  jobs.push(job);
  writeJobs(jobs);

  return { job, isDuplicate: false };
}

export function getPublishJob(jobId: string, workspaceId: string): PublishJob | null {
  const jobs = readJobs();
  return jobs.find((j) => j.id === jobId && j.workspaceId === workspaceId) || null;
}

export function listPublishJobs(
  workspaceId: string,
  filter?: { status?: PublishJobStatus; platform?: SupportedPlatform }
): PublishJob[] {
  const jobs = readJobs();
  return jobs.filter((j) => {
    if (j.workspaceId !== workspaceId) return false;
    if (filter?.status && j.status !== filter.status) return false;
    if (filter?.platform && j.platform !== filter.platform) return false;
    return true;
  });
}

export function cancelPublishJob(jobId: string, workspaceId: string): boolean {
  const jobs = readJobs();
  const idx = jobs.findIndex((j) => j.id === jobId && j.workspaceId === workspaceId);
  if (idx === -1) return false;

  if (jobs[idx].status === 'PUBLISHED') {
    throw new Error('Cannot cancel an already published post.');
  }

  jobs[idx].status = 'CANCELLED';
  jobs[idx].updatedAt = new Date().toISOString();
  writeJobs(jobs);
  return true;
}

/**
 * Calculates exponential backoff with jitter in milliseconds.
 */
export function calculateBackoffMs(attempt: number): number {
  const base = 1000 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

/**
 * Executes a publishing job against real external platform adapter.
 */
export async function executePublishJob(
  jobId: string,
  workspaceId: string
): Promise<{ success: boolean; job: PublishJob; error?: string }> {
  const jobs = readJobs();
  const idx = jobs.findIndex((j) => j.id === jobId && j.workspaceId === workspaceId);
  if (idx === -1) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const job = jobs[idx];
  const connection = getConnection(job.connectionId, workspaceId);

  // Run Pre-flight Checklist
  const checklist = await runPublishingChecklist(job, connection);
  if (checklist.isBlocked) {
    job.status = 'FAILED';
    job.lastError = {
      code: 'CHECKLIST_BLOCKED',
      message: checklist.blockers.join('; '),
      classification: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
      actionableFix: 'Resolve all checklist blockers before attempting publication.',
    };
    job.updatedAt = new Date().toISOString();
    writeJobs(jobs);

    appendLog({
      id: `log-${Date.now()}`,
      jobId: job.id,
      workspaceId: job.workspaceId,
      assetId: job.assetId,
      platform: job.platform,
      accountHandle: connection?.accountHandle || 'unknown',
      attemptNumber: job.attemptCount + 1,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      result: 'FAILURE',
      errorCode: 'CHECKLIST_BLOCKED',
      errorMessage: checklist.blockers.join('; '),
    });

    return { success: false, job, error: checklist.blockers.join('; ') };
  }

  // Update status to PREPARING / PUBLISHING
  job.status = 'PUBLISHING';
  job.attemptCount += 1;
  job.updatedAt = new Date().toISOString();
  writeJobs(jobs);

  const startTime = new Date().toISOString();
  const adapter = getPlatformAdapter(job.platform);
  const result = await adapter.publishPost(connection!, job);

  if (result.success && result.externalPostId) {
    // Only set to PUBLISHED if real external confirmation is verified
    job.status = 'PUBLISHED';
    job.externalPostId = result.externalPostId;
    job.externalUrl = result.externalUrl;
    job.publishedAt = new Date().toISOString();
    job.platformResponseMetadata = result.platformMetadata;
    job.lastError = undefined;
    job.updatedAt = new Date().toISOString();
    writeJobs(jobs);

    appendLog({
      id: `log-${Date.now()}`,
      jobId: job.id,
      workspaceId: job.workspaceId,
      assetId: job.assetId,
      platform: job.platform,
      accountHandle: connection!.accountHandle,
      attemptNumber: job.attemptCount,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      result: 'SUCCESS',
      externalPostId: result.externalPostId,
    });

    return { success: true, job };
  } else {
    // Failure handling & classification
    const err = result.error || {
      code: 'UNKNOWN_FAILURE',
      message: 'Unknown publishing error occurred',
      classification: 'UNKNOWN_ERROR' as ErrorClassification,
      actionableFix: 'Contact support or check platform status.',
    };

    const isRetryable =
      (err.classification === 'NETWORK_ERROR' || err.classification === 'RATE_LIMIT') &&
      job.attemptCount < job.maxAttempts;

    if (err.classification === 'AUTH_ERROR') {
      job.status = 'REAUTH_REQUIRED';
      if (connection) {
        updateConnectionStatus(connection.id, workspaceId, 'REAUTH_REQUIRED');
      }
    } else if (isRetryable) {
      job.status = 'RETRYING';
    } else {
      job.status = 'FAILED';
    }

    job.lastError = {
      code: err.code,
      message: err.message,
      classification: err.classification,
      timestamp: new Date().toISOString(),
      actionableFix: err.actionableFix,
    };
    job.updatedAt = new Date().toISOString();
    writeJobs(jobs);

    appendLog({
      id: `log-${Date.now()}`,
      jobId: job.id,
      workspaceId: job.workspaceId,
      assetId: job.assetId,
      platform: job.platform,
      accountHandle: connection ? connection.accountHandle : 'unknown',
      attemptNumber: job.attemptCount,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      result: isRetryable ? 'RETRY_SCHEDULED' : 'FAILURE',
      errorCode: err.code,
      errorMessage: err.message,
    });

    return { success: false, job, error: err.message };
  }
}
