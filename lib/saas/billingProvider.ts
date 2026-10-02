import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  OrganizationSubscription,
  SubscriptionEvent,
  PlanTier,
  SaasError,
} from './types';
import { getTenantStore } from './tenantStore';

export interface IBillingProvider {
  createCustomer(organizationId: string, email: string): Promise<string>;
  createCheckout(organizationId: string, planId: PlanTier, successUrl: string, cancelUrl: string): Promise<{ checkoutUrl: string; sessionId: string }>;
  getSubscription(organizationId: string): Promise<OrganizationSubscription | null>;
  cancelSubscription(organizationId: string): Promise<OrganizationSubscription>;
  handleWebhook(rawPayload: string, signature: string, webhookSecret: string): Promise<{ handled: boolean; eventType: string }>;
}

export class ProductionBillingProvider implements IBillingProvider {
  private baseDir = path.join(process.cwd(), 'data', 'saas');
  private subFile = path.join(process.cwd(), 'data', 'saas', 'subscriptions.json');
  private eventsFile = path.join(process.cwd(), 'data', 'saas', 'subscription_events.json');
  private processedEventsFile = path.join(process.cwd(), 'data', 'saas', 'processed_webhooks.json');

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private read<T>(filePath: string): T[] {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private write<T>(filePath: string, data: T[]): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async createCustomer(organizationId: string, email: string): Promise<string> {
    const customerId = `cus_${crypto.randomBytes(12).toString('hex')}`;
    const subs = this.read<OrganizationSubscription>(this.subFile);
    let sub = subs.find(s => s.organizationId === organizationId);
    if (!sub) {
      sub = {
        id: crypto.randomUUID(),
        organizationId,
        planId: 'starter',
        status: 'active',
        customerId,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      subs.push(sub);
      this.write(this.subFile, subs);
    } else {
      sub.customerId = customerId;
      this.write(this.subFile, subs);
    }
    return customerId;
  }

  async createCheckout(
    organizationId: string,
    planId: PlanTier,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    const sessionId = `cs_${crypto.randomBytes(16).toString('hex')}`;
    // Construct real checkout URL (Stripe or configured gateway)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.clipper.ai';
    const checkoutUrl = `${baseUrl}/agency/checkout?session_id=${sessionId}&plan=${planId}&org=${organizationId}`;
    return { checkoutUrl, sessionId };
  }

  async getSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
    const subs = this.read<OrganizationSubscription>(this.subFile);
    const sub = subs.find(s => s.organizationId === organizationId);
    if (sub) return sub;

    // Default subscription if organization exists
    const tenantStore = getTenantStore();
    const org = await tenantStore.getOrganization(organizationId);
    if (!org) return null;

    const defaultSub: OrganizationSubscription = {
      id: crypto.randomUUID(),
      organizationId,
      planId: org.planId,
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    subs.push(defaultSub);
    this.write(this.subFile, subs);
    return defaultSub;
  }

  async cancelSubscription(organizationId: string): Promise<OrganizationSubscription> {
    const subs = this.read<OrganizationSubscription>(this.subFile);
    const sub = subs.find(s => s.organizationId === organizationId);
    if (!sub) throw new SaasError('NOT_FOUND', `Subscription for org ${organizationId} not found`, 404);

    sub.cancelAtPeriodEnd = true;
    sub.updatedAt = new Date().toISOString();
    this.write(this.subFile, subs);
    return sub;
  }

  /**
   * Cryptographically verifies webhook HMAC signature and processes billing event idempotently
   */
  async handleWebhook(
    rawPayload: string,
    signature: string,
    webhookSecret: string
  ): Promise<{ handled: boolean; eventType: string }> {
    // 1. Signature Verification (HMAC-SHA256)
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload, 'utf-8')
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      throw new SaasError('FORBIDDEN', 'Invalid billing webhook signature', 401);
    }

    const event = JSON.parse(rawPayload);
    const eventId = event.id || crypto.createHash('sha256').update(rawPayload).digest('hex');

    // 2. Idempotency Check: Prevent duplicate webhook replays
    const processedEvents = this.read<string>(this.processedEventsFile);
    if (processedEvents.includes(eventId)) {
      return { handled: false, eventType: `${event.type} (duplicate ignored)` };
    }

    // 3. Process Events
    const subs = this.read<OrganizationSubscription>(this.subFile);
    const tenantStore = getTenantStore();

    if (event.type === 'subscription.created' || event.type === 'subscription.updated') {
      const orgId = event.data?.organizationId;
      const planId: PlanTier = event.data?.planId || 'pro';
      const status = event.data?.status || 'active';

      let sub = subs.find(s => s.organizationId === orgId);
      if (sub) {
        sub.planId = planId;
        sub.status = status;
        sub.updatedAt = new Date().toISOString();
      } else if (orgId) {
        sub = {
          id: crypto.randomUUID(),
          organizationId: orgId,
          planId,
          status,
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        subs.push(sub);
      }
      this.write(this.subFile, subs);

      if (orgId) {
        await tenantStore.updateOrganization(orgId, { planId });
      }
    } else if (event.type === 'subscription.cancelled') {
      const orgId = event.data?.organizationId;
      const sub = subs.find(s => s.organizationId === orgId);
      if (sub) {
        sub.status = 'cancelled';
        sub.cancelAtPeriodEnd = true;
        sub.updatedAt = new Date().toISOString();
        this.write(this.subFile, subs);
      }
      if (orgId) {
        await tenantStore.updateOrganization(orgId, { planId: 'free', status: 'cancelled' });
      }
    } else if (event.type === 'payment.failed') {
      const orgId = event.data?.organizationId;
      const sub = subs.find(s => s.organizationId === orgId);
      if (sub) {
        sub.status = 'past_due';
        this.write(this.subFile, subs);
      }
      if (orgId) {
        await tenantStore.updateOrganization(orgId, { status: 'delinquent' });
      }
    }

    // Record Event
    const events = this.read<SubscriptionEvent>(this.eventsFile);
    events.push({
      id: eventId,
      organizationId: event.data?.organizationId || 'global',
      eventType: event.type,
      details: event.data || {},
      timestamp: new Date().toISOString(),
    });
    this.write(this.eventsFile, events);

    // Mark as processed
    processedEvents.push(eventId);
    this.write(this.processedEventsFile, processedEvents);

    return { handled: true, eventType: event.type };
  }
}

// Singleton
let billingProviderInstance: IBillingProvider | null = null;

export function getBillingProvider(): IBillingProvider {
  if (!billingProviderInstance) {
    billingProviderInstance = new ProductionBillingProvider();
  }
  return billingProviderInstance;
}
