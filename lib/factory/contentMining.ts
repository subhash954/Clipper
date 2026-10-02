/**
 * CLIPPER CONTENT FACTORY — CONTENT MINING & DEDUPLICATION ENGINE
 * Phase 1, 3, 4, 5
 * 
 * Mines genuine, distinct content opportunities from Mission 3 Multimodal Intelligence
 * and performs strict semantic & timeline deduplication to prevent mass duplication.
 */

import { 
  IntelligenceReport, 
  SemanticSegment, 
  CandidateClip, 
  HookCandidate 
} from '@/lib/intelligence/types';
import { WordTimestamp } from '@/lib/types';
import { 
  ContentOpportunity, 
  ContentMap, 
  ContentMapTopic, 
  SupportedPlatform,
  OpportunityStatus 
} from './types';

export interface MiningOptions {
  projectId: string;
  sourceDurationSeconds: number;
  minOpportunityDurationSeconds?: number; // default 15s
  maxOpportunityDurationSeconds?: number; // default 180s
  targetPillars?: string[];
  audience?: string;
}

/**
 * Calculates token overlap similarity between two text snippets
 */
function calculateTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculates temporal overlap between two [start, end] ranges: intersection / min(durationA, durationB)
 */
function calculateTimeOverlapRatio(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number {
  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  if (overlapEnd <= overlapStart) return 0;

  const overlapDuration = overlapEnd - overlapStart;
  const minDuration = Math.min(endA - startA, endB - startB);
  return minDuration <= 0 ? 0 : overlapDuration / minDuration;
}

/**
 * Determines content pillars based on semantic category and content
 */
function inferPillars(segmentType?: string, text?: string): string[] {
  const pillars: string[] = [];
  const lower = (text || '').toLowerCase();

  if (segmentType === 'contrarian_statement' || lower.includes('stop') || lower.includes('mistake') || lower.includes('wrong')) {
    pillars.push('Contrarian');
  }
  if (segmentType === 'statistic' || segmentType === 'claim' || lower.includes('%') || lower.includes('percent')) {
    pillars.push('Case Studies', 'Education');
  }
  if (segmentType === 'actionable_advice' || segmentType === 'core_framework' || lower.includes('how to') || lower.includes('framework')) {
    pillars.push('Tutorial', 'Education');
  }
  if (segmentType === 'story' || segmentType === 'analogy' || lower.includes('when i') || lower.includes('years ago')) {
    pillars.push('Storytelling', 'Personal Brand');
  }
  if (pillars.length === 0) {
    pillars.push('Education');
  }
  return Array.from(new Set(pillars));
}

/**
 * Mines raw candidate opportunities from Master Intelligence Report
 */
export function mineOpportunitiesFromIntelligence(
  report: IntelligenceReport,
  words: WordTimestamp[],
  options: MiningOptions
): { opportunities: ContentOpportunity[]; rawScannedCount: number; deduplicatedCount: number } {
  const rawOpportunities: ContentOpportunity[] = [];
  const now = new Date().toISOString();

  // 1. Process validated candidate clips from Mission 3
  const candidates = report.candidateClips || (report as any).contentCandidates || [];
  for (const candidate of candidates) {
    // Find matching transcript words
    const matchingWords = words.filter(
      (w) => w.start >= candidate.start - 0.2 && w.end <= candidate.end + 0.2
    );
    const transcriptText = matchingWords.map((w) => w.word).join(' ');

    const hookText = (candidate as any).hook?.text || (candidate as any).hookAnalysis?.hookText || candidate.title;
    const payoffText = (candidate as any).payoff?.text || candidate.title;
    const pillars = inferPillars(undefined, transcriptText);

    // Compute platform fit based on duration and editorial score
    const duration = (candidate as any).duration || (candidate.end - candidate.start);
    const baseScore = candidate.editorialScore?.overallScore || 80;
    const confidence = candidate.editorialScore?.confidence || 0.9;
    const subtopic = (candidate as any).hook?.hookType || (candidate as any).hookAnalysis?.hookType || 'Key Highlight';

    const platformFit: Record<SupportedPlatform, number> = {
      youtube_shorts: duration <= 60 ? Math.min(99, Math.round(baseScore * 1.02)) : 40,
      instagram_reels: duration <= 90 ? Math.min(99, Math.round(baseScore * 0.98)) : 45,
      tiktok: duration <= 180 ? Math.min(99, Math.round(baseScore * 1.05)) : 50,
      linkedin: duration >= 20 ? Math.min(95, Math.round(baseScore * 0.95)) : 60,
      x: duration <= 140 ? Math.min(95, Math.round(baseScore * 0.94)) : 50,
      facebook: Math.min(92, Math.round(baseScore * 0.90)),
    };

    rawOpportunities.push({
      id: `opp-${candidate.id}`,
      projectId: options.projectId,
      sourceStart: candidate.start,
      sourceEnd: candidate.end,
      sourceTranscript: transcriptText || candidate.title,
      topic: candidate.title.split(':')[0] || 'Core Insight',
      subtopic,
      contentType: duration <= 60 ? 'YOUTUBE_SHORT' : 'SHORT_VIDEO',
      hook: hookText,
      payoff: payoffText,
      audience: options.audience || 'Creators & Knowledge Seekers',
      score: baseScore,
      confidence,
      evidence: {
        start: candidate.start,
        end: candidate.end,
        quote: transcriptText.slice(0, 160),
      },
      platformFit,
      pillars,
      status: 'DISCOVERED',
      lineage: {
        sourceProjectId: options.projectId,
        sourceClipId: candidate.id,
        sourceStart: candidate.start,
        sourceEnd: candidate.end,
        wordCount: matchingWords.length,
        extractedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  // 2. Process high-value semantic segments (frameworks, statistics, contrarian statements)
  if (report.semanticSegments && report.semanticSegments.length > 0) {
    for (const segment of report.semanticSegments) {
      if (segment.importance >= 70) {
        // Build window around this segment
        const segStart = Math.max(0, segment.start - 1.0);
        const segEnd = Math.min(options.sourceDurationSeconds, segment.end + 5.0);
        const segDuration = segEnd - segStart;

        if (segDuration >= (options.minOpportunityDurationSeconds || 15)) {
          const matchingWords = words.filter((w) => w.start >= segStart && w.end <= segEnd);
          const transcriptText = matchingWords.map((w) => w.word).join(' ');

          const pillars = inferPillars(segment.segmentType, segment.text);

          rawOpportunities.push({
            id: `opp-seg-${segment.id}`,
            projectId: options.projectId,
            sourceStart: segStart,
            sourceEnd: segEnd,
            sourceTranscript: transcriptText || segment.text,
            topic: segment.topic || 'Core Insight',
            subtopic: segment.subtopic || segment.segmentType,
            contentType: segment.segmentType === 'statistic' ? 'QUOTE_CARD' : 'REEL',
            hook: segment.text.slice(0, 80),
            payoff: segment.text,
            audience: options.audience || 'Target Audience',
            score: Math.min(95, segment.importance + 5),
            confidence: segment.confidence,
            evidence: {
              start: segment.start,
              end: segment.end,
              quote: segment.text,
              speakerId: segment.speakerId,
              segmentType: segment.segmentType,
            },
            platformFit: {
              youtube_shorts: 82,
              instagram_reels: 85,
              tiktok: 84,
              linkedin: segment.segmentType === 'contrarian_statement' || segment.segmentType === 'statistic' ? 92 : 78,
              x: 88,
              facebook: 75,
            },
            pillars,
            status: 'DISCOVERED',
            lineage: {
              sourceProjectId: options.projectId,
              sourceStart: segStart,
              sourceEnd: segEnd,
              wordCount: matchingWords.length,
              extractedAt: now,
            },
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  }

  // Deduplication Phase (Phase 4)
  const deduplicated: ContentOpportunity[] = [];
  let duplicatesCount = 0;

  for (const candidate of rawOpportunities) {
    let isDuplicate = false;

    for (const existing of deduplicated) {
      const timeOverlap = calculateTimeOverlapRatio(
        candidate.sourceStart,
        candidate.sourceEnd,
        existing.sourceStart,
        existing.sourceEnd
      );
      const textSim = calculateTextSimilarity(
        candidate.sourceTranscript,
        existing.sourceTranscript
      );

      // If heavy overlap in time (>60%) or high semantic text overlap (>65%)
      if (timeOverlap > 0.6 || textSim > 0.65) {
        isDuplicate = true;
        duplicatesCount++;

        // If the newcomer has a higher editorial score, replace the existing one
        if (candidate.score > existing.score) {
          existing.id = candidate.id;
          existing.score = candidate.score;
          existing.hook = candidate.hook;
          existing.payoff = candidate.payoff;
          existing.evidence = candidate.evidence;
          existing.pillars = Array.from(new Set([...existing.pillars, ...candidate.pillars]));
        }
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push(candidate);
    }
  }

  // Sort descending by AI Editorial Score
  deduplicated.sort((a, b) => b.score - a.score);

  return {
    opportunities: deduplicated,
    rawScannedCount: rawOpportunities.length,
    deduplicatedCount: duplicatesCount,
  };
}

/**
 * Builds a hierarchical Content Map (Phase 3) grouping opportunities into major topics
 */
export function buildContentMap(
  projectId: string,
  sourceDurationSeconds: number,
  opportunities: ContentOpportunity[]
): ContentMap {
  const topicMap: Record<string, ContentMapTopic> = {};

  for (const opp of opportunities) {
    const topicKey = opp.topic.trim() || 'General Insights';
    if (!topicMap[topicKey]) {
      topicMap[topicKey] = {
        id: `topic-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`,
        title: topicKey,
        description: `Discussions and ideas covering ${topicKey}`,
        evidenceStart: opp.sourceStart,
        evidenceEnd: opp.sourceEnd,
        opportunities: [],
      };
    }

    topicMap[topicKey].opportunities.push(opp);
    topicMap[topicKey].evidenceStart = Math.min(topicMap[topicKey].evidenceStart, opp.sourceStart);
    topicMap[topicKey].evidenceEnd = Math.max(topicMap[topicKey].evidenceEnd, opp.sourceEnd);
  }

  return {
    projectId,
    sourceDuration: sourceDurationSeconds,
    topics: Object.values(topicMap),
    totalOpportunitiesCount: opportunities.length,
    generatedAt: new Date().toISOString(),
  };
}
