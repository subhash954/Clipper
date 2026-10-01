import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { getTTSProvider } from '@/lib/providers/ttsProvider';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const { text, voiceId } = body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'Narration script text is required.' }, { status: 400 });
    }

    const provider = getTTSProvider();
    if (!provider.isConfigured()) {
      return NextResponse.json(
        {
          error: 'Voice generation provider not configured.',
          details: 'Please set ELEVENLABS_API_KEY in the server environment to enable AI voice narration.',
          isConfigured: false,
        },
        { status: 503 }
      );
    }

    const result = await provider.synthesize(text.trim(), voiceId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      audioUrl: result.audioUrl,
      duration: result.durationSeconds,
      provider: result.provider,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'TTS generation error' }, { status: 500 });
  }
}
