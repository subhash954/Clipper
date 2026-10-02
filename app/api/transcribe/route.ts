import { NextRequest, NextResponse } from 'next/server';
import { getTranscriptionService } from '@/lib/transcription/transcriptionService';
import { transcribeWithDeepgram, DeepgramProviderError } from '@/lib/providers/deepgramProvider';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
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

    if (contentType.includes('application/json')) {
      const body = await req.json();
      projectId = body.projectId;
      mediaId = body.mediaId;
      forceRerun = Boolean(body.forceRerun);
      audioUrl = body.audioUrl;
    } else if (contentType.includes('multipart/form-data')) {
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

    // 2. Direct Audio Input Flow (Audio URL or File Upload without project)
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
