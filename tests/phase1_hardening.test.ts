/**
 * CLIPPER PHASE 1: CORE TRUTH & SECURITY HARDENING TEST SUITE
 * 20 Comprehensive Acceptance Tests Verifying Truth, Determinism, and Security.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ClipperError, formatErrorResponse } from '../lib/errors';
import { renderClipWithFfmpeg, getFfmpegPath } from '../lib/renderEngine';
import {
  getStorage,
  resetStorageInstance,
  LocalStorageAdapter,
  DEV_DEFAULT_USER_ID,
} from '../lib/storage';
import {
  createRenderJob,
  getRenderJob,
  updateRenderJob,
  cancelRenderJob,
  clearActiveJobsMemoryCache,
} from '../lib/renderJobs';
import {
  validateSafeRemoteUrl,
  isPrivateOrReservedIpv4,
  safeFetchRemoteMedia,
} from '../lib/security/ssrfValidator';
import { validateEnvironment } from '../lib/config/envValidator';
import { Project, RenderJob } from '../lib/types';
import { requireProjectAccess, AuthenticatedUser } from '../lib/auth/serverAuth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runHardeningTests() {
  console.log('====================================================');
  console.log('🔒 CLIPPER PHASE 1 HARDENING & TRUTH ACCEPTANCE TESTS');
  console.log('====================================================');

  // ----------------------------------------------------
  // TEST GROUP 1: Structured Error Handling (Step 23)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 1: Structured Errors & Secret Redaction ---');
  const customError = new ClipperError('FORBIDDEN', 'Access denied to workspace', 403, false, { workspaceId: 'ws-123' });
  const customRes = formatErrorResponse(customError);
  assert(customRes.status === 403, 'ClipperError returns accurate HTTP status code (403)');
  assert(customRes.body.code === 'FORBIDDEN', 'ClipperError returns structured error code');
  assert(customRes.body.retryable === false, 'ClipperError retains retryable status');
  assert(customRes.body.details?.workspaceId === 'ws-123', 'ClipperError retains structured details');

  const leakedSecretMsg = 'Connection failed postgresql://user:super_secret_pw@db.supabase.com:5432/postgres?key=my_api_key_12345';
  const sanitizedRes = formatErrorResponse(new Error(leakedSecretMsg));
  assert(!sanitizedRes.body.message.includes('super_secret_pw'), 'formatErrorResponse redacts database credentials');
  assert(!sanitizedRes.body.message.includes('my_api_key_12345'), 'formatErrorResponse redacts API key tokens');

  // ----------------------------------------------------
  // TEST GROUP 2: Media Unavailable & Zero Synthetic Fallback (Step 2)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 2: Media Resolution & Zero Synthetic Fallback ---');
  let mediaUnavailableThrew = false;
  try {
    await renderClipWithFfmpeg('nonexistent-job', {
      inputMedia: '/tmp/completely_non_existent_file_998877.mp4',
      startTime: 0,
      duration: 3,
      words: [],
    });
  } catch (err: any) {
    mediaUnavailableThrew = true;
    assert(err instanceof ClipperError, 'Missing source media throws ClipperError instance');
    assert(err.code === 'MEDIA_UNAVAILABLE', 'Missing source media returns MEDIA_UNAVAILABLE code');
    assert(err.statusCode === 404, 'Missing source media returns 404 status code');
    assert(err.retryable === false, 'Missing source media is marked non-retryable');
  }
  assert(mediaUnavailableThrew, 'Pipeline failed closed without generating synthetic placeholder footage');

  // ----------------------------------------------------
  // TEST GROUP 3: Storage Modes & Production Fail-Closed (Step 3)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 3: Storage Modes & Fail-Closed Enforcement ---');
  const originalEnv = process.env.NODE_ENV;
  const originalMode = process.env.STORAGE_MODE;
  const originalAllow = process.env.ALLOW_DEV_LOCAL_STORAGE;

  try {
    // 3A: STORAGE_MODE=supabase without credentials
    process.env.STORAGE_MODE = 'supabase';
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    resetStorageInstance();

    let supabaseUnavailableThrew = false;
    try {
      getStorage();
    } catch (err: any) {
      supabaseUnavailableThrew = true;
      assert(err instanceof ClipperError && err.code === 'STORAGE_UNAVAILABLE', 'STORAGE_MODE=supabase without credentials throws STORAGE_UNAVAILABLE');
    }
    assert(supabaseUnavailableThrew, 'Fail-closed on unconfigured Supabase in supabase mode');

    // 3B: Production mode forbidding local storage
    process.env.STORAGE_MODE = 'local';
    (process.env as any).NODE_ENV = 'production';
    delete process.env.ALLOW_DEV_LOCAL_STORAGE;
    resetStorageInstance();

    let prodLocalThrew = false;
    try {
      getStorage();
    } catch (err: any) {
      prodLocalThrew = true;
      assert(err instanceof ClipperError && err.code === 'STORAGE_UNAVAILABLE', 'Production mode rejects STORAGE_MODE=local and throws STORAGE_UNAVAILABLE');
    }
    assert(prodLocalThrew, 'Production mode strictly fails closed when local storage is attempted');
  } finally {
    (process.env as any).NODE_ENV = originalEnv;
    process.env.STORAGE_MODE = originalMode;
    if (originalAllow) process.env.ALLOW_DEV_LOCAL_STORAGE = originalAllow;
    else delete process.env.ALLOW_DEV_LOCAL_STORAGE;
    resetStorageInstance();
  }

  // ----------------------------------------------------
  // TEST GROUP 4: Project & Render Job Ownership Enforcement (Step 4 & 5)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 4: Strict Ownership & Validation ---');
  const storage = getStorage();

  // Test in production simulation: saveProject requires userId
  const prevEnv = process.env.NODE_ENV;
  try {
    (process.env as any).NODE_ENV = 'production';
    process.env.ALLOW_DEV_LOCAL_STORAGE = 'true'; // Allow adapter for test, verify validation
    resetStorageInstance();
    const testAdapter = new LocalStorageAdapter();

    let unownedProjectThrew = false;
    try {
      await testAdapter.saveProject({
        id: crypto.randomUUID(),
        title: 'Unowned Project',
        userId: undefined,
        workflowType: 'youtube_to_shorts',
        sourceType: 'youtube',
        durationSeconds: 60,
        status: 'completed',
        clips: [],
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      unownedProjectThrew = true;
      assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'saveProject in production without userId throws VALIDATION_ERROR');
    }
    assert(unownedProjectThrew, 'Unowned project creation strictly blocked in production');

    let unownedJobThrew = false;
    try {
      await testAdapter.createRenderJob({
        id: `render-job-${Date.now()}`,
        inputUrl: '/test/video.mp4',
        userId: undefined,
        status: 'queued',
        progress: 0,
        currentStage: 'Queued',
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      unownedJobThrew = true;
      assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'createRenderJob in production without userId throws VALIDATION_ERROR');
    }
    assert(unownedJobThrew, 'Unowned render job creation strictly blocked in production');
  } finally {
    (process.env as any).NODE_ENV = prevEnv;
    resetStorageInstance();
  }

  // ----------------------------------------------------
  // TEST GROUP 5: Tenant Isolation & requireProjectAccess (Step 5)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 5: Tenant Isolation & Access Enforcement ---');
  const aliceId = '11111111-1111-1111-1111-111111111111';
  const bobId = '22222222-2222-2222-2222-222222222222';
  const aliceProject: Project = {
    id: crypto.randomUUID(),
    userId: aliceId,
    title: "Alice's Secret Project",
    workflowType: 'youtube_to_shorts',
    sourceType: 'youtube',
    durationSeconds: 120,
    status: 'completed',
    clips: [],
    createdAt: new Date().toISOString(),
  };
  await storage.saveProject(aliceProject);

  const aliceUser: AuthenticatedUser = { id: aliceId, email: 'alice@clipper.ai', role: 'owner' };
  const bobUser: AuthenticatedUser = { id: bobId, email: 'bob@clipper.ai', role: 'owner' };

  let aliceAccessAllowed = false;
  try {
    await requireProjectAccess(aliceUser, aliceProject.id, 'viewer');
    aliceAccessAllowed = true;
  } catch {}
  assert(aliceAccessAllowed, "Alice can access her own project");

  let bobAccessBlocked = false;
  try {
    await requireProjectAccess(bobUser, aliceProject.id, 'viewer');
  } catch (err: any) {
    bobAccessBlocked = true;
    assert(err.statusCode === 403, "Bob receives 403 Forbidden attempting to access Alice's project");
  }
  assert(bobAccessBlocked, "Cross-tenant access breach strictly blocked");

  // ----------------------------------------------------
  // TEST GROUP 6: Authoritative Render Job State Machine (Step 8, 9, 10)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 6: Render Job State Machine & Persistence ---');
  const testJob = await createRenderJob({
    projectId: aliceProject.id,
    userId: aliceId,
    inputUrl: '/test/sample.mp4',
  });
  assert(testJob.status === 'queued', 'Newly created render job has status "queued"');
  assert(testJob.userId === aliceId, 'Render job has valid non-null userId');

  // Verify memory cache clearing preserves authoritative storage
  clearActiveJobsMemoryCache();
  const fetchedJob = await getRenderJob(testJob.id);
  assert(fetchedJob !== null, 'Job successfully retrieved from storage after memory cache wiped');
  assert(fetchedJob?.id === testJob.id, 'Fetched job ID matches persisted job ID');

  // Progress update: queued -> processing
  const processingJob = await updateRenderJob(testJob.id, {
    status: 'processing',
    progress: 40,
    currentStage: 'Rendering frames...',
  });
  assert(processingJob?.status === 'processing', 'Valid transition: queued -> processing');
  assert(processingJob?.progress === 40, 'Progress updated to 40%');

  // Completion: processing -> completed
  const completedJob = await updateRenderJob(testJob.id, {
    status: 'completed',
    progress: 100,
    outputUrl: '/exports/sample_out.mp4',
    completedAt: new Date().toISOString(),
  });
  assert(completedJob?.status === 'completed', 'Valid transition: processing -> completed');

  // Illegal transition: completed -> processing (MUST THROW VALIDATION_ERROR)
  let illegalTransitionThrew = false;
  try {
    await updateRenderJob(testJob.id, {
      status: 'processing',
    });
  } catch (err: any) {
    illegalTransitionThrew = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Transition from terminal state "completed" throws VALIDATION_ERROR');
  }
  assert(illegalTransitionThrew, 'State machine forbids transitioning from terminal state');

  // Cannot cancel completed job
  let cancelCompletedThrew = false;
  try {
    await cancelRenderJob(testJob.id);
  } catch (err: any) {
    cancelCompletedThrew = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Cancelling a completed job throws VALIDATION_ERROR');
  }
  assert(cancelCompletedThrew, 'Cannot cancel already completed render job');

  // ----------------------------------------------------
  // TEST GROUP 7: Advanced SSRF & Safe Fetch Protections (Step 16)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 7: SSRF & Remote Media Ingestion ---');
  assert(isPrivateOrReservedIpv4('127.0.0.1'), 'Identifies 127.0.0.1 as loopback');
  assert(isPrivateOrReservedIpv4('10.0.5.20'), 'Identifies 10.0.0.0/8 as private RFC 1918');
  assert(isPrivateOrReservedIpv4('169.254.169.254'), 'Identifies 169.254.0.0/16 as cloud metadata IP');
  assert(!isPrivateOrReservedIpv4('1.1.1.1'), 'Identifies 1.1.1.1 as public IP');

  const localhostCheck = await validateSafeRemoteUrl('http://localhost:3000/api/secret');
  assert(!localhostCheck.isValid, 'Blocks http://localhost');

  const metadataCheck = await validateSafeRemoteUrl('http://169.254.169.254/latest/meta-data');
  assert(!metadataCheck.isValid, 'Blocks AWS metadata endpoint');

  // ----------------------------------------------------
  // TEST GROUP 8: Environment Configuration Diagnostics (Step 15)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 8: Runtime Environment Diagnostics ---');
  const envReport = validateEnvironment();
  assert(typeof envReport.environment === 'string', 'Environment report specifies current environment');
  assert(typeof envReport.diagnostics.NODE_ENV === 'string', 'Diagnostics include NODE_ENV');
  assert(!envReport.diagnostics.SUPABASE_SERVICE_ROLE_KEY.includes('secret'), 'Diagnostics redact service role key');

  // ----------------------------------------------------
  // TEST GROUP 9: Real FFmpeg End-to-End Execution (Step 26)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 9: Real FFmpeg Pipeline Execution ---');
  const tempDir = path.join(process.cwd(), 'data', 'test_hardening_scratch');
  fs.mkdirSync(tempDir, { recursive: true });
  const realVideoFile = path.join(tempDir, 'real_test_source.mp4');

  const ffmpeg = getFfmpegPath();
  execSync(
    `"${ffmpeg}" -y -f lavfi -i testsrc=size=1280x720:rate=30 -t 3 -c:v libx264 -pix_fmt yuv420p "${realVideoFile}"`,
    { stdio: 'ignore' }
  );
  assert(fs.existsSync(realVideoFile), 'Generated real 720p MP4 input media');

  const renderJobId = `phase1-e2e-${Date.now()}`;
  const renderResult = await renderClipWithFfmpeg(renderJobId, {
    inputMedia: realVideoFile,
    startTime: 0,
    duration: 2,
    words: [
      { word: 'TRUTH', start: 0.2, end: 0.8 },
      { word: 'MATTERS', start: 0.9, end: 1.6 },
    ],
    aspectRatio: '9:16',
    trackingMode: 'center',
    isProUser: true,
  });

  assert(fs.existsSync(renderResult.filePath), 'Real FFmpeg export file exists on disk');
  assert(renderResult.fileSizeBytes > 1000, `Export MP4 has valid non-zero size (${renderResult.fileSizeBytes} bytes)`);
  assert(renderResult.outputUrl.endsWith('.mp4'), 'Valid MP4 output URL generated');

  // Cleanup scratch
  try {
    fs.unlinkSync(realVideoFile);
    fs.unlinkSync(renderResult.filePath);
    fs.rmdirSync(tempDir);
  } catch {}

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`PHASE 1 ACCEPTANCE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
