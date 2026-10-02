import { NextRequest, NextResponse } from 'next/server';
import { getSecurityEngine } from '@/lib/saas/securityEngine';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getTenantStore } from '@/lib/saas/tenantStore';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ success: false, error: 'organizationId is required' }, { status: 400 });
    }

    const securityEngine = getSecurityEngine();
    const apiKeys = await securityEngine.listApiKeys(organizationId);

    return NextResponse.json({ success: true, apiKeys });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { action, organizationId, workspaceId, name, permissions, expiresInDays, keyId } = body;

    const securityEngine = getSecurityEngine();
    const tenantStore = getTenantStore();

    if (action === 'create') {
      const { apiKey, rawSecret } = await securityEngine.createApiKey(
        organizationId,
        workspaceId,
        name || 'New API Key',
        permissions || ['project.read', 'asset.read'],
        expiresInDays
      );

      await tenantStore.recordAudit({
        organizationId,
        workspaceId,
        actorId: user.id,
        actorEmail: user.email,
        action: 'apikey.created',
        resourceType: 'apikey',
        resourceId: apiKey.id,
        metadata: { name: apiKey.name, keyPrefix: apiKey.keyPrefix },
      });

      // Raw secret is returned ONLY ONCE!
      return NextResponse.json({ success: true, apiKey, rawSecret });
    }

    if (action === 'revoke') {
      const revoked = await securityEngine.revokeApiKey(keyId, organizationId);
      await tenantStore.recordAudit({
        organizationId,
        workspaceId,
        actorId: user.id,
        actorEmail: user.email,
        action: 'apikey.revoked',
        resourceType: 'apikey',
        resourceId: keyId,
      });

      return NextResponse.json({ success: true, revoked });
    }

    return NextResponse.json({ success: false, error: 'Invalid API key action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
