import {
  CandidateClip,
  SemanticSegment,
  HookCandidate,
  StoryBeat,
  DialogueExchange,
} from '../types';
import { evaluateStandaloneValue } from './standaloneEvaluator';
import { optimizeClipBoundaries, WordBoundaryInfo } from './boundaryOptimizer';
import { calculateAIEditorialScore } from './editorialScorer';
import { auditQualityGates } from './qualityGates';

export interface ClipDiscoveryInput {
  projectId: string;
  videoTitle: string;
  allWords: Array<{ word: string; start: number; end: number; confidence?: number }>;
  semanticSegments: SemanticSegment[];
  hooks: HookCandidate[];
  storyBeats: StoryBeat[];
  dialogueExchanges: DialogueExchange[];
  targetClipCount?: number;
}

/**
 * Candidate Clip Discovery Engine
 * Synthesizes story beats, opening hooks, and semantic segments into standalone,
 * quality-audited short-form video clips with exact word-level timing.
 */
export function discoverCandidateClips(input: ClipDiscoveryInput): CandidateClip[] {
  const {
    projectId,
    videoTitle,
    allWords,
    semanticSegments,
    hooks,
    storyBeats,
    dialogueExchanges,
    targetClipCount = 5,
  } = input;

  if (allWords.length === 0 || semanticSegments.length === 0) {
    return [];
  }

  const candidatePool: CandidateClip[] = [];

  // 1. Process candidate openings from top hooks
  const primaryHooks = hooks.slice(0, Math.max(targetClipCount * 2, 8));

  for (let hIdx = 0; hIdx < primaryHooks.length; hIdx++) {
    const hook = primaryHooks[hIdx];
    const initialStart = hook.start;

    // Look ahead to find the payoff/conclusion segment between 20s and 55s after hook
    let targetEnd = initialStart + 35; // Default 35s short
    let payoffSummary = 'Primary premise delivered.';
    let payoffText = hook.text;
    let payoffTimestamp = targetEnd;

    // Find downstream segments that complete the thought
    const candidatePayoffs = semanticSegments.filter(
      (s) => s.end > initialStart + 15 && s.end <= initialStart + 60
    );

    if (candidatePayoffs.length > 0) {
      // Prefer actionable advice, conclusion, or statistic as payoff
      const bestPayoff =
        candidatePayoffs.find(
          (s) =>
            s.segmentType === 'conclusion' ||
            s.segmentType === 'actionable_advice' ||
            s.segmentType === 'core_framework' ||
            s.segmentType === 'statistic'
        ) || candidatePayoffs[candidatePayoffs.length - 1];

      targetEnd = bestPayoff.end;
      payoffText = bestPayoff.text;
      payoffSummary = `Concludes with ${bestPayoff.segmentType.replace(/_/g, ' ')}: "${bestPayoff.text.slice(0, 50)}..."`;
      payoffTimestamp = bestPayoff.end;
    }

    // Extract raw transcript text for preliminary standalone evaluation
    const initialWords = allWords.filter((w) => w.start >= initialStart && w.end <= targetEnd);
    const initialText = initialWords.map((w) => w.word).join(' ');

    // 2. Standalone Value Test & Context Expansion
    const standalone = evaluateStandaloneValue({
      clipText: initialText,
      clipStart: initialStart,
      clipEnd: targetEnd,
      allSegments: semanticSegments,
    });

    let effectiveStart = initialStart;
    let effectiveEnd = targetEnd;

    if (standalone.recommendedAdjustment?.action === 'expand_backward' && standalone.recommendedAdjustment.adjustedStart !== undefined) {
      effectiveStart = standalone.recommendedAdjustment.adjustedStart;
    }

    // 3. Boundary Optimization (Snaps to word onsets, avoids syllable cutoffs)
    const boundary = optimizeClipBoundaries({
      targetStart: effectiveStart,
      targetEnd: effectiveEnd,
      allWords,
      minDurationSeconds: 15,
      maxDurationSeconds: 62,
    });

    const finalStart = boundary.recommendedStart;
    const finalEnd = boundary.recommendedEnd;
    const finalDuration = finalEnd - finalStart;

    // Map exact words within the optimized window
    const clipWords = allWords.filter((w) => w.start >= finalStart - 0.05 && w.end <= finalEnd + 0.1);
    const clipTranscript = clipWords.map((w) => w.word).join(' ');

    if (clipWords.length < 8) continue;

    // 4. Generate High-CTR Title
    let clipTitle = `${hook.hookType}: ${hook.text.slice(0, 40)}`;
    if (hook.hookType === 'Contrarian') {
      clipTitle = `The Contrarian Truth About ${videoTitle.slice(0, 25)}`;
    } else if (hook.hookType === 'Statistic') {
      clipTitle = `Proof That Shocked Everyone (${videoTitle.slice(0, 25)})`;
    }

    // 5. Calculate Transparent AI Editorial Score
    const editorialScore = calculateAIEditorialScore({
      title: clipTitle,
      transcript: clipTranscript,
      durationSeconds: finalDuration,
      wordsCount: clipWords.length,
      hook,
      standalone,
    });

    // 6. Audit 8 Quality Gates
    const qualityGate = auditQualityGates({
      wordsCount: clipWords.length,
      durationSeconds: finalDuration,
      hasTranscriptAlignment: clipWords.length > 0,
      standalone,
      isDuplicate: false, // Updated during clustering phase
      confidence: editorialScore.confidence,
      clipText: clipTranscript,
    });

    candidatePool.push({
      id: `clip-${hIdx + 1}-${Date.now()}`,
      projectId,
      source: 'multimodal',
      start: finalStart,
      end: finalEnd,
      confidence: editorialScore.confidence,
      title: clipTitle,
      transcript: clipTranscript,
      words: clipWords,
      hook,
      payoff: {
        text: payoffText,
        timestamp: payoffTimestamp,
        summary: payoffSummary,
      },
      context: {
        summary: standalone.recommendedAdjustment?.reason || 'Context is self-contained.',
        needsExpansion: standalone.contextRequired,
      },
      editorialScore,
      qualityGate,
      standaloneEvaluation: standalone,
      boundary,
      evidence: `Synthesized from ${hook.hookType} hook with ${(editorialScore.overallScore)} editorial score`,
      createdAt: new Date().toISOString(),
    });
  }

  // Sort descending by editorial score
  return candidatePool.sort((a, b) => b.editorialScore.overallScore - a.editorialScore.overallScore);
}
