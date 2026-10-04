import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse } from '@/lib/errors';
import { EditingService } from '@/lib/editor/editingService';
import { CANONICAL_ASPECT_RATIOS } from '@/lib/reframe/types';

function isValidExpectedVersion(val: any): val is number {
  return typeof val === 'number' && Number.isFinite(val) && Number.isInteger(val) && val >= 1;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { projectId, expectedVersion, cameraPath, itemId } = body;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    if (!isValidExpectedVersion(expectedVersion)) {
      return NextResponse.json(
        { error: 'Missing or invalid expectedVersion: must be a finite integer >= 1' },
        { status: 400 }
      );
    }

    if (!cameraPath || typeof cameraPath !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid cameraPath object' }, { status: 400 });
    }

    if (!CANONICAL_ASPECT_RATIOS.includes(cameraPath.targetAspectRatio)) {
      return NextResponse.json(
        { error: `Invalid cameraPath targetAspectRatio: must be one of ${CANONICAL_ASPECT_RATIOS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(cameraPath.keyframes) || cameraPath.keyframes.length === 0) {
      return NextResponse.json({ error: 'cameraPath must contain at least one keyframe' }, { status: 400 });
    }

    if (itemId !== undefined && typeof itemId !== 'string') {
      return NextResponse.json({ error: 'itemId must be a string when provided' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'editor');

    const result = await EditingService.applyReframe({
      projectId,
      userId: user.id,
      cameraPath,
      itemId,
      expectedVersion,
    });

    return NextResponse.json({
      success: true,
      timeline: result.timeline,
      operation: result.operation,
    });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
