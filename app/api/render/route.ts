import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { createRenderJob, startRenderWorkerAsync } from '@/lib/renderJobs';
import { RenderClipOptions } from '@/lib/renderEngine';
import { getAuthenticatedUser, requireProjectAccess } from '@/lib/auth/serverAuth';
import { validateSafeRemoteUrl } from '@/lib/security/ssrfValidator';
import { formatErrorResponse, ClipperError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        new ClipperError('AUTH_REQUIRED', 'Authentication required. Please log in.', 401).toResponse(),
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      projectId,
      clip,
      sourceUrl,
      subtitleStyle,
      visualSettings,
      audioSettings,
      cuts,
      isProUser = false,
      reframeTrack,
      aspectRatio,
      trackingMode,
      manualSettings,
      brollOperations,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'projectId is required to initiate a render job.', 400).toResponse(),
        { status: 400 }
      );
    }

    try {
      await requireProjectAccess(user, projectId, 'editor');
    } catch (authErr: any) {
      const { body: errBody, status } = formatErrorResponse(authErr);
      return NextResponse.json(errBody, { status });
    }

    if (!clip || typeof clip.start !== 'number' || typeof clip.duration !== 'number') {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'Valid clip object with start and duration timestamps is required.', 400).toResponse(),
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

    // Validate media URL against SSRF if remote
    if (candidateMedia.startsWith('http://') || candidateMedia.startsWith('https://')) {
      const ssrfCheck = await validateSafeRemoteUrl(candidateMedia);
      if (!ssrfCheck.isValid) {
        return NextResponse.json(
          { error: `Remote media URL security violation: ${ssrfCheck.error}` },
          { status: 400 }
        );
      }
    } else {
      // Validate local media existence
      const isLocalValid =
        fs.existsSync(candidateMedia) ||
        candidateMedia.startsWith('/uploads/') ||
        candidateMedia.startsWith('/exports/');

      if (!isLocalValid) {
        return NextResponse.json(
          { error: `Local media path not found: ${candidateMedia}` },
          { status: 404 }
        );
      }
    }

    // 1. Create registered render job
    const job = await createRenderJob({
      projectId,
      clipId: clip.id,
      userId: user.id,
      inputUrl: candidateMedia,
    });

    const resolvedReframe = reframeTrack || visualSettings?.reframeTrack;
    const resolvedAspect = aspectRatio || visualSettings?.aspectRatio || resolvedReframe?.aspectRatio;
    const resolvedTracking = trackingMode || visualSettings?.trackingMode || resolvedReframe?.trackingMode;
    const resolvedManual = manualSettings || visualSettings?.manualPosition || resolvedReframe?.manualSettings;
    const resolvedBroll = brollOperations || (clip.cuts ? clip.cuts.filter((c: any) => c.type === 'BROLL') : []);
    const resolvedCuts = cuts || clip.cuts || [];

    const renderOptions: RenderClipOptions = {
      inputMedia: candidateMedia,
      startTime: clip.start,
      duration: clip.duration,
      words: clip.words || [],
      subtitleStyle,
      visualSettings,
      audioSettings,
      cuts: resolvedCuts,
      isProUser,
      reframeTrack: resolvedReframe,
      aspectRatio: resolvedAspect,
      trackingMode: resolvedTracking,
      manualSettings: resolvedManual,
      brollOperations: resolvedBroll,
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
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
