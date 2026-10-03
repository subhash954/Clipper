/**
 * CLIPPER PHASE 4.5: REAL POSTGRESQL INTEGRATION TEST SUITE
 * Stale-Worker Write Protection, Fencing, and Atomic Commit Ownership Gate
 *
 * Requirements:
 * 1. Must execute against real PostgreSQL (fails immediately if DB unreachable).
 * 2. Scenario 10: Stale Worker A Race Test (superseded lease rejected, Transcript B remains canonical).
 * 3. Scenario 11: Active Lease Test (active lease commits successfully, canonical parent preserved).
 * 4. Scenario 12: Wrong Token Test (fraudulent token rejected, transcript unmutated).
 * 5. Scenario 13: Expired Token Test (expired lease rejected, transcript unmutated).
 * 6. Scenario 14: Concurrent Commit Test (single authoritative writer, zero duplicates).
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
console.log('CLIPPER PHASE 4.5: REAL POSTGRESQL INTEGRATION GATE');
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

async function runAllTests() {
  const testUserId = ensureValidUuid();
  const testEmail = `pgtest_${testUserId}@example.com`;
  const testProjectId = ensureValidUuid();
  const testMediaId = ensureValidUuid();
  const initialTranscriptId = ensureValidUuid();
  const lockKey = `${testProjectId}:${testMediaId}:deepgram:nova-2:exact_word`;

  try {
    // -------------------------------------------------------------
    // Setup Shared Test Fixtures in Real PostgreSQL
    // -------------------------------------------------------------
    runPsql(`
      INSERT INTO auth.users (id, email) VALUES ('${testUserId}', '${testEmail}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.profiles (id, email, full_name) VALUES ('${testUserId}', '${testEmail}', 'PG 4.5 Tester') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.projects (id, user_id, title, workflow_type, status) VALUES ('${testProjectId}', '${testUserId}', 'PG 4.5 Project', 'youtube_to_shorts', 'created') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${testMediaId}', '${testProjectId}', '${testUserId}', 'source.mp4', 'https://cdn.example.com/source.mp4', 'uploads/source.mp4', 'video/mp4', 2048, 12.0, 'ready') ON CONFLICT (id) DO NOTHING;
    `);

    // =============================================================
    // TEST 1: ACTIVE LEASE TEST (Scenario 11)
    // =============================================================
    console.log('\n--- Scenario 11: Active Lease Test ---');
    const leaseTokenA = ensureValidUuid();
    const segA1Id = ensureValidUuid();
    const wordA1Id = ensureValidUuid();

    // Acquire Lease A
    runPsql(`
      INSERT INTO public.transcription_locks (
        lock_key, lease_token, project_id, media_asset_id, user_id, provider, model, timing_precision, status, expires_at
      ) VALUES (
        '${lockKey}', '${leaseTokenA}', '${testProjectId}', '${testMediaId}', '${testUserId}', 'deepgram', 'nova-2', 'exact_word', 'in_progress', NOW() + INTERVAL '60 seconds'
      ) ON CONFLICT (lock_key) DO UPDATE SET
        lease_token = EXCLUDED.lease_token,
        lease_generation = nextval('public.transcription_lease_generation_seq'),
        expires_at = EXCLUDED.expires_at;
    `);

    const rpcResultA = runPsql(`
      SELECT public.replace_transcript_atomic(
        '${testUserId}'::UUID,
        '${initialTranscriptId}'::UUID,
        '${testProjectId}'::UUID,
        '${testMediaId}'::UUID,
        'Initial Transcript A Text',
        '[]'::jsonb,
        '[]'::jsonb,
        'en',
        'deepgram',
        'exact_word',
        'Deepgram Nova-2 Word-Level Alignment',
        'deepgram',
        'nova-2',
        12.0,
        'completed',
        NULL,
        '{}'::jsonb,
        '[{"id": "${segA1Id}", "segment_index": 0, "start_time": 0.0, "end_time": 6.0, "text": "Initial Transcript A Text"}]'::jsonb,
        '[{"id": "${wordA1Id}", "segment_id": "${segA1Id}", "word_index": 0, "word": "Initial", "start_time": 0.0, "end_time": 2.500}]'::jsonb,
        '${leaseTokenA}'::UUID,
        '${lockKey}'::TEXT
      );
    `).trim();

    assert(rpcResultA.includes(initialTranscriptId), 'Active lease commit succeeds and returns canonical transcript ID');

    // Verify database state directly
    const rowA = runPsql(`
      SELECT id, transcript_text, timing_label, duration FROM public.transcripts WHERE project_id = '${testProjectId}';
    `).trim();
    assert(rowA.includes(initialTranscriptId), 'Canonical transcript record created with initial parent ID');
    assert(rowA.includes('Initial Transcript A Text'), 'Transcript text persisted correctly');
    assert(rowA.includes('Deepgram Nova-2 Word-Level Alignment'), 'timing_label persisted correctly');

    const projStatusA = runPsql(`
      SELECT status, active_media_id FROM public.projects WHERE id = '${testProjectId}';
    `).trim();
    assert(projStatusA.includes('transcript_ready'), 'Atomic commit transitions project status to transcript_ready');
    assert(projStatusA.includes(testMediaId), 'Atomic commit sets active_media_id on project');

    // =============================================================
    // TEST 2: WRONG TOKEN TEST (Scenario 12)
    // =============================================================
    console.log('\n--- Scenario 12: Wrong Token Test ---');
    const fraudulentToken = ensureValidUuid();
    let wrongTokenRejected = false;
    try {
      runPsql(`
        SELECT public.replace_transcript_atomic(
          '${testUserId}'::UUID,
          '${ensureValidUuid()}'::UUID,
          '${testProjectId}'::UUID,
          '${testMediaId}'::UUID,
          'Fraudulent Overwrite Attempt',
          '[]'::jsonb,
          '[]'::jsonb,
          'en',
          'deepgram',
          'exact_word',
          'Deepgram Nova-2 Word-Level Alignment',
          'deepgram',
          'nova-2',
          12.0,
          'completed',
          NULL,
          '{}'::jsonb,
          '[]'::jsonb,
          '[]'::jsonb,
          '${fraudulentToken}'::UUID,
          '${lockKey}'::TEXT
        );
      `);
    } catch (err: any) {
      wrongTokenRejected = true;
    }
    assert(wrongTokenRejected, 'Database strictly rejects commit attempt with fraudulent lease token');

    const rowAfterWrongToken = runPsql(`
      SELECT transcript_text FROM public.transcripts WHERE project_id = '${testProjectId}';
    `).trim();
    assert(
      rowAfterWrongToken.includes('Initial Transcript A Text'),
      'Canonical transcript remains completely unmutated after rejected wrong token commit'
    );

    // =============================================================
    // TEST 3: EXPIRED TOKEN TEST (Scenario 13)
    // =============================================================
    console.log('\n--- Scenario 13: Expired Token Test ---');
    // Expire the lease in the database
    runPsql(`
      UPDATE public.transcription_locks
      SET expires_at = NOW() - INTERVAL '10 seconds'
      WHERE lock_key = '${lockKey}';
    `);

    let expiredTokenRejected = false;
    try {
      runPsql(`
        SELECT public.replace_transcript_atomic(
          '${testUserId}'::UUID,
          '${ensureValidUuid()}'::UUID,
          '${testProjectId}'::UUID,
          '${testMediaId}'::UUID,
          'Expired Lease Overwrite Attempt',
          '[]'::jsonb,
          '[]'::jsonb,
          'en',
          'deepgram',
          'exact_word',
          'Deepgram Nova-2 Word-Level Alignment',
          'deepgram',
          'nova-2',
          12.0,
          'completed',
          NULL,
          '{}'::jsonb,
          '[]'::jsonb,
          '[]'::jsonb,
          '${leaseTokenA}'::UUID,
          '${lockKey}'::TEXT
        );
      `);
    } catch (err: any) {
      expiredTokenRejected = true;
    }
    assert(expiredTokenRejected, 'Database strictly rejects commit attempt with expired lease');

    const rowAfterExpiredToken = runPsql(`
      SELECT transcript_text FROM public.transcripts WHERE project_id = '${testProjectId}';
    `).trim();
    assert(
      rowAfterExpiredToken.includes('Initial Transcript A Text'),
      'Canonical transcript remains completely unmutated after rejected expired lease commit'
    );

    // =============================================================
    // TEST 4: STALE WORKER RACE TEST (Scenario 10)
    // =============================================================
    console.log('\n--- Scenario 10: Real PostgreSQL Race Test (Worker A Stale vs Worker B Fresh) ---');
    // Step 1: Worker A acquired lease A (already expired above)
    // Step 2: Worker B acquires lease B with new lease token and new generation
    const leaseTokenB = ensureValidUuid();
    const temporaryTranscriptBId = ensureValidUuid();
    const segB1Id = ensureValidUuid();
    const wordB1Id = ensureValidUuid();

    runPsql(`
      INSERT INTO public.transcription_locks (
        lock_key, lease_token, project_id, media_asset_id, user_id, provider, model, timing_precision, status, expires_at
      ) VALUES (
        '${lockKey}', '${leaseTokenB}', '${testProjectId}', '${testMediaId}', '${testUserId}', 'deepgram', 'nova-2', 'exact_word', 'in_progress', NOW() + INTERVAL '60 seconds'
      ) ON CONFLICT (lock_key) DO UPDATE SET
        lease_token = EXCLUDED.lease_token,
        lease_generation = nextval('public.transcription_lease_generation_seq'),
        expires_at = EXCLUDED.expires_at;
    `);

    // Step 3: Worker B commits Transcript B
    const rpcResultB = runPsql(`
      SELECT public.replace_transcript_atomic(
        '${testUserId}'::UUID,
        '${temporaryTranscriptBId}'::UUID,
        '${testProjectId}'::UUID,
        '${testMediaId}'::UUID,
        'Transcript B Canonical Winner',
        '[]'::jsonb,
        '[]'::jsonb,
        'en',
        'deepgram',
        'exact_word',
        'Deepgram Nova-2 Word-Level Alignment',
        'deepgram',
        'nova-2',
        15.500,
        'completed',
        NULL,
        '{}'::jsonb,
        '[{"id": "${segB1Id}", "segment_index": 0, "start_time": 0.0, "end_time": 15.500, "text": "Transcript B Canonical Winner"}]'::jsonb,
        '[{"id": "${wordB1Id}", "segment_id": "${segB1Id}", "word_index": 0, "word": "Winner", "start_time": 1.237, "end_time": 1.999}]'::jsonb,
        '${leaseTokenB}'::UUID,
        '${lockKey}'::TEXT
      );
    `).trim();

    assert(
      rpcResultB.includes(initialTranscriptId),
      'Worker B commit preserves canonical parent transcript ID (does NOT adopt temporary ID)'
    );

    // Verify Transcript B is now canonical
    const rowB = runPsql(`
      SELECT id, transcript_text FROM public.transcripts WHERE project_id = '${testProjectId}';
    `).trim();
    assert(rowB.includes(initialTranscriptId), 'Canonical parent transcript ID intact');
    assert(rowB.includes('Transcript B Canonical Winner'), 'Transcript text updated to Version B');

    // Step 4: Worker A resumes and attempts to commit Transcript A using stale leaseTokenA
    const staleSegAId = ensureValidUuid();
    const staleWordAId = ensureValidUuid();
    let staleWorkerARejected = false;
    try {
      runPsql(`
        SELECT public.replace_transcript_atomic(
          '${testUserId}'::UUID,
          '${ensureValidUuid()}'::UUID,
          '${testProjectId}'::UUID,
          '${testMediaId}'::UUID,
          'Stale Worker A Attempted Write',
          '[]'::jsonb,
          '[]'::jsonb,
          'en',
          'deepgram',
          'exact_word',
          'Deepgram Nova-2 Word-Level Alignment',
          'deepgram',
          'nova-2',
          10.0,
          'completed',
          NULL,
          '{}'::jsonb,
          '[{"id": "${staleSegAId}", "segment_index": 0, "start_time": 0.0, "end_time": 10.0, "text": "Stale Segment"}]'::jsonb,
          '[{"id": "${staleWordAId}", "segment_id": "${staleSegAId}", "word_index": 0, "word": "Stale", "start_time": 0.0, "end_time": 1.0}]'::jsonb,
          '${leaseTokenA}'::UUID,
          '${lockKey}'::TEXT
        );
      `);
    } catch (staleErr: any) {
      staleWorkerARejected = true;
    }
    assert(staleWorkerARejected, 'Database strictly REJECTS Stale Worker A write attempt');

    // Step 5: Verify CANONICAL TRUTH remains Transcript B
    const verifyPostRaceTranscript = runPsql(`
      SELECT id, transcript_text, duration FROM public.transcripts WHERE project_id = '${testProjectId}';
    `).trim();
    assert(
      verifyPostRaceTranscript.includes('Transcript B Canonical Winner'),
      'Canonical transcript text strictly remains Transcript B'
    );
    assert(
      !verifyPostRaceTranscript.includes('Stale Worker A Attempted Write'),
      'Stale Worker A text was NOT written'
    );
    assert(
      verifyPostRaceTranscript.includes(initialTranscriptId),
      'Canonical parent transcript ID unchanged'
    );

    // Step 6: Verify child rows belong strictly to B
    const verifyPostRaceSegments = runPsql(`
      SELECT id FROM public.transcript_segments WHERE transcript_id = '${initialTranscriptId}';
    `).trim();
    assert(verifyPostRaceSegments.includes(segB1Id), "Worker B's segment remains intact");
    assert(!verifyPostRaceSegments.includes(staleSegAId), "Stale Worker A's segment was NOT inserted");

    const verifyPostRaceWords = runPsql(`
      SELECT id FROM public.transcript_words WHERE transcript_id = '${initialTranscriptId}';
    `).trim();
    assert(verifyPostRaceWords.includes(wordB1Id), "Worker B's word remains intact");
    assert(!verifyPostRaceWords.includes(staleWordAId), "Stale Worker A's word was NOT inserted");

    // Step 7: Verify project state is transcript_ready
    const finalProjState = runPsql(`
      SELECT status FROM public.projects WHERE id = '${testProjectId}';
    `).trim();
    assert(finalProjState.includes('transcript_ready'), 'Project status remains valid transcript_ready');

    // =============================================================
    // TEST 5: CONCURRENT COMMIT RACE (Scenario 14)
    // =============================================================
    console.log('\n--- Scenario 14: Concurrent Commit Race Test ---');
    // Lock belongs to Token B. Token C attempts concurrent write without having lease.
    const tokenC = ensureValidUuid();
    let tokenCRejected = false;
    try {
      runPsql(`
        SELECT public.replace_transcript_atomic(
          '${testUserId}'::UUID,
          '${ensureValidUuid()}'::UUID,
          '${testProjectId}'::UUID,
          '${testMediaId}'::UUID,
          'Worker C Unauthorized Commit',
          '[]'::jsonb,
          '[]'::jsonb,
          'en',
          'deepgram',
          'exact_word',
          'Deepgram Nova-2 Word-Level Alignment',
          'deepgram',
          'nova-2',
          15.5,
          'completed',
          NULL,
          '{}'::jsonb,
          '[]'::jsonb,
          '[]'::jsonb,
          '${tokenC}'::UUID,
          '${lockKey}'::TEXT
        );
      `);
    } catch (err: any) {
      tokenCRejected = true;
    }
    assert(tokenCRejected, 'Concurrent unauthorized worker strictly rejected');

    const singleTranscriptCount = runPsql(`
      SELECT COUNT(*)::text FROM public.transcripts WHERE project_id = '${testProjectId}';
    `).trim();
    assert(singleTranscriptCount === '1', 'Exactly one canonical transcript exists for the project (no duplicates)');

    // =============================================================
    // TEST 5: PHASE 4.6 STATE-WRITE FENCING (Scenario 15 & 16)
    // =============================================================
    console.log('\n--- Scenario 15: Stale Worker Cannot Transition Project Status to Transcribing ---');
    const staleTranscribeToken = ensureValidUuid();
    // Simulate expired lock for stale worker
    runPsql(`
      UPDATE public.transcription_locks
      SET expires_at = NOW() - INTERVAL '5 seconds',
          lease_token = '${staleTranscribeToken}'
      WHERE lock_key = '${lockKey}';
    `);

    // Stale worker attempts to transition project status to 'transcribing'
    const staleTranscribeResult = runPsql(`
      SELECT public.update_project_status_if_lease_held(
        '${testProjectId}'::UUID,
        '${lockKey}'::TEXT,
        '${staleTranscribeToken}'::UUID,
        'transcribing'::TEXT
      )::TEXT;
    `).trim();
    assert(staleTranscribeResult === 'false', 'Database strictly rejects stale worker transition to transcribing');

    const verifyStatusNotTranscribing = runPsql(`
      SELECT status FROM public.projects WHERE id = '${testProjectId}';
    `).trim();
    assert(verifyStatusNotTranscribing === 'transcript_ready', 'Project status remains transcript_ready');

    console.log('\n--- Scenario 16: Un-Leased / Fraudulent Worker Cannot Transition Project Status to Failed ---');
    const fakeToken = ensureValidUuid();
    const fakeFailResult = runPsql(`
      SELECT public.update_project_status_if_lease_held(
        '${testProjectId}'::UUID,
        '${lockKey}'::TEXT,
        '${fakeToken}'::UUID,
        'failed'::TEXT,
        'Fake error'::TEXT
      )::TEXT;
    `).trim();
    assert(fakeFailResult === 'false', 'Database strictly rejects un-leased worker transition to failed');

    const verifyStatusNotFailed = runPsql(`
      SELECT status FROM public.projects WHERE id = '${testProjectId}';
    `).trim();
    assert(verifyStatusNotFailed === 'transcript_ready', 'Project status protected: remains transcript_ready');

    // Valid lease holder can update status
    const validToken = ensureValidUuid();
    runPsql(`
      UPDATE public.transcription_locks
      SET expires_at = NOW() + INTERVAL '60 seconds',
          lease_token = '${validToken}'
      WHERE lock_key = '${lockKey}';
    `);
    const validUpdateResult = runPsql(`
      SELECT public.update_project_status_if_lease_held(
        '${testProjectId}'::UUID,
        '${lockKey}'::TEXT,
        '${validToken}'::UUID,
        'completed'::TEXT
      )::TEXT;
    `).trim();
    assert(validUpdateResult === 'true', 'Valid lease holder successfully updates project status');

    const verifyStatusCompleted = runPsql(`
      SELECT status FROM public.projects WHERE id = '${testProjectId}';
    `).trim();
    assert(verifyStatusCompleted === 'completed', 'Project status successfully transitioned to completed');

    // -------------------------------------------------------------
    // Cleanup Test Data Cleanly
    // -------------------------------------------------------------
    runPsql(`
      DELETE FROM public.transcription_locks WHERE lock_key = '${lockKey}';
      DELETE FROM public.transcripts WHERE project_id = '${testProjectId}';
      DELETE FROM public.media_assets WHERE id = '${testMediaId}';
      DELETE FROM public.projects WHERE id = '${testProjectId}';
      DELETE FROM public.profiles WHERE id = '${testUserId}';
      DELETE FROM auth.users WHERE id = '${testUserId}';
    `);
    console.log('✓ Cleaned up test fixtures');

  } catch (testErr: any) {
    console.error('\nTest execution failed:', testErr);
    // Cleanup on error
    try {
      runPsql(`
        DELETE FROM public.transcription_locks WHERE lock_key = '${lockKey}';
        DELETE FROM public.transcripts WHERE project_id = '${testProjectId}';
        DELETE FROM public.media_assets WHERE id = '${testMediaId}';
        DELETE FROM public.projects WHERE id = '${testProjectId}';
        DELETE FROM public.profiles WHERE id = '${testUserId}';
        DELETE FROM auth.users WHERE id = '${testUserId}';
      `);
    } catch {}
    console.log('\n====================================================');
    console.log(`REAL POSTGRESQL TESTS: FAILED (${passed} PASSED, ${failed + 1} FAILED)`);
    console.log('====================================================');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log(`REAL POSTGRESQL TESTS: PASSED (${passed} PASSED, 0 FAILED)`);
  console.log('====================================================');
}

runAllTests();
