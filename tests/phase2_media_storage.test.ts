/**
 * CLIPPER PHASE 2 ACCEPTANCE & VERIFICATION TEST SUITE
 * Real Media Upload, Probing, StorageService, Bunny Storage & CDN Token Signing
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { StorageService, getStorageService, resetStorageServiceInstance } from '../lib/storage/storageService';
import { LocalStorageProvider } from '../lib/storage/providers/localStorageProvider';
import { BunnyStorageProvider } from '../lib/storage/providers/bunnyStorageProvider';
import { validateMediaFileSignature, probeMedia } from '../lib/media/probeService';
import { MediaProcessingService } from '../lib/media/processingService';
import { renderClipWithFfmpeg, getFfmpegPath } from '../lib/renderEngine';
import { validateEnvironment } from '../lib/config/envValidator';
import { ClipperError } from '../lib/errors';
import { getMediaStorage, CloudMediaStorageAdapter } from '../lib/storage';

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

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('📦 CLIPPER PHASE 2: REAL UPLOAD & MEDIA STORAGE TESTS');
  console.log('====================================================');

  const testScratchDir = path.join(process.cwd(), 'data', 'test_phase2_scratch');
  fs.mkdirSync(testScratchDir, { recursive: true });

  const ffmpeg = getFfmpegPath();
  const testVideoPath = path.join(testScratchDir, 'real_camera_sample.mp4');

  // Generate an authentic 1280x720 3-second H.264 video with real audio track for testing
  execSync(
    `"${ffmpeg}" -y -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:duration=3 -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k "${testVideoPath}"`,
    { stdio: 'ignore' }
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Canonical Storage Key Taxonomy & Path Traversal Hardening
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 1: Storage Key Taxonomy & Traversal Hardening ---');
  const storageService = getStorageService();

  const validKey = storageService.generateCanonicalStorageKey({
    userId: 'user-123',
    projectId: 'proj-456',
    mediaId: 'media-789',
    artifactType: 'source',
    fileName: 'my_awesome_video.mp4',
  });
  assert(
    validKey === 'users/user-123/projects/proj-456/media/media-789/source/my_awesome_video.mp4',
    'Generates deterministic canonical storage key'
  );

  let traversalBlocked = false;
  try {
    storageService.generateCanonicalStorageKey({
      userId: '../../etc',
      projectId: 'proj-456',
      mediaId: 'media-789',
      artifactType: 'source',
      fileName: 'video.mp4',
    });
  } catch (err: any) {
    traversalBlocked = err.code === 'VALIDATION_ERROR';
  }
  assert(traversalBlocked, 'Blocks path traversal in userId');

  let fileTraversalBlocked = false;
  try {
    storageService.generateCanonicalStorageKey({
      userId: 'user-123',
      projectId: 'proj-456',
      mediaId: 'media-789',
      artifactType: 'source',
      fileName: '../malicious.mp4',
    });
  } catch (err: any) {
    fileTraversalBlocked = err.code === 'VALIDATION_ERROR';
  }
  assert(fileTraversalBlocked, 'Blocks path traversal in fileName');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Magic Bytes File Signature Verification
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Magic Bytes File Signature Verification ---');
  const validSig = validateMediaFileSignature(testVideoPath);
  assert(validSig.isValid, 'Recognizes authentic MP4 container via magic bytes');
  assert(validSig.detectedType?.includes('video/mp4') ?? false, 'Detects container format as MP4');

  // Create a fake video file (text disguised as .mp4)
  const fakeVideoPath = path.join(testScratchDir, 'fake_script.mp4');
  fs.writeFileSync(fakeVideoPath, 'console.log("I am an evil script");');
  const fakeSig = validateMediaFileSignature(fakeVideoPath);
  assert(!fakeSig.isValid, 'Rejects text file disguised with .mp4 extension');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Deep FFprobe Inspection
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Deep FFprobe Container Inspection ---');
  const probe = await probeMedia(testVideoPath);
  assert(probe.isValid, 'FFprobe succeeds on valid MP4');
  assert(probe.hasVideo, 'FFprobe confirms presence of video stream');
  assert(probe.hasAudio, 'FFprobe confirms presence of audio stream');
  assert(probe.width === 1280, 'FFprobe extracts exact width (1280)');
  assert(probe.height === 720, 'FFprobe extracts exact height (720)');
  assert(probe.codec === 'h264', 'FFprobe extracts exact video codec (h264)');
  assert(probe.duration >= 2.9 && probe.duration <= 3.2, `FFprobe extracts accurate duration (${probe.duration.toFixed(2)}s)`);

  const fakeProbe = await probeMedia(fakeVideoPath);
  assert(!fakeProbe.isValid, 'FFprobe fails on non-video file');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Media Processing Service (Proxy & Thumbnail)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Proxy & Thumbnail Generation ---');
  const processingService = new MediaProcessingService();
  const processResult = await processingService.processMediaAsset({
    userId: 'user-001',
    projectId: 'proj-001',
    mediaId: 'media-001',
    localSourcePath: testVideoPath,
  });

  assert(!!processResult.proxyKey, 'Generates 720p editing proxy storage key');
  assert(!!processResult.thumbnailKey, 'Generates thumbnail storage key');
  assert(await storageService.exists(processResult.proxyKey!), 'Editing proxy uploaded to storage');
  assert(await storageService.exists(processResult.thumbnailKey!), 'Thumbnail image uploaded to storage');

  const thumbMetadata = await storageService.getObjectMetadata(processResult.thumbnailKey!);
  assert(thumbMetadata !== null && thumbMetadata.sizeBytes > 500, 'Thumbnail is non-empty image file');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: StorageService CRUD & Lifecycle Operations
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: StorageService CRUD & Lifecycle Operations ---');
  const sampleData = Buffer.from('CLIPPER CLOUD MEDIA TEST PAYLOAD');
  const testKey = 'users/u1/projects/p1/media/m1/source/test.txt';

  const uploadRes = await storageService.upload(testKey, sampleData, { contentType: 'text/plain' });
  assert(uploadRes.sizeBytes === sampleData.length, 'Upload returns accurate byte size');
  assert(await storageService.exists(testKey), 'Object exists after upload');

  const fetchedBuf = await storageService.getObject(testKey);
  assert(fetchedBuf.toString() === sampleData.toString(), 'getObject returns exact uploaded binary content');

  // Move / Copy
  const copyKey = 'users/u1/projects/p1/media/m1/source/test_copy.txt';
  await storageService.copyObject(testKey, copyKey);
  assert(await storageService.exists(copyKey), 'copyObject successfully duplicates object');

  await storageService.deleteObject(testKey);
  assert(!(await storageService.exists(testKey)), 'deleteObject removes source object');
  assert(await storageService.exists(copyKey), 'Copy still exists after source deleted');

  // Prefix deletion
  const deletedCount = await storageService.deletePrefix('users/u1/projects/p1/');
  assert(deletedCount > 0, 'deletePrefix removes tree of objects');
  assert(!(await storageService.exists(copyKey)), 'Objects under prefix are purged');

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Chunked Multipart Upload Session Simulation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Chunked Multipart Upload Session ---');
  const session = await storageService.createUploadSession({
    userId: 'user-chunk',
    projectId: 'proj-chunk',
    fileName: 'large_upload.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 1024 * 1024 * 10, // 10MB
  });

  assert(session.status === 'pending', 'Upload session starts in pending state');
  assert(session.storageKey.includes('large_upload') || session.storageKey.includes('original.mp4'), 'Session has canonical storage key');

  const chunk1 = Buffer.alloc(1024 * 100, 1);
  const chunk2 = Buffer.alloc(1024 * 100, 2);

  const part1 = await storageService.uploadMultipartPart(session.sessionId, 1, chunk1);
  const part2 = await storageService.uploadMultipartPart(session.sessionId, 2, chunk2);

  assert(part1.partNumber === 1 && !!part1.etag, 'Part 1 uploaded with MD5 ETag');
  assert(part2.partNumber === 2 && !!part2.etag, 'Part 2 uploaded with MD5 ETag');

  const completeUpload = await storageService.completeMultipartUpload(session.sessionId, [part1, part2]);
  assert(completeUpload.sizeBytes === chunk1.length + chunk2.length, 'Complete multipart combines chunks to exact size');
  assert(await storageService.exists(session.storageKey), 'Multipart uploaded object exists in storage');

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Bunny Storage & Bunny CDN Token Authentication
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Bunny Storage & CDN Token Signing ---');
  const bunnyProvider = new BunnyStorageProvider({
    storageZone: 'clipper-test-zone',
    apiKey: 'mock-bunny-storage-api-key',
    hostname: 'storage.bunnycdn.com',
    cdnHostname: 'clipper-cdn.b-cdn.net',
    cdnTokenKey: 'super-secret-bunny-cdn-token-key',
  });

  assert(bunnyProvider.providerType === 'bunny', 'Bunny provider reports correct providerType');

  const signedUrl = await bunnyProvider.getSignedDownloadUrl('users/u1/projects/p1/media/m1/proxy/proxy-720p.mp4', {
    expiresInSeconds: 3600,
    downloadFilename: 'preview.mp4',
  });

  assert(signedUrl.startsWith('https://clipper-cdn.b-cdn.net/users/u1/projects/p1/media/m1/proxy/proxy-720p.mp4'), 'Signed URL uses configured CDN hostname');
  assert(signedUrl.includes('token='), 'Signed URL includes SHA-256 token parameter');
  assert(signedUrl.includes('expires='), 'Signed URL includes timestamp expiration parameter');
  assert(signedUrl.includes('download=preview.mp4'), 'Signed URL includes download filename parameter');

  // --------------------------------------------------------------------------
  // TEST GROUP 8: Render Pipeline Cloud Storage Output
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Render Pipeline Cloud Storage Integration ---');
  // Upload test video to storage
  const sourceMediaKey = 'users/render-user/projects/render-proj/media/render-media/source/original.mp4';
  const testVideoBuf = fs.readFileSync(testVideoPath);
  await storageService.upload(sourceMediaKey, testVideoBuf, { contentType: 'video/mp4' });

  const renderJobId = `phase2-render-${Date.now()}`;
  const renderResult = await renderClipWithFfmpeg(renderJobId, {
    inputMedia: sourceMediaKey, // Resolves from storage key!
    startTime: 0,
    duration: 2,
    words: [
      { word: 'BUNNY', start: 0.1, end: 0.8 },
      { word: 'STORAGE', start: 0.9, end: 1.8 },
    ],
    aspectRatio: '9:16',
    trackingMode: 'center',
    isProUser: true,
    userId: 'render-user',
    projectId: 'render-proj',
    mediaId: 'render-media',
  });

  assert(renderResult.jobId === renderJobId, 'Render completed with matching jobId');
  assert(!!renderResult.storageKey, 'Render result includes cloud storageKey');
  assert(renderResult.storageKey!.includes('renders'), 'Render storageKey placed in renders artifact directory');
  assert(await storageService.exists(renderResult.storageKey!), 'Rendered MP4 exists in storage');
  assert(renderResult.fileSizeBytes > 1000, `Rendered MP4 has non-zero size (${renderResult.fileSizeBytes} bytes)`);

  // --------------------------------------------------------------------------
  // TEST GROUP 9: Security Safeguards & Environment Validation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Production Storage Safeguards ---');
  // Attempting LocalStorageProvider in production mode without bypass must throw
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ALLOW_DEV_LOCAL_STORAGE;
  (process.env as any).NODE_ENV = 'production';
  delete process.env.ALLOW_DEV_LOCAL_STORAGE;

  let localForbiddenInProd = false;
  try {
    new LocalStorageProvider();
  } catch (err: any) {
    localForbiddenInProd = err.code === 'CONFIGURATION_ERROR';
  }
  assert(localForbiddenInProd, 'LocalStorageProvider throws in production without bypass');

  // Validate environment validator with bunny provider
  process.env.STORAGE_PROVIDER = 'bunny';
  delete process.env.BUNNY_STORAGE_ZONE;
  const envValidation = validateEnvironment();
  assert(
    envValidation.errors.some((e) => e.includes('STORAGE_PROVIDER=bunny requires BUNNY_STORAGE_ZONE')),
    'Environment validator flags missing BUNNY_STORAGE_ZONE when STORAGE_PROVIDER=bunny'
  );

  // Restore env
  (process.env as any).NODE_ENV = origNodeEnv;
  if (origBypass) process.env.ALLOW_DEV_LOCAL_STORAGE = origBypass;
  delete process.env.STORAGE_PROVIDER;

  // Cleanup test scratch
  try {
    fs.rmSync(testScratchDir, { recursive: true, force: true });
    if (renderResult.filePath && fs.existsSync(renderResult.filePath)) {
      fs.unlinkSync(renderResult.filePath);
    }
  } catch {}

  console.log('\n====================================================');
  console.log(`📊 PHASE 2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal Phase 2 test runner error:', err);
  process.exit(1);
});
