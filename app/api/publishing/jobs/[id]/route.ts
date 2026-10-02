/**
 * CLIPPER PUBLISHING API — SINGLE JOB DETAILS & CANCEL
 * GET /api/publishing/jobs/[id]
 * DELETE /api/publishing/jobs/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublishJob, cancelPublishJob } from '@/lib/publishing/queueService';
import { getConnection } from '@/lib/publishing/connectionStore';
import { runPublishingChecklist } from '@/lib/publishing/checklist';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || 'default-workspace';

  const job = getPublishJob(id, workspaceId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const connection = getConnection(job.connectionId, workspaceId);
  const checklist = await runPublishingChecklist(job, connection);

  return NextResponse.json({ job, checklist, connection });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default-workspace';

    const success = cancelPublishJob(id, workspaceId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
