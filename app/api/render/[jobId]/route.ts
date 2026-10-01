import { NextRequest, NextResponse } from 'next/server';
import { getRenderJob } from '@/lib/renderJobs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID parameter is required' }, { status: 400 });
    }

    const job = await getRenderJob(jobId);
    if (!job) {
      return NextResponse.json({ error: `Render job ${jobId} not found` }, { status: 404 });
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
