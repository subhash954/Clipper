import fs from 'fs';
import path from 'path';
import { extractYouTubeVideoId } from '../app/api/youtube/ingest/route';
import { calculateViralScore } from '../lib/scoring/viralScoring';
import { 
  alignClipsToTranscript, 
  convertToRelativeWordTimestamps, 
  matchQuoteToTranscript, 
  calculateIntervalOverlap 
} from '../lib/alignmentEngine';
import { detectFillerWords, detectSilences, calculateVoiceEnergy } from '../lib/edl/editDecisionList';
import { getStorage, getMediaStorage } from '../lib/storage';
import { renderClipWithFfmpeg, getFfmpegPath } from '../lib/renderEngine';
import { WordTimestamp, Transcript, Project } from '../lib/types';
import {
  calculateCropDimensions,
  smoothTrackingPath,
  buildFfmpegReframeCropFilter,
  generateReframeTrack,
} from '../lib/reframe/reframeEngine';
import { ReframeTrack, ReframeKeyframe } from '../lib/reframe/types';
import { execSync } from 'child_process';

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
  assert(aligned[0].alignmentStatus === 'verified', 'Clip alignment status is verified');

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

  // TEST 6: Real Edit Decision List (EDL) Detection
  console.log('\n--- TEST GROUP 6: Real Edit Decision List (EDL) ---');
  const wordsWithFillers: WordTimestamp[] = [
    { word: 'So', start: 0.1, end: 0.3 },
    { word: 'um', start: 0.4, end: 0.9 },
    { word: 'basically', start: 1.1, end: 1.7 },
    { word: 'we', start: 2.5, end: 2.8 }, // 0.8s silence pause between 1.7 and 2.5
    { word: 'built', start: 2.8, end: 3.1 },
    { word: 'the', start: 3.1, end: 3.3 },
    { word: 'the', start: 3.3, end: 3.5 }, // stutter / repeated word
    { word: 'system', start: 3.5, end: 4.0 },
  ];

  const detectedFillers = detectFillerWords(wordsWithFillers);
  assert(detectedFillers.length >= 2, `Detected real filler words and stutters (found ${detectedFillers.length})`);
  assert(detectedFillers[0].reason === 'filler', 'First cut identified as filler');

  const detectedSilences = detectSilences(wordsWithFillers, 0.5);
  assert(detectedSilences.length === 1, `Detected silent pause >= 0.5s (found ${detectedSilences.length})`);
  assert(detectedSilences[0].start === 1.7 && detectedSilences[0].end === 2.5, 'Silence bounds mapped accurately');

  const energy = calculateVoiceEnergy(sampleWords);
  assert(energy !== null, 'Voice energy cadence computed');
  assert(energy!.wordsPerSecond > 0, `Words per second computed (${energy?.wordsPerSecond})`);

  // TEST 7: Robust Alignment & Failed Match Protection (Sections 5 & 6)
  console.log('\n--- TEST GROUP 7: Failed Match Protection & Deduplication ---');
  const failedMatch = matchQuoteToTranscript('Non existent hallucinated phrase from an alien galaxy', sampleWords);
  assert(failedMatch.matchType === 'none', 'Non-existent quote matchType is none');
  assert(failedMatch.confidence === 0, 'Non-existent quote confidence is 0.00');

  // Verify interval overlap computation
  const overlap = calculateIntervalOverlap(10, 45, 15, 50); // overlap 15 to 45 (30s) / min(35, 35) = 30/35 ≈ 0.85
  assert(overlap > 0.80, `Overlap correctly detected (${overlap.toFixed(2)})`);

  // TEST 8: Media Storage Adapter (Section 16)
  console.log('\n--- TEST GROUP 8: Media Storage Abstraction ---');
  const mediaStorage = getMediaStorage();
  const testBuffer = Buffer.from('test mp4 content bytes');
  const uploadedPath = await mediaStorage.upload('unit-test-media.mp4', testBuffer, 'video/mp4');
  assert(await mediaStorage.exists('unit-test-media.mp4'), 'Uploaded media exists in storage');
  const downloaded = await mediaStorage.download('unit-test-media.mp4');
  assert(downloaded.toString() === 'test mp4 content bytes', 'Downloaded media bytes match');
  const signedUrl = await mediaStorage.getSignedUrl('unit-test-media.mp4');
  assert(signedUrl.includes('unit-test-media.mp4'), 'Signed media URL generated');
  await mediaStorage.delete('unit-test-media.mp4');
  assert(!(await mediaStorage.exists('unit-test-media.mp4')), 'Deleted media no longer exists');

  // TEST 9: Real FFmpeg 9:16 Video Composition & MP4 Output
  console.log('\n--- TEST GROUP 9: Real FFmpeg 9:16 MP4 Rendering ---');
  const testRenderId = `test-render-${Date.now()}`;
  const outDir = path.join(process.cwd(), 'public', 'exports');
  fs.mkdirSync(outDir, { recursive: true });

  const tempSourcePath = path.join(process.cwd(), 'data', `test_source_${Date.now()}.mp4`);
  fs.mkdirSync(path.dirname(tempSourcePath), { recursive: true });
  execSync(
    `"${getFfmpegPath()}" -y -f lavfi -i testsrc=size=1920x1080:rate=30 -f lavfi -i sine=frequency=1000:sample_rate=44100 -t 4 -c:v libx264 -c:a aac -pix_fmt yuv420p "${tempSourcePath}"`,
    { stdio: 'ignore' }
  );

  console.log('Rendering 3-second 1080x1920 test MP4 with FFmpeg...');
  const renderResult = await renderClipWithFfmpeg(testRenderId, {
    inputMedia: tempSourcePath,
    startTime: 0,
    duration: 3,
    words: [
      { word: 'TEST', start: 0.5, end: 1.2 },
      { word: 'RENDER', start: 1.3, end: 2.2 },
    ],
    isProUser: true,
  });

  try { fs.unlinkSync(tempSourcePath); } catch {}

  assert(fs.existsSync(renderResult.filePath), 'Render output MP4 exists on filesystem');
  const stat = fs.statSync(renderResult.filePath);
  assert(stat.size > 1000, `Output MP4 has valid non-zero byte size (${stat.size} bytes)`);
  assert(renderResult.outputUrl === `/exports/${testRenderId}.mp4`, 'Valid accessible HTTP output URL generated');

  // TEST 10: Auto Reframe Crop Dimensions & Multi-Aspect Ratio Math
  console.log('\n--- TEST GROUP 10: Auto Reframe Crop Dimensions Math ---');
  const crop916 = calculateCropDimensions(1920, 1080, '9:16');
  assert(crop916.cropHeight === 1080, '9:16 on 1080p source preserves full height (1080)');
  assert(crop916.cropWidth === 608, `9:16 crop width is even integer (got ${crop916.cropWidth})`);
  assert(crop916.targetWidth === 1080 && crop916.targetHeight === 1920, '9:16 target dimensions 1080x1920');

  const crop11 = calculateCropDimensions(1920, 1080, '1:1');
  assert(crop11.cropHeight === 1080 && crop11.cropWidth === 1080, '1:1 square crop is 1080x1080');

  const crop169 = calculateCropDimensions(1920, 1080, '16:9');
  assert(crop169.cropWidth === 1920 && crop169.cropHeight === 1080, '16:9 landscape maintains 1920x1080');

  const crop45 = calculateCropDimensions(1920, 1080, '4:5');
  assert(crop45.cropHeight === 1080 && crop45.cropWidth === 864, `4:5 social portrait crop is 864x1080 (got ${crop45.cropWidth}x${crop45.cropHeight})`);

  // TEST 11: Temporal Smoothing & Dead Zone Noise Suppression
  console.log('\n--- TEST GROUP 11: Temporal Smoothing & Dead Zone ---');
  const jitterKeyframes: ReframeKeyframe[] = [
    { time: 0, x: 0.500, y: 0.500, scale: 1.0, confidence: 0.9 },
    { time: 1, x: 0.515, y: 0.510, scale: 1.0, confidence: 0.9 }, // 0.015 movement (< 0.035 dead zone)
    { time: 2, x: 0.520, y: 0.505, scale: 1.0, confidence: 0.9 }, // 0.020 movement (< 0.035 dead zone)
  ];
  const smoothedJitter = smoothTrackingPath(jitterKeyframes, 0.25, 0.035);
  assert(smoothedJitter[1].x === 0.5, `Dead zone suppresses horizontal jitter < 0.035 (got ${smoothedJitter[1].x})`);
  assert(smoothedJitter[2].x === 0.5, `Dead zone suppresses subsequent jitter (got ${smoothedJitter[2].x})`);

  // Significant movement traverses dead zone smoothly
  const panKeyframes: ReframeKeyframe[] = [
    { time: 0, x: 0.20, y: 0.50, scale: 1.0, confidence: 0.9 },
    { time: 1, x: 0.80, y: 0.50, scale: 1.0, confidence: 0.9 }, // 0.60 delta (> 0.035 dead zone)
  ];
  const smoothedPan = smoothTrackingPath(panKeyframes, 0.25, 0.035);
  assert(smoothedPan[1].x > 0.20 && smoothedPan[1].x < 0.80, `EMA smoothly shifts towards target (got ${smoothedPan[1].x})`);

  // TEST 12: Dynamic FFmpeg Reframe Filter Expression Generation
  console.log('\n--- TEST GROUP 12: Dynamic FFmpeg Reframe Filter Expressions ---');
  const centerTrack: ReframeTrack = {
    id: 'track-center',
    sourceWidth: 1920,
    sourceHeight: 1080,
    targetWidth: 1080,
    targetHeight: 1920,
    aspectRatio: '9:16',
    trackingMode: 'center',
    keyframes: [
      { time: 0, x: 0.5, y: 0.5, scale: 1.0, confidence: 1.0 },
      { time: 5, x: 0.5, y: 0.5, scale: 1.0, confidence: 1.0 },
    ],
    version: '2.0.0',
    createdAt: new Date().toISOString(),
  };
  const centerFilter = buildFfmpegReframeCropFilter(centerTrack);
  assert(centerFilter.includes('crop=608:1080:656:0,scale=1080:1920'), `Center crop filter has exact static bounds (${centerFilter})`);

  const manualTrack: ReframeTrack = {
    id: 'track-manual',
    sourceWidth: 1920,
    sourceHeight: 1080,
    targetWidth: 1080,
    targetHeight: 1920,
    aspectRatio: '9:16',
    trackingMode: 'manual',
    manualSettings: { x: 0.2, y: 0.5, zoom: 1.5 },
    keyframes: [],
    version: '2.0.0',
    createdAt: new Date().toISOString(),
  };
  const manualFilter = buildFfmpegReframeCropFilter(manualTrack);
  assert(manualFilter.includes('scale=1080:1920') && !manualFilter.includes('656:0'), `Manual filter calculates custom offset & zoom (${manualFilter})`);

  const smartTrack: ReframeTrack = {
    id: 'track-smart',
    sourceWidth: 1920,
    sourceHeight: 1080,
    targetWidth: 1080,
    targetHeight: 1920,
    aspectRatio: '9:16',
    trackingMode: 'smart',
    keyframes: [
      { time: 0, x: 0.16, y: 0.5, scale: 1.0, confidence: 0.9 }, // Left
      { time: 3, x: 0.50, y: 0.5, scale: 1.0, confidence: 0.9 }, // Center
      { time: 6, x: 0.84, y: 0.5, scale: 1.0, confidence: 0.9 }, // Right
    ],
    version: '2.0.0',
    createdAt: new Date().toISOString(),
  };
  const smartFilter = buildFfmpegReframeCropFilter(smartTrack);
  assert(smartFilter.includes('if(lt(t,') && smartFilter.includes('scale=1080:1920'), `Smart filter builds dynamic piecewise linear interpolation filter (${smartFilter})`);

  // TEST 13: Real FFmpeg End-to-End Reframe Rendering (Multi-Aspect Ratios)
  console.log('\n--- TEST GROUP 13: Real FFmpeg End-to-End Reframe Rendering ---');
  const tempTestDir = path.join(process.cwd(), 'data', 'test_scratch');
  fs.mkdirSync(tempTestDir, { recursive: true });
  const testInputVideo = path.join(tempTestDir, 'synthetic_test_source.mp4');

  // Generate 6-second 1920x1080 source test video with moving box
  const ffmpeg = getFfmpegPath();
  execSync(
    `"${ffmpeg}" -y -f lavfi -i testsrc=size=1920x1080:rate=30 -t 6 -c:v libx264 -pix_fmt yuv420p "${testInputVideo}"`,
    { stdio: 'ignore' }
  );

  assert(fs.existsSync(testInputVideo), 'Created real 1080p source video for reframe testing');

  // Render Smart Centered 9:16
  const smartJobId = `reframe-smart-${Date.now()}`;
  console.log('Rendering 9:16 Smart Centered video with dynamic crop track...');
  const smartResult = await renderClipWithFfmpeg(smartJobId, {
    inputMedia: testInputVideo,
    startTime: 0,
    duration: 5,
    words: [
      { word: 'SMART', start: 0.5, end: 1.5 },
      { word: 'REFRAME', start: 1.6, end: 3.0 },
    ],
    reframeTrack: smartTrack,
    isProUser: true,
  });
  assert(fs.existsSync(smartResult.filePath), 'Smart reframed MP4 was successfully exported');
  assert(smartResult.fileSizeBytes > 10000, `Smart reframed MP4 has valid non-zero size (${smartResult.fileSizeBytes} bytes)`);
  try { fs.unlinkSync(smartResult.filePath); } catch {}

  // Render 1:1 Square
  const squareJobId = `reframe-square-${Date.now()}`;
  console.log('Rendering 1:1 Square video with reframe engine...');
  const squareResult = await renderClipWithFfmpeg(squareJobId, {
    inputMedia: testInputVideo,
    startTime: 0,
    duration: 3,
    words: [{ word: 'SQUARE', start: 0.2, end: 1.0 }],
    aspectRatio: '1:1',
    trackingMode: 'center',
    isProUser: true,
  });
  assert(fs.existsSync(squareResult.filePath), '1:1 Square MP4 was successfully exported');
  try { fs.unlinkSync(squareResult.filePath); } catch {}

  // Verify missing media throws error without synthetic fallback
  let missingMediaThrew = false;
  try {
    await renderClipWithFfmpeg('missing-media-job', {
      inputMedia: '/non/existent/path/video.mp4',
      startTime: 0,
      duration: 3,
      words: [],
    });
  } catch (err: any) {
    missingMediaThrew = true;
    assert(err.message.includes('Source media file could not be acquired'), `Error message correctly reports missing source media: "${err.message}"`);
  }
  assert(missingMediaThrew, 'Render pipeline cleanly fails when media is missing (NO fake synthetic fallback)');

  // Clean up test scratch
  try {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
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
