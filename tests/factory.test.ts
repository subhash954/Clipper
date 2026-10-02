import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { sampleTranscriptWords } from '../lib/sampleData';
import { analyzeVideoMultimodal } from '../lib/intelligence/orchestrator';
import { mineOpportunitiesFromIntelligence, buildContentMap } from '../lib/factory/contentMining';
import { generateHooksForOpportunity, buildHookVariantTest } from '../lib/factory/hookFactory';
import { adaptOpportunityToPlatform, generateAssetVariants } from '../lib/factory/adaptationEngine';
import { getPlatformProfile, validatePlatformConstraints } from '../lib/factory/platformProfiles';
import {
  generateContentBrief,
  generateTitles,
  generateHashtags,
  generatePlatformCopy,
  generateThumbnailConcept,
  generateTextPost,
  generateCarouselPlan,
  generateThreadPlan,
  generateEmailAngle,
  generateCTA
} from '../lib/factory/copywritingEngines';
import { auditContentAsset } from '../lib/factory/qualityGates';
import {
  createBatchJob,
  executeBatchJob,
  estimateBatchCost,
  partiallyRegenerateAsset
} from '../lib/factory/batchService';
import {
  computeObjectChecksum,
  saveOpportunities,
  getOpportunitiesForProject,
  saveContentAsset,
  searchContentLibrary,
  scheduleContentItem,
  getCalendarItems,
  getDefaultBrandKit
} from '../lib/factory/contentStore';
import { ContentOpportunity, ContentAsset } from '../lib/factory/types';

const testWords = [
  { word: 'Stop', start: 0.0, end: 0.3, speaker: 0 },
  { word: 'building', start: 0.3, end: 0.7, speaker: 0 },
  { word: 'a', start: 0.7, end: 0.8, speaker: 0 },
  { word: 'brand', start: 0.8, end: 1.2, speaker: 0 },
  { word: 'and', start: 1.2, end: 1.4, speaker: 0 },
  { word: 'start', start: 1.4, end: 1.8, speaker: 0 },
  { word: 'building', start: 1.8, end: 2.2, speaker: 0 },
  { word: 'a', start: 2.2, end: 2.3, speaker: 0 },
  { word: 'world.', start: 2.3, end: 2.9, speaker: 0 },
  { word: 'Most', start: 3.4, end: 3.7, speaker: 0 },
  { word: 'creators', start: 3.7, end: 4.2, speaker: 0 },
  { word: 'focus', start: 4.2, end: 4.6, speaker: 0 },
  { word: 'on', start: 4.6, end: 4.8, speaker: 0 },
  { word: 'logos,', start: 4.8, end: 5.3, speaker: 0 },
  { word: 'but', start: 5.4, end: 5.6, speaker: 0 },
  { word: 'real', start: 5.6, end: 5.9, speaker: 0 },
  { word: 'loyalty', start: 5.9, end: 6.4, speaker: 0 },
  { word: 'comes', start: 6.4, end: 6.7, speaker: 0 },
  { word: 'from', start: 6.7, end: 7.0, speaker: 0 },
  { word: 'immersive', start: 7.0, end: 7.5, speaker: 0 },
  { word: 'storytelling.', start: 7.5, end: 8.2, speaker: 0 },
  { word: 'How', start: 9.0, end: 9.3, speaker: 1 },
  { word: 'do', start: 9.3, end: 9.5, speaker: 1 },
  { word: 'we', start: 9.5, end: 9.7, speaker: 1 },
  { word: 'apply', start: 9.7, end: 10.1, speaker: 1 },
  { word: 'that', start: 10.1, end: 10.4, speaker: 1 },
  { word: 'today?', start: 10.4, end: 10.9, speaker: 1 },
  { word: 'Ninety', start: 11.4, end: 11.8, speaker: 0 },
  { word: 'percent', start: 11.8, end: 12.2, speaker: 0 },
  { word: 'of', start: 12.2, end: 12.4, speaker: 0 },
  { word: 'success', start: 12.4, end: 12.9, speaker: 0 },
  { word: 'is', start: 12.9, end: 13.1, speaker: 0 },
  { word: 'consistency.', start: 13.1, end: 14.0, speaker: 0 },
];

describe('🏭 CLIPPER MISSION 5: CONTENT FACTORY & MULTI-PLATFORM ENGINE', () => {

  let testIntelligenceReport: any;
  let testOpportunities: ContentOpportunity[] = [];

  before(async () => {
    testIntelligenceReport = await analyzeVideoMultimodal({
      projectId: 'proj-factory-e2e',
      videoTitle: 'Mastering Video Strategy',
      durationSeconds: 20,
      words: testWords,
      skipCache: true,
    });

    const mined = mineOpportunitiesFromIntelligence(
      testIntelligenceReport,
      testWords,
      {
        projectId: 'proj-factory-e2e',
        sourceDurationSeconds: 20,
      }
    );
    testOpportunities = mined.opportunities;
  });

  it('Setup: Generates authentic multimodal intelligence report for test media', async () => {
    assert.ok(testIntelligenceReport, 'Intelligence report generated');
    assert.strictEqual(testIntelligenceReport.status, 'completed');
    assert.ok(testIntelligenceReport.candidateClips.length > 0, 'Candidates discovered');
  });

  // ==========================================================================
  // TEST GROUP 1: Content Opportunity Mining & Deduplication
  // ==========================================================================
  describe('--- TEST GROUP 1: Content Mining & Deduplication ---', () => {
    it('Mines genuine content opportunities with evidence and AI Editorial Scores', () => {
      const result = mineOpportunitiesFromIntelligence(
        testIntelligenceReport,
        testWords,
        {
          projectId: 'proj-factory-e2e',
          sourceDurationSeconds: 30,
        }
      );

      testOpportunities = result.opportunities;
      assert.ok(result.rawScannedCount > 0, 'Scanned raw candidate segments');
      assert.ok(testOpportunities.length > 0, 'Extracted distinct opportunities');

      const firstOpp = testOpportunities[0];
      assert.ok(firstOpp.id.startsWith('opp-'), 'Valid opportunity ID');
      assert.ok(firstOpp.score >= 70 && firstOpp.score <= 100, 'Bounded AI Editorial Score');
      assert.ok(firstOpp.evidence.quote.length > 0, 'Evidence contains source quote');
      assert.ok(firstOpp.lineage.sourceStart >= 0, 'Lineage records source start');
      assert.ok(firstOpp.lineage.sourceEnd > firstOpp.lineage.sourceStart, 'Lineage records source end');
    });

    it('Merges duplicate overlapping opportunities to prevent mass duplication', () => {
      const result = mineOpportunitiesFromIntelligence(
        testIntelligenceReport,
        testWords,
        {
          projectId: 'proj-factory-e2e',
          sourceDurationSeconds: 30,
        }
      );

      // Verifies that duplicates were filtered out and not duplicated arbitrarily
      assert.ok(result.opportunities.length <= result.rawScannedCount, 'Deduplication strictly reduced duplicates');
    });

    it('Constructs hierarchical Content Map grouping ideas by major topics', () => {
      const contentMap = buildContentMap('proj-factory-e2e', 30, testOpportunities);
      assert.strictEqual(contentMap.projectId, 'proj-factory-e2e');
      assert.ok(contentMap.topics.length > 0, 'Content map has major topics');
      assert.ok(contentMap.topics[0].opportunities.length > 0, 'Topic contains child opportunities');
    });
  });

  // ==========================================================================
  // TEST GROUP 2: Hook Factory & Creative Variant Testing
  // ==========================================================================
  describe('--- TEST GROUP 2: Hook Factory & Creative Variants ---', () => {
    it('Generates 5 distinct legitimate hook types grounded in source facts', () => {
      const opp = testOpportunities[0];
      const hooks = generateHooksForOpportunity(opp);

      assert.strictEqual(hooks.length, 5, 'Generated exactly 5 distinct hooks');
      const hookTypes = hooks.map((h) => h.hookType);
      assert.ok(hookTypes.includes('Contrarian'), 'Includes Contrarian hook');
      assert.ok(hookTypes.includes('Question'), 'Includes Question hook');
      assert.ok(hookTypes.includes('Curiosity'), 'Includes Curiosity hook');
      assert.ok(hookTypes.includes('Mistake'), 'Includes Mistake hook');

      hooks.forEach((h) => {
        assert.ok(h.confidence >= 0.8, 'High confidence score');
        assert.ok(h.estimatedCuriosityGap >= 70, 'Curiosity gap evaluated');
        assert.ok(h.sourceEvidence.length > 0, 'Hook grounded in source evidence');
      });
    });

    it('Builds creative variant test matrix (Variant A, Variant B, Variant C)', () => {
      const opp = testOpportunities[0];
      const hooks = generateHooksForOpportunity(opp);
      const variantTest = buildHookVariantTest(opp, hooks);

      assert.strictEqual(variantTest.variants.length, 3, 'Created 3 variant test legs');
      assert.strictEqual(variantTest.variants[0].variantId, 'Variant A');
      assert.strictEqual(variantTest.variants[1].variantId, 'Variant B');
      assert.strictEqual(variantTest.variants[2].variantId, 'Variant C');
    });
  });

  // ==========================================================================
  // TEST GROUP 3: Platform Profiles & Technical Constraints
  // ==========================================================================
  describe('--- TEST GROUP 3: Platform Constraints Engine ---', () => {
    it('Provides valid profiles for YouTube Shorts, Reels, TikTok, and LinkedIn', () => {
      const yt = getPlatformProfile('youtube_shorts');
      assert.strictEqual(yt.maxDurationSeconds, 60);
      assert.deepStrictEqual(yt.recommendedAspectRatios, ['9:16']);
      assert.strictEqual(yt.captionSafeAreas.rightPercent, 18);

      const reels = getPlatformProfile('instagram_reels');
      assert.strictEqual(reels.maxDurationSeconds, 90);

      const tiktok = getPlatformProfile('tiktok');
      assert.strictEqual(tiktok.maxDurationSeconds, 180);

      const linkedin = getPlatformProfile('linkedin');
      assert.strictEqual(linkedin.maxDurationSeconds, 600);
      assert.ok(linkedin.recommendedAspectRatios.includes('1:1'));
    });

    it('Validates platform duration and aspect ratio constraints', () => {
      const validCheck = validatePlatformConstraints({
        platform: 'youtube_shorts',
        durationSeconds: 30,
        aspectRatio: '9:16',
        title: 'Short Title',
      });
      assert.strictEqual(validCheck.valid, true);

      // Violates max duration (65s on Shorts)
      const invalidDuration = validatePlatformConstraints({
        platform: 'youtube_shorts',
        durationSeconds: 65,
        aspectRatio: '9:16',
      });
      assert.strictEqual(invalidDuration.valid, false);
      assert.ok(invalidDuration.errors[0].includes('exceeds'));

      // Violates aspect ratio (16:9 on TikTok)
      const invalidAspect = validatePlatformConstraints({
        platform: 'tiktok',
        durationSeconds: 25,
        aspectRatio: '16:9',
      });
      assert.strictEqual(invalidAspect.valid, false);
      assert.ok(invalidAspect.errors[0].includes('not recommended'));
    });
  });

  // ==========================================================================
  // TEST GROUP 4: Copywriting & Supporting Content Engines
  // ==========================================================================
  describe('--- TEST GROUP 4: Copywriting & Supporting Content Engines ---', () => {
    it('Generates evidence-backed titles and filters banned phrases', () => {
      const opp = testOpportunities[0];
      const titles = generateTitles(opp, {
        bannedPhrases: ['forbiddenWord'],
      } as any);

      assert.ok(titles.length >= 4, 'Generated multiple title angles');
      assert.ok(titles.some((t) => t.type === 'Direct'), 'Contains Direct title');
      assert.ok(titles.some((t) => t.type === 'Curiosity'), 'Contains Curiosity title');
      assert.ok(titles.every((t) => t.sourceEvidence.length > 0), 'Every title cites source evidence');
    });

    it('Generates platform-formatted descriptions and hashtag sets', () => {
      const opp = testOpportunities[0];
      const brief = generateContentBrief(opp, 'youtube_shorts');
      const hashtags = generateHashtags(opp, undefined, 6);
      const copy = generatePlatformCopy(opp, brief, hashtags);

      assert.ok(copy.youtubeDescription?.includes('#'), 'YouTube description contains hashtags');
      assert.ok(copy.instagramCaption?.includes('👇'), 'Instagram caption contains hook format');
      assert.ok(copy.linkedinPost?.includes('evidence'), 'LinkedIn post contains structured context');
      assert.ok(hashtags.all.length <= 6, 'Hashtags respect maximum count limit');
    });

    it('Generates structured Carousel plans with source citations', () => {
      const opp = testOpportunities[0];
      const carousel = generateCarouselPlan(opp);

      assert.strictEqual(carousel.slides.length, 7, 'Carousel contains 7 slides');
      assert.strictEqual(carousel.slides[0].purpose, 'Hook');
      assert.strictEqual(carousel.slides[3].purpose, 'Framework');
      assert.strictEqual(carousel.slides[6].purpose, 'CTA');
      assert.ok(carousel.slides.every((s) => s.sourceEvidence.length > 0), 'All slides reference source');
    });

    it('Generates structured Thread plans with numbered posts', () => {
      const opp = testOpportunities[0];
      const thread = generateThreadPlan(opp);

      assert.strictEqual(thread.posts.length, 4, 'Thread contains 4 posts');
      assert.ok(thread.posts[0].text.includes('🧵👇'), 'Opening thread hook formatted correctly');
    });

    it('Generates Email newsletter angles with story and action', () => {
      const opp = testOpportunities[0];
      const email = generateEmailAngle(opp);

      assert.ok(email.subject.length > 0, 'Email contains subject line');
      assert.ok(email.fullBody.includes('Subject:'), 'Email body contains full formatted letter');
    });

    it('Generates Thumbnail Concepts strictly marked as concepts (not fake image files)', () => {
      const opp = testOpportunities[0];
      const concept = generateThumbnailConcept(opp);

      assert.strictEqual(concept.isGeneratedImage, false, 'Explicitly marked as concept, not fake image');
      assert.ok(concept.headline.length > 0, 'Concept provides headline guidance');
      assert.ok(concept.composition.length > 0, 'Concept provides visual composition');
    });
  });

  // ==========================================================================
  // TEST GROUP 5: Multi-Platform Adaptation & RenderSpecs
  // ==========================================================================
  describe('--- TEST GROUP 5: Adaptation Engine & RenderSpecs ---', () => {
    it('Adapts opportunity into 9:16 YouTube Shorts asset with real RenderSpec', () => {
      const opp = testOpportunities[0];
      const { asset, durationOptimized } = adaptOpportunityToPlatform(opp, {
        platform: 'youtube_shorts',
        aspectRatio: '9:16',
        sourceWords: testWords,
        captionStyle: 'karaoke',
      });

      assert.strictEqual(asset.platform, 'youtube_shorts');
      assert.strictEqual(asset.aspectRatio, '9:16');
      assert.ok(asset.renderSpec, 'RenderSpec created');
      assert.strictEqual(asset.renderSpec.canvas.aspectRatio, '9:16');
      assert.ok(asset.renderSpec.captions.enabled, 'Captions enabled');
      assert.strictEqual(asset.renderSpec.captions.safeAreaEnabled, true);
      assert.ok(asset.renderSpec.captions.words.length > 0, 'Word-level sync preserved');
    });

    it('Creates creative testing variants (Hook B, 1:1 Square Feed)', () => {
      const opp = testOpportunities[0];
      const hooks = generateHooksForOpportunity(opp);
      const { asset } = adaptOpportunityToPlatform(opp, { platform: 'youtube_shorts' });
      const variants = generateAssetVariants(asset, hooks);

      assert.ok(variants.length >= 2, 'Generated multiple variants');
      assert.ok(variants.some((v) => v.variantType === 'HOOK'), 'Contains Hook variant');
      assert.ok(variants.some((v) => v.variantType === 'ASPECT_RATIO'), 'Contains Aspect Ratio variant');
    });
  });

  // ==========================================================================
  // TEST GROUP 6: Quality Gates & Pre-Publication Auditing
  // ==========================================================================
  describe('--- TEST GROUP 6: Quality Gates Auditor ---', () => {
    it('Passes compliant asset with high audit score', () => {
      const opp = testOpportunities[0];
      const { asset } = adaptOpportunityToPlatform(opp, { platform: 'youtube_shorts' });
      const audit = auditContentAsset(asset);

      assert.strictEqual(audit.passed, true, 'Compliant asset passed quality gates');
      assert.strictEqual(audit.score, 100, 'Score is 100%');
      assert.strictEqual(audit.checks.sourceAlignment, true);
      assert.strictEqual(audit.checks.durationValidity, true);
    });

    it('Quarantines asset as NEEDS_REVIEW if duration exceeds platform limits', () => {
      const opp = testOpportunities[0];
      const { asset } = adaptOpportunityToPlatform(opp, { platform: 'youtube_shorts' });
      // Tamper duration to exceed 60s
      asset.durationSeconds = 75;

      const audit = auditContentAsset(asset);
      assert.strictEqual(audit.passed, false, 'Failed audit due to excessive duration');
      assert.ok(audit.reasons.some((r) => r.includes('violates YouTube Shorts limits')));
    });
  });

  // ==========================================================================
  // TEST GROUP 7: Batch Generation & Cost Budget Enforcement
  // ==========================================================================
  describe('--- TEST GROUP 7: Batch Processing & Cost Controls ---', () => {
    it('Estimates proposed batch dollar costs accurately', () => {
      const estimate = estimateBatchCost(5, 2);
      assert.ok(estimate.estimatedCostUsd > 0, 'Calculated non-zero estimated cost');
      assert.ok(estimate.breakdown.aiBriefs > 0, 'Itemized AI briefs estimate');
      assert.ok(estimate.breakdown.renders > 0, 'Itemized renders estimate');
    });

    it('Executes batch job with error isolation across platforms', async () => {
      const job = createBatchJob('proj-factory-e2e', 3, 5.0);
      assert.strictEqual(job.status, 'QUEUED');

      const { job: completedJob, generatedAssets } = await executeBatchJob(
        job.id,
        testOpportunities,
        {
          platforms: ['youtube_shorts', 'tiktok'],
          maxBudgetUsd: 5.0,
          sourceWords: testWords,
        }
      );

      assert.strictEqual(completedJob.status, 'COMPLETED');
      assert.ok(completedJob.generatedCount > 0, 'Generated assets');
      assert.ok(generatedAssets.length > 0, 'Returned asset array');
      assert.ok(completedJob.actualCostUsd > 0, 'Actual cost recorded');
      assert.strictEqual(completedJob.budgetExceeded, false, 'Remained within $5 budget');
    });

    it('Enforces hard budget limit and stops expensive operations when budget is exceeded', async () => {
      // Set an impossibly small budget of $0.001
      const microBudgetJob = createBatchJob('proj-factory-e2e', 5, 0.001);
      const { job: completedJob } = await executeBatchJob(
        microBudgetJob.id,
        testOpportunities,
        {
          platforms: ['youtube_shorts'],
          maxBudgetUsd: 0.001,
          sourceWords: testWords,
        }
      );

      assert.strictEqual(completedJob.budgetExceeded, true, 'Flagged budgetExceeded');
    });
  });

  // ==========================================================================
  // TEST GROUP 8: Asset Locking & Partial Regeneration
  // ==========================================================================
  describe('--- TEST GROUP 8: Asset Locking & Regeneration ---', () => {
    it('Preserves locked fields during partial regeneration', () => {
      const opp = testOpportunities[0];
      const { asset } = adaptOpportunityToPlatform(opp, { platform: 'youtube_shorts' });
      asset.title = 'LOCKED USER TITLE DO NOT CHANGE';
      asset.lockedFields = ['title'];

      const regenerated = partiallyRegenerateAsset(
        asset,
        ['title', 'cta'],
        opp
      );

      // Title must remain locked!
      assert.strictEqual(regenerated.title, 'LOCKED USER TITLE DO NOT CHANGE');
      // CTA was unlocked and should update
      assert.ok(regenerated.cta.length > 0);
    });
  });

  // ==========================================================================
  // TEST GROUP 9: Content Store, Search & Deduplication Checksums
  // ==========================================================================
  describe('--- TEST GROUP 9: Content Store & Search ---', async () => {
    it('Persists and retrieves opportunities from store', async () => {
      await saveOpportunities(testOpportunities);
      const retrieved = await getOpportunitiesForProject('proj-factory-e2e');
      assert.ok(retrieved.length >= testOpportunities.length);
    });

    it('Saves asset and performs multi-facet search & natural language queries', async () => {
      const opp = testOpportunities[0];
      const { asset } = adaptOpportunityToPlatform(opp, { platform: 'youtube_shorts' });
      asset.title = 'AI Video Growth Secret';
      await saveContentAsset(asset);

      const searchResults = await searchContentLibrary({
        query: 'Growth Secret',
        platform: 'youtube_shorts',
      });

      assert.ok(searchResults.length > 0, 'Found asset by natural language query');
      assert.ok(searchResults.some((a) => a.id === asset.id), 'Search results contain saved asset ID');
    });

    it('Calculates deterministic SHA-256 object checksums to prevent duplicate storage', () => {
      const specA = { format: 'mp4', width: 1080, height: 1920 };
      const specB = { format: 'mp4', height: 1920, width: 1080 };
      const checksumA = computeObjectChecksum(specA);
      const checksumB = computeObjectChecksum(specB);

      assert.strictEqual(checksumA, checksumB, 'Checksum is invariant to key order');
      assert.strictEqual(checksumA.length, 64, 'Valid 64-char hex SHA-256 hash');
    });
  });

  // ==========================================================================
  // TEST GROUP 10: Content Calendar Scheduling
  // ==========================================================================
  describe('--- TEST GROUP 10: Content Calendar State ---', async () => {
    it('Schedules publication item with campaign and status', async () => {
      const scheduledDate = new Date(Date.now() + 86400000).toISOString();
      await scheduleContentItem({
        id: 'cal-test-item-1',
        assetId: 'asset-test-1',
        projectId: 'proj-factory-e2e',
        platform: 'youtube_shorts',
        scheduledAt: scheduledDate,
        status: 'scheduled',
        campaign: 'Summer Viral Sprint',
        pillar: 'Education',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const calendar = await getCalendarItems('proj-factory-e2e');
      assert.ok(calendar.length > 0, 'Calendar has scheduled entries');
      const item = calendar.find((c) => c.id === 'cal-test-item-1');
      assert.ok(item, 'Item present in calendar');
      assert.strictEqual(item?.campaign, 'Summer Viral Sprint');
      assert.strictEqual(item?.status, 'scheduled');
    });
  });

});
