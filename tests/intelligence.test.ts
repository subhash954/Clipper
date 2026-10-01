import { analyzeSpeakers } from '../lib/intelligence/engines/speakerEngine';
import { extractSemanticSegments } from '../lib/intelligence/engines/transcriptEngine';
import { detectHooksInSegments } from '../lib/intelligence/engines/hookDetector';
import { buildStoryArc } from '../lib/intelligence/engines/storyEngine';
import { evaluateStandaloneValue } from '../lib/intelligence/engines/standaloneEvaluator';
import { optimizeClipBoundaries } from '../lib/intelligence/engines/boundaryOptimizer';
import { calculateAIEditorialScore } from '../lib/intelligence/engines/editorialScorer';
import { auditQualityGates } from '../lib/intelligence/engines/qualityGates';
import { clusterCandidateClips } from '../lib/intelligence/engines/duplicateClusterEngine';
import { generateVisualAndBRollOpportunities } from '../lib/intelligence/engines/opportunityEngine';
import { extractCaptionEmphases } from '../lib/intelligence/engines/captionEmphasisEngine';
import { analyzeEditorialPacing } from '../lib/intelligence/engines/paceEngine';
import { classifyContentType } from '../lib/intelligence/engines/classifierEngine';
import { evaluatePlatformFit } from '../lib/intelligence/engines/platformFitEngine';
import { computeAnalysisHash, getCachedIntelligence, setCachedIntelligence, invalidateIntelligenceCache } from '../lib/intelligence/cache';
import { executeWithResilience } from '../lib/intelligence/resilience';
import { analyzeVideoMultimodal } from '../lib/intelligence/orchestrator';

async function runIntelligenceTests() {
  console.log('====================================================');
  console.log('🧠 CLIPPER MULTIMODAL INTELLIGENCE TEST SUITE');
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

  // FIXTURE DATA
  const sampleWords = [
    { word: 'Stop', start: 0.0, end: 0.3, speaker: 'speaker_0' },
    { word: 'building', start: 0.3, end: 0.7, speaker: 'speaker_0' },
    { word: 'a', start: 0.7, end: 0.8, speaker: 'speaker_0' },
    { word: 'brand', start: 0.8, end: 1.2, speaker: 'speaker_0' },
    { word: 'and', start: 1.2, end: 1.4, speaker: 'speaker_0' },
    { word: 'start', start: 1.4, end: 1.8, speaker: 'speaker_0' },
    { word: 'building', start: 1.8, end: 2.2, speaker: 'speaker_0' },
    { word: 'a', start: 2.2, end: 2.3, speaker: 'speaker_0' },
    { word: 'world.', start: 2.3, end: 2.9, speaker: 'speaker_0' },
    { word: 'Most', start: 3.4, end: 3.7, speaker: 'speaker_0' },
    { word: 'creators', start: 3.7, end: 4.2, speaker: 'speaker_0' },
    { word: 'focus', start: 4.2, end: 4.6, speaker: 'speaker_0' },
    { word: 'on', start: 4.6, end: 4.8, speaker: 'speaker_0' },
    { word: 'logos,', start: 4.8, end: 5.3, speaker: 'speaker_0' },
    { word: 'but', start: 5.4, end: 5.6, speaker: 'speaker_0' },
    { word: 'real', start: 5.6, end: 5.9, speaker: 'speaker_0' },
    { word: 'loyalty', start: 5.9, end: 6.4, speaker: 'speaker_0' },
    { word: 'comes', start: 6.4, end: 6.7, speaker: 'speaker_0' },
    { word: 'from', start: 6.7, end: 7.0, speaker: 'speaker_0' },
    { word: 'immersive', start: 7.0, end: 7.5, speaker: 'speaker_0' },
    { word: 'storytelling.', start: 7.5, end: 8.2, speaker: 'speaker_0' },
    { word: 'How', start: 9.0, end: 9.3, speaker: 'speaker_1' },
    { word: 'do', start: 9.3, end: 9.5, speaker: 'speaker_1' },
    { word: 'you', start: 9.5, end: 9.7, speaker: 'speaker_1' },
    { word: 'actually', start: 9.7, end: 10.1, speaker: 'speaker_1' },
    { word: 'execute', start: 10.1, end: 10.5, speaker: 'speaker_1' },
    { word: 'that?', start: 10.5, end: 11.0, speaker: 'speaker_1' },
    { word: 'Step', start: 11.5, end: 11.8, speaker: 'speaker_0' },
    { word: '1', start: 11.8, end: 12.1, speaker: 'speaker_0' },
    { word: 'is', start: 12.1, end: 12.3, speaker: 'speaker_0' },
    { word: 'generating', start: 12.3, end: 12.8, speaker: 'speaker_0' },
    { word: 'a', start: 12.8, end: 12.9, speaker: 'speaker_0' },
    { word: 'clear', start: 12.9, end: 13.3, speaker: 'speaker_0' },
    { word: 'mythology,', start: 13.3, end: 13.9, speaker: 'speaker_0' },
    { word: 'which', start: 14.0, end: 14.2, speaker: 'speaker_0' },
    { word: 'drives', start: 14.2, end: 14.5, speaker: 'speaker_0' },
    { word: '90%', start: 14.5, end: 15.0, speaker: 'speaker_0' },
    { word: 'of', start: 15.0, end: 15.2, speaker: 'speaker_0' },
    { word: 'organic', start: 15.2, end: 15.6, speaker: 'speaker_0' },
    { word: 'retention.', start: 15.6, end: 16.3, speaker: 'speaker_0' },
  ];

  // TEST 1: Speaker Diarization & Dialogue Exchange
  console.log('--- TEST GROUP 1: Speaker Diarization & Q&A ---');
  const speakerRes = analyzeSpeakers({ words: sampleWords, projectId: 'proj-1' });
  assert(speakerRes.profiles.length === 2, 'Detects 2 distinct speakers (got ' + speakerRes.profiles.length + ')');
  assert(speakerRes.profiles[0].displayLabel === 'Speaker A', 'Assigns neutral Speaker A label');
  assert(speakerRes.dialogueExchanges.length === 1, 'Identifies Q&A turn between Speaker B and Speaker A');
  assert(speakerRes.dialogueExchanges[0].questionSpeakerId === 'speaker_1', 'Identifies correct question initiator');

  // TEST 2: Semantic Segments Extraction
  console.log('\n--- TEST GROUP 2: Semantic Segment Parsing ---');
  const semSegments = extractSemanticSegments({ words: sampleWords, projectId: 'proj-1' });
  assert(semSegments.length >= 3, 'Extracted at least 3 semantic segments (got ' + semSegments.length + ')');
  assert(semSegments[0].segmentType === 'contrarian_statement', 'Classifies "Stop building..." as contrarian statement');
  assert(semSegments.some((s) => s.segmentType === 'statistic'), 'Detects statistic segment with 90% metric');

  // TEST 3: Hook Detection
  console.log('\n--- TEST GROUP 3: Hook Detection & Curiosity Gap ---');
  const hooks = detectHooksInSegments({ segments: semSegments, projectId: 'proj-1' });
  assert(hooks.length > 0, 'Discovered valid hook candidates');
  assert(hooks[0].hookType === 'Contrarian', 'Primary hook is Contrarian (got ' + hooks[0].hookType + ')');
  assert(hooks[0].score >= 85, 'Contrarian hook has score >= 85 (got ' + hooks[0].score + ')');
  assert(hooks[0].curiosityGapExplanation.length > 10, 'Generates explanatory curiosity gap rationale');

  // TEST 4: Narrative Story Arc
  console.log('\n--- TEST GROUP 4: Narrative Story Structure ---');
  const storyArc = buildStoryArc({ segments: semSegments, projectId: 'proj-1', durationSeconds: 20 });
  assert(storyArc.beats.length > 0, 'Constructs story beats across timeline');
  assert(storyArc.beats[0].type === 'Hook', 'First beat categorized as Hook');
  assert(storyArc.completenessScore >= 60, 'Narrative completeness scored reasonably');

  // TEST 5: Standalone Value Test & Dangling Pronoun Detection
  console.log('\n--- TEST GROUP 5: Standalone Value & Context Test ---');
  const cleanEval = evaluateStandaloneValue({
    clipText: 'Stop building a brand and start building a world.',
    clipStart: 0,
    clipEnd: 2.9,
    allSegments: semSegments,
  });
  assert(!cleanEval.contextRequired, 'Self-contained thought does not require context expansion');
  assert(cleanEval.standaloneScore >= 80, 'Self-contained thought has high standalone score');

  const danglingEval = evaluateStandaloneValue({
    clipText: 'As I said earlier, this means that you should never do that.',
    clipStart: 9.0,
    clipEnd: 15.0,
    allSegments: semSegments,
  });
  assert(danglingEval.contextRequired, 'Detects dangling transitional phrase "As I said earlier"');
  assert(danglingEval.recommendedAdjustment?.action === 'expand_backward' || danglingEval.recommendedAdjustment?.action === 'reject', 'Recommends backward expansion or rejection');

  // TEST 6: Boundary Optimization
  console.log('\n--- TEST GROUP 6: Boundary Optimization ---');
  const boundary = optimizeClipBoundaries({
    targetStart: 0.1,
    targetEnd: 16.0,
    allWords: sampleWords,
  });
  assert(boundary.recommendedStart <= 0.0, 'Snaps to start word onset with pre-roll padding');
  assert(boundary.recommendedEnd >= 16.3, 'Includes trailing word decay');
  assert(boundary.confidence >= 0.9, 'Boundary optimization confidence is high');

  // TEST 7: AI Editorial Scoring (11 Dimensions)
  console.log('\n--- TEST GROUP 7: AI Editorial Scoring ---');
  const score = calculateAIEditorialScore({
    title: 'Contrarian Brand Secret',
    transcript: 'Stop building a brand and start building a world.',
    durationSeconds: 25,
    wordsCount: 50,
    hook: hooks[0],
    standalone: cleanEval,
  });
  assert(score.label === 'AI EDITORIAL ANALYSIS', 'Score labeled explicitly as AI EDITORIAL ANALYSIS');
  assert(score.overallScore >= 75 && score.overallScore <= 100, 'Overall score bounded between 75 and 100');
  assert(score.dimensionScores.hookQuality >= 80, 'Dimensional hookQuality reflects semantic hook');
  assert(score.dimensionScores.standaloneValue >= 80, 'Dimensional standaloneValue reflects completeness');

  // TEST 8: Quality Gates Audit
  console.log('\n--- TEST GROUP 8: Quality Gates Audit ---');
  const verifiedGate = auditQualityGates({
    wordsCount: 45,
    durationSeconds: 28,
    hasTranscriptAlignment: true,
    standalone: cleanEval,
    isDuplicate: false,
    confidence: 0.92,
    clipText: 'Stop building a brand and start building a world.',
  });
  assert(verifiedGate.status === 'verified', 'Compliant clip passes all 8 quality gates as verified');

  const rejectedGate = auditQualityGates({
    wordsCount: 5,
    durationSeconds: 8, // Below 15s limit
    hasTranscriptAlignment: true,
    standalone: cleanEval,
    isDuplicate: false,
    confidence: 0.92,
    clipText: 'Short clip.',
  });
  assert(rejectedGate.status === 'rejected', 'Sub-15s clip is strictly rejected');
  assert(rejectedGate.failedGates.includes('min_duration'), 'Flags min_duration gate failure');

  // TEST 9: Duplicate Detection & Clustering
  console.log('\n--- TEST GROUP 9: Duplicate Clustering ---');
  const mockClips: any[] = [
    {
      id: 'clip-1',
      start: 0,
      end: 20,
      transcript: 'Stop building a brand and start building a world in 2026.',
      hook: hooks[0],
      editorialScore: { overallScore: 88 },
    },
    {
      id: 'clip-2',
      start: 2,
      end: 22, // 90% overlap with clip 1
      transcript: 'Stop building a brand and start building a world right now.',
      hook: hooks[0],
      editorialScore: { overallScore: 82 },
    },
  ];
  const { clusteredClips, clusters } = clusterCandidateClips(mockClips);
  assert(clusters.length === 1, 'Near-duplicate clips grouped into single cluster');
  assert(clusteredClips[0].isPrimaryInCluster === true, 'Higher scoring clip is marked primary');
  assert(clusteredClips[1].isPrimaryInCluster === false, 'Lower scoring clip is marked alternative');

  // TEST 10: Visual Opportunities & B-Roll Queries
  console.log('\n--- TEST GROUP 10: Visual Opportunities & B-Roll ---');
  const opps = generateVisualAndBRollOpportunities({
    projectId: 'proj-1',
    clipId: 'clip-1',
    transcript: 'Step 1 drives 90% of organic retention.',
    words: sampleWords.slice(27),
  });
  assert(opps.visualOpportunities.some((v) => v.type === 'money_stat_graphic'), 'Generates stat graphic for 90%');
  assert(opps.bRollQueries.length > 0, 'Generates contextual B-roll queries');
  assert(opps.bRollQueries[0].query.split(' ').length >= 4, 'B-roll query is conceptual narrative (not naive single word)');

  // TEST 11: Caption Emphasis Intelligence
  console.log('\n--- TEST GROUP 11: Caption Emphasis ---');
  const emphases = extractCaptionEmphases({
    projectId: 'proj-1',
    words: sampleWords,
  });
  assert(emphases.some((e) => e.text.toUpperCase() === 'STOP'), 'Emphasizes contrarian word "Stop"');
  assert(emphases.some((e) => e.text === '90%'), 'Emphasizes metric "90%" with highlight style');

  // TEST 12: Editorial Pacing & Classification
  console.log('\n--- TEST GROUP 12: Pacing & Classification ---');
  const pacing = analyzeEditorialPacing({ words: sampleWords, projectId: 'proj-1' });
  assert(pacing.length > 0, 'Calculates editorial pacing intervals');
  assert(pacing[0].wordsPerSecond > 0, 'Computes words per second');

  const classification = classifyContentType({
    title: 'The Great Brand Debate',
    transcript: sampleWords.map((w) => w.word).join(' '),
    speakers: speakerRes.profiles,
    scenes: [],
    durationSeconds: 20,
  });
  assert(classification.primaryType === 'Podcast' || classification.primaryType === 'Interview', 'Classifies multi-speaker dialog as Podcast/Interview');

  // TEST 13: Platform Fit Engine
  console.log('\n--- TEST GROUP 13: Platform Fit Engine ---');
  const platformFit = evaluatePlatformFit({
    durationSeconds: 30,
    hook: hooks[0],
    standalone: cleanEval,
    topic: 'Branding & Business',
  });
  assert(platformFit['YouTube Shorts'].score >= 80, 'Evaluates YouTube Shorts fit >= 80');
  assert(platformFit['TikTok'].score >= 80, 'Evaluates TikTok fit >= 80');
  assert(platformFit['LinkedIn'].score >= 75, 'Evaluates LinkedIn business fit >= 75');

  // TEST 14: Caching via Analysis Hash
  console.log('\n--- TEST GROUP 14: Analysis Caching ---');
  const hash1 = computeAnalysisHash({ mediaIdentifier: 'vid-1', transcriptText: 'Hello world' });
  const hash2 = computeAnalysisHash({ mediaIdentifier: 'vid-1', transcriptText: 'Hello world' });
  const hash3 = computeAnalysisHash({ mediaIdentifier: 'vid-1', transcriptText: 'Different text' });
  assert(hash1 === hash2, 'Analysis hash is deterministic for identical media + transcript');
  assert(hash1 !== hash3, 'Analysis hash modifies when transcript changes');

  // TEST 15: Resilience & Error Recording
  console.log('\n--- TEST GROUP 15: Resilience & Failure Handling ---');
  const failureAccumulator: any[] = [];
  let attemptsMade = 0;
  const resilientRes = await executeWithResilience(
    async () => {
      attemptsMade++;
      if (attemptsMade < 2) {
        const err: any = new Error('Rate limit 429');
        err.statusCode = 429;
        throw err;
      }
      return 'success_after_retry';
    },
    { phase: 'test_phase', provider: 'test_provider', maxAttempts: 3 },
    failureAccumulator
  );
  assert(resilientRes === 'success_after_retry', 'Successfully recovered after 429 retry');
  assert(attemptsMade === 2, 'Made exactly 2 attempts');

  // TEST 16: Master Multimodal Orchestration
  console.log('\n--- TEST GROUP 16: Master Multimodal Orchestrator ---');
  const report = await analyzeVideoMultimodal({
    projectId: 'test-orchestrator-proj',
    videoTitle: 'Master Brand World Building',
    durationSeconds: 20,
    words: sampleWords,
    skipCache: true,
  });
  assert(report.status === 'completed', 'Master report status is completed');
  assert(report.candidateClips.length > 0, 'Discovered audited candidate clips');
  assert(report.speakers.length === 2, 'Report includes speaker profiles');
  assert(report.audioMetrics.wordsPerSecond > 0, 'Report includes audio pacing metrics');
  assert(report.visualOpportunities.length > 0, 'Report includes visual graphic opportunities');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIntelligenceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
