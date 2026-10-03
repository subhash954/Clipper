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

import { execSync, exec } from 'child_process';
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
function execPsqlAsync(sql: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = exec('psql -h /tmp -U $(whoami) -d clipper_test -t -v ON_ERROR_STOP=1', (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: err ? (err.code ?? 1) : 0 });
    });
    child.stdin?.write(sql);
    child.stdin?.end();
  });
}

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
  const urProjectId = ensureValidUuid();
  const rbacProjectId = ensureValidUuid();
  const raceProjectId = ensureValidUuid();
  const editorUserId = ensureValidUuid();
  const viewerUserId = ensureValidUuid();
  const unrelatedUserId = ensureValidUuid();
  const tenantBUserId = ensureValidUuid();

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
      assert(err.message.includes('timeline_items_source_start_check') || err.message.includes('INVALID_SOURCE_RANGE'), 'Check constraint failure triggers rollback');
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

    // =============================================================
    // TEST 7: Real PostgreSQL Multi-Step Undo & Redo Gate
    // =============================================================
    console.log('\n--- Test 7: Real PostgreSQL Multi-Step Undo & Redo Gate ---');
    const urMediaId = ensureValidUuid();
    const urTrackId = ensureValidUuid();
    const urItem1Id = ensureValidUuid();
    const urItem2AId = ensureValidUuid();
    const urItem2BId = ensureValidUuid();

    runPsql(`
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${urProjectId}', '${testUserId}', 'Undo Redo Project', 'youtube_to_shorts', 'created') ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${urMediaId}', '${urProjectId}', '${testUserId}', 'urVideo.mp4', 'https://cdn.example.com/urVideo.mp4', 'uploads/urVideo.mp4', 'video/mp4', 4096, 60.0, 'ready') ON CONFLICT (id) DO NOTHING;
    `);

    // State A: Initial timeline (1 item, [0, 30])
    const urTracksA = JSON.stringify([
      {
        id: urTrackId,
        type: 'video',
        index: 0,
        name: 'Video Track',
        items: [
          {
            id: urItem1Id,
            sourceMediaId: urMediaId,
            sourceStart: 0.0,
            sourceEnd: 30.0,
            timelineStart: 0.0,
            timelineEnd: 30.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);
    const urOpA = JSON.stringify({ type: 'create_timeline', params: { duration: 30.0 } });

    const urResA = JSON.parse(runPsql(`
      SELECT public.save_timeline_atomic(
        '${urProjectId}'::UUID, '${testUserId}'::UUID, NULL::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
        '${urTracksA.replace(/'/g, "''")}'::JSONB, '${urOpA.replace(/'/g, "''")}'::JSONB
      );
    `).trim());

    assert(urResA.version === 1, 'State A: version 1');
    assert(urResA.currentOperationIndex === 1, 'State A: cursor index 1');
    assert(urResA.tracks[0].items.length === 1, 'State A has 1 item');

    // State B: Split item into 2 pieces ([0, 15], [15, 30])
    const urTracksB = JSON.stringify([
      {
        id: urTrackId,
        type: 'video',
        index: 0,
        name: 'Video Track',
        items: [
          {
            id: urItem2AId,
            sourceMediaId: urMediaId,
            sourceStart: 0.0,
            sourceEnd: 15.0,
            timelineStart: 0.0,
            timelineEnd: 15.0,
            speed: 1.0,
            enabled: true,
          },
          {
            id: urItem2BId,
            sourceMediaId: urMediaId,
            sourceStart: 15.0,
            sourceEnd: 30.0,
            timelineStart: 15.0,
            timelineEnd: 30.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);
    const urOpB = JSON.stringify({ type: 'split', params: { splitTime: 15.0 } });

    const urResB = JSON.parse(runPsql(`
      SELECT public.save_timeline_atomic(
        '${urProjectId}'::UUID, '${testUserId}'::UUID, 1::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
        '${urTracksB.replace(/'/g, "''")}'::JSONB, '${urOpB.replace(/'/g, "''")}'::JSONB
      );
    `).trim());

    assert(urResB.version === 2, 'State B: version 2');
    assert(urResB.currentOperationIndex === 2, 'State B: cursor index 2');
    assert(urResB.tracks[0].items.length === 2, 'State B has 2 items');

    // State C: Delete second item (1 item remaining: [0, 15])
    const urTracksC = JSON.stringify([
      {
        id: urTrackId,
        type: 'video',
        index: 0,
        name: 'Video Track',
        items: [
          {
            id: urItem2AId,
            sourceMediaId: urMediaId,
            sourceStart: 0.0,
            sourceEnd: 15.0,
            timelineStart: 0.0,
            timelineEnd: 15.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);
    const urOpC = JSON.stringify({ type: 'delete_item', params: { itemId: urItem2BId } });

    const urResC = JSON.parse(runPsql(`
      SELECT public.save_timeline_atomic(
        '${urProjectId}'::UUID, '${testUserId}'::UUID, 2::INTEGER, 15.0::NUMERIC, '30fps'::TEXT,
        '${urTracksC.replace(/'/g, "''")}'::JSONB, '${urOpC.replace(/'/g, "''")}'::JSONB
      );
    `).trim());

    assert(urResC.version === 3, 'State C: version 3');
    assert(urResC.currentOperationIndex === 3, 'State C: cursor index 3');
    assert(urResC.tracks[0].items.length === 1, 'State C has 1 item');

    // 1. Undo to B: expect version 4, cursor 2, 2 items
    const urUndoToB = JSON.parse(runPsql(`
      SELECT public.undo_timeline_atomic('${urProjectId}'::UUID, '${testUserId}'::UUID, 3::INTEGER);
    `).trim());
    assert(urUndoToB.version === 4, 'Undo C -> B: version incremented to 4');
    assert(urUndoToB.currentOperationIndex === 2, 'Undo C -> B: cursor moved to 2');
    assert(urUndoToB.tracks[0].items.length === 2, 'Undo C -> B: restored 2 items');

    // 2. Undo to A: expect version 5, cursor 1, 1 item
    const urUndoToA = JSON.parse(runPsql(`
      SELECT public.undo_timeline_atomic('${urProjectId}'::UUID, '${testUserId}'::UUID, 4::INTEGER);
    `).trim());
    assert(urUndoToA.version === 5, 'Undo B -> A: version incremented to 5');
    assert(urUndoToA.currentOperationIndex === 1, 'Undo B -> A: cursor moved to 1');
    assert(urUndoToA.tracks[0].items.length === 1, 'Undo B -> A: restored 1 item');

    // 3. Redo to B: expect version 6, cursor 2, 2 items
    const urRedoToB = JSON.parse(runPsql(`
      SELECT public.redo_timeline_atomic('${urProjectId}'::UUID, '${testUserId}'::UUID, 5::INTEGER);
    `).trim());
    assert(urRedoToB.version === 6, 'Redo A -> B: version incremented to 6');
    assert(urRedoToB.currentOperationIndex === 2, 'Redo A -> B: cursor moved to 2');
    assert(urRedoToB.tracks[0].items.length === 2, 'Redo A -> B: restored 2 items');

    // 4. Redo to C: expect version 7, cursor 3, 1 item
    const urRedoToC = JSON.parse(runPsql(`
      SELECT public.redo_timeline_atomic('${urProjectId}'::UUID, '${testUserId}'::UUID, 6::INTEGER);
    `).trim());
    assert(urRedoToC.version === 7, 'Redo B -> C: version incremented to 7');
    assert(urRedoToC.currentOperationIndex === 3, 'Redo B -> C: cursor moved to 3');
    assert(urRedoToC.tracks[0].items.length === 1, 'Redo B -> C: restored 1 item');

    // 5. Redo beyond C must throw NO_REDO_OPERATION
    let urRedoBeyondThrew = false;
    try {
      runPsql(`SELECT public.redo_timeline_atomic('${urProjectId}'::UUID, '${testUserId}'::UUID, 7::INTEGER);`);
    } catch (err: any) {
      urRedoBeyondThrew = true;
      assert(err.message.includes('NO_REDO_OPERATION'), 'PostgreSQL raises NO_REDO_OPERATION when no ops available');
    }
    assert(urRedoBeyondThrew, 'Redo beyond available ops rejected by PostgreSQL');

    // =============================================================
    // TEST 8: Real PostgreSQL Redo Branch Invalidation Gate
    // =============================================================
    console.log('\n--- Test 8: Real PostgreSQL Redo Branch Invalidation Gate ---');
    // Current state: C (version 7, cursor 3). Undo -> B (version 8, cursor 2).
    const urUndoAgainToB = JSON.parse(runPsql(`
      SELECT public.undo_timeline_atomic('${urProjectId}'::UUID, '${testUserId}'::UUID, 7::INTEGER);
    `).trim());
    assert(urUndoAgainToB.version === 8, 'Undo to B at version 8');
    assert(urUndoAgainToB.currentOperationIndex === 2, 'Cursor at 2');

    // Apply new Edit D: trim item instead of deleting
    const urTracksD = JSON.stringify([
      {
        id: urTrackId,
        type: 'video',
        index: 0,
        name: 'Video Track',
        items: [
          {
            id: urItem2AId,
            sourceMediaId: urMediaId,
            sourceStart: 2.0,
            sourceEnd: 15.0,
            timelineStart: 2.0,
            timelineEnd: 15.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);
    const urOpD = JSON.stringify({ type: 'trim', params: { itemId: urItem2AId, start: 2.0 } });

    const urResD = JSON.parse(runPsql(`
      SELECT public.save_timeline_atomic(
        '${urProjectId}'::UUID, '${testUserId}'::UUID, 8::INTEGER, 15.0::NUMERIC, '30fps'::TEXT,
        '${urTracksD.replace(/'/g, "''")}'::JSONB, '${urOpD.replace(/'/g, "''")}'::JSONB
      );
    `).trim());
    assert(urResD.version === 9, 'Edit D committed at version 9');
    assert(urResD.currentOperationIndex === 3, 'Cursor at 3 after Edit D');

    // Attempting Redo now MUST fail because the branch was invalidated
    let urInvalidatedRedoThrew = false;
    try {
      runPsql(`SELECT public.redo_timeline_atomic('${urProjectId}'::UUID, '${testUserId}'::UUID, 9::INTEGER);`);
    } catch (err: any) {
      urInvalidatedRedoThrew = true;
      assert(err.message.includes('NO_REDO_OPERATION'), 'PostgreSQL rejected redo on invalidated branch');
    }
    assert(urInvalidatedRedoThrew, 'Redo on invalidated branch threw error in PostgreSQL');

    // =============================================================
    // TEST 9: Real PostgreSQL Authorization & RBAC Gate (7 Cases)
    // =============================================================
    console.log('\n--- Test 9: Real PostgreSQL Authorization & RBAC Gate ---');
    const rbacWorkspaceId = ensureValidUuid();
    const rbacMediaId = ensureValidUuid();
    const rbacTrackId = ensureValidUuid();
    const rbacItemId = ensureValidUuid();

    const editorEmail = `editor_${editorUserId.slice(0, 8)}@example.com`;
    const viewerEmail = `viewer_${viewerUserId.slice(0, 8)}@example.com`;
    const unrelatedEmail = `unrelated_${unrelatedUserId.slice(0, 8)}@example.com`;
    const tenantBEmail = `tenantb_${tenantBUserId.slice(0, 8)}@example.com`;

    runPsql(`
      -- Owner profile
      INSERT INTO auth.users (id, email) VALUES ('${editorUserId}', '${editorEmail}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, full_name, role) VALUES ('${editorUserId}', '${editorEmail}', 'Editor User', 'editor') ON CONFLICT (id) DO NOTHING;

      INSERT INTO auth.users (id, email) VALUES ('${viewerUserId}', '${viewerEmail}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, full_name, role) VALUES ('${viewerUserId}', '${viewerEmail}', 'Viewer User', 'viewer') ON CONFLICT (id) DO NOTHING;

      INSERT INTO auth.users (id, email) VALUES ('${unrelatedUserId}', '${unrelatedEmail}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, full_name, role) VALUES ('${unrelatedUserId}', '${unrelatedEmail}', 'Unrelated User', 'editor') ON CONFLICT (id) DO NOTHING;

      INSERT INTO auth.users (id, email) VALUES ('${tenantBUserId}', '${tenantBEmail}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, full_name, role) VALUES ('${tenantBUserId}', '${tenantBEmail}', 'Tenant B', 'owner') ON CONFLICT (id) DO NOTHING;

      -- Workspace & Project
      INSERT INTO public.workspaces (id, name, owner_id) VALUES ('${rbacWorkspaceId}', 'RBAC Workspace', '${testUserId}') ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.projects (id, user_id, workspace_id, title, workflow_type, status)
      VALUES ('${rbacProjectId}', '${testUserId}', '${rbacWorkspaceId}', 'RBAC Project', 'youtube_to_shorts', 'created') ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${rbacMediaId}', '${rbacProjectId}', '${testUserId}', 'rbacVideo.mp4', 'https://cdn.example.com/rbacVideo.mp4', 'uploads/rbacVideo.mp4', 'video/mp4', 4096, 60.0, 'ready') ON CONFLICT (id) DO NOTHING;

      -- Workspace memberships
      INSERT INTO public.organization_members (workspace_id, user_id, email, name, role, status)
      VALUES ('${rbacWorkspaceId}', '${editorUserId}', '${editorEmail}', 'Editor User', 'EDITOR', 'active')
      ON CONFLICT (workspace_id, user_id) DO NOTHING;

      INSERT INTO public.organization_members (workspace_id, user_id, email, name, role, status)
      VALUES ('${rbacWorkspaceId}', '${viewerUserId}', '${viewerEmail}', 'Viewer User', 'VIEWER', 'active')
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
    `);

    const rbacTracks = JSON.stringify([
      {
        id: rbacTrackId,
        type: 'video',
        index: 0,
        name: 'Video Track',
        items: [
          {
            id: rbacItemId,
            sourceMediaId: rbacMediaId,
            sourceStart: 0.0,
            sourceEnd: 30.0,
            timelineStart: 0.0,
            timelineEnd: 30.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);
    const rbacOp = JSON.stringify({ type: 'create_timeline', params: { duration: 30.0 } });

    // 1. Owner Edit: Must Succeed
    const ownerRes = JSON.parse(runPsql(`
      SELECT public.save_timeline_atomic(
        '${rbacProjectId}'::UUID, '${testUserId}'::UUID, NULL::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
        '${rbacTracks.replace(/'/g, "''")}'::JSONB, '${rbacOp.replace(/'/g, "''")}'::JSONB
      );
    `).trim());
    assert(ownerRes.version === 1, 'RBAC 1: Owner successfully edited timeline (version 1)');

    // 2. Legitimate Editor Edit: Must Succeed
    const editorRes = JSON.parse(runPsql(`
      SELECT public.save_timeline_atomic(
        '${rbacProjectId}'::UUID, '${editorUserId}'::UUID, 1::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
        '${rbacTracks.replace(/'/g, "''")}'::JSONB, '${JSON.stringify({ type: 'trim' }).replace(/'/g, "''")}'::JSONB
      );
    `).trim());
    assert(editorRes.version === 2, 'RBAC 2: Legitimate workspace editor successfully edited timeline (version 2)');

    // 3. Viewer Edit: Must be strictly Rejected (42501)
    let viewerThrew = false;
    try {
      runPsql(`
        SELECT public.save_timeline_atomic(
          '${rbacProjectId}'::UUID, '${viewerUserId}'::UUID, 2::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
          '${rbacTracks.replace(/'/g, "''")}'::JSONB, NULL::JSONB
        );
      `);
    } catch (err: any) {
      viewerThrew = true;
      assert(err.message.includes('Viewer') && err.message.includes('not permitted'), 'Viewer mutation strictly rejected with FORBIDDEN');
    }
    assert(viewerThrew, 'RBAC 3: Viewer edit was rejected');

    // 4. Unrelated User Edit: Must be strictly Rejected (42501)
    let unrelatedThrew = false;
    try {
      runPsql(`
        SELECT public.save_timeline_atomic(
          '${rbacProjectId}'::UUID, '${unrelatedUserId}'::UUID, 2::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
          '${rbacTracks.replace(/'/g, "''")}'::JSONB, NULL::JSONB
        );
      `);
    } catch (err: any) {
      unrelatedThrew = true;
      assert(err.message.includes('not authorized to edit project'), 'Unrelated user mutation strictly rejected with FORBIDDEN');
    }
    assert(unrelatedThrew, 'RBAC 4: Unrelated user edit was rejected');

    // 5. Cross-Tenant Mutation: Tenant B mutating Tenant A project rejected (42501)
    let crossTenantThrew = false;
    try {
      runPsql(`
        SELECT public.save_timeline_atomic(
          '${rbacProjectId}'::UUID, '${tenantBUserId}'::UUID, 2::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
          '${rbacTracks.replace(/'/g, "''")}'::JSONB, NULL::JSONB
        );
      `);
    } catch (err: any) {
      crossTenantThrew = true;
      assert(err.message.includes('not authorized to edit project'), 'Cross-tenant mutation strictly rejected with FORBIDDEN');
    }
    assert(crossTenantThrew, 'RBAC 5: Cross-tenant mutation was rejected');

    // 6. Forged Project ID: Must throw PROJECT_NOT_FOUND (P0002)
    const forgedProjId = ensureValidUuid();
    let forgedProjThrew = false;
    try {
      runPsql(`
        SELECT public.save_timeline_atomic(
          '${forgedProjId}'::UUID, '${testUserId}'::UUID, 1::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
          '${rbacTracks.replace(/'/g, "''")}'::JSONB, NULL::JSONB
        );
      `);
    } catch (err: any) {
      forgedProjThrew = true;
      assert(err.message.includes('PROJECT_NOT_FOUND'), 'Forged project ID rejected with PROJECT_NOT_FOUND');
    }
    assert(forgedProjThrew, 'RBAC 6: Forged projectId was rejected');

    // 7. Forged User ID: Must throw FORBIDDEN (42501)
    const forgedUserId = ensureValidUuid();
    let forgedUserThrew = false;
    try {
      runPsql(`
        SELECT public.save_timeline_atomic(
          '${rbacProjectId}'::UUID, '${forgedUserId}'::UUID, 2::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
          '${rbacTracks.replace(/'/g, "''")}'::JSONB, NULL::JSONB
        );
      `);
    } catch (err: any) {
      forgedUserThrew = true;
      assert(err.message.includes('User') && err.message.includes('does not exist'), 'Forged user ID rejected with FORBIDDEN');
    }
    assert(forgedUserThrew, 'RBAC 7: Forged userId was rejected');

    // =============================================================
    // TEST 10: Real PostgreSQL Concurrency Race Gates
    // =============================================================
    console.log('\n--- Test 10: Real PostgreSQL Concurrency Race Gates ---');
    const raceMediaId = ensureValidUuid();
    const raceTrackId = ensureValidUuid();
    const raceItem1Id = ensureValidUuid();
    const raceItem2Id = ensureValidUuid();

    runPsql(`
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${raceProjectId}', '${testUserId}', 'Race Project', 'youtube_to_shorts', 'created') ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${raceMediaId}', '${raceProjectId}', '${testUserId}', 'raceVideo.mp4', 'https://cdn.example.com/raceVideo.mp4', 'uploads/raceVideo.mp4', 'video/mp4', 4096, 60.0, 'ready') ON CONFLICT (id) DO NOTHING;
    `);

    // Initialize race timeline at version 1
    const raceTracksInitial = JSON.stringify([
      {
        id: raceTrackId,
        type: 'video',
        index: 0,
        name: 'Video Track',
        items: [
          {
            id: raceItem1Id,
            sourceMediaId: raceMediaId,
            sourceStart: 0.0,
            sourceEnd: 30.0,
            timelineStart: 0.0,
            timelineEnd: 30.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);
    runPsql(`
      SELECT public.save_timeline_atomic(
        '${raceProjectId}'::UUID, '${testUserId}'::UUID, NULL::INTEGER, 30.0::NUMERIC, '30fps'::TEXT,
        '${raceTracksInitial.replace(/'/g, "''")}'::JSONB, '${JSON.stringify({ type: 'create_timeline' }).replace(/'/g, "''")}'::JSONB
      );
    `);

    // Race 1: Two workers perform different edits with the same expectedVersion = 1
    const raceTracksEdit1 = JSON.stringify([
      {
        id: raceTrackId,
        type: 'video',
        index: 0,
        name: 'Video Track',
        items: [
          {
            id: raceItem1Id,
            sourceMediaId: raceMediaId,
            sourceStart: 0.0,
            sourceEnd: 20.0,
            timelineStart: 0.0,
            timelineEnd: 20.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);
    const raceTracksEdit2 = JSON.stringify([
      {
        id: raceTrackId,
        type: 'video',
        index: 0,
        name: 'Video Track',
        items: [
          {
            id: raceItem1Id,
            sourceMediaId: raceMediaId,
            sourceStart: 5.0,
            sourceEnd: 30.0,
            timelineStart: 5.0,
            timelineEnd: 30.0,
            speed: 1.0,
            enabled: true,
          },
        ],
      },
    ]);

    const sqlWorker1 = `SELECT public.save_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, 1::INTEGER, 20.0::NUMERIC, '30fps'::TEXT, '${raceTracksEdit1.replace(/'/g, "''")}'::JSONB, '${JSON.stringify({ type: 'trim' }).replace(/'/g, "''")}'::JSONB);`;
    const sqlWorker2 = `SELECT public.save_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, 1::INTEGER, 25.0::NUMERIC, '30fps'::TEXT, '${raceTracksEdit2.replace(/'/g, "''")}'::JSONB, '${JSON.stringify({ type: 'trim' }).replace(/'/g, "''")}'::JSONB);`;

    const [raceRes1, raceRes2] = await Promise.all([
      execPsqlAsync(sqlWorker1),
      execPsqlAsync(sqlWorker2),
    ]);

    const successesRace1 = (raceRes1.exitCode === 0 ? 1 : 0) + (raceRes2.exitCode === 0 ? 1 : 0);
    const conflictsRace1 = (raceRes1.stderr.includes('TIMELINE_VERSION_CONFLICT') ? 1 : 0) +
                           (raceRes2.stderr.includes('TIMELINE_VERSION_CONFLICT') ? 1 : 0);

    assert(successesRace1 === 1, 'Race 1: Exactly one worker succeeded in concurrent write');
    assert(conflictsRace1 === 1, 'Race 1: Exactly one worker received TIMELINE_VERSION_CONFLICT');

    const raceVerAfter1 = runPsql(`SELECT version FROM public.timelines WHERE project_id = '${raceProjectId}';`).trim();
    assert(raceVerAfter1 === '2', 'Race 1: Timeline version incremented to exactly 2 (no lost update)');

    // Race 2: Undo vs Edit race at version 2
    const sqlUndoRace = `SELECT public.undo_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, 2::INTEGER);`;
    const sqlEditRace = `SELECT public.save_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, 2::INTEGER, 15.0::NUMERIC, '30fps'::TEXT, '${raceTracksEdit1.replace(/'/g, "''")}'::JSONB, '${JSON.stringify({ type: 'trim' }).replace(/'/g, "''")}'::JSONB);`;

    const [undoRaceRes, editRaceRes] = await Promise.all([
      execPsqlAsync(sqlUndoRace),
      execPsqlAsync(sqlEditRace),
    ]);

    const successesRace2 = (undoRaceRes.exitCode === 0 ? 1 : 0) + (editRaceRes.exitCode === 0 ? 1 : 0);
    const conflictsRace2 = (undoRaceRes.stderr.includes('TIMELINE_VERSION_CONFLICT') ? 1 : 0) +
                           (editRaceRes.stderr.includes('TIMELINE_VERSION_CONFLICT') ? 1 : 0);

    assert(successesRace2 === 1, 'Race 2: Exactly one operation succeeded in undo vs edit race');
    assert(conflictsRace2 === 1, 'Race 2: Exactly one operation received TIMELINE_VERSION_CONFLICT');

    // Setup for Redo vs Edit race:
    // First, add another edit so we have multiple operations, then undo once
    const curVerStr = runPsql(`SELECT version FROM public.timelines WHERE project_id = '${raceProjectId}';`).trim();
    const curVerNum = parseInt(curVerStr, 10);
    runPsql(`
      SELECT public.save_timeline_atomic(
        '${raceProjectId}'::UUID, '${testUserId}'::UUID, ${curVerNum}::INTEGER, 18.0::NUMERIC, '30fps'::TEXT,
        '${raceTracksEdit1.replace(/'/g, "''")}'::JSONB, '${JSON.stringify({ type: 'trim' }).replace(/'/g, "''")}'::JSONB
      );
    `);
    const afterExtraEditVer = parseInt(runPsql(`SELECT version FROM public.timelines WHERE project_id = '${raceProjectId}';`).trim(), 10);
    // Undo once
    runPsql(`SELECT public.undo_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, ${afterExtraEditVer}::INTEGER);`);
    const verBeforeRace3 = parseInt(runPsql(`SELECT version FROM public.timelines WHERE project_id = '${raceProjectId}';`).trim(), 10);

    // Race 3: Redo vs Edit race
    const sqlRedoRace = `SELECT public.redo_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, ${verBeforeRace3}::INTEGER);`;
    const sqlEditRace3 = `SELECT public.save_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, ${verBeforeRace3}::INTEGER, 12.0::NUMERIC, '30fps'::TEXT, '${raceTracksEdit2.replace(/'/g, "''")}'::JSONB, '${JSON.stringify({ type: 'split' }).replace(/'/g, "''")}'::JSONB);`;

    const [redoRaceRes, editRace3Res] = await Promise.all([
      execPsqlAsync(sqlRedoRace),
      execPsqlAsync(sqlEditRace3),
    ]);

    const successesRace3 = (redoRaceRes.exitCode === 0 ? 1 : 0) + (editRace3Res.exitCode === 0 ? 1 : 0);
    const conflictsRace3 = (redoRaceRes.stderr.includes('TIMELINE_VERSION_CONFLICT') ? 1 : 0) +
                           (editRace3Res.stderr.includes('TIMELINE_VERSION_CONFLICT') ? 1 : 0);

    assert(successesRace3 === 1, 'Race 3: Exactly one operation succeeded in redo vs edit race');
    assert(conflictsRace3 === 1, 'Race 3: Exactly one operation received TIMELINE_VERSION_CONFLICT');

    // Race 4: Two simultaneous undo operations
    // Ensure we have operations to undo: add 2 edits first
    const verBeforeRace4 = parseInt(runPsql(`SELECT version FROM public.timelines WHERE project_id = '${raceProjectId}';`).trim(), 10);
    runPsql(`
      SELECT public.save_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, ${verBeforeRace4}::INTEGER, 20.0::NUMERIC, '30fps'::TEXT, '${raceTracksEdit1.replace(/'/g, "''")}'::JSONB, '${JSON.stringify({ type: 'split' }).replace(/'/g, "''")}'::JSONB);
    `);
    const verBeforeSimulUndo = parseInt(runPsql(`SELECT version FROM public.timelines WHERE project_id = '${raceProjectId}';`).trim(), 10);

    const sqlUndo1 = `SELECT public.undo_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, ${verBeforeSimulUndo}::INTEGER);`;
    const sqlUndo2 = `SELECT public.undo_timeline_atomic('${raceProjectId}'::UUID, '${testUserId}'::UUID, ${verBeforeSimulUndo}::INTEGER);`;

    const [simulUndo1Res, simulUndo2Res] = await Promise.all([
      execPsqlAsync(sqlUndo1),
      execPsqlAsync(sqlUndo2),
    ]);

    const successesRace4 = (simulUndo1Res.exitCode === 0 ? 1 : 0) + (simulUndo2Res.exitCode === 0 ? 1 : 0);
    const conflictsRace4 = (simulUndo1Res.stderr.includes('TIMELINE_VERSION_CONFLICT') ? 1 : 0) +
                           (simulUndo2Res.stderr.includes('TIMELINE_VERSION_CONFLICT') ? 1 : 0);

    assert(successesRace4 === 1, 'Race 4: Exactly one operation succeeded in concurrent undo race');
    assert(conflictsRace4 === 1, 'Race 4: Exactly one operation received TIMELINE_VERSION_CONFLICT');

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
        DELETE FROM public.organization_members WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = '${testUserId}');
        DELETE FROM public.timeline_operations WHERE timeline_id IN (SELECT id FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}', '${urProjectId}', '${rbacProjectId}', '${raceProjectId}'));
        DELETE FROM public.timeline_items WHERE track_id IN (SELECT id FROM public.tracks WHERE timeline_id IN (SELECT id FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}', '${urProjectId}', '${rbacProjectId}', '${raceProjectId}')));
        DELETE FROM public.tracks WHERE timeline_id IN (SELECT id FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}', '${urProjectId}', '${rbacProjectId}', '${raceProjectId}'));
        DELETE FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}', '${urProjectId}', '${rbacProjectId}', '${raceProjectId}');
        DELETE FROM public.media_assets WHERE project_id IN ('${projectAId}', '${projectBId}', '${urProjectId}', '${rbacProjectId}', '${raceProjectId}');
        DELETE FROM public.projects WHERE id IN ('${projectAId}', '${projectBId}', '${urProjectId}', '${rbacProjectId}', '${raceProjectId}');
        DELETE FROM public.workspaces WHERE owner_id = '${testUserId}';
        DELETE FROM public.profiles WHERE id IN ('${testUserId}', '${editorUserId}', '${viewerUserId}', '${unrelatedUserId}', '${tenantBUserId}');
        DELETE FROM auth.users WHERE id IN ('${testUserId}', '${editorUserId}', '${viewerUserId}', '${unrelatedUserId}', '${tenantBUserId}');
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
