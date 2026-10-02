import { NextRequest, NextResponse } from 'next/server';
import { getBillingProvider } from '@/lib/saas/billingProvider';
import { getTenantStore } from '@/lib/saas/tenantStore';
import { requireAuth } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ success: false, error: 'organizationId required' }, { status: 400 });
    }

    const provider = getBillingProvider();
    const subscription = await provider.getSubscription(organizationId);

    return NextResponse.json({ success: true, subscription });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check if this is an external billing webhook
    const signature = req.headers.get('stripe-signature') || req.headers.get('x-billing-signature');
    if (signature) {
      const rawBody = await req.text();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_clipper_test_secret';
      const provider = getBillingProvider();
      const result = await provider.handleWebhook(rawBody, signature, webhookSecret);
      return NextResponse.json({ success: true, ...result });
    }

    // Authenticated user checkout or cancellation
    const user = await requireAuth(req);
    const body = await req.json();
    const { action, organizationId, planId, successUrl, cancelUrl } = body;

    const provider = getBillingProvider();

    if (action === 'checkout') {
      const checkout = await provider.createCheckout(
        organizationId,
        planId || 'pro',
        successUrl || 'https://app.clipper.ai/agency?checkout=success',
        cancelUrl || 'https://app.clipper.ai/agency?checkout=cancelled'
      );
      return NextResponse.json({ success: true, ...checkout });
    }

    if (action === 'cancel') {
      const subscription = await provider.cancelSubscription(organizationId);
      return NextResponse.json({ success: true, subscription });
    }

    return NextResponse.json({ success: false, error: 'Invalid billing action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
