import { NextRequest, NextResponse } from 'next/server';
import { getTenantStore } from '@/lib/saas/tenantStore';
import { requireAuth } from '@/lib/auth/serverAuth';
import { can, resolveAuthContext } from '@/lib/saas/permissionEngine';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || user.workspaceId || user.id;

    const tenantStore = getTenantStore();
    const clients = await tenantStore.listClients(workspaceId);

    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const workspaceId = body.workspaceId || user.workspaceId || user.id;

    const tenantStore = getTenantStore();
    const ws = await tenantStore.getWorkspace(workspaceId);
    if (!ws) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    const client = await tenantStore.createClient(ws.organizationId, workspaceId, body);

    await tenantStore.recordAudit({
      organizationId: ws.organizationId,
      workspaceId,
      actorId: user.id,
      actorEmail: user.email,
      action: 'client.created',
      resourceType: 'client',
      resourceId: client.id,
      metadata: { name: client.name, company: client.company },
    });

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
