import { NextRequest, NextResponse } from 'next/server';
import { getCaptionService } from '@/lib/captions/captionService';
import { getStorage } from '@/lib/storage';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { ClipperError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { trackId } = await params;
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;

    const captionService = getCaptionService();
    const track = await captionService.getCaptionTrackById(trackId, user.id, projectId);

    if (!track) {
      return NextResponse.json({ success: false, error: 'Caption track not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, track });
  } catch (error: any) {
    if (error instanceof ClipperError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ success: false, error: 'Failed to retrieve caption track.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { trackId } = await params;
    const body = await req.json();
    const { projectId, cueId, updates } = body;

    if (!projectId || !cueId || !updates) {
      return NextResponse.json({ error: 'projectId, cueId, and updates are required.' }, { status: 400 });
    }

    const captionService = getCaptionService();
    const updatedTrack = await captionService.updateCaptionCue({
      projectId,
      trackId,
      cueId,
      userId: user.id,
      updates,
    });

    return NextResponse.json({ success: true, track: updatedTrack });
  } catch (error: any) {
    if (error instanceof ClipperError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ success: false, error: 'Failed to update caption cue.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { trackId } = await params;
    const storage = getStorage();

    if (!storage.deleteCaptionTrack) {
      return NextResponse.json({ error: 'Delete operation not supported.' }, { status: 501 });
    }

    const deleted = await storage.deleteCaptionTrack(trackId, user.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Caption track not found or delete denied.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    if (error instanceof ClipperError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ success: false, error: 'Failed to delete caption track.' }, { status: 500 });
  }
}
