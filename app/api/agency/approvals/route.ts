import { NextRequest, NextResponse } from 'next/server';
import { getApprovalEngine } from '@/lib/saas/approvalEngine';
import { requireAuth } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json({ success: false, error: 'assetId is required' }, { status: 400 });
    }

    const engine = getApprovalEngine();
    const history = await engine.getApprovalHistory(assetId);
    const comments = await engine.listComments(assetId);

    return NextResponse.json({ success: true, history, comments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { action, assetId, workspaceId, currentStatus, targetStatus, notes, text, videoTimestampSeconds, commentId } = body;

    const engine = getApprovalEngine();

    if (action === 'transition') {
      const transition = await engine.transitionApproval(
        assetId,
        workspaceId || user.workspaceId || user.id,
        currentStatus,
        targetStatus,
        { id: user.id, name: user.email.split('@')[0], role: (user.role?.toUpperCase() as any) || 'EDITOR' },
        notes
      );
      return NextResponse.json({ success: true, transition });
    }

    if (action === 'comment') {
      const comment = await engine.addComment(
        assetId,
        workspaceId || user.workspaceId || user.id,
        { id: user.id, name: user.email.split('@')[0], role: (user.role?.toUpperCase() as any) || 'EDITOR' },
        text,
        videoTimestampSeconds
      );
      return NextResponse.json({ success: true, comment });
    }

    if (action === 'resolve_comment') {
      const comment = await engine.resolveComment(commentId, user.id);
      return NextResponse.json({ success: true, comment });
    }

    return NextResponse.json({ success: false, error: 'Invalid approval action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
