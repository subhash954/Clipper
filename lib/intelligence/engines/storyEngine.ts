import { StoryBeat, StoryBeatType, StoryArc, SemanticSegment } from '../types';

/**
 * Story Structure Engine
 * Analyzes the chronological sequence of semantic segments to construct
 * full narrative arcs, identifying problem-tension-insight-payoff transitions.
 */
export function buildStoryArc(params: {
  segments: SemanticSegment[];
  projectId: string;
  durationSeconds: number;
}): StoryArc {
  const { segments, projectId, durationSeconds } = params;

  if (segments.length === 0) {
    return {
      overallStructure: 'Single segment',
      beats: [],
      narrativeClimaxTimestamp: 0,
      primaryPayoffTimestamp: 0,
      completenessScore: 50,
    };
  }

  const beats: StoryBeat[] = [];
  let climaxTimestamp = durationSeconds * 0.65;
  let payoffTimestamp = durationSeconds * 0.85;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const textLower = seg.text.toLowerCase();
    const relativePos = seg.start / Math.max(1, durationSeconds);

    let beatType: StoryBeatType = 'Context';
    let importance = seg.importance;

    // Opening hook
    if (i === 0 || (relativePos < 0.15 && seg.importance >= 85)) {
      beatType = 'Hook';
    }
    // Problem & friction
    else if (
      textLower.includes('problem') ||
      textLower.includes('struggle') ||
      textLower.includes('fail') ||
      textLower.includes('mistake')
    ) {
      beatType = 'Problem';
    }
    // Tension & stakes
    else if (
      textLower.includes('die') ||
      textLower.includes('survive') ||
      textLower.includes('urgent') ||
      textLower.includes('warning')
    ) {
      beatType = 'Tension';
      climaxTimestamp = seg.start;
    }
    // Core Insight / Epiphany
    else if (
      seg.segmentType === 'contrarian_statement' ||
      textLower.includes('the secret') ||
      textLower.includes('realized that') ||
      textLower.includes('the truth is')
    ) {
      beatType = 'Insight';
      importance = Math.max(90, importance);
      climaxTimestamp = seg.start;
    }
    // Concrete Example
    else if (seg.segmentType === 'example' || textLower.includes('for example') || textLower.includes('look at')) {
      beatType = 'Example';
    }
    // Proof & metrics
    else if (seg.segmentType === 'statistic') {
      beatType = 'Proof';
    }
    // Transformation
    else if (textLower.includes('changed everything') || textLower.includes('resulted in')) {
      beatType = 'Transformation';
    }
    // Payoff
    else if (relativePos > 0.6 && (seg.segmentType === 'actionable_advice' || seg.segmentType === 'core_framework')) {
      beatType = 'Payoff';
      payoffTimestamp = seg.start;
      importance = 92;
    }
    // CTA & Conclusion
    else if (
      textLower.includes('subscribe') ||
      textLower.includes('comment') ||
      textLower.includes('share') ||
      textLower.includes('follow')
    ) {
      beatType = 'CTA';
    } else if (relativePos > 0.85 || seg.segmentType === 'conclusion') {
      beatType = 'Conclusion';
      payoffTimestamp = seg.start;
    }

    beats.push({
      id: `beat-${i}-${Date.now()}`,
      projectId,
      source: 'multimodal',
      start: seg.start,
      end: seg.end,
      confidence: seg.confidence,
      type: beatType,
      summary: seg.text.slice(0, 80),
      importance,
      evidence: `Narrative position ${(relativePos * 100).toFixed(0)}% mapped to beat '${beatType}'`,
      createdAt: new Date().toISOString(),
    });
  }

  // Calculate completeness score based on presence of essential story pillars
  const beatTypesFound = new Set(beats.map((b) => b.type));
  let completeness = 60;
  if (beatTypesFound.has('Hook')) completeness += 10;
  if (beatTypesFound.has('Insight') || beatTypesFound.has('Problem')) completeness += 12;
  if (beatTypesFound.has('Payoff') || beatTypesFound.has('Conclusion')) completeness += 10;
  if (beatTypesFound.has('Proof') || beatTypesFound.has('Example')) completeness += 8;
  completeness = Math.min(100, completeness);

  const overallStructure = `${beats.slice(0, 4).map((b) => b.type).join(' → ')} → ... → ${beats.slice(-2).map((b) => b.type).join(' → ')}`;

  return {
    overallStructure,
    beats,
    narrativeClimaxTimestamp: Number(climaxTimestamp.toFixed(2)),
    primaryPayoffTimestamp: Number(payoffTimestamp.toFixed(2)),
    completenessScore: completeness,
  };
}
