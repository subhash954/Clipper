import { NextRequest, NextResponse } from 'next/server';
import { getTenantStore } from '@/lib/saas/tenantStore';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getEntitlementService } from '@/lib/saas/entitlementService';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || user.workspaceId || user.id;

    const tenantStore = getTenantStore();
    const branding = await tenantStore.getBranding(workspaceId);
    const domain = await tenantStore.getDomainConfig(workspaceId);

    return NextResponse.json({ success: true, branding, domain });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { action, workspaceId, branding, hostname, domainId } = body;

    const targetWsId = workspaceId || user.workspaceId || user.id;
    const tenantStore = getTenantStore();
    const ws = await tenantStore.getWorkspace(targetWsId);
    if (!ws) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    const org = await tenantStore.getOrganization(ws.organizationId);
    const entitlementService = getEntitlementService();

    if (action === 'save_branding') {
      if (branding.removePlatformAttribution) {
        entitlementService.assertFeatureEntitlement(org?.planId || 'free', 'whitelabel');
      }
      const updated = await tenantStore.saveBranding({
        ...branding,
        workspaceId: targetWsId,
      });
      return NextResponse.json({ success: true, branding: updated });
    }

    if (action === 'configure_domain') {
      entitlementService.assertFeatureEntitlement(org?.planId || 'free', 'custom_domain');
      const domain = await tenantStore.configureDomain(targetWsId, hostname);
      return NextResponse.json({ success: true, domain });
    }

    if (action === 'verify_domain') {
      const domain = await tenantStore.verifyDomain(domainId);
      return NextResponse.json({ success: true, domain });
    }

    return NextResponse.json({ success: false, error: 'Invalid branding action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
