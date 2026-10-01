import { NextRequest, NextResponse } from 'next/server';
import { createRenderJob, startRenderWorkerAsync } from '@/lib/renderJobs';
import { RenderClipOptions } from '@/lib/renderEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      clip,
      sourceUrl,
      subtitleStyle,
      visualSettings,
      isProUser = false,
    } = body;

    if (!clip || typeof clip.start !== 'number' || typeof clip.duration !== 'number') {
      return NextResponse.json(
        { error: 'Valid clip object with start and duration timestamps is required.' },
        { status: 400 }
      );
    }

    // Determine media source
    // Can be an uploaded video URL, direct MP4 URL, or fallback public sample
    const inputMedia =
      sourceUrl ||
      clip.videoUrl ||
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

    // 1. Create registered render job
    const job = await createRenderJob({
      projectId,
      clipId: clip.id,
      inputUrl: inputMedia,
    });

    const renderOptions: RenderClipOptions = {
      inputMedia,
      startTime: clip.start,
      duration: clip.duration,
      words: clip.words || [],
      subtitleStyle,
      visualSettings,
      isProUser,
    };

    // 2. Launch background rendering worker (non-blocking)
    startRenderWorkerAsync(job.id, renderOptions);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
    });
  } catch (error: any) {
    console.error('Error initiating render job:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to initiate 9:16 video render job.' },
      { status: 500 }
    );
  }
}
