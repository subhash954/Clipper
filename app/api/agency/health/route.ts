import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { ProductAnalytics } from '@/lib/saas/productAnalytics';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const [healthMetrics, featureAdoption] = await Promise.all([
      ProductAnalytics.getProductHealthMetrics(),
      ProductAnalytics.getFeatureAdoptionMetrics(),
    ]);

    return NextResponse.json({
      success: true,
      health: healthMetrics,
      adoption: featureAdoption,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    const event = await ProductAnalytics.trackEvent(
      body.organizationId || 'org_default',
      user.id,
      body.eventType,
      body.workspaceId,
      body.metadata
    );

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
