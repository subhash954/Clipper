/**
 * CLIPPER PHASE 5: REAL POSTGRESQL INTEGRATION TEST SUITE
 * Database Integrity, Check Constraints, Concurrency & Atomic RPC Gate
 *
 * Requirements:
 * 1. Must execute against real PostgreSQL (fails immediately if DB unreachable).
 * 2. Scenario 1: Fresh Timeline Creation via save_timeline_atomic
 * 3. Scenario 2: Concurrency & Stale ExpectedVersion Protection (409 Conflict)
 * 4. Scenario 3: Database Check Constraints (sourceStart, sourceEnd, speed, timeline range)
 * 5. Scenario 4: Media Ownership & Cross-Project Integrity Gate (MEDIA_NOT_OWNED)
 * 6. Scenario 5: Atomic Rollback Verification on Batch Failure
 * 7. Scenario 6: Non-Destructive Source Media Immutability
 */

import { execSync } from 'child_process';
import crypto from 'crypto';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

function ensureValidUuid(): string {
  return crypto.randomUUID();
}

console.log('====================================================');
console.log('CLIPPER PHASE 5: REAL POSTGRESQL INTEGRATION GATE');
console.log('====================================================\n');

// 1. Verify PostgreSQL Reachability
let runPsql: (sql: string) => string;
try {
  const check = execSync('psql -h /tmp -U $(whoami) -d clipper_test -t -c "SELECT 1;" 2>&1', {
    encoding: 'utf8',
  });
  if (check.trim() !== '1') {
    console.error('REAL POSTGRESQL TESTS: FAILED');
    console.error('REASON: PostgreSQL returned unexpected response:', check);
    process.exit(1);
  }
  runPsql = (sql: string): string => {
    return execSync('psql -h /tmp -U $(whoami) -d clipper_test -t -v ON_ERROR_STOP=1', {
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  };
  console.log('✓ Connected to PostgreSQL test database (clipper_test)');
} catch (connErr: any) {
  console.error('REAL POSTGRESQL TESTS: FAILED');
  console.error('REASON: Local PostgreSQL test database not reachable at /tmp:5432 (clipper_test)');
  console.error(connErr.message);
  process.exit(1);
}

async function runPhase5PostgresTests() {
  const testUserId = ensureValidUuid();
  const testEmail = `pg5_${testUserId}@example.com`;
  const projectAId = ensureValidUuid();
  const projectBId = ensureValidUuid();
  const mediaAId = ensureValidUuid();
  const mediaBId = ensureValidUuid();

  try {
    // -------------------------------------------------------------
    // Setup Shared Test Fixtures in Real PostgreSQL
    // -------------------------------------------------------------
    console.log('\n--- Setup Test Fixtures ---');
    runPsql(`
      INSERT INTO auth.users (id, email) VALUES ('${testUserId}', '${testEmail}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, full_name) VALUES ('${testUserId}', '${testEmail}', 'PG 5 Tester') ON CONFLICT (id) DO NOTHING;
      
      -- Project A
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${projectAId}', '${testUserId}', 'Project A', 'youtube_to_shorts', 'created') ON CONFLICT (id) DO NOTHING;
      
      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${mediaAId}', '${projectAId}', '${testUserId}', 'videoA.mp4', 'https://cdn.example.com/videoA.mp4', 'uploads/videoA.mp4', 'video/mp4', 4096, 60.0, 'ready') ON CONFLICT (id) DO NOTHING;

      -- Project B (Foreign Project)
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${projectBId}', '${testUserId}', 'Project B', 'youtube_to_shorts', 'created') ON CONFLICT (id) DO NOTHING;
      
      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${mediaBId}', '${projectBId}', '${testUserId}', 'videoB.mp4', 'https://cdn.example.com/videoB.mp4', 'uploads/videoB.mp4', 'video/mp4', 4096, 60.0, 'ready') ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✓ Projects & Media Assets created in PostgreSQL');

    // =============================================================
    // TEST 1: Fresh Timeline Creation via save_timeline_atomic
    // =============================================================
    console.log('\n--- Test 1: Fresh Timeline Creation via RPC ---');
    const videoTrackId = ensureValidUuid();
    const audioTrackId = ensureValidUuid();
    const item1Id = ensureValidUuid();

    const initialTracks = JSON.stringify([
      {
        id: videoTrackId,
        name: 'Video 1',
        type: 'video',
        index: 0,
        isMuted: false,
        isLocked: false,
        items: [
          {
            id: item1Id,
            sourceMediaId: mediaAId,
            sourceStart: 0.0,
            sourceEnd: 30.0,
            timelineStart: 0.0,
            timelineEnd: 30.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
      {
        id: audioTrackId,
        name: 'Audio 1',
        type: 'audio',
        index: 1,
        isMuted: false,
        isLocked: false,
        items: [],
      },
    ]);

    const initialOp = JSON.stringify({
      type: 'create_timeline',
      params: { sourceMediaId: mediaAId, duration: 30.0 },
    });

    const saveResult1 = runPsql(`
      SELECT public.save_timeline_atomic(
        '${projectAId}'::UUID,
        '${testUserId}'::UUID,
        NULL::INTEGER,
        30.0::NUMERIC,
        '30fps'::TEXT,
        '${initialTracks.replace(/'/g, "''")}'::JSONB,
        '${initialOp.replace(/'/g, "''")}'::JSONB
      );
    `);

    const result1Json = JSON.parse(saveResult1.trim());
    assert(result1Json.version === 1, 'Initial timeline version is 1');
    assert(result1Json.projectId === projectAId, 'Returned project ID matches requested ID');
    const timelineId = result1Json.id;
    assert(!!timelineId, 'Valid timeline ID generated');

    // Verify row counts in PostgreSQL
    const countTracks = runPsql(`SELECT COUNT(*) FROM public.tracks WHERE timeline_id = '${timelineId}';`).trim();
    const countItems = runPsql(`SELECT COUNT(*) FROM public.timeline_items WHERE track_id = '${videoTrackId}';`).trim();
    const countOps = runPsql(`SELECT COUNT(*) FROM public.timeline_operations WHERE timeline_id = '${timelineId}';`).trim();

    assert(countTracks === '2', '2 tracks persisted in public.tracks');
    assert(countItems === '1', '1 item persisted in public.timeline_items');
    assert(countOps === '1', '1 operation recorded in public.timeline_operations');

    // =============================================================
    // TEST 2: Optimistic Concurrency Gate (Stale Version Conflict)
    // =============================================================
    console.log('\n--- Test 2: Optimistic Concurrency Conflict ---');

    // Worker 1: Updates timeline with expected_version = 1 -> succeeds, version becomes 2
    const itemSplitA = ensureValidUuid();
    const itemSplitB = ensureValidUuid();
    const splitTracks = JSON.stringify([
      {
        id: videoTrackId,
        name: 'Video 1',
        type: 'video',
        index: 0,
        isMuted: false,
        isLocked: false,
        items: [
          {
            id: itemSplitA,
            sourceMediaId: mediaAId,
            sourceStart: 0.0,
            sourceEnd: 15.0,
            timelineStart: 0.0,
            timelineEnd: 15.0,
            speed: 1.0,
            enabled: true,
          },
          {
            id: itemSplitB,
            sourceMediaId: mediaAId,
            sourceStart: 15.0,
            sourceEnd: 30.0,
            timelineStart: 15.0,
            timelineEnd: 30.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
      {
        id: audioTrackId,
        name: 'Audio 1',
        type: 'audio',
        index: 1,
        isMuted: false,
        isLocked: false,
        items: [],
      },
    ]);

    const splitOp = JSON.stringify({
      type: 'split_item',
      params: { splitTime: 15.0, originalItemId: item1Id },
    });

    const saveResult2 = runPsql(`
      SELECT public.save_timeline_atomic(
        '${projectAId}'::UUID,
        '${testUserId}'::UUID,
        1::INTEGER,
        30.0::NUMERIC,
        '30fps'::TEXT,
        '${splitTracks.replace(/'/g, "''")}'::JSONB,
        '${splitOp.replace(/'/g, "''")}'::JSONB
      );
    `);
    const result2Json = JSON.parse(saveResult2.trim());
    assert(result2Json.version === 2, 'Version incremented to 2 after split');

    // Worker 2: Attempts update with stale expected_version = 1 -> MUST FAIL with TIMELINE_VERSION_CONFLICT
    let conflictCaught = false;
    try {
      runPsql(`
        SELECT public.save_timeline_atomic(
          '${projectAId}'::UUID,
          '${testUserId}'::UUID,
          1::INTEGER,
          30.0::NUMERIC,
          '30fps'::TEXT,
          '${splitTracks.replace(/'/g, "''")}'::JSONB,
          NULL::JSONB
        );
      `);
    } catch (err: any) {
      conflictCaught = true;
      assert(err.message.includes('TIMELINE_VERSION_CONFLICT'), 'PostgreSQL raised TIMELINE_VERSION_CONFLICT exception');
    }
    assert(conflictCaught, 'Stale concurrent update was rejected');

    // Confirm version in DB is still 2
    const currentVersion = runPsql(`SELECT version FROM public.timelines WHERE id = '${timelineId}';`).trim();
    assert(currentVersion === '2', 'Current timeline version remains 2');

    // =============================================================
    // TEST 3: Database Check Constraints
    // =============================================================
    console.log('\n--- Test 3: Database Check Constraints ---');

    // Constraint 3a: Negative source start rejected
    let negativeSourceCaught = false;
    try {
      runPsql(`
        INSERT INTO public.timeline_items (
          id, track_id, source_media_id, source_start, source_end, timeline_start, timeline_end, speed, enabled
        ) VALUES (
          '${ensureValidUuid()}', '${videoTrackId}', '${mediaAId}', -5.0, 10.0, 0.0, 15.0, 1.0, true
        );
      `);
    } catch (err: any) {
      negativeSourceCaught = true;
      assert(err.message.includes('timeline_items_source_start_check'), 'Negative source_start rejected by check constraint');
    }
    assert(negativeSourceCaught, 'Negative source_start was rejected');

    // Constraint 3b: Inverted source range (source_end <= source_start) rejected
    let invertedSourceCaught = false;
    try {
      runPsql(`
        INSERT INTO public.timeline_items (
          id, track_id, source_media_id, source_start, source_end, timeline_start, timeline_end, speed, enabled
        ) VALUES (
          '${ensureValidUuid()}', '${videoTrackId}', '${mediaAId}', 20.0, 10.0, 0.0, 10.0, 1.0, true
        );
      `);
    } catch (err: any) {
      invertedSourceCaught = true;
      assert(err.message.includes('check constraint') || err.message.includes('timeline_items_check'), 'Inverted source range rejected by check constraint');
    }
    assert(invertedSourceCaught, 'Inverted source range was rejected');

    // Constraint 3c: Inverted timeline range (timeline_end <= timeline_start) rejected
    let invertedTimelineCaught = false;
    try {
      runPsql(`
        INSERT INTO public.timeline_items (
          id, track_id, source_media_id, source_start, source_end, timeline_start, timeline_end, speed, enabled
        ) VALUES (
          '${ensureValidUuid()}', '${videoTrackId}', '${mediaAId}', 0.0, 10.0, 15.0, 10.0, 1.0, true
        );
      `);
    } catch (err: any) {
      invertedTimelineCaught = true;
      assert(err.message.includes('check constraint') || err.message.includes('timeline_items_check'), 'Inverted timeline range rejected by check constraint');
    }
    assert(invertedTimelineCaught, 'Inverted timeline range was rejected');

    // Constraint 3d: Non-positive speed (speed <= 0) rejected
    let zeroSpeedCaught = false;
    try {
      runPsql(`
        INSERT INTO public.timeline_items (
          id, track_id, source_media_id, source_start, source_end, timeline_start, timeline_end, speed, enabled
        ) VALUES (
          '${ensureValidUuid()}', '${videoTrackId}', '${mediaAId}', 0.0, 10.0, 0.0, 10.0, 0.0, true
        );
      `);
    } catch (err: any) {
      zeroSpeedCaught = true;
      assert(err.message.includes('timeline_items_speed_check'), 'Zero speed rejected by check constraint');
    }
    assert(zeroSpeedCaught, 'Zero speed was rejected');

    // =============================================================
    // TEST 4: Media Ownership & Cross-Project Integrity Gate
    // =============================================================
    console.log('\n--- Test 4: Cross-Project Media Authority Gate ---');

    // Attempt to save item referencing mediaBId (which belongs to Project B) into Project A's timeline
    const crossProjectTracks = JSON.stringify([
      {
        id: videoTrackId,
        name: 'Video 1',
        type: 'video',
        index: 0,
        isMuted: false,
        isLocked: false,
        items: [
          {
            id: ensureValidUuid(),
            sourceMediaId: mediaBId, // Foreign media from Project B!
            sourceStart: 0.0,
            sourceEnd: 10.0,
            timelineStart: 0.0,
            timelineEnd: 10.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);

    let crossProjectCaught = false;
    try {
      runPsql(`
        SELECT public.save_timeline_atomic(
          '${projectAId}'::UUID,
          '${testUserId}'::UUID,
          2::INTEGER,
          30.0::NUMERIC,
          '30fps'::TEXT,
          '${crossProjectTracks.replace(/'/g, "''")}'::JSONB,
          NULL::JSONB
        );
      `);
    } catch (err: any) {
      crossProjectCaught = true;
      assert(err.message.includes('MEDIA_NOT_OWNED'), 'Cross-project media reference rejected with MEDIA_NOT_OWNED');
    }
    assert(crossProjectCaught, 'Cross-project media was safely blocked by RPC');

    // =============================================================
    // TEST 5: Atomic Rollback on Batch Failure
    // =============================================================
    console.log('\n--- Test 5: Atomic Rollback on Batch Failure ---');

    // Submit batch where item violates source_start >= 0 check constraint
    const badBatchTracks = JSON.stringify([
      {
        id: videoTrackId,
        name: 'Video 1',
        type: 'video',
        index: 0,
        isMuted: false,
        isLocked: false,
        items: [
          {
            id: ensureValidUuid(),
            sourceMediaId: mediaAId,
            sourceStart: -10.0, // Violates check constraint
            sourceEnd: 10.0,
            timelineStart: 0.0,
            timelineEnd: 10.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);

    let rollbackCaught = false;
    try {
      runPsql(`
        SELECT public.save_timeline_atomic(
          '${projectAId}'::UUID,
          '${testUserId}'::UUID,
          2::INTEGER,
          30.0::NUMERIC,
          '30fps'::TEXT,
          '${badBatchTracks.replace(/'/g, "''")}'::JSONB,
          NULL::JSONB
        );
      `);
    } catch (err: any) {
      rollbackCaught = true;
      assert(err.message.includes('timeline_items_source_start_check'), 'Check constraint failure triggers rollback');
    }
    assert(rollbackCaught, 'Invalid batch rejected by PostgreSQL transaction');

    // Confirm that the timeline state rolled back completely and still has 2 split items from Test 2
    const rollbackItemCount = runPsql(`SELECT COUNT(*) FROM public.timeline_items WHERE track_id = '${videoTrackId}';`).trim();
    assert(rollbackItemCount === '2', 'Timeline items completely rolled back to pre-failure state (2 items)');

    // =============================================================
    // TEST 6: Non-Destructive Source Media Immutability
    // =============================================================
    console.log('\n--- Test 6: Non-Destructive Source Media Immutability ---');

    // Query mediaA in media_assets
    const mediaCheck = runPsql(`
      SELECT duration, file_url, storage_path, status FROM public.media_assets WHERE id = '${mediaAId}';
    `).trim().split('|').map(s => s.trim());

    assert(Number(mediaCheck[0]) === 60, 'Source media duration unchanged at 60.0s');
    assert(mediaCheck[1] === 'https://cdn.example.com/videoA.mp4', 'Source media URL unchanged');
    assert(mediaCheck[2] === 'uploads/videoA.mp4', 'Source media storage path unchanged');
    assert(mediaCheck[3] === 'ready', 'Source media status untouched');

    console.log('\n====================================================');
    console.log(`📊 PHASE 5 POSTGRESQL GATE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

  } catch (err: any) {
    console.error('Fatal Postgres test error:', err);
    process.exit(1);
  } finally {
    // Cleanup fixtures
    try {
      runPsql(`
        DELETE FROM public.timeline_operations WHERE timeline_id IN (SELECT id FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}'));
        DELETE FROM public.timeline_items WHERE track_id IN (SELECT id FROM public.tracks WHERE timeline_id IN (SELECT id FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}')));
        DELETE FROM public.tracks WHERE timeline_id IN (SELECT id FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}'));
        DELETE FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.media_assets WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.projects WHERE id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.profiles WHERE id = '${testUserId}';
        DELETE FROM auth.users WHERE id = '${testUserId}';
      `);
      console.log('✓ Cleaned up test fixtures in PostgreSQL');
    } catch {
      // ignore cleanup errors
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5PostgresTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
