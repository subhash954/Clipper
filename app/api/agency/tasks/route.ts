import { NextRequest, NextResponse } from 'next/server';
import { getApprovalEngine } from '@/lib/saas/approvalEngine';
import { requireAuth } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || user.workspaceId || user.id;

    const engine = getApprovalEngine();
    const tasks = await engine.listTasks(workspaceId);

    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const workspaceId = body.workspaceId || user.workspaceId || user.id;

    const engine = getApprovalEngine();

    if (body.action === 'update_status') {
      const task = await engine.updateTaskStatus(body.taskId, body.status);
      return NextResponse.json({ success: true, task });
    }

    const task = await engine.createTask(workspaceId, user.id, {
      title: body.title,
      description: body.description,
      assigneeId: body.assigneeId,
      assigneeName: body.assigneeName,
      priority: body.priority,
      dueAt: body.dueAt,
      assetId: body.assetId,
      projectId: body.projectId,
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
