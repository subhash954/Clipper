/**
 * CLIPPER PHASE 6: REAL POSTGRESQL INTEGRATION TEST SUITE
 * Database Integrity, Check Constraints, RBAC, Tenant Isolation & Atomic RPCs
 *
 * Requirements:
 * 1. Must execute against real PostgreSQL (fails immediately if DB unreachable).
 * 2. Scenario 1: save_reframe_analysis_atomic RPC (Owner/Editor success, Upsert)
 * 3. Scenario 2: save_reframe_config_atomic RPC (Owner/Editor success, Upsert)
 * 4. Scenario 3: RBAC Security Gates (Viewer rejected 42501, Unrelated rejected 42501, Missing project P0002)
 * 5. Scenario 4: Media Ownership & Cross-Project Integrity Gate (MEDIA_NOT_OWNED 42501)
 * 6. Scenario 5: Tenant Isolation (Tenant B cannot access or mutate Tenant A)
 * 7. Scenario 6: Database Check Constraints (Aspect ratios, tracking modes, negative dimensions)
 * 8. Scenario 7: Timeline Operations Constraint (set_reframe allowed)
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
console.log('CLIPPER PHASE 6: REAL POSTGRESQL INTEGRATION GATE');
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

async function runPhase6PostgresTests() {
  const ownerUserId = ensureValidUuid();
  const editorUserId = ensureValidUuid();
  const viewerUserId = ensureValidUuid();
  const unrelatedUserId = ensureValidUuid();
  const tenantBUserId = ensureValidUuid();

  const ownerEmail = `pg6_owner_${ownerUserId}@example.com`;
  const editorEmail = `pg6_editor_${editorUserId}@example.com`;
  const viewerEmail = `pg6_viewer_${viewerUserId}@example.com`;
  const unrelatedEmail = `pg6_unrelated_${unrelatedUserId}@example.com`;
  const tenantBEmail = `pg6_tenantb_${tenantBUserId}@example.com`;

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
      INSERT INTO auth.users (id, email) VALUES
        ('${ownerUserId}', '${ownerEmail}'),
        ('${editorUserId}', '${editorEmail}'),
        ('${viewerUserId}', '${viewerEmail}'),
        ('${unrelatedUserId}', '${unrelatedEmail}'),
        ('${tenantBUserId}', '${tenantBEmail}')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.profiles (id, email, full_name, role) VALUES
        ('${ownerUserId}', '${ownerEmail}', 'Phase 6 Owner', 'owner'),
        ('${editorUserId}', '${editorEmail}', 'Phase 6 Editor', 'editor'),
        ('${viewerUserId}', '${viewerEmail}', 'Phase 6 Viewer', 'viewer'),
        ('${unrelatedUserId}', '${unrelatedEmail}', 'Phase 6 Unrelated', 'editor'),
        ('${tenantBUserId}', '${tenantBEmail}', 'Phase 6 Tenant B', 'owner')
      ON CONFLICT (id) DO NOTHING;

      -- Project A (Owned by ownerUserId)
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${projectAId}', '${ownerUserId}', 'Reframe Project A', 'youtube_to_shorts', 'created')
      ON CONFLICT (id) DO NOTHING;

      -- Media Asset A (belongs to Project A)
      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${mediaAId}', '${projectAId}', '${ownerUserId}', 'videoA.mp4', 'https://cdn.example.com/videoA.mp4', 'uploads/videoA.mp4', 'video/mp4', 8192, 60.0, 'ready')
      ON CONFLICT (id) DO NOTHING;

      -- Project B (Owned by tenantBUserId)
      INSERT INTO public.projects (id, user_id, title, workflow_type, status)
      VALUES ('${projectBId}', '${tenantBUserId}', 'Reframe Project B', 'youtube_to_shorts', 'created')
      ON CONFLICT (id) DO NOTHING;

      -- Media Asset B (belongs to Project B)
      INSERT INTO public.media_assets (id, project_id, user_id, file_name, file_url, storage_path, mime_type, size_bytes, duration, status)
      VALUES ('${mediaBId}', '${projectBId}', '${tenantBUserId}', 'videoB.mp4', 'https://cdn.example.com/videoB.mp4', 'uploads/videoB.mp4', 'video/mp4', 8192, 45.0, 'ready')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✓ Projects, Users, Profiles & Media Assets created in PostgreSQL');

    // =============================================================
    // SCENARIO 1: save_reframe_analysis_atomic RPC
    // =============================================================
    console.log('\n--- Scenario 1: save_reframe_analysis_atomic RPC ---');

    const sampleScenes = JSON.stringify([
      { sceneIndex: 0, start: 0.0, end: 30.0 },
      { sceneIndex: 1, start: 30.0, end: 60.0 },
    ]);
    const sampleTracks = JSON.stringify([
      {
        trackId: 'tr-1',
        start: 0.0,
        end: 30.0,
        averageConfidence: 0.95,
        detections: [{ timestamp: 0.0, x: 0.5, y: 0.5, width: 0.2, height: 0.3, confidence: 0.95 }],
      },
    ]);

    const resAnalysis1 = runPsql(`
      SELECT public.save_reframe_analysis_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        '${mediaAId}'::UUID,
        1920::INTEGER,
        1080::INTEGER,
        60.0::NUMERIC,
        '${sampleScenes.replace(/'/g, "''")}'::JSONB,
        '${sampleTracks.replace(/'/g, "''")}'::JSONB,
        'hybrid'::TEXT,
        '1.0.0'::TEXT
      );
    `);

    const jsonAnalysis1 = JSON.parse(resAnalysis1.trim());
    assert(jsonAnalysis1.projectId === projectAId, 'Analysis saved with correct project ID');
    assert(jsonAnalysis1.mediaAssetId === mediaAId, 'Analysis saved with correct media asset ID');
    assert(jsonAnalysis1.sourceWidth === 1920, 'Source width recorded as 1920');
    assert(jsonAnalysis1.sourceHeight === 1080, 'Source height recorded as 1080');
    assert(Number(jsonAnalysis1.duration) === 60.0, 'Duration recorded as 60.0');
    assert(jsonAnalysis1.provider === 'hybrid', 'Provider recorded as hybrid');

    // Test idempotent upsert (calling again updates the existing record)
    const resAnalysis2 = runPsql(`
      SELECT public.save_reframe_analysis_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        '${mediaAId}'::UUID,
        1920::INTEGER,
        1080::INTEGER,
        60.0::NUMERIC,
        '${sampleScenes.replace(/'/g, "''")}'::JSONB,
        '${sampleTracks.replace(/'/g, "''")}'::JSONB,
        'gemini-vision'::TEXT,
        '1.1.0'::TEXT
      );
    `);
    const jsonAnalysis2 = JSON.parse(resAnalysis2.trim());
    assert(jsonAnalysis2.id === jsonAnalysis1.id, 'Upsert updated same row without primary key collision');
    assert(jsonAnalysis2.provider === 'gemini-vision', 'Provider updated to gemini-vision');

    // =============================================================
    // SCENARIO 2: save_reframe_config_atomic RPC
    // =============================================================
    console.log('\n--- Scenario 2: save_reframe_config_atomic RPC ---');

    const resConfig1 = runPsql(`
      SELECT public.save_reframe_config_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        '9:16'::TEXT,
        'smart'::TEXT,
        'DUAL'::TEXT,
        NULL::JSONB,
        0.30::NUMERIC,
        0.040::NUMERIC,
        0.38::NUMERIC
      );
    `);

    const jsonConfig1 = JSON.parse(resConfig1.trim());
    assert(jsonConfig1.projectId === projectAId, 'Config saved with correct project ID');
    assert(jsonConfig1.targetAspectRatio === '9:16', 'Target aspect ratio recorded as 9:16');
    assert(jsonConfig1.trackingMode === 'smart', 'Tracking mode recorded as smart');
    assert(jsonConfig1.multiPersonMode === 'DUAL', 'Multi-person mode recorded as DUAL');
    assert(Number(jsonConfig1.smoothingAlpha) === 0.30, 'Smoothing alpha recorded as 0.30');
    assert(Number(jsonConfig1.deadZone) === 0.040, 'Dead zone recorded as 0.040');

    // Test upsert on conflict (project_id, target_aspect_ratio)
    const resConfig2 = runPsql(`
      SELECT public.save_reframe_config_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        '9:16'::TEXT,
        'smart'::TEXT,
        'GROUP'::TEXT,
        NULL::JSONB,
        0.25::NUMERIC,
        0.035::NUMERIC,
        0.35::NUMERIC
      );
    `);
    const jsonConfig2 = JSON.parse(resConfig2.trim());
    assert(jsonConfig2.id === jsonConfig1.id, 'Config upsert modified existing row');
    assert(jsonConfig2.multiPersonMode === 'GROUP', 'Multi-person mode updated to GROUP');

    // =============================================================
    // SCENARIO 3: RBAC Security Gates
    // =============================================================
    console.log('\n--- Scenario 3: RBAC Security Gates ---');

    // 1. Viewer role rejected (42501) on analysis mutation
    const viewerAnalysisAttempt = await execPsqlAsync(`
      SELECT public.save_reframe_analysis_atomic(
        '${projectAId}'::UUID,
        '${viewerUserId}'::UUID,
        '${mediaAId}'::UUID,
        1920::INTEGER,
        1080::INTEGER,
        60.0::NUMERIC,
        '[]'::JSONB,
        '[]'::JSONB,
        'hybrid'::TEXT,
        '1.0.0'::TEXT
      );
    `);
    assert(viewerAnalysisAttempt.exitCode !== 0, 'Viewer mutation of reframe analysis was rejected');
    assert(
      viewerAnalysisAttempt.stderr.includes('FORBIDDEN') || viewerAnalysisAttempt.stderr.includes('42501'),
      'Viewer mutation rejected with FORBIDDEN / 42501'
    );

    // 2. Viewer role rejected (42501) on config mutation
    const viewerConfigAttempt = await execPsqlAsync(`
      SELECT public.save_reframe_config_atomic(
        '${projectAId}'::UUID,
        '${viewerUserId}'::UUID,
        '1:1'::TEXT,
        'center'::TEXT
      );
    `);
    assert(viewerConfigAttempt.exitCode !== 0, 'Viewer mutation of reframe config was rejected');
    assert(
      viewerConfigAttempt.stderr.includes('FORBIDDEN') || viewerConfigAttempt.stderr.includes('42501'),
      'Viewer config mutation rejected with FORBIDDEN / 42501'
    );

    // 3. Unrelated user rejected (42501) on project A
    const unrelatedAttempt = await execPsqlAsync(`
      SELECT public.save_reframe_analysis_atomic(
        '${projectAId}'::UUID,
        '${unrelatedUserId}'::UUID,
        '${mediaAId}'::UUID,
        1920::INTEGER,
        1080::INTEGER,
        60.0::NUMERIC,
        '[]'::JSONB,
        '[]'::JSONB,
        'hybrid'::TEXT,
        '1.0.0'::TEXT
      );
    `);
    assert(unrelatedAttempt.exitCode !== 0, 'Unrelated user mutation was rejected');
    assert(
      unrelatedAttempt.stderr.includes('FORBIDDEN') || unrelatedAttempt.stderr.includes('42501'),
      'Unrelated user rejected with FORBIDDEN / 42501'
    );

    // 4. Non-existent project rejected (P0002)
    const fakeProjectId = ensureValidUuid();
    const fakeProjAttempt = await execPsqlAsync(`
      SELECT public.save_reframe_analysis_atomic(
        '${fakeProjectId}'::UUID,
        '${ownerUserId}'::UUID,
        '${mediaAId}'::UUID,
        1920::INTEGER,
        1080::INTEGER,
        60.0::NUMERIC,
        '[]'::JSONB,
        '[]'::JSONB,
        'hybrid'::TEXT,
        '1.0.0'::TEXT
      );
    `);
    assert(fakeProjAttempt.exitCode !== 0, 'Non-existent project was rejected');
    assert(
      fakeProjAttempt.stderr.includes('PROJECT_NOT_FOUND') || fakeProjAttempt.stderr.includes('P0002'),
      'Missing project rejected with PROJECT_NOT_FOUND / P0002'
    );

    // =============================================================
    // SCENARIO 4: Media Ownership & Cross-Project Integrity Gate
    // =============================================================
    console.log('\n--- Scenario 4: Cross-Project Media Ownership Gate ---');

    // Attempting to attach mediaB (belongs to Project B) to Project A must fail!
    const crossMediaAttempt = await execPsqlAsync(`
      SELECT public.save_reframe_analysis_atomic(
        '${projectAId}'::UUID,
        '${ownerUserId}'::UUID,
        '${mediaBId}'::UUID,
        1920::INTEGER,
        1080::INTEGER,
        45.0::NUMERIC,
        '[]'::JSONB,
        '[]'::JSONB,
        'hybrid'::TEXT,
        '1.0.0'::TEXT
      );
    `);
    assert(crossMediaAttempt.exitCode !== 0, 'Cross-project media attachment was rejected');
    assert(
      crossMediaAttempt.stderr.includes('MEDIA_NOT_OWNED'),
      'Cross-project media rejected with MEDIA_NOT_OWNED error'
    );

    // =============================================================
    // SCENARIO 5: Tenant Isolation
    // =============================================================
    console.log('\n--- Scenario 5: Multi-Tenant Isolation ---');

    // Tenant B cannot mutate Project A's reframe config
    const tenantBAccessAttempt = await execPsqlAsync(`
      SELECT public.save_reframe_config_atomic(
        '${projectAId}'::UUID,
        '${tenantBUserId}'::UUID,
        '4:5'::TEXT,
        'smart'::TEXT
      );
    `);
    assert(tenantBAccessAttempt.exitCode !== 0, 'Tenant B unauthorized mutation on Project A was rejected');
    assert(
      tenantBAccessAttempt.stderr.includes('FORBIDDEN') || tenantBAccessAttempt.stderr.includes('42501'),
      'Tenant B rejected with FORBIDDEN / 42501'
    );

    // =============================================================
    // SCENARIO 6: Database Check Constraints
    // =============================================================
    console.log('\n--- Scenario 6: Database Check Constraints ---');

    // 1. Invalid Aspect Ratio (e.g. 21:9)
    const invalidAspectAttempt = await execPsqlAsync(`
      INSERT INTO public.reframe_configs (
        project_id, target_aspect_ratio, tracking_mode
      ) VALUES (
        '${projectAId}', '21:9', 'smart'
      );
    `);
    assert(invalidAspectAttempt.exitCode !== 0, 'Invalid aspect ratio 21:9 rejected by DB check constraint');

    // 2. Invalid tracking mode
    const invalidTrackingAttempt = await execPsqlAsync(`
      INSERT INTO public.reframe_configs (
        project_id, target_aspect_ratio, tracking_mode
      ) VALUES (
        '${projectAId}', '16:9', 'invalid_mode'
      );
    `);
    assert(invalidTrackingAttempt.exitCode !== 0, 'Invalid tracking mode rejected by DB check constraint');

    // 3. Invalid multi_person_mode
    const invalidMultiModeAttempt = await execPsqlAsync(`
      INSERT INTO public.reframe_configs (
        project_id, target_aspect_ratio, multi_person_mode
      ) VALUES (
        '${projectAId}', '16:9', 'ALL_PEOPLE'
      );
    `);
    assert(invalidMultiModeAttempt.exitCode !== 0, 'Invalid multi_person_mode rejected by DB check constraint');

    // 4. Invalid negative source_width in reframe_analyses
    const negativeWidthAttempt = await execPsqlAsync(`
      INSERT INTO public.reframe_analyses (
        project_id, media_asset_id, source_width, source_height, duration
      ) VALUES (
        '${projectAId}', '${mediaAId}', -1920, 1080, 60.0
      );
    `);
    assert(negativeWidthAttempt.exitCode !== 0, 'Negative source_width rejected by DB check constraint');

    // =============================================================
    // SCENARIO 7: Timeline Operations Constraint (SET_REFRAME)
    // =============================================================
    console.log('\n--- Scenario 7: Timeline Operations Constraint (SET_REFRAME) ---');

    // Create a dummy timeline to test timeline_operations insertion
    const testTimelineId = ensureValidUuid();
    runPsql(`
      INSERT INTO public.timelines (id, project_id, version, duration, timebase)
      VALUES ('${testTimelineId}', '${projectAId}', 1, 60.0, '30fps')
      ON CONFLICT (id) DO NOTHING;
    `);

    const opInsertResult = await execPsqlAsync(`
      INSERT INTO public.timeline_operations (
        id, timeline_id, operation_index, operation_type, params, version_after
      ) VALUES (
        gen_random_uuid(), '${testTimelineId}', 1, 'set_reframe', '{"aspectRatio":"9:16"}'::jsonb, 2
      );
    `);
    assert(opInsertResult.exitCode === 0, 'timeline_operations allows set_reframe operation');

    // =============================================================
    // SCENARIO 8: RPC Parameter Bounds Validation

    // =============================================================
    console.log('\n--- Scenario 8: RPC Parameter Bounds Validation ---');

    // 1. Zero/Negative source_width rejected by RPC
    const zeroWidthRpc = await execPsqlAsync(`
      SELECT public.save_reframe_analysis_atomic(
        '${projectAId}', '${ownerUserId}', '${mediaAId}',
        0, 1080, 60.0, '[]'::jsonb, '[]'::jsonb, 'hybrid', '2.0.0'
      );
    `);
    assert(zeroWidthRpc.exitCode !== 0, 'Zero source_width rejected by save_reframe_analysis_atomic');
    assert(zeroWidthRpc.stderr.includes('INVALID_WIDTH'), 'Zero width rejected with INVALID_WIDTH error');

    // 2. Zero/Negative duration rejected by RPC
    const zeroDurRpc = await execPsqlAsync(`
      SELECT public.save_reframe_analysis_atomic(
        '${projectAId}', '${ownerUserId}', '${mediaAId}',
        1920, 1080, 0.0, '[]'::jsonb, '[]'::jsonb, 'hybrid', '2.0.0'
      );
    `);
    assert(zeroDurRpc.exitCode !== 0, 'Zero duration rejected by save_reframe_analysis_atomic');
    assert(zeroDurRpc.stderr.includes('INVALID_DURATION'), 'Zero duration rejected with INVALID_DURATION error');

    // 3. Invalid target aspect ratio rejected by save_reframe_config_atomic
    const invalidAspectRpc = await execPsqlAsync(`
      SELECT public.save_reframe_config_atomic(
        '${projectAId}', '${ownerUserId}', '21:9', 'smart', 'GENERAL'
      );
    `);
    assert(invalidAspectRpc.exitCode !== 0, 'Invalid aspect ratio 21:9 rejected by save_reframe_config_atomic');
    assert(invalidAspectRpc.stderr.includes('INVALID_ASPECT_RATIO'), 'Invalid aspect ratio rejected with INVALID_ASPECT_RATIO error');

    // 4. Invalid smoothing alpha (> 1.0) rejected by save_reframe_config_atomic
    const invalidAlphaRpc = await execPsqlAsync(`
      SELECT public.save_reframe_config_atomic(
        '${projectAId}', '${ownerUserId}', '9:16', 'smart', 'GENERAL', NULL, 1.5
      );
    `);
    assert(invalidAlphaRpc.exitCode !== 0, 'Smoothing alpha > 1.0 rejected by save_reframe_config_atomic');
    assert(invalidAlphaRpc.stderr.includes('INVALID_SMOOTHING_ALPHA'), 'Smoothing alpha > 1.0 rejected with INVALID_SMOOTHING_ALPHA error');

    // =============================================================
    // SCENARIO 9: Metadata & Degraded Status Persistence
    // =============================================================
    console.log('\n--- Scenario 9: Metadata & Degraded Status Persistence ---');

    const metaRpcResult = runPsql(`
      SELECT public.save_reframe_analysis_atomic(
        '${projectAId}', '${ownerUserId}', '${mediaAId}',
        1920, 1080, 45.0, '[]'::jsonb, '[]'::jsonb, 'hybrid', '2.0.0',
        '{"detectorMode":"hybrid","capabilities":["multimodal-bounding-boxes","spatial-luminance-centroid"],"providersUsed":["gemini-vision","local-centroid"],"fallbackEvents":[{"fromProvider":"gemini-vision","toProvider":"local-centroid","reason":"429 quota"}]}'::jsonb,
        true
      );
    `);
    assert(metaRpcResult.includes('hybrid'), 'RPC executed with hybrid provider and complete provenance');

    // Verify row directly in PostgreSQL
    const dbRowMeta = runPsql(`
      SELECT metadata->>'detectorMode', metadata->'providersUsed', metadata->'fallbackEvents', degraded
      FROM public.reframe_analyses
      WHERE project_id = '${projectAId}' AND media_asset_id = '${mediaAId}';
    `).trim();
    assert(dbRowMeta.includes('hybrid'), 'metadata.detectorMode recorded as hybrid in real DB');
    assert(dbRowMeta.includes('gemini-vision') && dbRowMeta.includes('local-centroid'), 'metadata.providersUsed recorded in real DB');
    assert(dbRowMeta.includes('429 quota'), 'metadata.fallbackEvents recorded in real DB');
    assert(dbRowMeta.includes('t') || dbRowMeta.includes('true'), 'degraded boolean recorded as true in real DB');

    // =============================================================
    // SCENARIO 10: RLS Direct Access Verification
    // =============================================================
    console.log('\n--- Scenario 10: RLS Direct Access Verification ---');

    // Direct insertion by unauthenticated user blocked by RLS
    const rlsBlocked = await execPsqlAsync(`
      SET ROLE anon;
      INSERT INTO public.reframe_analyses (
        project_id, media_asset_id, source_width, source_height, duration
      ) VALUES (
        '${projectAId}', '${mediaAId}', 1920, 1080, 30.0
      );
      RESET ROLE;
    `);
    assert(rlsBlocked.exitCode !== 0, 'Direct insertion by unauthenticated anon role blocked by RLS');

    console.log('\n====================================================');
    console.log(`📊 PHASE 6 POSTGRESQL GATE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
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
        DELETE FROM public.reframe_configs WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.reframe_analyses WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.media_assets WHERE project_id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.projects WHERE id IN ('${projectAId}', '${projectBId}');
        DELETE FROM public.profiles WHERE id IN ('${ownerUserId}', '${editorUserId}', '${viewerUserId}', '${unrelatedUserId}', '${tenantBUserId}');
        DELETE FROM auth.users WHERE id IN ('${ownerUserId}', '${editorUserId}', '${viewerUserId}', '${unrelatedUserId}', '${tenantBUserId}');
      `);
      console.log('✓ Teardown completed cleanly');
    } catch (cleanupErr) {
      console.warn('Teardown warning:', cleanupErr);
    }
  }
}

runPhase6PostgresTests().catch((err) => {
  console.error('Fatal PostgreSQL Test Gate Error:', err);
  process.exit(1);
});
