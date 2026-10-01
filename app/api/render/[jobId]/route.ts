import { NextRequest, NextResponse } from 'next/server';
import { getRenderJob } from '@/lib/renderJobs';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID parameter is required' }, { status: 400 });
    }

    const job = await getRenderJob(jobId);
    if (!job) {
      return NextResponse.json({ error: `Render job ${jobId} not found` }, { status: 404 });
    }

    // Tenant check: user can only see their own render jobs unless admin
    if (job.userId && job.userId !== user.id && user.role !== 'admin' && !user.isDevUser) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to view this render job.' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error('Error fetching render job:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch render job status' },
      { status: 500 }
    );
  }
}
