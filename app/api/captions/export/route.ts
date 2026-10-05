import { NextRequest, NextResponse } from 'next/server';
import { getCaptionService } from '@/lib/captions/captionService';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { ClipperError } from '@/lib/errors';
import { CaptionFormat } from '@/lib/captions/types';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const format = (searchParams.get('format') || 'srt').toLowerCase() as CaptionFormat;
    const versionStr = searchParams.get('version');
    const version = versionStr ? parseInt(versionStr, 10) : undefined;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
    }

    if (!['srt', 'vtt', 'ass'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: srt, vtt, ass.' },
        { status: 400 }
      );
    }

    const captionService = getCaptionService();
    const content = await captionService.exportCaptions({
      projectId,
      version,
      userId: user.id,
      format,
    });

    let contentType = 'text/plain; charset=utf-8';
    let fileExtension = 'srt';

    if (format === 'vtt') {
      contentType = 'text/vtt; charset=utf-8';
      fileExtension = 'vtt';
    } else if (format === 'ass') {
      contentType = 'text/x-ssa; charset=utf-8';
      fileExtension = 'ass';
    }

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="subtitles_${projectId.slice(0, 8)}.${fileExtension}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    if (error instanceof ClipperError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to export subtitles.' },
      { status: 500 }
    );
  }
}
