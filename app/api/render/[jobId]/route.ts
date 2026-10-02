import { NextRequest, NextResponse } from 'next/server';
import { getRenderJob } from '@/lib/renderJobs';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { formatErrorResponse, ClipperError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        new ClipperError('AUTH_REQUIRED', 'Authentication required. Please log in.', 401).toResponse(),
        { status: 401 }
      );
    }

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'Job ID parameter is required.', 400).toResponse(),
        { status: 400 }
      );
    }

    const job = await getRenderJob(jobId);
    if (!job) {
      return NextResponse.json(
        new ClipperError('NOT_FOUND', `Render job ${jobId} not found.`, 404).toResponse(),
        { status: 404 }
      );
    }

    // Strict tenant check: user can only see their own render jobs unless admin
    if (user.role !== 'admin' && job.userId !== user.id) {
      return NextResponse.json(
        new ClipperError('FORBIDDEN', 'Forbidden: You do not have permission to view this render job.', 403).toResponse(),
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
