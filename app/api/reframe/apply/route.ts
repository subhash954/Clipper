import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse } from '@/lib/errors';
import { EditingService } from '@/lib/editor/editingService';
import { validateCameraPath, isPositiveInteger } from '@/lib/reframe/validation';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { projectId, expectedVersion, cameraPath, itemId } = body;

    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    if (!isPositiveInteger(expectedVersion, 1)) {
      return NextResponse.json(
        { error: 'Missing or invalid expectedVersion: must be a finite integer >= 1' },
        { status: 400 }
      );
    }

    if (itemId !== undefined && (typeof itemId !== 'string' || !itemId.trim())) {
      return NextResponse.json({ error: 'itemId must be a non-empty string when provided' }, { status: 400 });
    }

    // Comprehensive runtime validation of the entire camera path and each keyframe
    const validatedCameraPath = validateCameraPath(cameraPath);

    await requireProjectAccess(user, projectId, 'editor');

    const result = await EditingService.applyReframe({
      projectId,
      userId: user.id,
      cameraPath: validatedCameraPath,
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
