/**
 * CLIPPER SOCIAL PUBLISHING — TIMEZONE-AWARE & BULK SCHEDULING ENGINE
 * Phase 14, 15, 16
 * 
 * Provides timezone-accurate calendar scheduling, minimum gap enforcement,
 * and bulk queue generation with pre-execution slot preview.
 */

import {
  BulkScheduleConfig,
  BulkSchedulePreviewItem,
  PublishJob,
} from './types';
import { enqueuePublishJob, listPublishJobs } from './queueService';
import { getConnection } from './connectionStore';
import { getContentAssetById } from '@/lib/factory/contentStore';

/**
 * Checks if a proposed scheduled time conflicts with an existing job within the minimum gap.
 */
export function checkScheduleGapConflict(
  workspaceId: string,
  connectionId: string,
  proposedTimeIso: string,
  minGapHours: number = 2
): { hasConflict: boolean; conflictingJob?: PublishJob } {
  const existingJobs = listPublishJobs(workspaceId).filter(
    (j) =>
      j.connectionId === connectionId &&
      (j.status === 'QUEUED' || j.status === 'PUBLISHING' || j.status === 'PUBLISHED')
  );

  const proposedMs = new Date(proposedTimeIso).getTime();
  const gapMs = minGapHours * 60 * 60 * 1000;

  for (const job of existingJobs) {
    const jobMs = new Date(job.scheduledAt).getTime();
    if (Math.abs(proposedMs - jobMs) < gapMs) {
      return { hasConflict: true, conflictingJob: job };
    }
  }

  return { hasConflict: false };
}

/**
 * Generates preview of bulk scheduling distribution without committing to database.
 */
export function previewBulkSchedule(config: BulkScheduleConfig): BulkSchedulePreviewItem[] {
  const connection = getConnection(config.connectionId, config.workspaceId);
  const accountHandle = connection?.accountHandle || 'unknown';

  const previewItems: BulkSchedulePreviewItem[] = [];
  let currentDate = new Date(config.startDate);

  // If start date is in the past, adjust to now
  if (currentDate.getTime() < Date.now()) {
    currentDate = new Date(Date.now() + 3600 * 1000); // 1 hour in future
  }

  const gapHours = Math.max(1, config.gapHours || 24);
  const startHour = config.allowedHoursStart ?? 10;
  const endHour = config.allowedHoursEnd ?? 18;

  for (let i = 0; i < config.assetIds.length; i++) {
    const assetId = config.assetIds[i];

    // Align hour within allowed window
    let scheduleSlot = new Date(currentDate.getTime() + i * gapHours * 3600 * 1000);

    // If day of week frequency requires weekdays only, skip weekend
    if (config.frequency === 'weekdays') {
      while (scheduleSlot.getUTCDay() === 0 || scheduleSlot.getUTCDay() === 6) {
        scheduleSlot = new Date(scheduleSlot.getTime() + 24 * 3600 * 1000);
      }
    }

    // Clamp hour to allowed range
    const currentHour = scheduleSlot.getUTCHours();
    if (currentHour < startHour) {
      scheduleSlot.setUTCHours(startHour, 0, 0, 0);
    } else if (currentHour > endHour) {
      scheduleSlot.setUTCHours(endHour, 0, 0, 0);
    }

    previewItems.push({
      assetId,
      platform: config.platform,
      scheduledAt: scheduleSlot.toISOString(),
      scheduledTimezone: config.timezone || 'UTC',
      accountHandle,
    });
  }

  return previewItems;
}

/**
 * Executes confirmed bulk schedule plan, creating queued jobs for each asset.
 */
export async function executeBulkSchedule(
  config: BulkScheduleConfig
): Promise<{ scheduledCount: number; jobs: PublishJob[] }> {
  const preview = previewBulkSchedule(config);
  const createdJobs: PublishJob[] = [];

  for (const item of preview) {
    const asset = await getContentAssetById(item.assetId);
    const mediaFilePath = asset?.renderedVideoPath || `/renders/${item.assetId}.mp4`;
    const title = asset?.title || `Content Asset ${item.assetId.slice(0, 8)}`;
    const description = asset?.description || '';
    const hashtags = asset?.hashtags?.all || [];

    const { job } = enqueuePublishJob({
      workspaceId: config.workspaceId,
      assetId: item.assetId,
      connectionId: config.connectionId,
      platform: config.platform,
      scheduledAt: item.scheduledAt,
      scheduledTimezone: item.scheduledTimezone,
      mediaFilePath,
      metadata: {
        title,
        description,
        caption: description,
        hashtags,
        privacy: 'public',
      },
    });

    createdJobs.push(job);
  }

  return {
    scheduledCount: createdJobs.length,
    jobs: createdJobs,
  };
}
