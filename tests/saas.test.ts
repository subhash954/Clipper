import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { getTenantStore } from '../lib/saas/tenantStore';
import { can, hasPermission, authorizeOrThrow } from '../lib/saas/permissionEngine';
import { getApprovalEngine } from '../lib/saas/approvalEngine';
import { getMeteringService } from '../lib/saas/meteringService';
import { getBillingProvider } from '../lib/saas/billingProvider';
import { getSecurityEngine } from '../lib/saas/securityEngine';
import { getWebhookDispatcher } from '../lib/saas/webhookDispatcher';
import { getCostLedger } from '../lib/saas/costLedger';
import { getEntitlementService } from '../lib/saas/entitlementService';
import { SaasError } from '../lib/saas/types';

describe('🏢 CLIPPER MISSION 8: AGENCY & MULTI-TENANT SaaS OPERATING SYSTEM', () => {
  const tenantStore = getTenantStore();
  const approvalEngine = getApprovalEngine();
  const meteringService = getMeteringService();
  const billingProvider = getBillingProvider();
  const securityEngine = getSecurityEngine();
  const webhookDispatcher = getWebhookDispatcher();
  const costLedger = getCostLedger();
  const entitlementService = getEntitlementService();

  let testOrgAId: string;
  let testWorkspaceAId: string;
  let testOrgBId: string;
  let testWorkspaceBId: string;
  const ownerUserId = 'user-owner-1001';
  const clientUserId = 'user-client-2001';
  const editorUserId = 'user-editor-3001';

  before(async () => {
    // Setup Organization A (Agency)
    const orgA = await tenantStore.createOrganization('Apex Media Agency', ownerUserId, 'agency');
    testOrgAId = orgA.id;
    const workspacesA = await tenantStore.listWorkspaces(testOrgAId);
    testWorkspaceAId = workspacesA[0].id;

    // Setup Organization B (Separate Tenant)
    const orgB = await tenantStore.createOrganization('Solopreneur Studio', 'user-solo-9999', 'starter');
    testOrgBId = orgB.id;
    const workspacesB = await tenantStore.listWorkspaces(testOrgBId);
    testWorkspaceBId = workspacesB[0].id;

    // Add members to Workspace A
    await tenantStore.addMember(testOrgAId, testWorkspaceAId, clientUserId, 'client@nike.com', 'Client Contact', 'CLIENT');
    await tenantStore.addMember(testOrgAId, testWorkspaceAId, editorUserId, 'editor@apex.com', 'Senior Editor', 'EDITOR');
  });

  // -------------------------------------------------------------------------
  // 1. TENANT ARCHITECTURE & ISOLATION
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 1: Tenant Architecture & Workspace Isolation ---', () => {
    it('Creates organization with isolated default workspace', async () => {
      const org = await tenantStore.getOrganization(testOrgAId);
      assert.ok(org, 'Org should exist');
      assert.equal(org.name, 'Apex Media Agency');
      assert.equal(org.planId, 'agency');

      const workspaces = await tenantStore.listWorkspaces(testOrgAId);
      assert.ok(workspaces.length >= 1, 'Should have at least 1 workspace');
      assert.equal(workspaces[0].organizationId, testOrgAId);
    });

    it('Enforces strict tenant isolation: Workspace B cannot see Workspace A members', async () => {
      const membersA = await tenantStore.listMembers(testWorkspaceAId);
      const membersB = await tenantStore.listMembers(testWorkspaceBId);

      const aUserIds = membersA.map(m => m.userId);
      const bUserIds = membersB.map(m => m.userId);

      // Verify no cross-tenant membership leakage
      assert.ok(!bUserIds.includes(clientUserId), 'Workspace B must not contain Workspace A client');
      assert.ok(!bUserIds.includes(editorUserId), 'Workspace B must not contain Workspace A editor');
    });

    it('Cascades deletion cleanly without leaving orphaned records', async () => {
      const tempOrg = await tenantStore.createOrganization('Temp Delete Org', 'user-temp-del', 'free');
      const tempWorkspaces = await tenantStore.listWorkspaces(tempOrg.id);
      assert.equal(tempWorkspaces.length, 1);

      const deleted = await tenantStore.deleteOrganization(tempOrg.id);
      assert.equal(deleted, true);

      const checkOrg = await tenantStore.getOrganization(tempOrg.id);
      assert.equal(checkOrg, null, 'Deleted org must be null');

      const survivingWorkspaces = await tenantStore.listWorkspaces(tempOrg.id);
      assert.equal(survivingWorkspaces.length, 0, 'Workspaces must be cascaded');
    });
  });

  // -------------------------------------------------------------------------
  // 2. PERMISSION ENGINE & RBAC
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 2: Centralized RBAC Permission Engine ---', () => {
    it('Grants full administrative capabilities to OWNER', () => {
      assert.equal(hasPermission('OWNER', 'billing.manage'), true);
      assert.equal(hasPermission('OWNER', 'project.delete'), true);
      assert.equal(hasPermission('OWNER', 'publish.execute'), true);
      assert.equal(hasPermission('OWNER', 'asset.approve'), true);
    });

    it('Strictly forbids CLIENT from administrative and publishing actions', () => {
      assert.equal(hasPermission('CLIENT', 'project.read'), true);
      assert.equal(hasPermission('CLIENT', 'asset.approve'), true);
      assert.equal(hasPermission('CLIENT', 'client.portal_access'), true);

      // Strict denials
      assert.equal(hasPermission('CLIENT', 'billing.view'), false);
      assert.equal(hasPermission('CLIENT', 'billing.manage'), false);
      assert.equal(hasPermission('CLIENT', 'apikeys.manage'), false);
      assert.equal(hasPermission('CLIENT', 'publish.execute'), false);
      assert.equal(hasPermission('CLIENT', 'workspace.manage'), false);
      assert.equal(hasPermission('CLIENT', 'asset.render'), false);
    });

    it('Evaluates can() context and catches cross-workspace violation', async () => {
      const authA = {
        userId: editorUserId,
        role: 'EDITOR' as const,
        workspaceId: testWorkspaceAId,
        organizationId: testOrgAId,
      };

      // Allowed within their own workspace
      const canEditA = await can(authA, 'asset.create', { workspaceId: testWorkspaceAId });
      assert.equal(canEditA, true);

      // Cross-workspace violation: Attempting to edit in Workspace B
      const canEditB = await can(authA, 'asset.create', { workspaceId: testWorkspaceBId });
      assert.equal(canEditB, false, 'Cross-workspace access must evaluate to false');
    });

    it('Throws SaasError FORBIDDEN when authorizeOrThrow fails', async () => {
      const clientAuth = {
        userId: clientUserId,
        role: 'CLIENT' as const,
        workspaceId: testWorkspaceAId,
        organizationId: testOrgAId,
      };

      await assert.rejects(
        async () => {
          await authorizeOrThrow(clientAuth, 'billing.manage', { workspaceId: testWorkspaceAId });
        },
        (err: any) => err instanceof SaasError && err.code === 'FORBIDDEN'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. CLIENT MANAGEMENT & ISOLATION
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 3: Agency Client Management & Portal Isolation ---', () => {
    let clientA: any;
    let clientB: any;

    it('Creates and lists agency clients scoped to workspace', async () => {
      clientA = await tenantStore.createClient(testOrgAId, testWorkspaceAId, {
        name: 'John Donahoe',
        company: 'Nike Global',
        contactEmail: 'marketing@nike.com',
        monthlyRetainerUSD: 5000,
        allocatedCredits: 1000,
      });

      clientB = await tenantStore.createClient(testOrgBId, testWorkspaceBId, {
        name: 'Jane Doe',
        company: 'Indie Apparel',
        contactEmail: 'jane@indie.com',
        monthlyRetainerUSD: 1000,
        allocatedCredits: 200,
      });

      const listA = await tenantStore.listClients(testWorkspaceAId);
      const listB = await tenantStore.listClients(testWorkspaceBId);

      assert.equal(listA.some(c => c.company === 'Nike Global'), true);
      assert.equal(listA.some(c => c.company === 'Indie Apparel'), false, 'Tenant A cannot see Tenant B client');
      assert.equal(listB.some(c => c.company === 'Indie Apparel'), true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. APPROVAL WORKFLOW & COMMENTS
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 4: Approval Workflow, Video Timestamps & Tasks ---', () => {
    const testAssetId = 'asset-test-approve-001';

    it('Transitions asset through valid state progression', async () => {
      // DRAFT -> IN_REVIEW
      const trans1 = await approvalEngine.transitionApproval(
        testAssetId,
        testWorkspaceAId,
        'DRAFT',
        'IN_REVIEW',
        { id: editorUserId, name: 'Editor', role: 'EDITOR' },
        'Ready for review'
      );
      assert.equal(trans1.toStatus, 'IN_REVIEW');

      // IN_REVIEW -> CLIENT_REVIEW
      const trans2 = await approvalEngine.transitionApproval(
        testAssetId,
        testWorkspaceAId,
        'IN_REVIEW',
        'CLIENT_REVIEW',
        { id: ownerUserId, name: 'Agency Owner', role: 'OWNER' }
      );
      assert.equal(trans2.toStatus, 'CLIENT_REVIEW');

      // CLIENT_REVIEW -> APPROVED (Approved by CLIENT)
      const trans3 = await approvalEngine.transitionApproval(
        testAssetId,
        testWorkspaceAId,
        'CLIENT_REVIEW',
        'APPROVED',
        { id: clientUserId, name: 'Nike Marketing', role: 'CLIENT' },
        'Looks fantastic!'
      );
      assert.equal(trans3.toStatus, 'APPROVED');
    });

    it('Rejects invalid approval transitions', async () => {
      await assert.rejects(
        async () => {
          await approvalEngine.transitionApproval(
            testAssetId,
            testWorkspaceAId,
            'DRAFT',
            'PUBLISHED', // Invalid jump!
            { id: editorUserId, name: 'Editor', role: 'EDITOR' }
          );
        },
        (err: any) => err instanceof SaasError && err.code === 'VALIDATION_ERROR'
      );
    });

    it('Adds and resolves timestamped video feedback with @mentions', async () => {
      const comment = await approvalEngine.addComment(
        testAssetId,
        testWorkspaceAId,
        { id: clientUserId, name: 'Client', role: 'CLIENT' },
        '@editor Please move caption higher at this moment',
        17.5 // 00:17
      );

      assert.equal(comment.videoTimestampSeconds, 17.5);
      assert.deepEqual(comment.mentions, ['editor']);
      assert.equal(comment.resolved, false);

      const resolved = await approvalEngine.resolveComment(comment.id, editorUserId);
      assert.equal(resolved.resolved, true);
      assert.equal(resolved.resolvedBy, editorUserId);
    });

    it('Manages workspace tasks with state updates', async () => {
      const task = await approvalEngine.createTask(testWorkspaceAId, ownerUserId, {
        title: 'Review 3 Nike Shorts',
        assigneeId: editorUserId,
        assigneeName: 'Senior Editor',
        priority: 'HIGH',
      });

      assert.equal(task.status, 'TODO');
      assert.equal(task.priority, 'HIGH');

      const updated = await approvalEngine.updateTaskStatus(task.id, 'DONE');
      assert.equal(updated.status, 'DONE');
    });
  });

  // -------------------------------------------------------------------------
  // 5. USAGE METERING & HARD QUOTA ENFORCEMENT
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 5: Usage Metering Ledger & Quota Enforcement ---', () => {
    it('Records granular usage events in immutable ledger', async () => {
      await meteringService.recordUsage({
        organizationId: testOrgAId,
        workspaceId: testWorkspaceAId,
        resource: 'render_seconds',
        quantity: 120, // 2 minutes
        source: 'ffmpeg_render',
      });

      await meteringService.recordUsage({
        organizationId: testOrgAId,
        workspaceId: testWorkspaceAId,
        resource: 'ai_tokens',
        quantity: 25000,
        source: 'gemini_pro',
      });

      const summary = await meteringService.getWorkspaceUsage(testWorkspaceAId);
      assert.ok(summary.totals.renderMinutes >= 2);
      assert.ok(summary.totals.aiTokens >= 25000);
      assert.ok(summary.quotas.maxRenderMinutesPerMonth > 0);
    });

    it('Enforces hard quotas and throws QUOTA_EXCEEDED when limit is reached', async () => {
      // Free tier has 15m render limit
      const freeOrg = await tenantStore.createOrganization('Quota Free Org', 'user-free-test', 'free');
      const freeWs = (await tenantStore.listWorkspaces(freeOrg.id))[0];

      // Simulate consuming 15 minutes (900 seconds)
      await meteringService.recordUsage({
        organizationId: freeOrg.id,
        workspaceId: freeWs.id,
        resource: 'render_seconds',
        quantity: 900,
        source: 'ffmpeg_render',
      });

      // Requesting 60 more seconds should exceed the 15m quota!
      await assert.rejects(
        async () => {
          await meteringService.assertQuotaAvailable(freeWs.id, 'render_seconds', 60);
        },
        (err: any) => err instanceof SaasError && err.code === 'QUOTA_EXCEEDED'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. BILLING & WEBHOOK VERIFICATION
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 6: Billing Webhooks & Cryptographic Verification ---', () => {
    const webhookSecret = 'whsec_test_secret_1234567890';

    it('Verifies HMAC-SHA256 signature and processes subscription update idempotently', async () => {
      const payload = JSON.stringify({
        id: `evt_sub_${Date.now()}`,
        type: 'subscription.updated',
        data: {
          organizationId: testOrgBId,
          planId: 'pro',
          status: 'active',
        },
      });

      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload, 'utf-8')
        .digest('hex');

      const res = await billingProvider.handleWebhook(payload, signature, webhookSecret);
      assert.equal(res.handled, true);
      assert.equal(res.eventType, 'subscription.updated');

      // Verify organization was upgraded to pro
      const updatedOrg = await tenantStore.getOrganization(testOrgBId);
      assert.equal(updatedOrg?.planId, 'pro');

      // Replay same webhook: should be detected as duplicate and not re-applied
      const replayRes = await billingProvider.handleWebhook(payload, signature, webhookSecret);
      assert.equal(replayRes.handled, false);
      assert.ok(replayRes.eventType.includes('duplicate ignored'));
    });

    it('Rejects forged or invalid webhook signatures', async () => {
      const payload = JSON.stringify({ type: 'subscription.updated' });
      const badSig = '0000000000000000000000000000000000000000000000000000000000000000';

      await assert.rejects(
        async () => {
          await billingProvider.handleWebhook(payload, badSig, webhookSecret);
        },
        (err: any) => err instanceof SaasError && err.code === 'FORBIDDEN'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 7. SECURITY ENGINE & API KEYS
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 7: API Key Vault & Rate Limiting ---', () => {
    let createdKey: any;
    let secretKey: string;

    it('Creates API key with SHA-256 hash and verifies raw secret', async () => {
      const { apiKey, rawSecret } = await securityEngine.createApiKey(
        testOrgAId,
        testWorkspaceAId,
        'Zapier Webhook Key',
        ['project.read', 'asset.create']
      );

      createdKey = apiKey;
      secretKey = rawSecret;

      assert.ok(rawSecret.startsWith('clp_live_'));
      assert.ok(apiKey.hashedSecret !== rawSecret); // Must be hashed

      const verified = await securityEngine.verifyApiKey(rawSecret);
      assert.ok(verified, 'Raw secret must verify successfully');
      assert.equal(verified?.id, apiKey.id);
    });

    it('Rejects invalid or revoked API keys', async () => {
      const badCheck = await securityEngine.verifyApiKey('clp_live_invalid_bad_key_12345');
      assert.equal(badCheck, null);

      await securityEngine.revokeApiKey(createdKey.id, testOrgAId);
      const afterRevoke = await securityEngine.verifyApiKey(secretKey);
      assert.equal(afterRevoke, null, 'Revoked key must not authenticate');
    });

    it('Applies sliding-window rate limits accurately', () => {
      const testIdentifier = 'test-ip-192.168.1.1';
      // Render limit is 10/min
      for (let i = 0; i < 10; i++) {
        const check = securityEngine.checkRateLimit(testIdentifier, 'render');
        assert.equal(check.allowed, true);
      }

      // 11th request should be blocked
      const blocked = securityEngine.checkRateLimit(testIdentifier, 'render');
      assert.equal(blocked.allowed, false);
      assert.equal(blocked.remaining, 0);

      assert.throws(
        () => securityEngine.assertRateLimit(testIdentifier, 'render'),
        (err: any) => err instanceof SaasError && err.code === 'RATE_LIMITED'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 8. OUTGOING WEBHOOK DISPATCHER
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 8: Outgoing Webhook Dispatcher ---', () => {
    it('Creates endpoint and dispatches signed webhook payload', async () => {
      const ep = await webhookDispatcher.createEndpoint(
        testWorkspaceAId,
        'dummy://webhook.receiver.internal',
        ['asset.created', 'approval.requested']
      );

      assert.ok(ep.secret.startsWith('whsec_'));

      const results = await webhookDispatcher.dispatchEvent(
        testWorkspaceAId,
        'asset.created',
        { assetId: 'asset-999', title: 'New Video' }
      );

      assert.equal(results.length, 1);
      assert.equal(results[0].endpointId, ep.id);
      assert.equal(results[0].event, 'asset.created');
    });
  });

  // -------------------------------------------------------------------------
  // 9. COST ACCOUNTING & MARGIN PROTECTION
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 9: Cost Accounting & Margin Protection ---', () => {
    it('Records provider costs and calculates gross margin from actual records', async () => {
      await costLedger.recordCost({
        organizationId: testOrgAId,
        workspaceId: testWorkspaceAId,
        serviceCategory: 'ai',
        providerName: 'gemini',
        estimatedCostUSD: 1.5,
        actualCostUSD: 1.45,
        unitsConsumed: 50000,
        unitType: 'tokens',
      });

      await costLedger.recordCost({
        organizationId: testOrgAId,
        workspaceId: testWorkspaceAId,
        serviceCategory: 'rendering',
        providerName: 'local_ffmpeg',
        estimatedCostUSD: 0.8,
        actualCostUSD: 0.75,
        unitsConsumed: 180,
        unitType: 'seconds',
      });

      const margin = await costLedger.getMarginReport(testOrgAId);
      assert.ok(margin.totalRevenueUSD > 0);
      assert.ok(margin.totalCostUSD > 0);
      assert.ok(margin.grossMarginPercent > 0);
      assert.equal(margin.breakdown.aiCostUSD >= 1.45, true);
      assert.equal(margin.breakdown.renderingCostUSD >= 0.75, true);
    });
  });

  // -------------------------------------------------------------------------
  // 10. WHITE-LABEL & PLAN ENTITLEMENTS
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 10: White-Label Branding & Entitlement Guardrails ---', () => {
    it('Permits white-label branding on Agency tier', () => {
      assert.equal(entitlementService.canWhitelabel('agency'), true);
      assert.equal(entitlementService.canCustomDomain('agency'), true);
      assert.equal(entitlementService.canClientPortal('agency'), true);
    });

    it('Blocks white-label removal on Starter tier', () => {
      assert.equal(entitlementService.canWhitelabel('starter'), false);
      assert.throws(
        () => entitlementService.assertFeatureEntitlement('starter', 'whitelabel'),
        (err: any) => err instanceof SaasError && err.code === 'FORBIDDEN'
      );
    });
  });
});
