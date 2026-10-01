import { NextRequest, NextResponse } from 'next/server';
import { transcribeWithDeepgram } from '@/lib/providers/deepgramProvider';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let audioUrl: string | undefined;
    let audioBuffer: Buffer | undefined;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      audioUrl = body.audioUrl;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (file) {
        const bytes = await file.arrayBuffer();
        audioBuffer = Buffer.from(bytes);
      }
    }

    if (!audioUrl && !audioBuffer) {
      return NextResponse.json(
        { error: 'An audioUrl or audio file upload is required for transcription.' },
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
      words: transcript.words,
      utterances: transcript.utterances || [],
      language: transcript.language,
    });
  } catch (error: any) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to transcribe audio with Deepgram.',
      },
      { status: error?.statusCode || 500 }
    );
  }
}
