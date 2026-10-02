import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { getEnterpriseJobQueue } from '../lib/enterprise/jobQueue';
import { getAIProviderRegistry, MockOrchestratedProvider } from '../lib/enterprise/aiRegistry';
import { getAutonomousContentAgent } from '../lib/enterprise/contentAgent';
import { getEnterprisePolicyEngine } from '../lib/enterprise/policyEngine';
import { getEnterpriseEventBus } from '../lib/enterprise/eventBus';
import { getEnterpriseMediaLifecycle } from '../lib/enterprise/mediaLifecycle';
import { SaasError } from '../lib/saas/types';

describe('🏛️ CLIPPER MISSION 9: ENTERPRISE SCALE & AUTONOMOUS CONTENT OS', () => {
  const dir = path.join(process.cwd(), 'data', 'enterprise');
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }

  const jobQueue = getEnterpriseJobQueue();
  const aiRegistry = getAIProviderRegistry();
  const contentAgent = getAutonomousContentAgent();
  const policyEngine = getEnterprisePolicyEngine();
  const eventBus = getEnterpriseEventBus();
  const mediaLifecycle = getEnterpriseMediaLifecycle();

  const testOrgAId = 'org-ent-alpha-001';
  const testWorkspaceAId = 'ws-ent-alpha-001';
  const testOrgBId = 'org-ent-beta-002';
  const testWorkspaceBId = 'ws-ent-beta-002';

  // -------------------------------------------------------------------------
  // 1. DISTRIBUTED JOB QUEUE & WORKER LEASES
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 1: Distributed Job Queue, Leases & Dead Letter Queue ---', () => {
    it('Schedules jobs with strict priority ordering (CRITICAL over NORMAL)', async () => {
      // Enqueue normal priority job
      await jobQueue.enqueueJob('media.render', testOrgAId, testWorkspaceAId, { clipId: 'c1' }, 'NORMAL');
      // Enqueue critical priority job after
      const criticalJob = await jobQueue.enqueueJob('media.render', testOrgAId, testWorkspaceAId, { clipId: 'c2' }, 'CRITICAL');

      // Worker leases next job: CRITICAL must be leased first despite being queued second
      const leased = await jobQueue.leaseNextJob('worker-node-1', ['media.render']);
      assert.ok(leased, 'Should lease a job');
      assert.equal(leased.id, criticalJob.id, 'Critical priority job must be leased before normal');
      assert.equal(leased.status, 'LEASED');
      assert.equal(leased.workerId, 'worker-node-1');
    });

    it('Records worker heartbeats and extends lease expiration', async () => {
      const leased = await jobQueue.leaseNextJob('worker-node-2', ['media.render']);
      assert.ok(leased);

      const heartbeatSuccess = await jobQueue.recordHeartbeat(
        'worker-node-2',
        leased.id,
        50,
        'Encoding 9:16 Video',
        60_000
      );
      assert.equal(heartbeatSuccess, true);

      const updated = await jobQueue.getJob(leased.id);
      assert.equal(updated?.status, 'PROCESSING');
      assert.ok(updated?.heartbeatAt);
    });

    it('Transitions repeatedly failing job to Dead Letter Queue after max retries', async () => {
      const failJob = await jobQueue.enqueueJob(
        'transcode.probe',
        testOrgAId,
        testWorkspaceAId,
        { file: 'corrupt.mp4' },
        'NORMAL',
        2 // Max 2 retries
      );

      // Attempt 1
      await jobQueue.leaseNextJob('worker-node-fail', ['transcode.probe']);
      await jobQueue.failJob(failJob.id, 'worker-node-fail', 'Corrupt container header');

      // Attempt 2
      await jobQueue.leaseNextJob('worker-node-fail', ['transcode.probe']);
      const deadJob = await jobQueue.failJob(failJob.id, 'worker-node-fail', 'Persistent unrecoverable corruption');

      assert.ok(deadJob);
      assert.equal(deadJob.status, 'DEAD_LETTER');
      assert.equal(deadJob.attempts, 2);

      const dlqList = await jobQueue.listDeadLetters(testOrgAId);
      assert.ok(dlqList.some(j => j.id === failJob.id), 'Job must appear in dead letter queue');

      // Admin manual retry
      const retried = await jobQueue.retryDeadLetterJob(failJob.id);
      assert.equal(retried?.status, 'QUEUED');
      assert.equal(retried?.attempts, 0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. AI PROVIDER ORCHESTRATION & CIRCUIT BREAKER
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 2: AI Provider Registry, Fallbacks & Circuit Breakers ---', () => {
    const primary = new MockOrchestratedProvider('gemini-enterprise');
    const fallback = new MockOrchestratedProvider('deepseek-backup');

    before(() => {
      aiRegistry.registerProvider(primary);
      aiRegistry.registerProvider(fallback);
    });

    it('Executes generation and returns cached response deterministically on second call', async () => {
      const prompt = 'Extract 3 high-retention hooks from transcript';
      const res1 = await aiRegistry.executeWithFallback(primary.id, fallback.id, prompt);
      assert.equal(res1.providerUsed, primary.id);
      assert.equal(res1.cached, false);

      // Second call: must hit deterministic cache
      const res2 = await aiRegistry.executeWithFallback(primary.id, fallback.id, prompt);
      assert.equal(res2.cached, true);
      assert.equal(res2.costUSD, res1.costUSD);
    });

    it('Gracefully fails over to fallback provider when primary experiences outage', async () => {
      primary.setFailing(true);

      const prompt = `Novel prompt test failover ${Date.now()}`;
      const res = await aiRegistry.executeWithFallback(primary.id, fallback.id, prompt, { skipCache: true });

      assert.equal(res.providerUsed, fallback.id, 'Should seamlessly fail over to fallback provider');
      assert.equal(res.fallbackUsed, true);

      primary.setFailing(false); // Reset
    });

    it('Opens circuit breaker when failure threshold is exceeded', async () => {
      const failingPrimary = new MockOrchestratedProvider('unstable-ai');
      failingPrimary.setFailing(true);
      aiRegistry.registerProvider(failingPrimary);

      // Trigger 3 consecutive failures to trip circuit
      for (let i = 0; i < 3; i++) {
        try {
          await aiRegistry.executeWithFallback(failingPrimary.id, fallback.id, `prompt-${i}`, { skipCache: true });
        } catch {
          // Expected
        }
      }

      const status = aiRegistry.getCircuitStatus(failingPrimary.id);
      assert.equal(status.circuitState, 'OPEN', 'Circuit should be OPEN after 3 failures');
    });
  });

  // -------------------------------------------------------------------------
  // 3. AUTONOMOUS CONTENT AGENT & HUMAN APPROVAL BOUNDARY
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 3: Autonomous Content Agent & Safety Boundaries ---', () => {
    let planId: string;

    it('Generates autonomous plan and executes safe steps until human approval boundary', async () => {
      const plan = await contentAgent.createAutonomousPlan(testOrgAId, testWorkspaceAId, 'proj-ent-source-1');
      planId = plan.planId;
      assert.equal(plan.status, 'PLANNING');
      assert.equal(plan.requiresHumanApproval, true);

      // Execute plan
      const executed = await contentAgent.executePlan(planId);

      // Must HALT at REQUIRES_APPROVAL
      assert.equal(executed.status, 'REQUIRES_APPROVAL', 'Agent must strictly stop at approval boundary');
      const approvalStep = executed.steps.find(s => s.action === 'REQUEST_HUMAN_APPROVAL');
      assert.equal(approvalStep?.status, 'REQUIRES_APPROVAL');

      // Subsequent external action (PUBLISH_TO_PLATFORM) must still be PENDING
      const publishStep = executed.steps.find(s => s.action === 'PUBLISH_TO_PLATFORM');
      assert.equal(publishStep?.status, 'PENDING');
    });

    it('Resumes autonomous workflow only after human approval is granted', async () => {
      const approved = await contentAgent.grantHumanApproval(planId, 'human-admin-42');
      assert.equal(approved.status, 'COMPLETED');
      assert.equal(approved.approvalGrantedBy, 'human-admin-42');

      const publishStep = approved.steps.find(s => s.action === 'PUBLISH_TO_PLATFORM');
      assert.equal(publishStep?.status, 'COMPLETED');
    });

    it('Maintains workspace content memory with approved and banned terms', async () => {
      await contentAgent.saveMemory({
        workspaceId: testWorkspaceAId,
        brandVoice: 'Hyper-technical, quantitative, zero fluff',
        contentPillars: ['Database Internals', 'Distributed Systems'],
        approvedTerminology: ['linearizability', 'raft', 'concurrency'],
        bannedTerminology: ['guaranteed rich', 'crypto moon', 'easy trick'],
        successfulPatterns: ['Show architecture diagram in first 3 seconds'],
      });

      const memory = await contentAgent.getMemory(testWorkspaceAId);
      assert.equal(memory.brandVoice, 'Hyper-technical, quantitative, zero fluff');
      assert.ok(memory.approvedTerminology.includes('linearizability'));
      assert.ok(memory.bannedTerminology.includes('guaranteed rich'));
    });
  });

  // -------------------------------------------------------------------------
  // 4. WORKFLOW DAG EXECUTION ENGINE
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 4: Visual Workflow DAG Engine & Recursion Protection ---', () => {
    it('Executes DAG workflow and pauses on Human Approval node', async () => {
      const wf = await contentAgent.createWorkflow(
        testOrgAId,
        testWorkspaceAId,
        'Autonomous Shorts Pipeline',
        [
          { id: 'node-1', type: 'TRIGGER', title: 'Video Uploaded', config: {}, nextNodes: ['node-2'] },
          { id: 'node-2', type: 'AI_ANALYSIS', title: 'Multimodal Analysis', config: {}, nextNodes: ['node-3'] },
          { id: 'node-3', type: 'HUMAN_APPROVAL', title: 'Producer Sign-off', config: {}, nextNodes: ['node-4'] },
          { id: 'node-4', type: 'PUBLISH_POST', title: 'Publish to YouTube', config: {}, nextNodes: [] },
        ],
        'node-1'
      );

      const run = await contentAgent.runWorkflow(wf.id);
      assert.equal(run.status, 'WAITING_FOR_APPROVAL');
      assert.equal(run.currentNodeId, 'node-3');
      assert.equal(run.nodeHistory.length, 3);
    });
  });

  // -------------------------------------------------------------------------
  // 5. ENTERPRISE POLICY ENGINE & GOVERNANCE
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 5: Enterprise Governance Policy & Cost Anomalies ---', () => {
    it('Blocks unapproved publishing and restricted platforms by policy', async () => {
      await policyEngine.setPolicy({
        organizationId: testOrgAId,
        requireApprovalBeforePublish: true,
        disableExternalPublishing: false,
        allowedSocialPlatforms: ['youtube_shorts', 'linkedin'],
        maxMonthlyAiBudgetUSD: 1000,
        maxMonthlyRenderMinutes: 5000,
        enforceMfa: true,
        enforceSSO: true,
        dataRetentionDays: 90,
        updatedAt: new Date().toISOString(),
      });

      // 1. Unapproved publish should throw FORBIDDEN
      await assert.rejects(
        async () => {
          await policyEngine.assertPublishAllowed(testOrgAId, 'youtube_shorts', false);
        },
        (err: any) => err instanceof SaasError && err.code === 'FORBIDDEN'
      );

      // 2. Disallowed platform (tiktok not in allowed list) should throw FORBIDDEN
      await assert.rejects(
        async () => {
          await policyEngine.assertPublishAllowed(testOrgAId, 'tiktok', true);
        },
        (err: any) => err instanceof SaasError && err.code === 'FORBIDDEN'
      );

      // 3. Compliant approved publish should pass
      await policyEngine.assertPublishAllowed(testOrgAId, 'youtube_shorts', true);
    });

    it('Detects spending anomalies when cost exceeds baseline by 2.5x threshold', async () => {
      const alert = await policyEngine.checkCostAnomaly(
        testOrgAId,
        'ai_generation',
        100, // Baseline: $100
        320, // Observed: $320 (3.2x spike)
        2.5
      );

      assert.ok(alert, 'Should detect cost anomaly');
      assert.equal(alert.spikeFactor, 3.2);
      assert.equal(alert.status, 'ACTIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 6. TRANSACTIONAL OUTBOX & EVENT BUS
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 6: Transactional Event Outbox & Idempotency ---', () => {
    it('Dispatches outbox events idempotently to subscribers', async () => {
      let receivedEvents: string[] = [];

      eventBus.subscribe('asset.approved', async (e) => {
        receivedEvents.push(e.eventId);
      });

      const event = await eventBus.publishEvent(
        'asset.approved',
        testOrgAId,
        testWorkspaceAId,
        { assetId: 'asset-100', title: 'Top 5 Coding Tips' },
        'idemp-key-unique-001'
      );

      assert.ok(event.eventId);

      // Process outbox
      const { processedCount } = await eventBus.processOutbox();
      assert.ok(processedCount >= 1);
      assert.ok(receivedEvents.includes(event.eventId));

      // Re-processing outbox: duplicate delivery must be skipped idempotently
      const repeat = await eventBus.processOutbox();
      assert.equal(repeat.processedCount, 0, 'No duplicate event processing');
    });
  });

  // -------------------------------------------------------------------------
  // 7. MEDIA LIFECYCLE & CONTENT HASH DEDUPLICATION
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 7: Media Container Security & Content Deduplication ---', () => {
    // Generate valid MP4 header buffer (offset 4: 'ftyp')
    const validMp4Buffer = Buffer.alloc(1024);
    validMp4Buffer.write('ftyp', 4, 'ascii');

    it('Validates MP4 container magic bytes and rejects invalid binaries', () => {
      const validCheck = mediaLifecycle.validateMediaBytes(validMp4Buffer);
      assert.equal(validCheck.valid, true);
      assert.equal(validCheck.format, 'mp4');

      const badBuffer = Buffer.from('NOT_A_VIDEO_FILE');
      const badCheck = mediaLifecycle.validateMediaBytes(badBuffer);
      assert.equal(badCheck.valid, false);
    });

    it('Deduplicates identical media uploads via SHA-256 hash', async () => {
      // Upload 1
      const upload1 = await mediaLifecycle.registerMediaUpload(
        testOrgAId,
        testWorkspaceAId,
        'proj-1',
        'intro.mp4',
        validMp4Buffer,
        'video/mp4'
      );
      assert.equal(upload1.isDeduplicated, false);
      assert.ok(upload1.asset.storageNamespace.includes('proj-1'));

      // Upload 2 (Identical byte buffer)
      const upload2 = await mediaLifecycle.registerMediaUpload(
        testOrgAId,
        testWorkspaceAId,
        'proj-2',
        'duplicate-intro.mp4',
        validMp4Buffer,
        'video/mp4'
      );
      assert.equal(upload2.isDeduplicated, true, 'Identical media content must be deduplicated');
      assert.equal(upload2.asset.contentHash, upload1.asset.contentHash);
      assert.equal(upload2.asset.storageNamespace, upload1.asset.storageNamespace, 'Reuses original storage key');
    });
  });

  // -------------------------------------------------------------------------
  // 8. ADVERSARIAL TENANT ISOLATION
  // -------------------------------------------------------------------------
  describe('--- TEST GROUP 8: Adversarial Tenant Isolation Verification ---', () => {
    it('Prevents Tenant B from discovering or accessing Tenant A media assets', async () => {
      const mediaListA = await mediaLifecycle.listMedia(testWorkspaceAId);
      const mediaListB = await mediaLifecycle.listMedia(testWorkspaceBId);

      const aIds = mediaListA.map(m => m.id);
      const bIds = mediaListB.map(m => m.id);

      for (const aId of aIds) {
        assert.ok(!bIds.includes(aId), 'Tenant B cannot see Tenant A media assets');
      }
    });

    it('Prevents Tenant B from receiving Tenant A dead letter queue items', async () => {
      const deadJob = await jobQueue.enqueueJob('dlq.test', testOrgAId, testWorkspaceAId, {}, 'NORMAL', 1);
      await jobQueue.leaseNextJob('worker-dlq', ['dlq.test']);
      await jobQueue.failJob(deadJob.id, 'worker-dlq', 'Forced failure to trigger DLQ');

      const dlqA = await jobQueue.listDeadLetters(testOrgAId);
      const dlqB = await jobQueue.listDeadLetters(testOrgBId);

      assert.ok(dlqA.length >= 1, 'Tenant A has dead letter items');
      assert.equal(dlqB.length, 0, 'Tenant B must have empty DLQ');
    });
  });
});
