import {
  createDefaultRenderSpec,
  trimClip,
  splitClipAt,
  moveClip,
  deleteClip,
  setCanvasAspectRatio,
  insertBRollClip,
} from '../lib/editor/timelineEngine';
import {
  EditorCommandManager,
  createEditorCommand,
} from '../lib/editor/commandHistory';
import { VersionService } from '../lib/editor/versionService';
import {
  extractSpeechIntervals,
  dbToLinear,
  calculateDuckingKeyframes,
  buildFfmpegDuckingFilter,
} from '../lib/editor/audioAutomation';
import { parseAIEditCommand } from '../lib/editor/aiEditCommands';
import {
  validateRenderSpec,
  compileRenderSpecToClipOptions,
} from '../lib/editor/renderSpecCompiler';
import { CanonicalRenderSpec } from '../lib/editor/types';

async function runEditorTests() {
  console.log('====================================================');
  console.log('🎬 CLIPPER MISSION 4: STUDIO EDITOR TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  const dummyWords = [
    { word: 'Hello', start: 0.2, end: 0.6 },
    { word: 'world', start: 0.7, end: 1.1 },
    { word: 'um', start: 1.5, end: 1.8 },
    { word: 'this', start: 2.2, end: 2.5 },
    { word: 'is', start: 2.6, end: 2.8 },
    { word: 'groundbreaking', start: 3.0, end: 3.7 },
  ];

  let baseSpec: CanonicalRenderSpec = createDefaultRenderSpec({
    projectId: 'proj-unit-test-1',
    sourceUrl: '/mock/video.mp4',
    durationSeconds: 30,
    width: 1920,
    height: 1080,
    words: dummyWords,
  });

  console.log('--- TEST GROUP 1: Canonical RenderSpec & Timeline Operations ---');
  assert(baseSpec.projectId === 'proj-unit-test-1', 'RenderSpec preserves projectId');
  assert(baseSpec.canvas.aspectRatio === '9:16', 'Default canvas aspect ratio is 9:16 vertical');
  assert(baseSpec.canvas.width === 1080 && baseSpec.canvas.height === 1920, 'Target dimensions 1080x1920');
  assert(baseSpec.duration === 30, 'Duration is 30 seconds');

  const videoTrack = baseSpec.tracks.find((t) => t.type === 'VIDEO');
  assert(Boolean(videoTrack && videoTrack.clips.length === 1), 'VIDEO track contains 1 source clip');
  assert(videoTrack!.clips[0].start === 0 && videoTrack!.clips[0].end === 30, 'Clip spans [0s, 30s]');

  // Non-destructive Trim
  const clipId = videoTrack!.clips[0].id;
  const trimmed = trimClip(baseSpec, clipId, 2.5, 25.0);
  const trimmedClip = trimmed.tracks.find((t) => t.type === 'VIDEO')!.clips[0];
  assert(trimmedClip.start === 2.5 && trimmedClip.end === 25.0, 'Trims start to 2.5s and end to 25.0s');
  assert(trimmedClip.sourceStart === 2.5, 'Source start offset preserves in-point non-destructively');
  assert(trimmed.version === baseSpec.version + 1, 'Version increments on timeline edit');

  // Non-destructive Split
  const split = splitClipAt(baseSpec, clipId, 10.0);
  const newVideoTrack = split.tracks.find((t) => t.type === 'VIDEO')!;
  assert(newVideoTrack.clips.length === 2, 'Splits clip into 2 contiguous parts');
  assert(newVideoTrack.clips[0].start === 0 && newVideoTrack.clips[0].end === 10.0, 'Part 1 spans [0s, 10s]');
  assert(newVideoTrack.clips[1].start === 10.0 && newVideoTrack.clips[1].end === 30, 'Part 2 spans [10s, 30s]');

  // Move clip
  const moved = moveClip(baseSpec, clipId, 5.0);
  const movedClip = moved.tracks.find((t) => t.type === 'VIDEO')!.clips[0];
  assert(movedClip.start === 5.0 && movedClip.end === 35.0, 'Moves clip start to 5.0s');

  // Delete clip
  const afterDelete = deleteClip(baseSpec, clipId);
  assert(afterDelete.tracks.find((t) => t.type === 'VIDEO')!.clips.length === 0, 'Deletes clip from track');

  // Aspect Ratio change
  const square = setCanvasAspectRatio(baseSpec, '1:1');
  assert(square.canvas.width === 1080 && square.canvas.height === 1080, 'Changes canvas to 1:1 square');
  assert(square.exportSettings.preset === 'Square', 'Export preset updates to Square');

  const landscape = setCanvasAspectRatio(baseSpec, '16:9');
  assert(landscape.canvas.width === 1920 && landscape.canvas.height === 1080, 'Changes canvas to 16:9 landscape');

  // Insert B-Roll
  const withBroll = insertBRollClip(baseSpec, {
    title: 'Tech Office Cutaway',
    sourceUrl: 'https://example.com/broll.mp4',
    start: 4.0,
    duration: 3.5,
  });
  const brollTrack = withBroll.tracks.find((t) => t.type === 'BROLL')!;
  assert(brollTrack.clips.length === 1, 'B-Roll track contains inserted clip');
  assert(brollTrack.clips[0].start === 4.0 && brollTrack.clips[0].end === 7.5, 'B-Roll spans [4.0s, 7.5s]');
  assert(brollTrack.clips[0].title === 'Tech Office Cutaway', 'B-Roll title preserved');

  console.log('\n--- TEST GROUP 2: Command History & Deterministic Undo/Redo ---');
  const manager = new EditorCommandManager(baseSpec);
  assert(!manager.canUndo() && !manager.canRedo(), 'Command history initialized empty');

  const trimCmd = createEditorCommand({
    type: 'TRIM_CLIP',
    description: 'Trim start to 2.0s',
    execute: (spec) => trimClip(spec, clipId, 2.0, 20.0),
    undo: () => baseSpec,
  });

  manager.executeCommand(trimCmd);
  assert(manager.canUndo(), 'canUndo is true after command execution');
  assert(!manager.canRedo(), 'canRedo is false after new command');
  assert(manager.getSpec().tracks.find((t) => t.type === 'VIDEO')!.clips[0].start === 2.0, 'Command applied edit');

  const reverted = manager.undo();
  assert(Boolean(reverted), 'Undo succeeds');
  assert(reverted!.tracks.find((t) => t.type === 'VIDEO')!.clips[0].start === 0, 'Reverted clip start to 0s');
  assert(manager.canRedo(), 'canRedo is true after undo');

  const reapplied = manager.redo();
  assert(Boolean(reapplied), 'Redo succeeds');
  assert(reapplied!.tracks.find((t) => t.type === 'VIDEO')!.clips[0].start === 2.0, 'Reapplied clip start to 2.0s');

  console.log('\n--- TEST GROUP 3: Version Control & Timeline Snapshots ---');
  const testProjectId = `proj-ver-test-${Date.now()}`;
  const v1 = await VersionService.saveVersion({
    projectId: testProjectId,
    userId: 'user-001',
    name: 'Version 1 - Raw Ingest',
    description: 'Initial import',
    renderSpec: baseSpec,
  });
  assert(v1.versionNumber === 1, 'Saved Version 1 snapshot');

  const v2 = await VersionService.saveVersion({
    projectId: testProjectId,
    userId: 'user-001',
    name: 'Version 2 - Square Feed',
    description: 'Changed to 1:1',
    renderSpec: square,
  });
  assert(v2.versionNumber === 2, 'Saved Version 2 snapshot');

  const versions = await VersionService.listVersions(testProjectId);
  assert(versions.length >= 2, 'Lists saved version checkpoints');

  const restoredV1 = await VersionService.restoreVersion(testProjectId, 1);
  assert(Boolean(restoredV1 && restoredV1.canvas.aspectRatio === '9:16'), 'Restores Version 1 (9:16)');

  const restoredV2 = await VersionService.restoreVersion(testProjectId, 2);
  assert(Boolean(restoredV2 && restoredV2.canvas.aspectRatio === '1:1'), 'Restores Version 2 (1:1)');

  console.log('\n--- TEST GROUP 4: Smart Audio Ducking & Automation ---');
  const speech = extractSpeechIntervals(dummyWords, 0.5);
  assert(speech.length >= 1, 'Extracts speech intervals from transcript words');
  assert(speech[0].start === 0.2, 'Speech begins at 0.2s');

  const linear = dbToLinear(-12);
  assert(Math.abs(linear - 0.251) < 0.01, '-12dB converts to ~0.251 linear factor');

  const keyframes = calculateDuckingKeyframes(10.0, [{ start: 2.0, end: 5.0 }], {
    duckAmountDb: -12.0,
    attackMs: 150,
    releaseMs: 350,
    baseVolume: 1.0,
  });
  assert(keyframes.length >= 3, 'Calculates volume automation keyframes');
  const speechKf = keyframes.find((k) => k.time >= 2.0 && k.time <= 5.0);
  assert(Boolean(speechKf && Math.abs(speechKf.volume - 0.251) < 0.01), 'Music volume ducked during speech');

  const filter = buildFfmpegDuckingFilter([{ start: 1.5, end: 4.0 }], {
    duckAmountDb: -12.0,
    attackMs: 150,
    releaseMs: 350,
    baseVolume: 1.0,
  });
  assert(filter.includes("volume='if(between(t,1.50,4.00),0.251,1.000)':eval=frame"), 'Builds FFmpeg volume ducking filter');

  console.log('\n--- TEST GROUP 5: AI Edit Commands Engine ---');
  const planSilence = parseAIEditCommand('Remove dead air pauses', baseSpec, {
    silenceThresholdSeconds: 0.3,
  });
  assert(planSilence.recognizedIntent === 'REMOVE_SILENCE', 'Recognizes REMOVE_SILENCE intent');
  assert(planSilence.operations.length === 1, 'Generates silence removal operation');
  const afterSilence = planSilence.apply(baseSpec);
  assert(afterSilence.cuts.length > 0 && afterSilence.cuts[0].type === 'silence', 'Applies silence cuts to RenderSpec');

  const planFillers = parseAIEditCommand('Remove fillers please', baseSpec);
  assert(planFillers.recognizedIntent === 'REMOVE_FILLERS', 'Recognizes REMOVE_FILLERS intent');
  const afterFillers = planFillers.apply(baseSpec);
  assert(afterFillers.cuts.some((c) => c.type === 'filler'), 'Excises verbal filler words');

  const planSpeaker = parseAIEditCommand('Focus on active speaker', baseSpec);
  assert(planSpeaker.recognizedIntent === 'FOCUS_SPEAKER', 'Recognizes FOCUS_SPEAKER intent');
  const afterSpeaker = planSpeaker.apply(baseSpec);
  assert(afterSpeaker.reframe.mode === 'smart', 'Sets reframe mode to smart tracking');

  const planBroll = parseAIEditCommand('Add B-roll cutaways', baseSpec);
  assert(planBroll.recognizedIntent === 'ADD_BROLL', 'Recognizes ADD_BROLL intent');
  const afterBroll = planBroll.apply(baseSpec);
  assert(afterBroll.tracks.find((t) => t.type === 'BROLL')!.clips.length > 0, 'Inserts B-roll clips into timeline');

  const planDuration = parseAIEditCommand('Create a 15 sec version', baseSpec);
  assert(planDuration.recognizedIntent === 'TARGET_DURATION', 'Recognizes TARGET_DURATION intent');
  const afterDuration = planDuration.apply(baseSpec);
  assert(afterDuration.duration === 15, 'Trims timeline duration to 15 seconds');

  console.log('\n--- TEST GROUP 6: RenderSpec Validation & Compiler ---');
  const validResult = validateRenderSpec(baseSpec);
  assert(validResult.valid && validResult.errors.length === 0, 'Valid RenderSpec passes audit');

  const badSpec = {
    ...baseSpec,
    sourceAsset: { ...baseSpec.sourceAsset, url: '' },
    duration: 0,
  };
  const badResult = validateRenderSpec(badSpec);
  assert(!badResult.valid, 'Invalid RenderSpec fails validation');
  assert(badResult.errors.some((e) => e.includes('sourceAsset.url')), 'Flags missing sourceAsset.url');
  assert(badResult.errors.some((e) => e.includes('duration')), 'Flags invalid 0s duration');

  let testSpec = insertBRollClip(baseSpec, {
    title: 'Broll Overlay',
    sourceUrl: '/mock/broll.mp4',
    start: 3.0,
    duration: 2.0,
  });
  testSpec = {
    ...testSpec,
    cuts: [{ id: 'cut-1', type: 'silence', start: 1.0, end: 1.5, reason: 'dead air' }],
  };

  const compiled = compileRenderSpecToClipOptions(testSpec);
  assert(compiled.inputMedia === '/mock/video.mp4', 'Compiled inputMedia is source URL');
  assert(compiled.cuts!.length === 1 && compiled.cuts![0].reason === 'silence', 'Compiled cuts mapped');
  assert(compiled.brollOperations!.length === 1 && compiled.brollOperations![0].label === 'Broll Overlay', 'Compiled B-rolls mapped');
  assert(compiled.words.length === dummyWords.length, 'Captions words preserved');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEditorTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
