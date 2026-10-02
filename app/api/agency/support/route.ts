import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { SupportService } from '@/lib/saas/supportService';
import { getTenantStore } from '@/lib/saas/tenantStore';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId');
    const status = searchParams.get('status') as any;

    const tickets = await SupportService.listTickets({
      organizationId: organizationId || undefined,
      workspaceId: workspaceId || undefined,
      status: status || undefined,
    });

    return NextResponse.json({ success: true, tickets });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    if (body.action === 'reply') {
      const msg = await SupportService.addMessage(
        body.ticketId,
        user.id,
        user.email,
        body.authorRole || 'USER',
        body.message
      );
      return NextResponse.json({ success: true, message: msg });
    }

    if (body.action === 'update_status') {
      const ticket = await SupportService.updateTicketStatus(
        body.ticketId,
        body.status,
        body.resolutionNotes
      );
      return NextResponse.json({ success: true, ticket });
    }

    const tenantStore = getTenantStore();
    const ws = body.workspaceId ? await tenantStore.getWorkspace(body.workspaceId) : null;
    const orgId = ws ? ws.organizationId : (body.organizationId || 'org_default');

    const ticket = await SupportService.createTicket({
      organizationId: orgId,
      workspaceId: body.workspaceId,
      userId: user.id,
      userEmail: user.email,
      subject: body.subject,
      message: body.message,
      category: body.category || 'bug',
      priority: body.priority || 'medium',
      resourceType: body.resourceType,
      resourceId: body.resourceId,
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
