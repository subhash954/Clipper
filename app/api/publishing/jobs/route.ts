/**
 * CLIPPER PUBLISHING API — PUBLISH JOBS
 * GET /api/publishing/jobs
 * POST /api/publishing/jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enqueuePublishJob,
  listPublishJobs,
  listPublishingLogs,
} from '@/lib/publishing/queueService';
import { PublishJobStatus } from '@/lib/publishing/types';
import { SupportedPlatform } from '@/lib/factory/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || 'default-workspace';
  const status = searchParams.get('status') as PublishJobStatus | null;
  const platform = searchParams.get('platform') as SupportedPlatform | null;
  const includeLogs = searchParams.get('includeLogs') === 'true';

  const filter: { status?: PublishJobStatus; platform?: SupportedPlatform } = {};
  if (status) filter.status = status;
  if (platform) filter.platform = platform;

  const jobs = listPublishJobs(workspaceId, filter);
  const logs = includeLogs ? listPublishingLogs(workspaceId) : undefined;

  return NextResponse.json({ jobs, logs });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId = 'default-workspace',
      assetId,
      connectionId,
      platform,
      scheduledAt,
      scheduledTimezone = 'UTC',
      mediaFilePath,
      metadata,
    } = body;

    if (!assetId || !connectionId || !platform || !scheduledAt) {
      return NextResponse.json(
        { error: 'Missing required parameters (assetId, connectionId, platform, scheduledAt).' },
        { status: 400 }
      );
    }

    const { job, isDuplicate } = enqueuePublishJob({
      workspaceId,
      assetId,
      connectionId,
      platform,
      scheduledAt,
      scheduledTimezone,
      mediaFilePath: mediaFilePath || `/renders/${assetId}.mp4`,
      metadata: metadata || {
        title: 'Untitled Video',
        description: '',
        hashtags: [],
        privacy: 'public',
      },
    });

    return NextResponse.json({ job, isDuplicate });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
