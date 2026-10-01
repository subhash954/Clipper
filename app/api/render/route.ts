import { NextRequest, NextResponse } from 'next/server';
import { createRenderJob, startRenderWorkerAsync } from '@/lib/renderJobs';
import { RenderClipOptions } from '@/lib/renderEngine';

/**
 * Validates media URL to prevent SSRF and protocol spoofing
 */
function isValidMediaUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    // Block local / loopback / private addresses / cloud metadata endpoints
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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

    // Determine candidate media source (uploaded file, direct MP4 URL, or clip videoUrl)
    const candidateMedia = (sourceUrl || clip.videoUrl || '').trim();

    // Section 24 & 25: Check for real media availability.
    // YouTube webpage URLs (watch?v=, youtu.be, shorts/) are not direct media streams for FFmpeg.
    const isYouTubeWebUrl =
      candidateMedia.includes('youtube.com/watch') ||
      candidateMedia.includes('youtu.be/') ||
      candidateMedia.includes('youtube.com/shorts');

    if (!candidateMedia || isYouTubeWebUrl) {
      return NextResponse.json(
        {
          error:
            'Render media is unavailable. YouTube web links cannot be processed directly into MP4 without an uploaded video file. Please provide an uploaded video file to export this clip.',
          requiresMediaUpload: true,
          projectId,
          clipId: clip.id,
        },
        { status: 422 }
      );
    }

    // Validate media URL against SSRF
    if (!isValidMediaUrl(candidateMedia)) {
      return NextResponse.json(
        { error: 'Invalid or restricted media URL protocol provided.' },
        { status: 400 }
      );
    }

    // 1. Create registered render job
    const job = await createRenderJob({
      projectId,
      clipId: clip.id,
      inputUrl: candidateMedia,
    });

    const renderOptions: RenderClipOptions = {
      inputMedia: candidateMedia,
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
