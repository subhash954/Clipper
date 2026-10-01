import { HookCandidate, HookType, SemanticSegment } from '../types';

/**
 * Real Hook Detection Engine
 * Evaluates segment openings for open loops, contrarian reframing, high-stakes problems,
 * quantitative statistics, and curiosity gaps.
 */
export function detectHooksInSegments(params: {
  segments: SemanticSegment[];
  projectId: string;
}): HookCandidate[] {
  const { segments, projectId } = params;
  const candidates: HookCandidate[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.text.trim();
    const upper = text.toUpperCase();
    const lower = text.toLowerCase();
    const duration = Math.max(0.5, seg.end - seg.start);
    const wps = Number((seg.wordsCount / duration).toFixed(2));

    let hookType: HookType | null = null;
    let baseScore = 65;
    let curiosityExplanation = '';

    // 1. Question Hooks (Open knowledge loops)
    if (text.endsWith('?') || lower.startsWith('why ') || lower.startsWith('how ') || lower.startsWith('what if ')) {
      hookType = 'Question';
      baseScore = 86;
      curiosityExplanation = 'Poses an unresolved question creating an immediate open cognitive loop.';
    }
    // 2. Contrarian Hooks (Confronts established consensus)
    else if (
      upper.includes('NOT ') ||
      upper.includes("DON'T ") ||
      upper.includes('STOP ') ||
      upper.includes('NEVER ') ||
      lower.includes('the truth is') ||
      lower.includes('instead of') ||
      lower.includes('myth')
    ) {
      hookType = 'Contrarian';
      baseScore = 92;
      curiosityExplanation = 'Challenges accepted conventional wisdom with a counter-intuitive premise.';
    }
    // 3. Statistic & Metric Hooks
    else if (/\d+/.test(text) && (text.includes('%') || text.includes('$') || upper.includes('PERCENT') || upper.includes('MILLION') || upper.includes('CRORE') || upper.includes('LAKH'))) {
      hookType = 'Statistic';
      baseScore = 88;
      curiosityExplanation = 'Provides specific, quantitative proof points establishing immediate credibility.';
    }
    // 4. Problem & Pain-Point Hooks
    else if (
      lower.includes('problem') ||
      lower.includes('mistake') ||
      lower.includes('failing') ||
      lower.includes('struggling') ||
      lower.includes('losing')
    ) {
      hookType = 'Problem';
      baseScore = 85;
      curiosityExplanation = 'Confronts an acute, recognizable pain point or costly error.';
    }
    // 5. Transformation Hooks
    else if (
      (lower.includes('went from') || lower.includes('how we built') || lower.includes('zero to')) &&
      /\d+/.test(text)
    ) {
      hookType = 'Transformation';
      baseScore = 89;
      curiosityExplanation = 'Highlights an extreme before-and-after outcome demonstrating proof of concept.';
    }
    // 6. Promise & Framework Hooks
    else if (
      lower.includes('framework') ||
      lower.includes('step') ||
      lower.includes('system') ||
      lower.includes('formula') ||
      lower.includes('secret')
    ) {
      hookType = 'Promise';
      baseScore = 84;
      curiosityExplanation = 'Promises a reproducible, structured methodology to achieve a high-value result.';
    }
    // 7. General Curiosity
    else if (seg.importance >= 80) {
      hookType = 'Curiosity';
      baseScore = 78;
      curiosityExplanation = 'High-salience conceptual assertion with intrinsic narrative tension.';
    }

    if (hookType) {
      // Pacing adjustment: Ideal hook pacing is punchy (2.2 - 3.8 words/sec)
      let scoreModifier = 0;
      if (wps >= 2.2 && wps <= 3.6) {
        scoreModifier += 5;
      } else if (wps < 1.5) {
        scoreModifier -= 6; // Too sluggish
      }

      // Length adjustment: Punchy hooks (< 18 words) perform significantly better
      if (seg.wordsCount <= 16) {
        scoreModifier += 4;
      }

      const finalScore = Math.min(99, Math.max(60, baseScore + scoreModifier));

      candidates.push({
        id: `hook-${i}-${Date.now()}`,
        projectId,
        source: 'transcript',
        start: seg.start,
        end: seg.end,
        confidence: seg.confidence,
        text,
        hookType,
        score: finalScore,
        pacingWps: wps,
        curiosityGapExplanation: curiosityExplanation,
        evidence: `Semantic pattern: ${hookType} with ${wps} wps delivery cadence`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Sort descending by hook score
  return candidates.sort((a, b) => b.score - a.score);
}
