import fs from 'fs';
import path from 'path';
import { extractYouTubeVideoId } from '../app/api/youtube/ingest/route';
import { calculateViralScore } from '../lib/scoring/viralScoring';
import { alignClipsToTranscript, convertToRelativeWordTimestamps } from '../lib/alignmentEngine';
import { getStorage } from '../lib/storage';
import { renderClipWithFfmpeg } from '../lib/renderEngine';
import { WordTimestamp, Transcript, Project } from '../lib/types';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 CLIPPER PRODUCTION PIPELINE AUTOMATED TEST SUITE');
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

  // TEST 1: YouTube URL Extraction & Validation
  console.log('--- TEST GROUP 1: YouTube URL Parsing ---');
  assert(
    extractYouTubeVideoId('https://www.youtube.com/watch?v=B_9c1hJGCsw') === 'B_9c1hJGCsw',
    'Standard watch URL'
  );
  assert(
    extractYouTubeVideoId('https://youtu.be/B_9c1hJGCsw') === 'B_9c1hJGCsw',
    'Short youtu.be URL'
  );
  assert(
    extractYouTubeVideoId('https://www.youtube.com/shorts/B_9c1hJGCsw') === 'B_9c1hJGCsw',
    'Shorts URL'
  );
  assert(
    extractYouTubeVideoId('https://www.youtube.com/embed/B_9c1hJGCsw') === 'B_9c1hJGCsw',
    'Embed URL'
  );
  assert(
    extractYouTubeVideoId('https://vimeo.com/123456') === null,
    'Rejects non-YouTube URLs'
  );
  assert(
    extractYouTubeVideoId('invalid string') === null,
    'Rejects arbitrary text'
  );

  // TEST 2: Transparent Viral Scoring Model
  console.log('\n--- TEST GROUP 2: Transparent Viral Scoring ---');
  const scoreResult = calculateViralScore({
    title: 'STOP Building a Brand, START Building a World!',
    importantLine: "You're not just building a brand, you're building a world.",
    whyThisLineIsImportant: 'Reframes marketing into an immersive ecosystem.',
    keyMomentType: 'Contrarian Truth',
    duration: 45,
    wordsCount: 65,
  });

  assert(
    scoreResult.viralScore >= 0 && scoreResult.viralScore <= 100,
    'Viral score is bounded between 0 and 100',
    `got: ${scoreResult.viralScore}`
  );
  assert(
    scoreResult.scoreBreakdown.hook >= 0 && scoreResult.scoreBreakdown.hook <= 100,
    'Hook score breakdown valid'
  );
  assert(
    scoreResult.scoreBreakdown.curiosity >= 0 && scoreResult.scoreBreakdown.curiosity <= 100,
    'Curiosity score breakdown valid'
  );
  assert(
    scoreResult.confidence >= 0 && scoreResult.confidence <= 1.0,
    'Confidence score is bounded between 0.0 and 1.0'
  );
  assert(
    scoreResult.label === 'AI Editorial Score',
    'Labeled transparently as AI Editorial Score'
  );

  // TEST 3: Transcript Alignment & Word Mapping
  console.log('\n--- TEST GROUP 3: Transcript Alignment ---');
  const sampleWords: WordTimestamp[] = [
    { word: 'You', start: 10.0, end: 10.3 },
    { word: 'are', start: 10.3, end: 10.6 },
    { word: 'not', start: 10.6, end: 10.9 },
    { word: 'just', start: 10.9, end: 11.2 },
    { word: 'building', start: 11.2, end: 11.6 },
    { word: 'a', start: 11.6, end: 11.8 },
    { word: 'brand', start: 11.8, end: 12.3 },
    { word: 'you', start: 12.5, end: 12.8 },
    { word: 'are', start: 12.8, end: 13.1 },
    { word: 'building', start: 13.1, end: 13.6 },
    { word: 'a', start: 13.6, end: 13.8 },
    { word: 'world', start: 13.8, end: 14.5 },
  ];

  // Add 40 more padding words to reach reasonable clip length
  for (let i = 1; i <= 40; i++) {
    sampleWords.push({
      word: `insight_${i}`,
      start: parseFloat((14.5 + i * 0.8).toFixed(2)),
      end: parseFloat((14.5 + (i + 1) * 0.8).toFixed(2)),
    });
  }

  const sampleTranscript: Transcript = {
    text: sampleWords.map((w) => w.word).join(' '),
    words: sampleWords,
    source: 'youtube_captions',
  };

  const aligned = alignClipsToTranscript({
    candidates: [
      {
        title: 'Brand World Building Secret',
        importantLine: "You are not just building a brand you are building a world",
        whyThisLineIsImportant: 'Reframes entire branding paradigm.',
        keyMomentType: 'Contrarian Truth',
        bRollKeywords: ['universe', 'growth'],
        aiImagePrompt: 'Cinematic world',
        soundEffects: ['whoosh.mp3'],
        approximateQuote: 'You are not just building a brand',
        startWord: 'You are not',
        endWord: 'building a world',
      },
    ],
    transcript: sampleTranscript,
    totalDurationSeconds: 60,
  });

  assert(aligned.length === 1, 'Aligned clip extracted');
  assert(aligned[0].start < aligned[0].end, 'Clip start is strictly less than clip end');
  assert(aligned[0].duration >= 15 && aligned[0].duration <= 60, 'Clip duration is bounded between 15s and 60s');
  assert(aligned[0].words.length > 0, 'Clip contains real mapped word timestamps');

  // TEST 4: Subtitle Relative Timestamp Conversion
  console.log('\n--- TEST GROUP 4: Subtitle Relative Timestamps ---');
  const absoluteWords: WordTimestamp[] = [
    { word: 'Hello', start: 120.45, end: 120.95 },
    { word: 'World', start: 121.17, end: 121.80 },
  ];
  const relativeWords = convertToRelativeWordTimestamps(absoluteWords, 120.45);
  assert(relativeWords[0].start === 0.0, 'First word relative start is 0.00');
  assert(relativeWords[1].start === 0.72, 'Second word relative start is exactly 0.72s (121.17 - 120.45)');

  // TEST 5: Storage Adapter Persistence
  console.log('\n--- TEST GROUP 5: Storage Abstraction ---');
  const storage = getStorage();
  const testProject: Project = {
    id: `test-proj-${Date.now()}`,
    title: 'Test Verification Project',
    workflowType: 'youtube_to_shorts',
    sourceType: 'youtube',
    durationSeconds: 300,
    status: 'clips_ready',
    clipsCount: 1,
    clips: aligned,
    createdAt: new Date().toISOString(),
  };

  await storage.saveProject(testProject);
  const fetchedProject = await storage.getProject(testProject.id);
  assert(fetchedProject !== null, 'Project persisted and retrieved from storage');
  assert(fetchedProject?.title === testProject.title, 'Retrieved project data matches');

  const testJob = await storage.createRenderJob({
    id: `job-test-${Date.now()}`,
    projectId: testProject.id,
    inputUrl: 'https://example.com/test.mp4',
    status: 'queued',
    progress: 0,
    currentStage: 'Queued',
    createdAt: new Date().toISOString(),
  });

  const fetchedJob = await storage.getRenderJob(testJob.id);
  assert(fetchedJob !== null, 'Render job persisted and retrieved');

  await storage.updateRenderJob(testJob.id, { progress: 50, currentStage: 'Rendering' });
  const updatedJob = await storage.getRenderJob(testJob.id);
  assert(updatedJob?.progress === 50, 'Render job progress update synced');

  // TEST 6: Real FFmpeg 9:16 Video Composition & MP4 Output
  console.log('\n--- TEST GROUP 6: Real FFmpeg 9:16 MP4 Rendering ---');
  const testRenderId = `test-render-${Date.now()}`;
  const outDir = path.join(process.cwd(), 'public', 'exports');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Rendering 3-second 1080x1920 test MP4 with FFmpeg...');
  const renderResult = await renderClipWithFfmpeg(testRenderId, {
    inputMedia: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    startTime: 0,
    duration: 3,
    words: [
      { word: 'TEST', start: 0.5, end: 1.2 },
      { word: 'RENDER', start: 1.3, end: 2.2 },
    ],
    isProUser: true,
  });

  assert(fs.existsSync(renderResult.filePath), 'Render output MP4 exists on filesystem');
  const stat = fs.statSync(renderResult.filePath);
  assert(stat.size > 1000, `Output MP4 has valid non-zero byte size (${stat.size} bytes)`);
  assert(renderResult.outputUrl === `/exports/${testRenderId}.mp4`, 'Valid accessible HTTP output URL generated');

  // Clean up test render file
  try {
    fs.unlinkSync(renderResult.filePath);
  } catch {}

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
