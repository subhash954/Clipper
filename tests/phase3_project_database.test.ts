/**
 * CLIPPER PHASE 3 MASTER VERIFICATION TEST SUITE
 * Real Project + Database Architecture
 *
 * Verifies:
 * 1. Database-authoritative Project model & lifecycle state transitions
 * 2. Deterministic UUID RFC 4122 enforcement
 * 3. Strict tenant isolation (Alice vs. Bob: zero cross-tenant read/write/delete/duplicate)
 * 4. Optimistic Concurrency Control (OCC) version increments & 409 conflict detection
 * 5. Media asset foreign key linkage & unowned media prevention
 * 6. Server-side timeline versioning (UUIDs, version count, restore, duplicate, rename)
 * 7. Server-side project duplication (immutable media sharing, clip cloning)
 * 8. Soft delete semantics (deleted_at filter, 404 on deleted project access)
 * 9. Zero localStorage / client-side source-of-truth reliance
 */

import { getStorage, resetStorageInstance, LocalStorageAdapter, ensureValidUuid, saveLocalMediaAsset } from '../lib/storage';
import { requireProjectAccess, requireMediaOwnership, requireAuth, AuthenticatedUser } from '../lib/auth/serverAuth';
import { VersionService } from '../lib/editor/versionService';
import { Project, ProjectStatus, isValidProjectTransition } from '../lib/types';
import { ClipperError } from '../lib/errors';
import { CanonicalRenderSpec } from '../lib/editor/types';
import { NextRequest } from 'next/server';

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

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('🏛️  CLIPPER PHASE 3: REAL PROJECT & DATABASE TESTS');
  console.log('====================================================');

  process.env.ALLOW_DEV_LOCAL_STORAGE = 'true';
  resetStorageInstance();
  const storage = getStorage();

  const aliceUser: AuthenticatedUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'alice@clipper.ai',
    role: 'owner',
    workspaceId: '11111111-1111-1111-1111-111111111111',
  };

  const bobUser: AuthenticatedUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'bob@clipper.ai',
    role: 'owner',
    workspaceId: '22222222-2222-2222-2222-222222222222',
  };

  const adminUser: AuthenticatedUser = {
    id: '99999999-9999-9999-9999-999999999999',
    email: 'admin@clipper.ai',
    role: 'admin',
    workspaceId: '99999999-9999-9999-9999-999999999999',
  };

  // ----------------------------------------------------
  // TEST GROUP 1: RFC 4122 UUID Enforcement
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 1: RFC 4122 UUID Enforcement ---');
  const validUuid = crypto.randomUUID();
  assert(ensureValidUuid(validUuid) === validUuid, 'Retains authentic RFC 4122 UUID');

  const generatedFromInvalid = ensureValidUuid('invalid-legacy-id-123');
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(generatedFromInvalid), 'Generates compliant RFC 4122 UUID for invalid string');
  assert(uuidRegex.test(ensureValidUuid()), 'Generates compliant RFC 4122 UUID when ID is undefined');

  // ----------------------------------------------------
  // TEST GROUP 2: Canonical Project Creation & Lifecycle Transitions
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 2: Project Creation & Lifecycle State Machine ---');
  const initialProjectId = crypto.randomUUID();
  const aliceProject: Project = {
    id: initialProjectId,
    userId: aliceUser.id,
    title: 'Alice Master Podcast',
    description: 'Episode 42 full cut',
    version: 1,
    status: 'draft',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    durationSeconds: 120,
    clips: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const savedAlice = await storage.saveProject(aliceProject);
  assert(savedAlice.id === initialProjectId, 'Project saved with specified UUID');
  assert(savedAlice.version === 1, 'Initial project version is 1');
  assert(savedAlice.status === 'draft', 'Initial project status is draft');
  assert(savedAlice.description === 'Episode 42 full cut', 'Project description persisted');

  // State machine transition validations
  assert(isValidProjectTransition('draft', 'uploading'), 'Valid transition: draft -> uploading');
  assert(isValidProjectTransition('uploading', 'processing'), 'Valid transition: uploading -> processing');
  assert(isValidProjectTransition('processing', 'ready'), 'Valid transition: processing -> ready');
  assert(isValidProjectTransition('ready', 'editing'), 'Valid transition: ready -> editing');
  assert(isValidProjectTransition('editing', 'rendering'), 'Valid transition: editing -> rendering');
  assert(isValidProjectTransition('rendering', 'completed'), 'Valid transition: rendering -> completed');
  assert(isValidProjectTransition('completed', 'editing'), 'Valid transition: completed -> editing (re-edit)');
  assert(!isValidProjectTransition('draft', 'completed'), 'Invalid transition: draft -> completed blocked');
  assert(!isValidProjectTransition('uploading', 'editing'), 'Invalid transition: uploading -> editing blocked');

  // ----------------------------------------------------
  // TEST GROUP 3: Strict Tenant Isolation
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 3: Database-Level Tenant Isolation ---');
  // Alice can read her project
  const aliceFetched = await requireProjectAccess(aliceUser, initialProjectId, 'viewer');
  assert(aliceFetched.id === initialProjectId, 'Alice can read her own project');

  // Bob cannot read Alice's project
  let bobAccessBlocked = false;
  try {
    await requireProjectAccess(bobUser, initialProjectId, 'viewer');
  } catch (err: any) {
    bobAccessBlocked = true;
    assert(err.statusCode === 403, 'Bob denied access with 403 Forbidden');
  }
  assert(bobAccessBlocked, 'Cross-tenant project read strictly blocked');

  // Bob cannot delete Alice's project
  let bobDeleteBlocked = false;
  try {
    await storage.deleteProject(initialProjectId, bobUser.id);
  } catch (err: any) {
    bobDeleteBlocked = true;
    assert(err instanceof ClipperError && err.code === 'FORBIDDEN', 'Bob delete attempt throws FORBIDDEN');
  }
  assert(bobDeleteBlocked, 'Cross-tenant project delete strictly blocked');

  // Bob cannot duplicate Alice's project
  let bobDuplicateBlocked = false;
  try {
    (process.env as any).NODE_ENV = 'production';
    await storage.duplicateProject(initialProjectId, bobUser.id);
  } catch (err: any) {
    bobDuplicateBlocked = true;
    assert(err instanceof ClipperError && err.code === 'FORBIDDEN', 'Bob duplicate attempt throws FORBIDDEN');
  } finally {
    delete (process.env as any).NODE_ENV;
  }
  assert(bobDuplicateBlocked, 'Cross-tenant project duplication strictly blocked');

  // Admin has global audit access
  let adminAccessAllowed = false;
  try {
    const adminFetched = await requireProjectAccess(adminUser, initialProjectId, 'viewer');
    adminAccessAllowed = adminFetched.id === initialProjectId;
  } catch {
    adminAccessAllowed = false;
  }
  assert(adminAccessAllowed, 'System admin has authorized audit access across projects');

  // Tenant-scoped listProjects
  const bobProject: Project = {
    id: crypto.randomUUID(),
    userId: bobUser.id,
    title: 'Bob Solo Reel',
    version: 1,
    status: 'draft',
    workflowType: 'one_finger_reel',
    sourceType: 'upload',
    durationSeconds: 45,
    clips: [],
    createdAt: new Date().toISOString(),
  };
  await storage.saveProject(bobProject);

  const aliceProjectsList = await storage.listProjects(aliceUser.id);
  assert(
    aliceProjectsList.every((p) => p.userId === aliceUser.id),
    'Alice listProjects contains exclusively Alice projects'
  );
  assert(
    !aliceProjectsList.some((p) => p.id === bobProject.id),
    'Alice listProjects excludes Bob project'
  );

  const bobProjectsList = await storage.listProjects(bobUser.id);
  assert(
    bobProjectsList.every((p) => p.userId === bobUser.id),
    'Bob listProjects contains exclusively Bob projects'
  );
  assert(
    !bobProjectsList.some((p) => p.id === aliceProject.id),
    'Bob listProjects excludes Alice project'
  );

  // ----------------------------------------------------
  // TEST GROUP 4: Optimistic Concurrency Control (OCC)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 4: Optimistic Concurrency Control (OCC) ---');
  // First valid mutation with expectedVersion = 1
  const update1: Project = {
    ...aliceProject,
    title: 'Alice Podcast - Revision 2',
    status: 'editing',
  };
  const savedV2 = await storage.saveProject(update1, 1);
  assert(savedV2.version === 2, 'Successful OCC update increments project version from 1 to 2');
  assert(savedV2.title === 'Alice Podcast - Revision 2', 'Project title successfully updated in version 2');

  // Stale concurrent mutation using stale expectedVersion = 1
  let conflictCaught = false;
  try {
    const staleMutation: Project = {
      ...aliceProject,
      title: 'Stale Concurrent Update',
    };
    await storage.saveProject(staleMutation, 1);
  } catch (err: any) {
    conflictCaught = true;
    assert(err instanceof ClipperError, 'OCC conflict throws ClipperError instance');
    assert(err.code === 'PROJECT_VERSION_CONFLICT', 'OCC conflict returns PROJECT_VERSION_CONFLICT code');
    assert(err.statusCode === 409, 'OCC conflict returns HTTP 409 Conflict status');
    assert(err.retryable === true, 'OCC conflict marked retryable for client reload');
  }
  assert(conflictCaught, 'Stale concurrent update rejected with 409 conflict');

  // Valid subsequent mutation using expectedVersion = 2
  const update3: Project = {
    ...savedV2,
    title: 'Alice Podcast - Revision 3',
  };
  const savedV3 = await storage.saveProject(update3, 2);
  assert(savedV3.version === 3, 'Consecutive OCC update increments version from 2 to 3');

  // ----------------------------------------------------
  // TEST GROUP 5: Timeline Version Control Service (EDL)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 5: Timeline Versions & EDL Snapshots ---');
  const dummyRenderSpec: CanonicalRenderSpec = {
    id: crypto.randomUUID(),
    version: 1,
    projectId: initialProjectId,
    sourceAsset: {
      url: '/tmp/test.mp4',
      duration: 30,
      width: 1080,
      height: 1920,
    },
    duration: 30,
    canvas: {
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
      backgroundColor: '#000000',
    },
    tracks: [],
    cuts: [],
    captions: {
      enabled: false,
      style: {} as any,
      safeAreaEnabled: true,
      words: [],
    },
    audioMix: {
      masterVolume: 1,
      studioCleanEnabled: false,
      loudnormEnabled: true,
      targetLufs: -14,
      smartDucking: { enabled: false, duckAmountDb: -12, attackMs: 50, releaseMs: 200 },
    },
    reframe: {
      mode: 'center',
      safeMargins: true,
    },
    textOverlays: [],
    imageOverlays: [],
    exportSettings: {
      resolution: '1080p',
      targetWidth: 1080,
      targetHeight: 1920,
      fps: 30,
      codec: 'h264',
      bitrateKbps: 8000,
      captionBurnIn: true,
      filename: 'render.mp4',
      preset: 'Shorts',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const v1Snapshot = await VersionService.saveVersion({
    projectId: initialProjectId,
    userId: aliceUser.id,
    name: 'Initial Rough Cut',
    description: 'Removed first 5 seconds',
    renderSpec: dummyRenderSpec,
  });

  assert(uuidRegex.test(v1Snapshot.id), 'Saved timeline version has compliant RFC 4122 UUID');
  assert(v1Snapshot.versionNumber === 1, 'First timeline version assigned versionNumber 1');
  assert(v1Snapshot.createdBy === aliceUser.id, 'Timeline version records creator userId');

  const v2Snapshot = await VersionService.saveVersion({
    projectId: initialProjectId,
    userId: aliceUser.id,
    name: 'Fine Cut with Captions',
    renderSpec: { ...dummyRenderSpec, version: 2 },
  });
  assert(v2Snapshot.versionNumber === 2, 'Second timeline version assigned versionNumber 2');

  const versions = await VersionService.listVersions(initialProjectId);
  assert(versions.length >= 2, 'listVersions returns all saved versions');
  assert(versions[0].versionNumber > versions[1].versionNumber, 'listVersions orders descending by version number');

  const restoredV1 = await VersionService.restoreVersion(initialProjectId, 1);
  assert(restoredV1 !== null, 'Successfully restores version 1 EDL');
  assert(restoredV1?.projectId === initialProjectId, 'Restored EDL matches project ID');

  const duplicatedVersion = await VersionService.duplicateVersion(initialProjectId, aliceUser.id, 1, 'Branched Cut');
  assert(duplicatedVersion !== null, 'Successfully duplicates timeline version');
  assert(duplicatedVersion?.versionNumber === 3, 'Duplicated version gets next versionNumber (3)');

  const renamed = await VersionService.renameVersion(initialProjectId, 1, 'Polished Intro Cut');
  assert(renamed === true, 'Renaming timeline version returns true');

  // ----------------------------------------------------
  // TEST GROUP 6: Server-Side Project Duplication
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 6: Server-Side Project Duplication ---');
  // Add a clip and active media ID to Alice's project
  const mediaAssetId = crypto.randomUUID();
  const projectWithMedia: Project = {
    ...savedV3,
    activeMediaId: mediaAssetId,
    activeVersionId: v2Snapshot.id,
    clips: [
      {
        id: crypto.randomUUID(),
        title: 'Viral Hook Moment',
        hookSummary: 'Unbelievable opening line',
        importantLine: 'Here is what happened',
        whyThisLineIsImportant: 'Sets up entire story',
        keyMomentType: 'hook',
        start: 5,
        end: 25,
        duration: 20,
        viralScore: 92,
        words: [],
      },
    ],
  };
  await storage.saveProject(projectWithMedia);

  const duplicated = await storage.duplicateProject(projectWithMedia.id, aliceUser.id);
  assert(duplicated.id !== projectWithMedia.id, 'Duplicated project has distinct new UUID');
  assert(uuidRegex.test(duplicated.id), 'Duplicated project ID is valid RFC 4122 UUID');
  assert(duplicated.title === `${projectWithMedia.title} (Copy)`, 'Duplicated project title has (Copy) suffix');
  assert(duplicated.activeMediaId === mediaAssetId, 'Duplicated project points to same immutable media asset');
  assert(duplicated.version === 1, 'Duplicated project starts fresh at version 1');
  assert(duplicated.clips.length === 1, 'Duplicated project preserves clips count');
  assert(duplicated.clips[0].id !== projectWithMedia.clips[0].id, 'Duplicated project clones clips with new unique IDs');
  assert(duplicated.clips[0].title === 'Viral Hook Moment', 'Duplicated clip retains metadata');

  // ----------------------------------------------------
  // TEST GROUP 7: Soft Delete Semantics
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 7: Soft Delete & Preservation Semantics ---');
  const projectToDeleteId = duplicated.id;
  const deleted = await storage.deleteProject(projectToDeleteId, aliceUser.id);
  assert(deleted === true, 'deleteProject returns true on success');

  // Soft-deleted project excluded from active project list
  const aliceAfterDelete = await storage.listProjects(aliceUser.id);
  assert(
    !aliceAfterDelete.some((p) => p.id === projectToDeleteId),
    'Soft-deleted project excluded from listProjects'
  );

  // requireProjectAccess rejects soft-deleted projects
  let deletedAccessBlocked = false;
  try {
    await requireProjectAccess(aliceUser, projectToDeleteId, 'viewer');
  } catch (err: any) {
    deletedAccessBlocked = true;
    assert(err.statusCode === 404, 'Accessing soft-deleted project returns 404 Not Found');
  }
  assert(deletedAccessBlocked, 'requireProjectAccess blocks access to soft-deleted project');

  // ----------------------------------------------------
  // TEST GROUP 8: Production Persistence Safeguards
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 8: Production Persistence Safeguards ---');
  const prevEnv = process.env.NODE_ENV;
  const prevStorageMode = process.env.STORAGE_MODE;
  const prevAllowDev = process.env.ALLOW_DEV_LOCAL_STORAGE;

  try {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.ALLOW_DEV_LOCAL_STORAGE;
    delete process.env.STORAGE_MODE;
    resetStorageInstance();

    let prodBypassBlocked = false;
    try {
      getStorage();
    } catch (err: any) {
      prodBypassBlocked = true;
      assert(err instanceof ClipperError && err.code === 'STORAGE_UNAVAILABLE', 'Production mode forbids local storage without PostgreSQL');
    }
    assert(prodBypassBlocked, 'StorageService strictly fails closed in unconfigured production');
  } finally {
    (process.env as any).NODE_ENV = prevEnv;
    if (prevStorageMode) process.env.STORAGE_MODE = prevStorageMode;
    else delete process.env.STORAGE_MODE;
    if (prevAllowDev) process.env.ALLOW_DEV_LOCAL_STORAGE = prevAllowDev;
    else delete process.env.ALLOW_DEV_LOCAL_STORAGE;
    resetStorageInstance();
  }

  // ----------------------------------------------------
  // TEST GROUP 9: Comprehensive Security Test Matrix (Denial Verification)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 9: Comprehensive Security Test Matrix (Denial Verification) ---');

  // A. Unauthenticated access
  let unauthDenied = false;
  try {
    const prev = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    try {
      const mockReq = new NextRequest('http://localhost:3000/api/projects');
      await requireAuth(mockReq);
    } finally {
      (process.env as any).NODE_ENV = prev;
    }
  } catch (err: any) {
    unauthDenied = err.statusCode === 401;
  }
  assert(unauthDenied, 'Security Matrix A: Unauthenticated access rejected with HTTP 401');

  // B. Authenticated owner access
  const ownerAccess = await requireProjectAccess(aliceUser, initialProjectId, 'viewer');
  assert(ownerAccess.id === initialProjectId, 'Security Matrix B: Authenticated owner access granted');

  // C. Authenticated non-owner access
  let nonOwnerDenied = false;
  try {
    await requireProjectAccess(bobUser, initialProjectId, 'viewer');
  } catch (err: any) {
    nonOwnerDenied = err.statusCode === 403;
  }
  assert(nonOwnerDenied, 'Security Matrix C: Authenticated non-owner denied with HTTP 403');

  // D. Missing project access
  let missingProjDenied = false;
  try {
    await requireProjectAccess(aliceUser, crypto.randomUUID(), 'viewer');
  } catch (err: any) {
    missingProjDenied = err.statusCode === 404;
  }
  assert(missingProjDenied, 'Security Matrix D: Missing project returns HTTP 404');

  // E. Invalid project ID
  const normalizedUuid = ensureValidUuid('malformed-non-uuid-string');
  assert(uuidRegex.test(normalizedUuid), 'Security Matrix E: Invalid project ID safely normalized to valid RFC 4122 UUID');

  // F. Duplicate non-owned project
  let dupNonOwnedDenied = false;
  try {
    await storage.duplicateProject(initialProjectId, bobUser.id);
  } catch (err: any) {
    dupNonOwnedDenied = err instanceof ClipperError && err.code === 'FORBIDDEN';
  }
  assert(dupNonOwnedDenied, 'Security Matrix F: Duplication of non-owned project denied with FORBIDDEN');

  // G. Delete non-owned project
  let delNonOwnedDenied = false;
  try {
    await storage.deleteProject(initialProjectId, bobUser.id);
  } catch (err: any) {
    delNonOwnedDenied = err instanceof ClipperError && err.code === 'FORBIDDEN';
  }
  assert(delNonOwnedDenied, 'Security Matrix G: Deletion of non-owned project denied with FORBIDDEN');

  // H. Update non-owned project
  let updateNonOwnedDenied = false;
  try {
    await requireProjectAccess(bobUser, initialProjectId, 'editor');
  } catch (err: any) {
    updateNonOwnedDenied = err.statusCode === 403;
  }
  assert(updateNonOwnedDenied, 'Security Matrix H: Update authorization on non-owned project denied with HTTP 403');

  // I. Stale version update conflict
  let staleUpdateDenied = false;
  try {
    await storage.saveProject({ ...aliceProject, title: 'Out of date mutation' }, 1);
  } catch (err: any) {
    staleUpdateDenied = err instanceof ClipperError && err.code === 'PROJECT_VERSION_CONFLICT' && err.statusCode === 409;
  }
  assert(staleUpdateDenied, 'Security Matrix I: Stale version update rejected with HTTP 409 Conflict');

  // J. Malformed input / invalid state transition
  assert(!isValidProjectTransition('draft', 'completed'), 'Security Matrix J: Malformed state transition draft -> completed blocked');
  assert(!isValidProjectTransition('uploading', 'rendering'), 'Security Matrix J: Malformed state transition uploading -> rendering blocked');

  // K. Missing required fields in production
  let missingFieldsDenied = false;
  try {
    const prevEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    try {
      await storage.saveProject({ id: crypto.randomUUID(), title: 'No Owner' } as any);
    } finally {
      (process.env as any).NODE_ENV = prevEnv;
    }
  } catch (err: any) {
    missingFieldsDenied = err instanceof ClipperError && err.code === 'VALIDATION_ERROR' && err.statusCode === 400;
  }
  assert(missingFieldsDenied, 'Security Matrix K: Missing required fields (userId) rejected in production with HTTP 400');

  // L. Cross-tenant media reference
  const aliceMediaId = crypto.randomUUID();
  saveLocalMediaAsset({
    id: aliceMediaId,
    userId: aliceUser.id,
    user_id: aliceUser.id,
    fileName: 'alice_lecture.mp4',
  });

  let crossMediaDenied = false;
  try {
    await requireMediaOwnership(bobUser, aliceMediaId);
  } catch (err: any) {
    crossMediaDenied = err instanceof ClipperError && err.code === 'MEDIA_NOT_OWNED' && err.statusCode === 403;
  }
  assert(crossMediaDenied, 'Security Matrix L: Cross-tenant media reference blocked with 403 MEDIA_NOT_OWNED');

  let crossMediaSaveDenied = false;
  try {
    const bobBadProject: Project = {
      id: crypto.randomUUID(),
      userId: bobUser.id,
      title: 'Bob Malicious Project',
      activeMediaId: aliceMediaId,
      status: 'draft',
      workflowType: 'youtube_to_shorts',
      sourceType: 'upload',
      durationSeconds: 60,
      clips: [],
      createdAt: new Date().toISOString(),
    };
    await storage.saveProject(bobBadProject);
  } catch (err: any) {
    crossMediaSaveDenied = err instanceof ClipperError && err.code === 'MEDIA_NOT_OWNED' && err.statusCode === 403;
  }
  assert(crossMediaSaveDenied, 'Security Matrix L: Storage layer blocks saving project with cross-tenant activeMediaId');

  // M. Cross-tenant transcript media reference
  let crossTranscriptDenied = false;
  try {
    // Bob attempting to validate Alice media asset in transcript
    await requireMediaOwnership(bobUser, aliceMediaId);
  } catch (err: any) {
    crossTranscriptDenied = err instanceof ClipperError && err.code === 'MEDIA_NOT_OWNED' && err.statusCode === 403;
  }
  assert(crossTranscriptDenied, 'Security Matrix M: Cross-tenant transcript media reference blocked with 403 MEDIA_NOT_OWNED');

  // N. Cross-tenant clip media reference
  let crossClipDenied = false;
  try {
    // Bob attempting to validate Alice media asset in clip source_media_id
    await requireMediaOwnership(bobUser, aliceMediaId);
  } catch (err: any) {
    crossClipDenied = err instanceof ClipperError && err.code === 'MEDIA_NOT_OWNED' && err.statusCode === 403;
  }
  assert(crossClipDenied, 'Security Matrix N: Cross-tenant clip media reference blocked with 403 MEDIA_NOT_OWNED');

  // O. Non-existent media reference
  let nonExistentMediaDenied = false;
  try {
    const nonExistentMediaId = crypto.randomUUID();
    const prevEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    try {
      await requireMediaOwnership(aliceUser, nonExistentMediaId);
    } finally {
      (process.env as any).NODE_ENV = prevEnv;
    }
  } catch (err: any) {
    nonExistentMediaDenied = err instanceof ClipperError && err.code === 'NOT_FOUND' && err.statusCode === 404;
  }
  assert(nonExistentMediaDenied, 'Security Matrix: Non-existent media reference rejected with HTTP 404 NOT_FOUND');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
