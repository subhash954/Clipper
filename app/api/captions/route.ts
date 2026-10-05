import { NextRequest, NextResponse } from 'next/server';
import { getCaptionService } from '@/lib/captions/captionService';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { ClipperError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const versionStr = searchParams.get('version');
    const version = versionStr ? parseInt(versionStr, 10) : undefined;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
    }

    const captionService = getCaptionService();
    const track = await captionService.getCaptionTrack(projectId, version, user.id);

    if (!track) {
      return NextResponse.json({ success: false, error: 'No caption track found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      track,
    });
  } catch (error: any) {
    if (error instanceof ClipperError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve caption track.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, transcriptId, mediaAssetId, language, style, config, forceRegenerate } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
    }

    const captionService = getCaptionService();
    const track = await captionService.generateCaptionTrack({
      projectId,
      userId: user.id,
      transcriptId,
      mediaAssetId,
      language,
      style,
      config,
      forceRegenerate: Boolean(forceRegenerate),
    });

    return NextResponse.json({
      success: true,
      track,
    });
  } catch (error: any) {
    if (error instanceof ClipperError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate captions.' },
      { status: 500 }
    );
  }
}
