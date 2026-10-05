/**
 * CLIPPER PHASE 7: REAL POSTGRESQL INTEGRATION TEST SUITE
 * Database Integrity, Check Constraints, RBAC, Tenant Isolation & Atomic RPCs
 *
 * Requirements:
 * 1. Must execute against real PostgreSQL (fails immediately if DB unreachable).
 * 2. Scenario 1: save_caption_track_atomic RPC (Owner/Editor success, cues + words persistence)
 * 3. Scenario 2: Versioning & Multi-Version History (v1 and v2 coexist)
 * 4. Scenario 3: RBAC Security Gates (Viewer rejected 42501, Unrelated rejected 42501, Missing project P0002)
 * 5. Scenario 4: Cross-Project Media & Transcript Integrity Gate (CROSS_PROJECT_FORBIDDEN 42501)
 * 6. Scenario 5: Database Check Constraints (version >= 1, source enum, timing bounds, confidence range)
 * 7. Scenario 6: Cascading Deletions & SET NULL constraints (project cascade, track cascade, transcript SET NULL)
 * 8. Scenario 7: RLS Direct Access Verification (anon role blocked on tracks, cues, words)
 * 9. Scenario 8: Timeline Operations Constraint (add_caption, change_caption, set_caption_style)
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
console.log('CLIPPER PHASE 7: REAL POSTGRESQL INTEGRATION GATE');
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

async function runPhase7PostgresTests() {
  const ownerUserId = ensureValidUuid();
  const editorUserId = ensureValidUuid();
  const viewerUserId = ensureValidUuid();
  const unrelatedUserId = ensureValidUuid();
  const tenantBUserId = ensureValidUuid();

  const ownerEmail = `pg7_owner_${ownerUserId}@example.com`;
  const editorEmail = `pg7_editor_${editorUserId}@example.com`;
  const viewerEmail = `pg7_viewer_${viewerUserId}@example.com`;
  const unrelatedEmail = `pg7_unrelated_${unrelatedUserId}@example.com`;
  const tenantBEmail = `pg7_tenantb_${tenantBUserId}@example.com`;

  const projectAId = ensureValidUuid();
  const projectBId = ensureValidUuid();
  const workspaceAId = ensureValidUuid();
  const mediaAId = ensureValidUuid();
  const mediaBId = ensureValidUuid();
  const transcriptAId = ensureValidUuid();
  const transcriptBId = ensureValidUuid();

  try {
    // -------------------------------------------------------------
    // Setup Shared Test Fixtures in Real PostgreSQL
    // -------------------------------------------------------------
    console.log('\n--- Setup Test Fixtures ---');
    runPsql(`
      INSERT INTO auth.users (id, email) VALUES
        ('${ownerUserId}', '${ownerEmail}'),
        ('${editorUserId}', '${editorEmail}'),
        ('${viewerUserId}', '${viewerEmail}'),
        ('${unrelatedUserId}', '${unrelatedEmail}'),
        ('${tenantBUserId}', '${tenantBEmail}')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.profiles (id, email, full_name, role) VALUES
        ('${ownerUserId}', '${ownerEmail}', 'Phase 7 Owner', 'owner'),
        ('${editorUserId}', '${editorEmail}', 'Phase 7 Editor', 'editor'),
        ('${viewerUserId}', '${viewerEmail}', 'Phase 7 Viewer', 'viewer'),
        ('${unrelatedUserId}', '${unrelatedEmail}', 'Phase 7 Unrelated', 'editor'),
        ('${tenantBUserId}', '${tenantBEmail}', 'Phase 7 Tenant B', 'owner')
      ON CONFLICT (id) DO NOTHING;

      -- Workspace A (Owned by ownerUserId)
      INSERT INTO public.workspaces (id, owner_id, name)
      VALUES ('${workspaceAId}', '${ownerUserId}', 'Phase 7 Workspace A')
      ON CONFLICT (id) DO NOTHING;

      -- Workspace memberships for Project A
      INSERT INTO public.organization_members (workspace_id, user_id, email, name, role, status)
      VALUES ('${workspaceAId}', '${editorUserId}', '${editorEmail}', 'Phase 7 Editor', 'EDITOR', 'active')
      ON CONFLICT (workspace_id, user_id) DO NOTHING;

      INSERT INTO public.organization_members (workspace_id, user_id, email, name, role, status)
      VALUES ('${workspaceAId}', '${viewerUserId}', '${viewerEmail}', 'Phase 7 Viewer', 'VIEWER', 'active')
      ON CONFLICT (workspace_id, user_id) DO NOTHING;

      -- Project A (Owned by ownerUserId with workspaceAId)
      INSERT INTO public.projects (id, user_id, workspace_id, title, workflow_type, status)
      VALUES ('${projectAId}', '${ownerUserId}', '${workspaceAId}', 'Caption Project A', 'youtube_to_shorts', 'created')
      ON CONFLICT (id) DO NOTHING;

      -- Media Asset A (belongs to Project A)
      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${mediaAId}', '${projectAId}', '${ownerUserId}', 'videoA.mp4', 'https://cdn.example.com/videoA.mp4', 'uploads/videoA.mp4', 'video/mp4', 8192, 60.0, 'ready')
      ON CONFLICT (id) DO NOTHING;

      -- Transcript A (belongs to Project A)
      INSERT INTO public.transcripts (id, project_id, media_asset_id, status, language, transcript_text, duration)
      VALUES ('${transcriptAId}', '${projectAId}', '${mediaAId}', 'completed', 'en', 'Welcome to Clipper', 60.0)
      ON CONFLICT (id) DO NOTHING;

      -- Project B (Owned by tenantBUserId)
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${projectBId}', '${tenantBUserId}', 'Caption Project B', 'youtube_to_shorts', 'created')
      ON CONFLICT (id) DO NOTHING;

      -- Media Asset B (belongs to Project B)
      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${mediaBId}', '${projectBId}', '${tenantBUserId}', 'videoB.mp4', 'https://cdn.example.com/videoB.mp4', 'uploads/videoB.mp4', 'video/mp4', 8192, 45.0, 'ready')
      ON CONFLICT (id) DO NOTHING;

      -- Transcript B (belongs to Project B)
      INSERT INTO public.transcripts (id, project_id, media_asset_id, status, language, transcript_text, duration)
      VALUES ('${transcriptBId}', '${projectBId}', '${mediaBId}', 'completed', 'en', 'Welcome to other project', 45.0)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✓ Projects, Users, Profiles, Transcripts & Media Assets created in PostgreSQL');

    // =============================================================
    // SCENARIO 1: save_caption_track_atomic RPC
    // =============================================================
    console.log('\n--- Scenario 1: save_caption_track_atomic RPC ---');

    const track1Id = ensureValidUuid();
    const cue1Id = ensureValidUuid();
    const word1Id = ensureValidUuid();
    const word2Id = ensureValidUuid();
    const word3Id = ensureValidUuid();

    const sampleCues = JSON.stringify([
      {
        id: cue1Id,
        sequence: 1,
        start: 0.5,
        end: 2.8,
        text: 'Welcome to Clipper',
        speakerId: 'spk-1',
        style: { fontSize: 48, primaryColor: '#FFFFFF' },
        language: 'en',
        words: [
          { id: word1Id, wordIndex: 0, word: 'Welcome', start: 0.5, end: 1.0, confidence: 0.98, highlighted: true },
          { id: word2Id, wordIndex: 1, word: 'to', start: 1.05, end: 1.3, confidence: 0.95, highlighted: false },
          { id: word3Id, wordIndex: 2, word: 'Clipper', start: 1.35, end: 2.8, confidence: 0.99, highlighted: false },
        ],
      },
    ]);

    const resTrack1 = runPsql(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        '${track1Id}'::UUID,
        '${transcriptAId}'::UUID,
        '${mediaAId}'::UUID,
        'en'::TEXT,
        1::INTEGER,
        'generated'::TEXT,
        '{"preset":"impact"}'::JSONB,
        2.8::NUMERIC,
        '{"generator":"deepgram"}'::JSONB,
        '${sampleCues.replace(/'/g, "''")}'::JSONB
      );
    `);

    const jsonTrack1 = JSON.parse(resTrack1.trim());
    assert(jsonTrack1.id === track1Id, 'Caption track saved with matching UUID');
    assert(jsonTrack1.projectId === projectAId, 'Caption track saved with correct project ID');
    assert(jsonTrack1.transcriptId === transcriptAId, 'Caption track saved with correct transcript ID');
    assert(jsonTrack1.mediaAssetId === mediaAId, 'Caption track saved with correct media asset ID');
    assert(jsonTrack1.version === 1, 'Caption track saved with version 1');
    assert(jsonTrack1.cuesCount === 1, 'Caption track cuesCount is 1');

    // Verify row directly in PostgreSQL tables
    const dbTrack = JSON.parse(runPsql(`
      SELECT row_to_json(t) FROM (
        SELECT id, project_id, transcript_id, cues_count, version, source, status
        FROM public.caption_tracks WHERE id = '${track1Id}'
      ) t;
    `).trim());
    assert(dbTrack.id === track1Id, 'Verified caption track row exists in public.caption_tracks');
    assert(dbTrack.cues_count === 1, 'Verified cues_count = 1 in public.caption_tracks');

    const dbCue = JSON.parse(runPsql(`
      SELECT row_to_json(c) FROM (
        SELECT id, track_id, sequence, start_time, end_time, text, speaker_id
        FROM public.caption_cues WHERE id = '${cue1Id}'
      ) c;
    `).trim());
    assert(dbCue.id === cue1Id, 'Verified cue row exists in public.caption_cues');
    assert(dbCue.track_id === track1Id, 'Verified cue foreign key track_id points to track1Id');
    assert(dbCue.text === 'Welcome to Clipper', 'Verified cue text matches in DB');

    const dbWordsCount = runPsql(`
      SELECT count(*) FROM public.caption_words WHERE cue_id = '${cue1Id}';
    `).trim();
    assert(Number(dbWordsCount) === 3, 'Verified 3 word rows created in public.caption_words for cue');

    const dbFirstWord = JSON.parse(runPsql(`
      SELECT row_to_json(w) FROM (
        SELECT id, cue_id, track_id, word_index, word, confidence, highlighted
        FROM public.caption_words WHERE id = '${word1Id}'
      ) w;
    `).trim());
    assert(dbFirstWord.word === 'Welcome', 'First word text is Welcome');
    assert(Number(dbFirstWord.confidence) === 0.98, 'Confidence correctly recorded as 0.98 in PostgreSQL');
    assert(dbFirstWord.highlighted === true, 'Highlighted boolean recorded as true in PostgreSQL');

    // =============================================================
    // SCENARIO 2: Versioning & Multi-Version History
    // =============================================================
    console.log('\n--- Scenario 2: Versioning & Multi-Version History ---');

    const track2Id = ensureValidUuid();
    const cue2Id = ensureValidUuid();
    const v2Cues = JSON.stringify([
      {
        id: cue2Id,
        sequence: 1,
        start: 0.5,
        end: 2.8,
        text: 'Welcome to Clipper PRO',
        style: { fontSize: 52 },
        language: 'en',
        words: [
          { wordIndex: 0, word: 'Welcome', start: 0.5, end: 1.0 },
          { wordIndex: 1, word: 'to', start: 1.05, end: 1.3 },
          { wordIndex: 2, word: 'Clipper', start: 1.35, end: 2.0 },
          { wordIndex: 3, word: 'PRO', start: 2.05, end: 2.8 },
        ],
      },
    ]);

    const resTrack2 = runPsql(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        '${track2Id}'::UUID,
        '${transcriptAId}'::UUID,
        '${mediaAId}'::UUID,
        'en'::TEXT,
        2::INTEGER,
        'edited'::TEXT,
        '{"preset":"neon"}'::JSONB,
        2.8::NUMERIC,
        '{}'::JSONB,
        '${v2Cues.replace(/'/g, "''")}'::JSONB
      );
    `);
    const jsonTrack2 = JSON.parse(resTrack2.trim());
    assert(jsonTrack2.id === track2Id, 'Version 2 created with new track ID');
    assert(jsonTrack2.version === 2, 'Version 2 correctly labeled');

    // Check that BOTH versions coexist in public.caption_tracks
    const trackVersions = runPsql(`
      SELECT version FROM public.caption_tracks WHERE project_id = '${projectAId}' ORDER BY version ASC;
    `).trim().split('\n').map((v) => Number(v.trim())).filter(Boolean);
    assert(trackVersions.includes(1) && trackVersions.includes(2), 'Both Version 1 and Version 2 coexist in database');

    // Test unique constraint: duplicate (project_id, version) must fail
    const dupVersionErr = await execPsqlAsync(`
      INSERT INTO public.caption_tracks (
        id, project_id, user_id, version, language, source, status
      ) VALUES (
        gen_random_uuid(), '${projectAId}', '${ownerUserId}', 1, 'en', 'generated', 'ready'
      );
    `);
    assert(dupVersionErr.exitCode !== 0, 'Unique constraint uq_caption_tracks_project_version rejects duplicate version');

    // =============================================================
    // SCENARIO 3: RBAC Security Gates
    // =============================================================
    console.log('\n--- Scenario 3: RBAC Security Gates ---');

    // 1. Editor should be able to create version 3
    const track3Id = ensureValidUuid();
    const resEditor = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}'::UUID,
        '${editorUserId}'::UUID,
        '${track3Id}'::UUID,
        NULL::UUID,
        NULL::UUID,
        'en'::TEXT,
        3::INTEGER,
        'edited'::TEXT,
        '{}'::JSONB,
        1.0::NUMERIC,
        '{}'::JSONB,
        '[]'::JSONB
      );
    `);
    assert(resEditor.exitCode === 0, 'Editor user permitted to execute save_caption_track_atomic');

    // 2. Viewer role should be REJECTED with 42501
    const resViewer = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}'::UUID,
        '${viewerUserId}'::UUID,
        gen_random_uuid(),
        NULL::UUID,
        NULL::UUID,
        'en'::TEXT,
        4::INTEGER,
        'edited'::TEXT,
        '{}'::JSONB,
        1.0::NUMERIC,
        '{}'::JSONB,
        '[]'::JSONB
      );
    `);
    assert(resViewer.exitCode !== 0, 'Viewer role rejected from save_caption_track_atomic');
    assert(resViewer.stderr.includes('42501') || resViewer.stderr.includes('FORBIDDEN'), 'Viewer failure code is 42501 FORBIDDEN');

    // 3. Unrelated user (not owner of Project A, not editor of Project A) should be REJECTED with 42501
    const resUnrelated = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}'::UUID,
        '${unrelatedUserId}'::UUID,
        gen_random_uuid(),
        NULL::UUID,
        NULL::UUID,
        'en'::TEXT,
        5::INTEGER,
        'edited'::TEXT,
        '{}'::JSONB,
        1.0::NUMERIC,
        '{}'::JSONB,
        '[]'::JSONB
      );
    `);
    assert(resUnrelated.exitCode !== 0, 'Unrelated user rejected from save_caption_track_atomic');
    assert(resUnrelated.stderr.includes('42501') || resUnrelated.stderr.includes('FORBIDDEN'), 'Unrelated user failure code is 42501 FORBIDDEN');

    // 4. Missing project should fail with P0002
    const missingProjectId = ensureValidUuid();
    const resMissing = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${missingProjectId}'::UUID,
        '${ownerUserId}'::UUID,
        gen_random_uuid(),
        NULL::UUID,
        NULL::UUID,
        'en'::TEXT,
        1::INTEGER,
        'generated'::TEXT,
        '{}'::JSONB,
        1.0::NUMERIC,
        '{}'::JSONB,
        '[]'::JSONB
      );
    `);
    assert(resMissing.exitCode !== 0, 'Missing project rejected from save_caption_track_atomic');
    assert(resMissing.stderr.includes('P0002') || resMissing.stderr.includes('PROJECT_NOT_FOUND'), 'Missing project returns P0002 PROJECT_NOT_FOUND');

    // =============================================================
    // SCENARIO 4: Cross-Project Media & Transcript Integrity Gate
    // =============================================================
    console.log('\n--- Scenario 4: Cross-Project Media & Transcript Integrity Gate ---');

    // Attempt to save caption track for Project A pointing to Transcript B (belongs to Project B)
    const resCrossTranscript = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        gen_random_uuid(),
        '${transcriptBId}'::UUID, -- BELONGS TO PROJECT B!
        '${mediaAId}'::UUID,
        'en'::TEXT,
        6::INTEGER,
        'generated'::TEXT,
        '{}'::JSONB,
        1.0::NUMERIC,
        '{}'::JSONB,
        '[]'::JSONB
      );
    `);
    assert(resCrossTranscript.exitCode !== 0, 'Cross-project transcript association rejected');
    assert(
      resCrossTranscript.stderr.includes('CROSS_PROJECT_FORBIDDEN') || resCrossTranscript.stderr.includes('42501'),
      'Cross-project transcript error is CROSS_PROJECT_FORBIDDEN / 42501'
    );

    // Attempt to save caption track for Project A pointing to Media B (belongs to Project B)
    const resCrossMedia = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        gen_random_uuid(),
        '${transcriptAId}'::UUID,
        '${mediaBId}'::UUID, -- BELONGS TO PROJECT B!
        'en'::TEXT,
        7::INTEGER,
        'generated'::TEXT,
        '{}'::JSONB,
        1.0::NUMERIC,
        '{}'::JSONB,
        '[]'::JSONB
      );
    `);
    assert(resCrossMedia.exitCode !== 0, 'Cross-project media asset association rejected');
    assert(
      resCrossMedia.stderr.includes('CROSS_PROJECT_FORBIDDEN') || resCrossMedia.stderr.includes('42501'),
      'Cross-project media asset error is CROSS_PROJECT_FORBIDDEN / 42501'
    );

    // =============================================================
    // SCENARIO 5: Database Check Constraints
    // =============================================================
    console.log('\n--- Scenario 5: Database Check Constraints ---');

    // 1. version >= 1 check constraint
    const resVerZero = await execPsqlAsync(`
      INSERT INTO public.caption_tracks (
        id, project_id, user_id, version, language, source, status
      ) VALUES (
        gen_random_uuid(), '${projectAId}', '${ownerUserId}', 0, 'en', 'generated', 'ready'
      );
    `);
    assert(resVerZero.exitCode !== 0, 'Check constraint rejects version 0');
    assert(resVerZero.stderr.includes('caption_tracks_version_check'), 'Failed caption_tracks_version_check constraint');

    // 2. source IN ('generated', 'edited', 'imported')
    const resBadSource = await execPsqlAsync(`
      INSERT INTO public.caption_tracks (
        id, project_id, user_id, version, language, source, status
      ) VALUES (
        gen_random_uuid(), '${projectAId}', '${ownerUserId}', 8, 'en', 'fabricated_source', 'ready'
      );
    `);
    assert(resBadSource.exitCode !== 0, 'Check constraint rejects invalid source');
    assert(resBadSource.stderr.includes('caption_tracks_source_check'), 'Failed caption_tracks_source_check constraint');

    // 3. status IN ('ready', 'processing', 'failed')
    const resBadStatus = await execPsqlAsync(`
      INSERT INTO public.caption_tracks (
        id, project_id, user_id, version, language, source, status
      ) VALUES (
        gen_random_uuid(), '${projectAId}', '${ownerUserId}', 9, 'en', 'generated', 'invalid_status'
      );
    `);
    assert(resBadStatus.exitCode !== 0, 'Check constraint rejects invalid status');
    assert(resBadStatus.stderr.includes('caption_tracks_status_check'), 'Failed caption_tracks_status_check constraint');

    // 4. cues_count >= 0
    const resNegCues = await execPsqlAsync(`
      INSERT INTO public.caption_tracks (
        id, project_id, user_id, version, language, source, status, cues_count
      ) VALUES (
        gen_random_uuid(), '${projectAId}', '${ownerUserId}', 10, 'en', 'generated', 'ready', -1
      );
    `);
    assert(resNegCues.exitCode !== 0, 'Check constraint rejects negative cues_count');
    assert(resNegCues.stderr.includes('caption_tracks_cues_count_check'), 'Failed caption_tracks_cues_count_check constraint');

    // 5. caption_cues.end_time > start_time
    const resBadCueTiming = await execPsqlAsync(`
      INSERT INTO public.caption_cues (
        id, track_id, sequence, start_time, end_time, text
      ) VALUES (
        gen_random_uuid(), '${track1Id}', 99, 5.0, 4.0, 'Inverted timing cue'
      );
    `);
    assert(resBadCueTiming.exitCode !== 0, 'Check constraint rejects cue end_time <= start_time');

    // 6. caption_words confidence between 0.0 and 1.0
    const resBadConfidence = await execPsqlAsync(`
      INSERT INTO public.caption_words (
        id, cue_id, track_id, word_index, word, start_time, end_time, confidence
      ) VALUES (
        gen_random_uuid(), '${cue1Id}', '${track1Id}', 99, 'BadConf', 1.0, 1.5, 1.85
      );
    `);
    assert(resBadConfidence.exitCode !== 0, 'Check constraint rejects word confidence > 1.0');
    assert(resBadConfidence.stderr.includes('caption_words_confidence_check'), 'Failed caption_words_confidence_check constraint');

    // =============================================================
    // SCENARIO 6: Cascading Deletions & SET NULL Constraints
    // =============================================================
    console.log('\n--- Scenario 6: Cascading Deletions & SET NULL Constraints ---');

    // Create a temporary project to test cascade delete
    const tempProjId = ensureValidUuid();
    const tempTrackId = ensureValidUuid();
    const tempCueId = ensureValidUuid();
    const tempWordId = ensureValidUuid();

    runPsql(`
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${tempProjId}', '${ownerUserId}', 'Temp Cascade Project', 'youtube_to_shorts', 'created');

      INSERT INTO public.caption_tracks (id, project_id, user_id, version, cues_count)
      VALUES ('${tempTrackId}', '${tempProjId}', '${ownerUserId}', 1, 1);

      INSERT INTO public.caption_cues (id, track_id, sequence, start_time, end_time, text)
      VALUES ('${tempCueId}', '${tempTrackId}', 1, 0.0, 1.0, 'Temp Cue');

      INSERT INTO public.caption_words (id, cue_id, track_id, word_index, word, start_time, end_time)
      VALUES ('${tempWordId}', '${tempCueId}', '${tempTrackId}', 0, 'Temp', 0.0, 1.0);
    `);

    // Verify rows exist before delete
    assert(Number(runPsql(`SELECT count(*) FROM public.caption_tracks WHERE id = '${tempTrackId}';`).trim()) === 1, 'Temp track exists');
    assert(Number(runPsql(`SELECT count(*) FROM public.caption_cues WHERE id = '${tempCueId}';`).trim()) === 1, 'Temp cue exists');
    assert(Number(runPsql(`SELECT count(*) FROM public.caption_words WHERE id = '${tempWordId}';`).trim()) === 1, 'Temp word exists');

    // Delete temp project -> MUST cascade to track, cue, and words
    runPsql(`DELETE FROM public.projects WHERE id = '${tempProjId}';`);

    assert(Number(runPsql(`SELECT count(*) FROM public.caption_tracks WHERE id = '${tempTrackId}';`).trim()) === 0, 'Project delete cascaded to caption_tracks');
    assert(Number(runPsql(`SELECT count(*) FROM public.caption_cues WHERE id = '${tempCueId}';`).trim()) === 0, 'Project delete cascaded to caption_cues');
    assert(Number(runPsql(`SELECT count(*) FROM public.caption_words WHERE id = '${tempWordId}';`).trim()) === 0, 'Project delete cascaded to caption_words');

    // Test transcript deletion: caption_tracks.transcript_id should be SET NULL, NOT delete the track
    const tempProj3Id = ensureValidUuid();
    const tempTranscriptId = ensureValidUuid();
    const tempTrackWithTrId = ensureValidUuid();
    runPsql(`
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${tempProj3Id}', '${ownerUserId}', 'Temp Tr Project', 'youtube_to_shorts', 'created');

      INSERT INTO public.transcripts (id, project_id, status, language, transcript_text, duration)
      VALUES ('${tempTranscriptId}', '${tempProj3Id}', 'completed', 'en', 'Temp Transcript', 10.0);

      INSERT INTO public.caption_tracks (id, project_id, transcript_id, user_id, version)
      VALUES ('${tempTrackWithTrId}', '${tempProj3Id}', '${tempTranscriptId}', '${ownerUserId}', 1);
    `);

    // Delete the transcript
    runPsql(`DELETE FROM public.transcripts WHERE id = '${tempTranscriptId}';`);

    // Verify track still exists but transcript_id is now NULL
    const trackAfterTrDelete = runPsql(`
      SELECT transcript_id FROM public.caption_tracks WHERE id = '${tempTrackWithTrId}';
    `).trim();
    assert(trackAfterTrDelete === '', 'Transcript delete sets caption_tracks.transcript_id to NULL (ON DELETE SET NULL)');

    // Cleanup tempProj3
    runPsql(`DELETE FROM public.projects WHERE id = '${tempProj3Id}';`);

    // =============================================================
    // SCENARIO 7: RLS Direct Access Verification
    // =============================================================
    console.log('\n--- Scenario 7: RLS Direct Access Verification ---');

    // Direct insertion by unauthenticated anon role blocked by RLS on caption_tracks
    const rlsBlockedTrack = await execPsqlAsync(`
      SET ROLE anon;
      INSERT INTO public.caption_tracks (
        id, project_id, user_id, version, language, source, status
      ) VALUES (
        gen_random_uuid(), '${projectAId}', '${ownerUserId}', 30, 'en', 'generated', 'ready'
      );
      RESET ROLE;
    `);
    assert(rlsBlockedTrack.exitCode !== 0, 'Direct insertion into caption_tracks by unauthenticated anon role blocked by RLS');

    // Direct insertion by unauthenticated anon role blocked on caption_cues
    const rlsBlockedCue = await execPsqlAsync(`
      SET ROLE anon;
      INSERT INTO public.caption_cues (
        id, track_id, sequence, start_time, end_time, text
      ) VALUES (
        gen_random_uuid(), '${track1Id}', 50, 0.0, 1.0, 'Hacked cue'
      );
      RESET ROLE;
    `);
    assert(rlsBlockedCue.exitCode !== 0, 'Direct insertion into caption_cues by unauthenticated anon role blocked by RLS');

    // Direct insertion by unauthenticated anon role blocked on caption_words
    const rlsBlockedWord = await execPsqlAsync(`
      SET ROLE anon;
      INSERT INTO public.caption_words (
        id, cue_id, track_id, word_index, word, start_time, end_time
      ) VALUES (
        gen_random_uuid(), '${cue1Id}', '${track1Id}', 50, 'HackedWord', 0.0, 1.0
      );
      RESET ROLE;
    `);
    assert(rlsBlockedWord.exitCode !== 0, 'Direct insertion into caption_words by unauthenticated anon role blocked by RLS');

    // =============================================================
    // SCENARIO 8: Timeline Operations Constraint
    // =============================================================
    console.log('\n--- Scenario 8: Timeline Operations Constraint ---');

    const timelineId = ensureValidUuid();
    runPsql(`
      INSERT INTO public.timelines (id, project_id, version, duration)
      VALUES ('${timelineId}', '${projectAId}', 1, 60.0);
    `);

    // Verify 'add_caption', 'change_caption', 'set_caption_style' are accepted
    const opAddCaption = runPsql(`
      INSERT INTO public.timeline_operations (id, timeline_id, operation_type, operation_index, params, inverse_params, version_after)
      VALUES (gen_random_uuid(), '${timelineId}', 'add_caption', 1, '{"trackId":"${track1Id}"}'::jsonb, '{}'::jsonb, 2)
      RETURNING operation_type;
    `).trim();
    assert(opAddCaption.includes('add_caption'), 'timeline_operations allows add_caption operation type');

    const opChangeCaption = runPsql(`
      INSERT INTO public.timeline_operations (id, timeline_id, operation_type, operation_index, params, inverse_params, version_after)
      VALUES (gen_random_uuid(), '${timelineId}', 'change_caption', 2, '{"cueId":"${cue1Id}"}'::jsonb, '{}'::jsonb, 3)
      RETURNING operation_type;
    `).trim();
    assert(opChangeCaption.includes('change_caption'), 'timeline_operations allows change_caption operation type');

    const opSetCaptionStyle = runPsql(`
      INSERT INTO public.timeline_operations (id, timeline_id, operation_type, operation_index, params, inverse_params, version_after)
      VALUES (gen_random_uuid(), '${timelineId}', 'set_caption_style', 3, '{"preset":"beast"}'::jsonb, '{}'::jsonb, 4)
      RETURNING operation_type;
    `).trim();
    assert(opSetCaptionStyle.includes('set_caption_style'), 'timeline_operations allows set_caption_style operation type');

    // =============================================================
    // SCENARIO 9: save_caption_track_atomic RPC Validation & Concurrency Gates
    // =============================================================
    console.log('\n--- Scenario 9: save_caption_track_atomic Boundary Validations ---');

    // 1. Rejects empty cue text
    const emptyCueTextRes = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${ownerUserId}',
        NULL,
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[{"id":"${ensureValidUuid()}","sequence":1,"start":0.0,"end":1.0,"text":"  "}]'::jsonb
      );
    `);
    assert(emptyCueTextRes.exitCode !== 0, 'save_caption_track_atomic rejects empty cue text');
    assert(emptyCueTextRes.stderr.includes('VALIDATION_ERROR'), 'Error contains VALIDATION_ERROR for empty cue text');

    // 2. Rejects cue end_time <= start_time
    const invertedCueTimeRes = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${ownerUserId}',
        NULL,
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[{"id":"${ensureValidUuid()}","sequence":1,"start":2.0,"end":1.0,"text":"Inverted"}]'::jsonb
      );
    `);
    assert(invertedCueTimeRes.exitCode !== 0, 'save_caption_track_atomic rejects cue end <= start');
    assert(invertedCueTimeRes.stderr.includes('VALIDATION_ERROR'), 'Error contains VALIDATION_ERROR for inverted cue time');

    // 3. Rejects empty word text
    const emptyWordTextRes = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${ownerUserId}',
        NULL,
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[{"id":"${ensureValidUuid()}","sequence":1,"start":0.0,"end":1.0,"text":"Valid","words":[{"wordIndex":0,"word":" ","start":0.0,"end":0.5}]}]'::jsonb
      );
    `);
    assert(emptyWordTextRes.exitCode !== 0, 'save_caption_track_atomic rejects empty word text');
    assert(emptyWordTextRes.stderr.includes('VALIDATION_ERROR'), 'Error contains VALIDATION_ERROR for empty word text');

    // 4. Rejects word timing outside cue bounds
    const outOfBoundsWordRes = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${ownerUserId}',
        NULL,
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[{"id":"${ensureValidUuid()}","sequence":1,"start":1.0,"end":2.0,"text":"Valid","words":[{"wordIndex":0,"word":"Out","start":0.2,"end":0.8}]}]'::jsonb
      );
    `);
    assert(outOfBoundsWordRes.exitCode !== 0, 'save_caption_track_atomic rejects word timing outside cue bounds');
    assert(outOfBoundsWordRes.stderr.includes('VALIDATION_ERROR'), 'Error contains VALIDATION_ERROR for out-of-bounds word');

    // 5. Atomic concurrent version bump with FOR UPDATE serialization
    const p1 = execPsqlAsync(`
      SELECT (public.save_caption_track_atomic(
        '${projectAId}', '${ownerUserId}', NULL, '${transcriptAId}', '${mediaAId}', 'en', NULL, 'generated', '{}'::jsonb, 10.0, '{}'::jsonb, '[]'::jsonb
      )->>'version')::integer AS v;
    `);
    const p2 = execPsqlAsync(`
      SELECT (public.save_caption_track_atomic(
        '${projectAId}', '${ownerUserId}', NULL, '${transcriptAId}', '${mediaAId}', 'en', NULL, 'generated', '{}'::jsonb, 10.0, '{}'::jsonb, '[]'::jsonb
      )->>'version')::integer AS v;
    `);
    const [res1, res2] = await Promise.all([p1, p2]);
    assert(res1.exitCode === 0 && res2.exitCode === 0, 'Concurrent save_caption_track_atomic calls succeed without deadlock');
    const v1 = parseInt(res1.stdout.trim(), 10);
    const v2 = parseInt(res2.stdout.trim(), 10);
    assert(v1 !== v2, `Concurrent calls allocate distinct versions (${v1} !== ${v2})`);

    // =============================================================
    // SCENARIO 10: Category 31 — Final Security-Definer & Immutability Gates
    // =============================================================
    console.log('\n--- Scenario 10: Category 31 — Final Security-Definer & Immutability Gates ---');

    // 31-A: SECURITY DEFINER identity impersonation rejection
    // Authenticated user editorUserId attempting to claim ownerUserId via p_user_id
    const impersonationRes = await execPsqlAsync(`
      SET request.jwt.claim.sub = '${editorUserId}';
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${ownerUserId}',
        NULL,
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[]'::jsonb
      );
    `);
    assert(impersonationRes.exitCode !== 0, 'Test 31-A: Authenticated user cannot impersonate another user via p_user_id');
    assert(impersonationRes.stderr.includes('Impersonation not permitted') || impersonationRes.stderr.includes('42501'), 'Test 31-A: Error code is 42501 FORBIDDEN for impersonation');

    // 31-B: Owner RPC success with own identity
    const ownerSuccessRes = await execPsqlAsync(`
      SET request.jwt.claim.sub = '${ownerUserId}';
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${ownerUserId}',
        NULL,
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[]'::jsonb
      );
    `);
    assert(ownerSuccessRes.exitCode === 0, 'Test 31-B: Owner can invoke RPC with own authenticated identity');

    // 31-C: Viewer mutation rejection
    const viewerMutationRes = await execPsqlAsync(`
      SET request.jwt.claim.sub = '${viewerUserId}';
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${viewerUserId}',
        NULL,
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[]'::jsonb
      );
    `);
    assert(viewerMutationRes.exitCode !== 0, 'Test 31-C: Viewer role rejected from mutating captions via RPC');
    assert(viewerMutationRes.stderr.includes('42501') || viewerMutationRes.stderr.includes('Viewer'), 'Test 31-C: Viewer error code is 42501 FORBIDDEN');

    // 31-D: Unauthorized user rejection
    const unauthorizedRes = await execPsqlAsync(`
      SET request.jwt.claim.sub = '${unrelatedUserId}';
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${unrelatedUserId}',
        NULL,
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[]'::jsonb
      );
    `);
    assert(unauthorizedRes.exitCode !== 0, 'Test 31-D: Unauthorized workspace user rejected from mutating captions');
    assert(unauthorizedRes.stderr.includes('42501') || unauthorizedRes.stderr.includes('FORBIDDEN'), 'Test 31-D: Unauthorized error code is 42501 FORBIDDEN');

    // 31-E: Immutable cue ID rejection at DB layer
    const mutateCueIdRes = await execPsqlAsync(`
      UPDATE public.caption_cues
      SET id = '${ensureValidUuid()}'
      WHERE id = '${cue1Id}';
    `);
    assert(mutateCueIdRes.exitCode !== 0, 'Test 31-E: Direct UPDATE on caption_cues.id rejected by DB trigger');
    assert(mutateCueIdRes.stderr.includes('IMMUTABLE_FIELD'), 'Test 31-E: Error mentions IMMUTABLE_FIELD');

    // 31-F: Immutable cue track_id rejection
    const mutateCueTrackRes = await execPsqlAsync(`
      UPDATE public.caption_cues
      SET track_id = '${ensureValidUuid()}'
      WHERE id = '${cue1Id}';
    `);
    assert(mutateCueTrackRes.exitCode !== 0, 'Test 31-F: Direct UPDATE on caption_cues.track_id rejected by DB trigger');
    assert(mutateCueTrackRes.stderr.includes('IMMUTABLE_FIELD'), 'Test 31-F: Error mentions IMMUTABLE_FIELD');

    // 31-G: Immutable cue sequence rejection
    const mutateCueSeqRes = await execPsqlAsync(`
      UPDATE public.caption_cues
      SET sequence = 999
      WHERE id = '${cue1Id}';
    `);
    assert(mutateCueSeqRes.exitCode !== 0, 'Test 31-G: Direct UPDATE on caption_cues.sequence rejected by DB trigger');
    assert(mutateCueSeqRes.stderr.includes('IMMUTABLE_FIELD'), 'Test 31-G: Error mentions IMMUTABLE_FIELD');

    // 31-H: Immutable word ID rejection
    const mutateWordIdRes = await execPsqlAsync(`
      UPDATE public.caption_words
      SET id = '${ensureValidUuid()}'
      WHERE id = '${word1Id}';
    `);
    assert(mutateWordIdRes.exitCode !== 0, 'Test 31-H: Direct UPDATE on caption_words.id rejected by DB trigger');
    assert(mutateWordIdRes.stderr.includes('IMMUTABLE_FIELD'), 'Test 31-H: Error mentions IMMUTABLE_FIELD');

    // 31-I: Immutable word cue_id rejection
    const mutateWordCueRes = await execPsqlAsync(`
      UPDATE public.caption_words
      SET cue_id = '${ensureValidUuid()}'
      WHERE id = '${word1Id}';
    `);
    assert(mutateWordCueRes.exitCode !== 0, 'Test 31-I: Direct UPDATE on caption_words.cue_id rejected by DB trigger');
    assert(mutateWordCueRes.stderr.includes('IMMUTABLE_FIELD'), 'Test 31-I: Error mentions IMMUTABLE_FIELD');

    // 31-J: Immutable word track_id rejection
    const mutateWordTrackRes = await execPsqlAsync(`
      UPDATE public.caption_words
      SET track_id = '${ensureValidUuid()}'
      WHERE id = '${word1Id}';
    `);
    assert(mutateWordTrackRes.exitCode !== 0, 'Test 31-J: Direct UPDATE on caption_words.track_id rejected by DB trigger');
    assert(mutateWordTrackRes.stderr.includes('IMMUTABLE_FIELD'), 'Test 31-J: Error mentions IMMUTABLE_FIELD');

    // 31-K: Immutable word_index rejection
    const mutateWordIdxRes = await execPsqlAsync(`
      UPDATE public.caption_words
      SET word_index = 888
      WHERE id = '${word1Id}';
    `);
    assert(mutateWordIdxRes.exitCode !== 0, 'Test 31-K: Direct UPDATE on caption_words.word_index rejected by DB trigger');
    assert(mutateWordIdxRes.stderr.includes('IMMUTABLE_FIELD'), 'Test 31-K: Error mentions IMMUTABLE_FIELD');

    // 31-V: Transaction rollback on invalid child row (no partial caption track or cue row remains)
    const rollbackTrackId = ensureValidUuid();
    const rollbackCueId = ensureValidUuid();
    const rollbackRes = await execPsqlAsync(`
      SELECT public.save_caption_track_atomic(
        '${projectAId}',
        '${ownerUserId}',
        '${rollbackTrackId}',
        '${transcriptAId}',
        '${mediaAId}',
        'en',
        NULL,
        'generated',
        '{}'::jsonb,
        10.0,
        '{}'::jsonb,
        '[{"id":"${rollbackCueId}","sequence":1,"start":1.0,"end":2.0,"text":"Rollback Cue","words":[{"wordIndex":0,"word":" ","start":1.0,"end":1.5}]}]'::jsonb
      );
    `);
    assert(rollbackRes.exitCode !== 0, 'Test 31-V1: RPC fails on invalid child word');
    const remainingTracks = runPsql(`
      SELECT count(*) FROM public.caption_tracks WHERE id = '${rollbackTrackId}';
    `).trim();
    assert(Number(remainingTracks) === 0, 'Test 31-V2: Entire transaction rolls back; no caption_tracks row remains');
    const remainingCues = runPsql(`
      SELECT count(*) FROM public.caption_cues WHERE id = '${rollbackCueId}';
    `).trim();
    assert(Number(remainingCues) === 0, 'Test 31-V3: Entire transaction rolls back; no caption_cues row remains');

    console.log('\n====================================================');
    console.log(`📊 PHASE 7 POSTGRESQL GATE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Teardown test fixtures
    try {
      runPsql(`
        DELETE FROM public.timeline_operations WHERE timeline_id IN (SELECT id FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}'));
        DELETE FROM public.timelines WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.caption_words WHERE track_id IN (SELECT id FROM public.caption_tracks WHERE project_id IN ('${projectAId}', '${projectBId}'));
        DELETE FROM public.caption_cues WHERE track_id IN (SELECT id FROM public.caption_tracks WHERE project_id IN ('${projectAId}', '${projectBId}'));
        DELETE FROM public.caption_tracks WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.transcripts WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.media_assets WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.projects WHERE id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.organization_members WHERE workspace_id = '${workspaceAId}';
        DELETE FROM public.workspaces WHERE id = '${workspaceAId}';
        DELETE FROM public.profiles WHERE id IN ('${ownerUserId}', '${editorUserId}', '${viewerUserId}', '${unrelatedUserId}', '${tenantBUserId}');
        DELETE FROM auth.users WHERE id IN ('${ownerUserId}', '${editorUserId}', '${viewerUserId}', '${unrelatedUserId}', '${tenantBUserId}');
      `);
      console.log('✓ Teardown completed cleanly');
    } catch (cleanupErr) {
      console.warn('Teardown warning:', cleanupErr);
    }
  }
}

runPhase7PostgresTests().catch((err) => {
  console.error('Fatal PostgreSQL Test Gate Error:', err);
  process.exit(1);
});
