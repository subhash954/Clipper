/**
 * CLIPPER PUBLISHING API — IMMEDIATE PUBLISH DISPATCH
 * POST /api/publishing/jobs/[id]/publish
 */

import { NextRequest, NextResponse } from 'next/server';
import { executePublishJob } from '@/lib/publishing/queueService';
import { dispatchAutomationEvent } from '@/lib/publishing/automationEngine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId || 'default-workspace';

    const result = await executePublishJob(id, workspaceId);

    // Fire automation events
    if (result.success) {
      await dispatchAutomationEvent(workspaceId, 'publish.completed', {
        jobId: id,
        assetId: result.job.assetId,
        platform: result.job.platform,
        externalPostId: result.job.externalPostId,
        externalUrl: result.job.externalUrl,
        title: 'Published Successfully',
        message: `Asset published to ${result.job.platform} (${result.job.externalUrl})`,
      });
    } else {
      await dispatchAutomationEvent(workspaceId, 'publish.failed', {
        jobId: id,
        assetId: result.job.assetId,
        platform: result.job.platform,
        error: result.error,
        title: 'Publishing Failed',
        message: `Failed to publish to ${result.job.platform}: ${result.error}`,
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
