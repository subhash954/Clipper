/**
 * CLIPPER MISSION 7: PERFORMANCE INTELLIGENCE & LEARNING ENGINE TEST SUITE
 * Complete verification of Phases 1 through 6.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

import {
  recordSnapshot,
  listSnapshots,
  getLatestSnapshot,
  syncPublicationPerformance,
} from '../lib/analytics/performanceStore';
import { normalizeSnapshot } from '../lib/analytics/normalizationEngine';
import {
  buildAttributionGraph,
  getHookCategoryLeaderboard,
  getDurationLeaderboard,
} from '../lib/analytics/attributionGraph';
import {
  computeLearnedWeights,
  applyLearnedWeightsToOpportunities,
  calibrateEditorialPredictions,
} from '../lib/analytics/learningEngine';
import { PerformanceSnapshot } from '../lib/analytics/types';
import { ContentOpportunity } from '../lib/factory/types';
import { saveContentAsset, saveOpportunities } from '../lib/factory/contentStore';
import { enqueuePublishJob } from '../lib/publishing/queueService';

describe('📊 CLIPPER MISSION 7: PERFORMANCE INTELLIGENCE & LEARNING ENGINE', () => {
  const testWorkspace = `ws-perf-${Date.now()}`;
  const testLineage = {
    sourceProjectId: 'proj-perf-1',
    sourceStart: 0,
    sourceEnd: 30,
    wordCount: 50,
    extractedAt: new Date().toISOString(),
  };
  let assetContrarianId = '';
  let assetQuestionId = '';
  let pubContrarianId = '';
  let pubQuestionId = '';

  before(async () => {
    // Setup test environment directory
    const testDir = path.join(process.cwd(), 'data', 'analytics');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 1. Create Opportunity A with Contrarian Hook
    const oppA: ContentOpportunity = {
      id: `opp-perf-contrarian-${Date.now()}`,
      projectId: 'proj-perf-1',
      sourceStart: 0,
      sourceEnd: 30,
      sourceTranscript: 'Stop building microservices if you have under 100 engineers.',
      topic: 'Stop Building Microservices Too Early',
      subtopic: 'Architecture',
      contentType: 'SHORT_VIDEO',
      hook: 'Stop building microservices if you have under 100 engineers.',
      payoff: 'Monoliths scale to millions of users with lower latency and maintenance overhead.',
      score: 82,
      confidence: 0.90,
      evidence: {
        start: 0,
        end: 30,
        quote: 'Stop building microservices if you have under 100 engineers.',
      },
      platformFit: {
        youtube_shorts: 85,
        instagram_reels: 80,
        tiktok: 75,
        linkedin: 90,
        x: 80,
        facebook: 70,
      },
      pillars: ['Architecture'],
      status: 'COMPLETED',
      lineage: testLineage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveOpportunities([oppA]);

    // 2. Create Asset A
    assetContrarianId = `asset-contrarian-${Date.now()}`;
    await saveContentAsset({
      id: assetContrarianId,
      projectId: 'proj-perf-1',
      opportunityId: oppA.id,
      title: 'Stop Building Microservices Too Early',
      description: 'Why early microservices kill startup velocity.',
      contentType: 'SHORT_VIDEO',
      platform: 'youtube_shorts',
      aspectRatio: '9:16',
      durationSeconds: 28,
      status: 'READY',
      titles: [],
      copy: {},
      hashtags: { broad: [], niche: [], topic: [], brand: [], all: ['#architecture', '#tech'] },
      cta: 'Subscribe for tech architectural audits',
      renderSpec: {
        id: 'rs-1',
        version: 1,
        projectId: 'proj-perf-1',
        duration: 28,
        tracks: [
          {
            id: 'tr-video',
            type: 'VIDEO',
            name: 'Video',
            order: 0,
            isMuted: false,
            isSolo: false,
            isLocked: false,
            clips: [
              {
                id: 'c-1',
                trackId: 'tr-video',
                trackType: 'VIDEO',
                title: 'Main',
                start: 0,
                end: 28,
                sourceStart: 0,
                sourceEnd: 28,
              },
            ],
          },
          {
            id: 'tr-broll',
            type: 'BROLL',
            name: 'B-Roll',
            order: 1,
            isMuted: false,
            isSolo: false,
            isLocked: false,
            clips: [
              {
                id: 'b-1',
                trackId: 'tr-broll',
                trackType: 'BROLL',
                title: 'Server Rack',
                start: 5,
                end: 8,
                sourceStart: 0,
                sourceEnd: 3,
              },
              {
                id: 'b-2',
                trackId: 'tr-broll',
                trackType: 'BROLL',
                title: 'Network Diagram',
                start: 15,
                end: 18,
                sourceStart: 0,
                sourceEnd: 3,
              },
            ],
          },
        ],
      } as any,
      renderedVideoPath: '/renders/contrarian.mp4',
      lockedFields: [],
      lineage: testLineage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Create Opportunity B with Question Hook
    const oppB: ContentOpportunity = {
      id: `opp-perf-question-${Date.now()}`,
      projectId: 'proj-perf-1',
      sourceStart: 30,
      sourceEnd: 75,
      sourceTranscript: 'What is Docker and how does it actually work under the hood?',
      topic: 'What Is Docker Containerization?',
      subtopic: 'DevOps',
      contentType: 'SHORT_VIDEO',
      hook: 'What is Docker and how does it actually work under the hood?',
      payoff: 'Containers isolate processes using Linux namespaces and cgroups.',
      score: 78,
      confidence: 0.80,
      evidence: {
        start: 30,
        end: 75,
        quote: 'What is Docker and how does it actually work under the hood?',
      },
      platformFit: {
        youtube_shorts: 75,
        instagram_reels: 70,
        tiktok: 70,
        linkedin: 75,
        x: 75,
        facebook: 65,
      },
      pillars: ['DevOps'],
      status: 'COMPLETED',
      lineage: testLineage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveOpportunities([oppB]);

    // 4. Create Asset B
    assetQuestionId = `asset-question-${Date.now()}`;
    await saveContentAsset({
      id: assetQuestionId,
      projectId: 'proj-perf-1',
      opportunityId: oppB.id,
      title: 'What Is Docker Containerization?',
      description: 'Understanding containers in 45 seconds.',
      contentType: 'SHORT_VIDEO',
      platform: 'youtube_shorts',
      aspectRatio: '9:16',
      durationSeconds: 45,
      status: 'READY',
      titles: [],
      copy: {},
      hashtags: { broad: [], niche: [], topic: [], brand: [], all: ['#docker'] },
      cta: 'Follow for DevOps tips',
      renderSpec: {
        id: 'rs-2',
        version: 1,
        projectId: 'proj-perf-1',
        duration: 45,
        tracks: [
          {
            id: 'tr-video',
            type: 'VIDEO',
            name: 'Video',
            order: 0,
            isMuted: false,
            isSolo: false,
            isLocked: false,
            clips: [
              {
                id: 'c-2',
                trackId: 'tr-video',
                trackType: 'VIDEO',
                title: 'Main',
                start: 0,
                end: 45,
                sourceStart: 0,
                sourceEnd: 45,
              },
            ],
          },
        ], // 0 B-rolls
      } as any,
      renderedVideoPath: '/renders/question.mp4',
      lockedFields: [],
      lineage: testLineage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    pubContrarianId = `pub-job-contrarian-${Date.now()}`;
    pubQuestionId = `pub-job-question-${Date.now()}`;
  });

  // ==========================================================================
  // GROUP 1: SNAPSHOT STORE & RULE ZERO
  // ==========================================================================
  describe('--- TEST GROUP 1: Performance Snapshot Store & Rule Zero ---', () => {
    test('Persists authentic observed performance snapshot with non-negative metrics', () => {
      const snap = recordSnapshot({
        workspaceId: testWorkspace,
        publicationId: pubContrarianId,
        assetId: assetContrarianId,
        projectId: 'proj-perf-1',
        platform: 'youtube_shorts',
        capturedAt: new Date().toISOString(),
        views: 24500,
        likes: 1850,
        comments: 320,
        shares: 680,
        saves: 840,
        watchTimeSeconds: 588000,
        averageViewDurationSeconds: 24.0, // 24s out of 28s = 85.7% retention!
        completionRate: 0.78,
        engagementRate: 0.12,
      });

      assert.ok(snap.id.startsWith('snap-'));
      assert.strictEqual(snap.views, 24500);
      assert.strictEqual(snap.averageViewDurationSeconds, 24.0);

      const latest = getLatestSnapshot(pubContrarianId, testWorkspace);
      assert.ok(latest);
      assert.strictEqual(latest?.views, 24500);
    });

    test('Rejects invalid negative metrics strictly', () => {
      assert.throws(() => {
        recordSnapshot({
          workspaceId: testWorkspace,
          publicationId: 'pub-bad',
          assetId: 'asset-bad',
          projectId: 'proj-1',
          platform: 'youtube_shorts',
          capturedAt: new Date().toISOString(),
          views: -100, // Negative!
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          watchTimeSeconds: 0,
          averageViewDurationSeconds: 0,
        });
      }, /non-negative/);
    });

    test('Rule Zero: Refuses to sync metrics for unpublished or unconfirmed job', async () => {
      const { job } = enqueuePublishJob({
        workspaceId: testWorkspace,
        assetId: assetQuestionId,
        connectionId: 'conn-test',
        platform: 'youtube_shorts',
        scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        mediaFilePath: '/renders/question.mp4',
        metadata: { title: 'Pending', description: '', hashtags: [], privacy: 'public' },
      });

      const res = await syncPublicationPerformance(job.id, testWorkspace);
      assert.strictEqual(res.success, false, 'Refuses sync');
      assert.ok(res.error?.includes('unpublished'), 'Flags job as unpublished');
    });
  });

  // ==========================================================================
  // GROUP 2: METRIC NORMALIZATION
  // ==========================================================================
  describe('--- TEST GROUP 2: Metric Normalization Across Platforms ---', () => {
    test('Applies platform friction multipliers (YouTube 1.25x vs TikTok 0.85x)', () => {
      const baseSnap: PerformanceSnapshot = {
        id: 'snap-norm-1',
        workspaceId: testWorkspace,
        publicationId: 'pub-1',
        assetId: 'asset-1',
        projectId: 'proj-1',
        platform: 'youtube_shorts',
        capturedAt: new Date().toISOString(),
        views: 10000,
        likes: 500,
        comments: 50,
        shares: 100,
        saves: 150,
        watchTimeSeconds: 200000,
        averageViewDurationSeconds: 20,
        completionRate: 0.65,
        createdAt: new Date().toISOString(),
      };

      const normYt = normalizeSnapshot(baseSnap, 30);
      assert.strictEqual(normYt.standardizedViews, 12500, 'YouTube 10k views standardized to 12.5k (1.25x)');

      const ttSnap = { ...baseSnap, platform: 'tiktok' as const };
      const normTt = normalizeSnapshot(ttSnap, 30);
      assert.strictEqual(normTt.standardizedViews, 8500, 'TikTok 10k views standardized to 8.5k (0.85x)');
    });

    test('Computes weighted engagement rate and composite performance score', () => {
      const highEngagementSnap: PerformanceSnapshot = {
        id: 'snap-norm-2',
        workspaceId: testWorkspace,
        publicationId: 'pub-2',
        assetId: 'asset-2',
        projectId: 'proj-1',
        platform: 'youtube_shorts',
        capturedAt: new Date().toISOString(),
        views: 1000,
        likes: 100,      // 100 * 1.0 = 100
        comments: 30,    // 30 * 2.0 = 60
        shares: 40,      // 40 * 3.0 = 120
        saves: 20,       // 20 * 2.5 = 50 -> sum = 330 / 1000 = 0.33
        watchTimeSeconds: 25000,
        averageViewDurationSeconds: 25, // 25s / 30s = 0.833
        completionRate: 0.80,
        createdAt: new Date().toISOString(),
      };

      const norm = normalizeSnapshot(highEngagementSnap, 30);
      assert.strictEqual(norm.normalizedEngagementRate, 0.33);
      assert.ok(norm.compositePerformanceScore >= 80, 'High engagement & retention scores >= 80/100');
    });
  });

  // ==========================================================================
  // GROUP 3: ATTRIBUTION & LEADERBOARDS
  // ==========================================================================
  describe('--- TEST GROUP 3: Creative Attribution & Leaderboards ---', () => {
    before(() => {
      // Record snapshot for Asset B (Question hook, lower engagement)
      recordSnapshot({
        workspaceId: testWorkspace,
        publicationId: pubQuestionId,
        assetId: assetQuestionId,
        projectId: 'proj-perf-1',
        platform: 'youtube_shorts',
        capturedAt: new Date().toISOString(),
        views: 8200,
        likes: 210,
        comments: 18,
        shares: 22,
        saves: 30,
        watchTimeSeconds: 123000,
        averageViewDurationSeconds: 15.0, // 15s out of 45s = 33% retention
        completionRate: 0.35,
        engagementRate: 0.04,
      });
    });

    test('Builds attribution graph linking publication to hook category and B-rolls', async () => {
      const graph = await buildAttributionGraph(testWorkspace);
      assert.ok(graph.length >= 2, 'Attribution graph contains analyzed items');

      const contrarianItem = graph.find((g) => g.hookCategory === 'Contrarian');
      assert.ok(contrarianItem, 'Found Contrarian hook item');
      assert.strictEqual(contrarianItem?.bRollCount, 2, 'Traced 2 B-roll cuts on timeline');
      assert.strictEqual(contrarianItem?.durationSeconds, 28);

      const questionItem = graph.find((g) => g.hookCategory === 'Question');
      assert.ok(questionItem, 'Found Question hook item');
      assert.strictEqual(questionItem?.bRollCount, 0, 'Traced 0 B-rolls on timeline');
    });

    test('Ranks Contrarian hooks above Question hooks on the leaderboard', async () => {
      const leaderboard = await getHookCategoryLeaderboard(testWorkspace);
      assert.ok(leaderboard.length >= 2, 'Leaderboard has categories');

      const topCategory = leaderboard[0];
      assert.strictEqual(topCategory.dimension, 'Contrarian', 'Contrarian hook wins top rank');
      assert.ok(topCategory.relativePerformanceMultiplier > 1.2, 'Contrarian multiplier > 1.2x baseline');
    });

    test('Discovers duration sweet spot leaderboard', async () => {
      const durationBoard = await getDurationLeaderboard(testWorkspace);
      assert.ok(durationBoard.length >= 1);
      // 28s falls into 20s - 40s bracket
      const sweetSpot = durationBoard.find((d) => d.dimension === '20s - 40s');
      assert.ok(sweetSpot, 'Identified 20s - 40s bracket');
      assert.ok(sweetSpot!.averageCompletionRate >= 0.7, 'High completion in sweet spot');
    });
  });

  // ==========================================================================
  // GROUP 4: LEARNING ENGINE & FEEDBACK LOOP
  // ==========================================================================
  describe('--- TEST GROUP 4: Continuous Learning Engine & Feedback Loop ---', () => {
    test('Calculates learned weights and actionable strategic recommendations', async () => {
      const learned = await computeLearnedWeights(testWorkspace);
      assert.strictEqual(learned.workspaceId, testWorkspace);
      assert.ok(learned.totalPublicationsAnalyzed >= 2);

      // Verify category weights
      assert.ok(learned.hookCategoryWeights['Contrarian'] > 1.0, 'Contrarian weight boosted');

      // Verify B-roll preference
      assert.strictEqual(learned.bRollDensityPreference, 'HIGH', 'High B-roll pacing preferred');

      // Verify recommendations generated
      assert.ok(learned.recommendations.length >= 1, 'Generated strategic recommendations');
      assert.ok(learned.recommendations.some((r) => r.type === 'HOOK_STRATEGY'));
    });

    test('Closes feedback loop: Re-scores Content Factory opportunities dynamically', async () => {
      const learned = await computeLearnedWeights(testWorkspace);

      const candidateOpportunities: ContentOpportunity[] = [
        {
          id: 'opp-candidate-1',
          projectId: 'proj-new',
          sourceStart: 0,
          sourceEnd: 20,
          sourceTranscript: 'Stop doing X',
          topic: 'Contrarian Topic Candidate',
          subtopic: 'Opinion',
          contentType: 'SHORT_VIDEO',
          hook: 'Stop doing X',
          payoff: 'Do Y instead',
          score: 80,
          confidence: 0.80,
          evidence: { start: 0, end: 20, quote: 'Stop doing X' },
          platformFit: { youtube_shorts: 80, instagram_reels: 80, tiktok: 80, linkedin: 80, x: 80, facebook: 80 },
          pillars: [],
          status: 'DISCOVERED',
          lineage: testLineage,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const reScored = applyLearnedWeightsToOpportunities(candidateOpportunities, learned);
      assert.ok(
        reScored[0].score > 80,
        `Contrarian opportunity score boosted from 80 to ${reScored[0].score} based on empirical performance`
      );
    });

    test('Calibrates AI editorial predictions against observed performance', async () => {
      const calibrations = await calibrateEditorialPredictions(testWorkspace);
      assert.ok(calibrations.length >= 2);
      assert.ok(calibrations.every((c) => typeof c.variance === 'number'));
    });
  });
});
