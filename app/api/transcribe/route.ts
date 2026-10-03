import { NextRequest, NextResponse } from 'next/server';
import { getTranscriptionService } from '@/lib/transcription/transcriptionService';
import { transcribeWithDeepgram, DeepgramProviderError } from '@/lib/providers/deepgramProvider';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { validateSafeRemoteUrl } from '@/lib/security/ssrfValidator';
import { ClipperError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let projectId: string | undefined;
    let mediaId: string | undefined;
    let forceRerun = false;
    let audioUrl: string | undefined;
    let audioBuffer: Buffer | undefined;

    const isDevLocalAllowed =
      process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_LOCAL_STORAGE === 'true';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      projectId = body.projectId;
      mediaId = body.mediaId;
      forceRerun = Boolean(body.forceRerun);
      audioUrl = body.audioUrl;
    } else if (contentType.includes('multipart/form-data')) {
      if (!isDevLocalAllowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Direct multipart audio upload to /api/transcribe is forbidden in production. Upload media via /api/media/upload first.',
          },
          { status: 400 }
        );
      }

      const formData = await req.formData();
      projectId = (formData.get('projectId') as string) || undefined;
      mediaId = (formData.get('mediaId') as string) || undefined;
      forceRerun = formData.get('forceRerun') === 'true';
      audioUrl = (formData.get('audioUrl') as string) || undefined;

      const file = formData.get('file') as File | null;
      if (file) {
        const bytes = await file.arrayBuffer();
        audioBuffer = Buffer.from(bytes);
      }
    }

    // SSRF Validation on remote audioUrl
    if (audioUrl) {
      const ssrfCheck = await validateSafeRemoteUrl(audioUrl);
      if (!ssrfCheck.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid or unsafe audio URL: ${ssrfCheck.error || 'Blocked by security policy.'}`,
          },
          { status: 400 }
        );
      }
    }

    // Production constraint: projectId is required for authoritative state tracking
    if (!projectId && !isDevLocalAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid projectId is required for transcription in production.',
        },
        { status: 400 }
      );
    }

    // 1. Canonical Project-Backed Transcription Flow
    if (projectId) {
      const transcriptionService = getTranscriptionService();
      const result = await transcriptionService.transcribeProjectMedia({
        projectId,
        mediaId,
        userId: user.id,
        forceRerun,
        audioBuffer,
        audioUrl,
      });

      return NextResponse.json({
        success: true,
        provider: 'deepgram_nova_2',
        transcriptId: result.transcriptId,
        transcript: result.transcript.text,
        isCached: result.isCached,
        wordsCount: result.wordsCount,
        durationSeconds: result.durationSeconds,
        words: result.transcript.words,
        segments: result.transcript.segments || [],
        utterances: result.transcript.utterances || [],
        timingPrecision: result.transcript.timingPrecision || 'exact_word',
        timingLabel: result.transcript.timingLabel,
        language: result.transcript.language || 'en',
      });
    }

    // In production, direct audio bypass without project/media is forbidden
    if (!isDevLocalAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Direct audio transcription without a project and canonical media asset is forbidden in production.',
        },
        { status: 400 }
      );
    }

    // 2. Direct Audio Input Flow (Development/test mode only)
    if (!audioUrl && !audioBuffer) {
      return NextResponse.json(
        { error: 'A projectId, audioUrl, or audio file upload is required for transcription.' },
        { status: 400 }
      );
    }

    const transcript = await transcribeWithDeepgram({
      audioUrl,
      audioBuffer,
    });

    return NextResponse.json({
      success: true,
      provider: 'deepgram_nova_2',
      transcript: transcript.text,
      wordsCount: transcript.words.length,
      durationSeconds: transcript.words.length > 0 ? transcript.words[transcript.words.length - 1].end : 0,
      words: transcript.words,
      utterances: transcript.utterances || [],
      timingPrecision: transcript.timingPrecision || 'exact_word',
      language: transcript.language || 'en',
    });
  } catch (error: any) {
    console.error('Transcription API error:', error);

    if (error instanceof ClipperError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof DeepgramProviderError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to transcribe audio with Deepgram.',
      },
      { status: error?.statusCode || 500 }
    );
  }
}
