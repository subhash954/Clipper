import { NextRequest, NextResponse } from 'next/server';
import { getTenantStore } from '@/lib/saas/tenantStore';
import { getApprovalEngine } from '@/lib/saas/approvalEngine';
import { searchContentLibrary, getCalendarItems } from '@/lib/factory/contentStore';
import { getStorage } from '@/lib/storage';
import { requireAuth } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || user.workspaceId || user.id;

    const tenantStore = getTenantStore();
    const ws = await tenantStore.getWorkspace(workspaceId);
    if (!ws) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    const storage = getStorage();
    const projects = await storage.listProjects();
    const workspaceProjects = projects.filter(p => p.workspaceId === workspaceId || p.userId === user.id);

    const assets = await searchContentLibrary({ query: '' });
    const calendarItems = await getCalendarItems();

    const approvalEngine = getApprovalEngine();
    const tasks = await approvalEngine.listTasks(workspaceId);

    const exportPayload = {
      workspace: ws,
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      projects: workspaceProjects,
      contentAssets: assets,
      calendarSchedule: calendarItems,
      tasks,
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="clipper-workspace-export-${ws.slug}.json"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
