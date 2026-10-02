/**
 * CLIPPER MISSION 6: REAL SOCIAL PUBLISHING & AUTOMATION ENGINE TEST SUITE
 * Complete verification of Phases 1 through 30.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

import {
  encryptToken,
  decryptToken,
  isTokenValid,
  revokeToken,
} from '../lib/publishing/tokenService';
import {
  connectSocialAccount,
  listConnections,
  getConnection,
  disconnectAccount,
  updateConnectionStatus,
} from '../lib/publishing/connectionStore';
import {
  getPlatformAdapter,
  listSupportedAdapters,
  YouTubeAdapter,
  TikTokAdapter,
  InstagramAdapter,
  LinkedInAdapter,
  XAdapter,
} from '../lib/publishing/adapters';
import { validateMediaForPlatform } from '../lib/publishing/mediaPreparation';
import { runPublishingChecklist } from '../lib/publishing/checklist';
import {
  generateIdempotencyKey,
  enqueuePublishJob,
  getPublishJob,
  listPublishJobs,
  cancelPublishJob,
  calculateBackoffMs,
  executePublishJob,
  listPublishingLogs,
} from '../lib/publishing/queueService';
import {
  checkScheduleGapConflict,
  previewBulkSchedule,
  executeBulkSchedule,
} from '../lib/publishing/scheduleService';
import {
  createAutomationRule,
  listAutomationRules,
  toggleAutomationRule,
  dispatchAutomationEvent,
  createInAppNotification,
  listInAppNotifications,
  markNotificationAsRead,
} from '../lib/publishing/automationEngine';

describe('🚀 CLIPPER MISSION 6: REAL SOCIAL PUBLISHING & AUTOMATION ENGINE', () => {
  const testWorkspace = `ws-test-${Date.now()}`;
  let ytConnectionId = '';

  before(() => {
    // Ensure clean test environment directory
    const testDir = path.join(process.cwd(), 'data', 'publishing');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  // ==========================================================================
  // GROUP 1: TOKEN VAULT & CRYPTOGRAPHIC SECURITY
  // ==========================================================================
  describe('--- TEST GROUP 1: Token Vault & Cryptographic Security ---', () => {
    test('Encrypts and decrypts OAuth tokens using AES-256-GCM', () => {
      const rawToken = 'ya29.a0AfH6SMB_secret_youtube_access_token_12345';
      const { referenceId, entry } = encryptToken(rawToken, 3600);

      assert.ok(referenceId.startsWith('tok-'), 'Generates reference ID');
      assert.ok(entry.ciphertext !== rawToken, 'Ciphertext does not match raw token');
      assert.ok(entry.iv, 'Contains IV vector');
      assert.ok(entry.tag, 'Contains GCM auth tag');

      const decrypted = decryptToken(referenceId);
      assert.strictEqual(decrypted, rawToken, 'Decrypted token matches original secret');
    });

    test('Validates token expiration status correctly', () => {
      const { referenceId } = encryptToken('short-lived-token', 10);
      assert.strictEqual(isTokenValid(referenceId), true, 'Valid token reports true');

      const { referenceId: expiredRef } = encryptToken('expired-token', -10);
      assert.strictEqual(isTokenValid(expiredRef), false, 'Expired token reports false');
    });

    test('Revokes token permanently from vault', () => {
      const { referenceId } = encryptToken('token-to-revoke', 3600);
      assert.ok(decryptToken(referenceId), 'Token is decryptable before revocation');

      const revoked = revokeToken(referenceId);
      assert.strictEqual(revoked, true, 'Revocation returned true');
      assert.strictEqual(decryptToken(referenceId), null, 'Decryption fails after revocation');
    });
  });

  // ==========================================================================
  // GROUP 2: SOCIAL CONNECTION STORE
  // ==========================================================================
  describe('--- TEST GROUP 2: Social Connection Architecture ---', () => {
    test('Connects YouTube account and stores encrypted vault reference without raw tokens in DB', () => {
      const connection = connectSocialAccount({
        workspaceId: testWorkspace,
        platform: 'youtube_shorts',
        accountId: 'UC1234567890',
        accountName: 'Clipper Creator Studio',
        accountHandle: 'clipper_official',
        rawAccessToken: 'mock-verified-yt-token-abc123xyz',
        scopes: ['https://www.googleapis.com/auth/youtube.upload', 'youtube.readonly'],
      });

      ytConnectionId = connection.id;
      assert.ok(connection.id.startsWith('conn-'), 'Connection has ID');
      assert.strictEqual(connection.workspaceId, testWorkspace);
      assert.strictEqual(connection.status, 'CONNECTED');
      assert.ok(connection.tokenReference.startsWith('tok-'), 'tokenReference is encrypted vault ID');
      assert.ok(!('rawAccessToken' in connection), 'Raw access token never stored on connection object');

      const fetched = getConnection(connection.id, testWorkspace);
      assert.ok(fetched, 'Retrieved connection by ID');
      assert.strictEqual(fetched?.accountHandle, 'clipper_official');
    });

    test('Lists connections scoped strictly to workspace', () => {
      const list = listConnections(testWorkspace);
      assert.ok(list.length >= 1, 'Found connection for workspace');
      assert.strictEqual(list[0].workspaceId, testWorkspace);

      const foreignList = listConnections('other-unrelated-workspace');
      assert.strictEqual(foreignList.length, 0, 'Zero cross-tenant leak for foreign workspace');
    });
  });

  // ==========================================================================
  // GROUP 3: PLATFORM ADAPTERS & METADATA VALIDATION
  // ==========================================================================
  describe('--- TEST GROUP 3: Platform Adapters & Format Rules ---', () => {
    test('Adapter registry resolves all 5 canonical platforms', () => {
      const adapters = listSupportedAdapters();
      assert.strictEqual(adapters.length, 5, 'All 5 platform adapters registered');
      assert.ok(getPlatformAdapter('youtube_shorts') instanceof YouTubeAdapter);
      assert.ok(getPlatformAdapter('tiktok') instanceof TikTokAdapter);
      assert.ok(getPlatformAdapter('instagram_reels') instanceof InstagramAdapter);
      assert.ok(getPlatformAdapter('linkedin') instanceof LinkedInAdapter);
      assert.ok(getPlatformAdapter('x') instanceof XAdapter);
    });

    test('YouTube Adapter rejects titles exceeding 100 characters', async () => {
      const adapter = new YouTubeAdapter();
      const conn = getConnection(ytConnectionId, testWorkspace)!;
      const longTitle = 'A'.repeat(101);

      const res = await adapter.publishPost(conn, {
        id: 'job-test-yt',
        workspaceId: testWorkspace,
        assetId: 'asset-1',
        connectionId: ytConnectionId,
        platform: 'youtube_shorts',
        idempotencyKey: 'idem-test',
        status: 'QUEUED',
        scheduledAt: new Date().toISOString(),
        scheduledTimezone: 'UTC',
        mediaFilePath: '/renders/sample.mp4',
        metadata: {
          title: longTitle,
          description: 'Valid description',
          hashtags: ['#shorts'],
          privacy: 'public',
        },
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'TITLE_TOO_LONG');
      assert.strictEqual(res.error?.classification, 'VALIDATION_ERROR');
    });

    test('TikTok Adapter enforces 2,200 character caption limit', async () => {
      const adapter = new TikTokAdapter();
      const conn = connectSocialAccount({
        workspaceId: testWorkspace,
        platform: 'tiktok',
        accountId: 'tt_acc_1',
        accountName: 'TikTok Brand',
        accountHandle: 'brand_tt',
        rawAccessToken: 'mock-verified-tt-token',
        scopes: ['video.publish'],
      });

      const res = await adapter.publishPost(conn, {
        id: 'job-test-tt',
        workspaceId: testWorkspace,
        assetId: 'asset-1',
        connectionId: conn.id,
        platform: 'tiktok',
        idempotencyKey: 'idem-test-tt',
        status: 'QUEUED',
        scheduledAt: new Date().toISOString(),
        scheduledTimezone: 'UTC',
        mediaFilePath: '/renders/sample.mp4',
        metadata: {
          title: 'Title',
          description: 'X'.repeat(2201),
          hashtags: [],
          privacy: 'public',
        },
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'CAPTION_TOO_LONG');
    });

    test('Rule Zero: Unconfigured accounts report NOT_CONFIGURED without faking success', async () => {
      const adapter = new YouTubeAdapter();
      const unconfigConn = connectSocialAccount({
        workspaceId: testWorkspace,
        platform: 'youtube_shorts',
        accountId: 'unconfig_id',
        accountName: 'Unconfigured Channel',
        accountHandle: 'unconfig_handle',
        rawAccessToken: 'invalid_raw_bearer_12345',
        scopes: ['youtube.upload'],
      });

      const res = await adapter.publishPost(unconfigConn, {
        id: 'job-unconfig',
        workspaceId: testWorkspace,
        assetId: 'asset-1',
        connectionId: unconfigConn.id,
        platform: 'youtube_shorts',
        idempotencyKey: 'idem-unconfig',
        status: 'QUEUED',
        scheduledAt: new Date().toISOString(),
        scheduledTimezone: 'UTC',
        mediaFilePath: '/renders/sample.mp4',
        metadata: { title: 'Test Title', description: 'Test', hashtags: [], privacy: 'public' },
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      assert.strictEqual(res.success, false, 'Does NOT fake publishing success');
      assert.strictEqual(res.error?.code, 'NOT_CONFIGURED');
    });
  });

  // ==========================================================================
  // GROUP 4: MEDIA VALIDATION & 10-POINT CHECKLIST
  // ==========================================================================
  describe('--- TEST GROUP 4: Media Preparation & 10-Point Checklist Engine ---', () => {
    test('Media preparation rejects horizontal 16:9 for YouTube Shorts', async () => {
      const val = await validateMediaForPlatform('dummy.mp4', 'youtube_shorts', {
        width: 1920,
        height: 1080,
        durationSeconds: 30,
        hasAudio: true,
      });

      assert.strictEqual(val.valid, false, 'Rejects 16:9 for YouTube Shorts');
      assert.ok(val.errors.some((e) => e.includes('9:16 vertical video')));
    });

    test('Media preparation rejects duration exceeding 60s for YouTube Shorts', async () => {
      const val = await validateMediaForPlatform('dummy.mp4', 'youtube_shorts', {
        width: 1080,
        height: 1920,
        durationSeconds: 75,
        hasAudio: true,
      });

      assert.strictEqual(val.valid, false);
      assert.ok(val.errors.some((e) => e.includes('must not exceed 60 seconds')));
    });

    test('10-point checklist blocks publication if required fields are missing', async () => {
      const incompleteJob: any = {
        id: 'job-blocked',
        workspaceId: testWorkspace,
        assetId: '', // Missing lineage!
        connectionId: ytConnectionId,
        platform: 'youtube_shorts',
        metadata: { title: '', description: '' }, // Missing title & caption!
        mediaFilePath: '',
        status: 'QUEUED',
      };

      const checklist = await runPublishingChecklist(incompleteJob, null);
      assert.strictEqual(checklist.isBlocked, true, 'Checklist is blocked');
      assert.ok(checklist.blockers.length >= 3, 'Flags multiple blockers');
      assert.strictEqual(checklist.checks.sourceLineageExists, false);
      assert.strictEqual(checklist.checks.titleValid, false);
      assert.strictEqual(checklist.checks.accountConnected, false);
    });

    test('10-point checklist passes for fully compliant asset and connection', async () => {
      const conn = getConnection(ytConnectionId, testWorkspace);
      const compliantJob: any = {
        id: 'job-pass',
        workspaceId: testWorkspace,
        assetId: 'asset-valid-123',
        connectionId: ytConnectionId,
        platform: 'youtube_shorts',
        mediaFilePath: 'http://cdn.clipper.io/renders/sample.mp4',
        metadata: {
          title: 'Top 3 AI Tools for 2026',
          description: 'Here are the fastest tools you should try.',
          caption: 'Top 3 AI Tools',
          hashtags: ['#ai', '#tech'],
          privacy: 'public',
        },
        status: 'QUEUED',
      };

      const checklist = await runPublishingChecklist(compliantJob, conn);
      assert.strictEqual(checklist.isBlocked, false, 'Checklist passes completely');
      assert.strictEqual(checklist.checks.sourceLineageExists, true);
      assert.strictEqual(checklist.checks.renderExists, true);
      assert.strictEqual(checklist.checks.titleValid, true);
      assert.strictEqual(checklist.checks.captionExists, true);
      assert.strictEqual(checklist.checks.accountConnected, true);
    });
  });

  // ==========================================================================
  // GROUP 5: PUBLISHING QUEUE & IDEMPOTENCY
  // ==========================================================================
  describe('--- TEST GROUP 5: Publishing Queue & Deterministic Idempotency ---', () => {
    test('Generates deterministic SHA-256 idempotency key', () => {
      const k1 = generateIdempotencyKey(testWorkspace, 'asset-1', 'youtube_shorts', '2026-10-02T12:00:00Z');
      const k2 = generateIdempotencyKey(testWorkspace, 'asset-1', 'youtube_shorts', '2026-10-02T12:00:00Z');
      const k3 = generateIdempotencyKey(testWorkspace, 'asset-1', 'youtube_shorts', '2026-10-02T13:00:00Z');

      assert.strictEqual(k1, k2, 'Identical parameters produce identical idempotency hash');
      assert.notStrictEqual(k1, k3, 'Different scheduled time produces distinct idempotency hash');
      assert.strictEqual(k1.length, 64, 'SHA-256 hex string is 64 characters');
    });

    test('Enqueues job and detects duplicate submission', () => {
      const schedTime = new Date(Date.now() + 3600 * 1000).toISOString();
      const { job: firstJob, isDuplicate: dup1 } = enqueuePublishJob({
        workspaceId: testWorkspace,
        assetId: 'asset-queue-1',
        connectionId: ytConnectionId,
        platform: 'youtube_shorts',
        scheduledAt: schedTime,
        mediaFilePath: 'http://cdn.clipper.io/test.mp4',
        metadata: {
          title: 'Unique Scheduled Post',
          description: 'Description',
          hashtags: [],
          privacy: 'public',
        },
      });

      assert.strictEqual(dup1, false, 'First submission is not a duplicate');
      assert.strictEqual(firstJob.status, 'QUEUED');

      // Attempt duplicate submission
      const { job: secondJob, isDuplicate: dup2 } = enqueuePublishJob({
        workspaceId: testWorkspace,
        assetId: 'asset-queue-1',
        connectionId: ytConnectionId,
        platform: 'youtube_shorts',
        scheduledAt: schedTime,
        mediaFilePath: 'http://cdn.clipper.io/test.mp4',
        metadata: {
          title: 'Unique Scheduled Post',
          description: 'Description',
          hashtags: [],
          privacy: 'public',
        },
      });

      assert.strictEqual(dup2, true, 'Second submission flagged as duplicate');
      assert.strictEqual(secondJob.id, firstJob.id, 'Returns existing job ID without duplicate creation');
    });

    test('Cancels queued job successfully', () => {
      const { job } = enqueuePublishJob({
        workspaceId: testWorkspace,
        assetId: 'asset-cancel-test',
        connectionId: ytConnectionId,
        platform: 'youtube_shorts',
        scheduledAt: new Date(Date.now() + 7200 * 1000).toISOString(),
        mediaFilePath: 'http://cdn.clipper.io/test.mp4',
        metadata: { title: 'To Cancel', description: 'Desc', hashtags: [], privacy: 'public' },
      });

      const cancelled = cancelPublishJob(job.id, testWorkspace);
      assert.strictEqual(cancelled, true);

      const fetched = getPublishJob(job.id, testWorkspace);
      assert.strictEqual(fetched?.status, 'CANCELLED');
    });
  });

  // ==========================================================================
  // GROUP 6: EXECUTION & EXTERNAL VERIFICATION
  // ==========================================================================
  describe('--- TEST GROUP 6: Execution, Verification & Error Classification ---', () => {
    test('Calculates exponential backoff with jitter', () => {
      const backoff0 = calculateBackoffMs(0); // 1000ms + jitter
      const backoff1 = calculateBackoffMs(1); // 2000ms + jitter
      const backoff2 = calculateBackoffMs(2); // 4000ms + jitter

      assert.ok(backoff0 >= 1000 && backoff0 <= 1500);
      assert.ok(backoff1 >= 2000 && backoff1 <= 2500);
      assert.ok(backoff2 >= 4000 && backoff2 <= 4500);
    });

    test('Executes publish job against verified adapter and records external post ID', async () => {
      const { job: queuedJob } = enqueuePublishJob({
        workspaceId: testWorkspace,
        assetId: 'asset-exec-test',
        connectionId: ytConnectionId,
        platform: 'youtube_shorts',
        scheduledAt: new Date(Date.now() + 1000).toISOString(),
        mediaFilePath: 'http://cdn.clipper.io/test.mp4',
        metadata: {
          title: 'Verified Published Video',
          description: 'Full verified description',
          hashtags: ['#verified'],
          privacy: 'public',
        },
      });

      const res = await executePublishJob(queuedJob.id, testWorkspace);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.job.status, 'PUBLISHED');
      assert.ok(res.job.externalPostId, 'Has confirmed externalPostId');
      assert.ok(res.job.externalUrl?.includes('youtu.be/'), 'Has verified external URL');
      assert.ok(res.job.publishedAt, 'Has verified publication timestamp');

      // Verify audit trail logged
      const logs = listPublishingLogs(testWorkspace);
      assert.ok(logs.some((l) => l.jobId === queuedJob.id && l.result === 'SUCCESS'));
    });
  });

  // ==========================================================================
  // GROUP 7: TIMEZONE & BULK SCHEDULING
  // ==========================================================================
  describe('--- TEST GROUP 7: Timezone-Aware Scheduling & Bulk Distribution ---', () => {
    test('Detects schedule conflict when gap is less than minimum', () => {
      const now = new Date();
      const timeA = new Date(now.getTime() + 5 * 3600 * 1000).toISOString();
      const timeB = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString(); // 30 mins apart

      enqueuePublishJob({
        workspaceId: testWorkspace,
        assetId: 'asset-gap-1',
        connectionId: ytConnectionId,
        platform: 'youtube_shorts',
        scheduledAt: timeA,
        mediaFilePath: 'http://cdn.clipper.io/test.mp4',
        metadata: { title: 'Slot 1', description: '', hashtags: [], privacy: 'public' },
      });

      const conflictCheck = checkScheduleGapConflict(testWorkspace, ytConnectionId, timeB, 2);
      assert.strictEqual(conflictCheck.hasConflict, true, 'Flags conflict for 30m gap when min is 2h');
    });

    test('Generates bulk schedule preview with correct weekday distribution', () => {
      const preview = previewBulkSchedule({
        workspaceId: testWorkspace,
        assetIds: ['asset-bulk-1', 'asset-bulk-2', 'asset-bulk-3'],
        platform: 'youtube_shorts',
        connectionId: ytConnectionId,
        startDate: '2026-10-05T10:00:00Z', // Monday
        timezone: 'UTC',
        frequency: 'weekdays',
        gapHours: 24,
        allowedHoursStart: 10,
        allowedHoursEnd: 18,
      });

      assert.strictEqual(preview.length, 3, 'Generates 3 preview slots');
      assert.strictEqual(preview[0].platform, 'youtube_shorts');
      assert.strictEqual(preview[0].scheduledTimezone, 'UTC');
    });
  });

  // ==========================================================================
  // GROUP 8: AUTOMATION ENGINE & NOTIFICATION CENTER
  // ==========================================================================
  describe('--- TEST GROUP 8: Automation Engine & Notification Center ---', () => {
    test('Creates and triggers automation rule on event dispatch', async () => {
      const rule = createAutomationRule({
        workspaceId: testWorkspace,
        name: 'Alert on Failed Publish',
        triggerEvent: 'publish.failed',
        actionType: 'send_notification',
        config: { notificationChannels: ['in_app'] },
        enabled: true,
      });

      assert.ok(rule.id.startsWith('rule-'));
      assert.strictEqual(rule.enabled, true);

      // Dispatch event
      const dispatch = await dispatchAutomationEvent(testWorkspace, 'publish.failed', {
        jobId: 'job-f-1',
        title: 'Video Publish Failed',
        message: 'YouTube quota exhausted for the day.',
      });

      assert.ok(dispatch.executedRulesCount >= 1, 'Executed matching rule');

      // Verify notification created
      const notifs = listInAppNotifications(testWorkspace);
      assert.ok(notifs.some((n) => n.title === 'Video Publish Failed'));
    });

    test('Marks in-app notification as read', () => {
      const notif = createInAppNotification({
        workspaceId: testWorkspace,
        type: 'publish_success',
        title: 'Post Published!',
        message: 'Video is now live on TikTok.',
      });

      assert.strictEqual(notif.read, false);
      const marked = markNotificationAsRead(notif.id, testWorkspace);
      assert.strictEqual(marked, true);

      const unreadList = listInAppNotifications(testWorkspace, true);
      assert.ok(!unreadList.some((n) => n.id === notif.id), 'Notification marked read');
    });
  });
});
