import { NextRequest, NextResponse } from 'next/server';
import { getMeteringService } from '@/lib/saas/meteringService';
import { requireAuth } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || user.workspaceId || user.id;

    const meteringService = getMeteringService();
    const usage = await meteringService.getWorkspaceUsage(workspaceId);

    return NextResponse.json({ success: true, usage });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
