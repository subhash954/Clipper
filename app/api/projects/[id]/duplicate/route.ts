import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { getAuthenticatedUser, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse, ClipperError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        new ClipperError('AUTH_REQUIRED', 'Authentication required. Please log in.', 401).toResponse(),
        { status: 401 }
      );
    }

    const { id } = await params;
    await requireProjectAccess(user, id, 'viewer');

    const storage = getStorage();
    const duplicated = await storage.duplicateProject(id, user.id);

    return NextResponse.json({ success: true, project: duplicated });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
