import { NextRequest, NextResponse } from 'next/server';
import { getTenantStore } from '@/lib/saas/tenantStore';
import { requireAuth } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!organizationId) {
      return NextResponse.json({ success: false, error: 'organizationId is required' }, { status: 400 });
    }

    const tenantStore = getTenantStore();
    const logs = await tenantStore.listAuditLogs(organizationId, limit);

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
