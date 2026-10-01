import { VisualOpportunity, BRollQuery, VisualOpportunityType } from '../types';

export interface OpportunityEngineInput {
  projectId: string;
  clipId: string;
  transcript: string;
  words: Array<{ word: string; start: number; end: number }>;
}

/**
 * Visual Opportunity & Semantic B-Roll Intelligence Engine
 * Identifies high-leverage moments for motion graphics, charts, and conceptual B-roll footage.
 */
export function generateVisualAndBRollOpportunities(params: OpportunityEngineInput): {
  visualOpportunities: VisualOpportunity[];
  bRollQueries: BRollQuery[];
} {
  const { projectId, clipId, transcript, words } = params;
  const visualOpportunities: VisualOpportunity[] = [];
  const bRollQueries: BRollQuery[] = [];

  const lower = transcript.toLowerCase();

  // 1. Scan for Quantitative Metrics & Currency (Money / Stats Graphics)
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const clean = w.word.trim();
    if (/\d+/.test(clean) || clean.includes('$') || clean.includes('%') || ['million', 'billion', 'lakh', 'crore'].includes(clean.toLowerCase())) {
      const windowStart = Math.max(0, w.start - 0.2);
      const windowEnd = Math.min(words[words.length - 1].end, w.end + 2.0);

      visualOpportunities.push({
        id: `vis-opp-stat-${i}-${Date.now()}`,
        projectId,
        source: 'multimodal',
        start: Number(windowStart.toFixed(2)),
        end: Number(windowEnd.toFixed(2)),
        confidence: 0.94,
        type: 'money_stat_graphic',
        keyword: clean,
        reason: `Prominent quantitative metric "${clean}" enhances viewer comprehension when reinforced with a visual counter.`,
        suggestedAssetPrompt: `Minimalist animated stat counter displaying "${clean}" with upward trajectory arrow`,
        evidence: `Spoken quantitative anchor at ${w.start.toFixed(2)}s`,
        createdAt: new Date().toISOString(),
      });
      break; // One primary stat graphic per clip
    }
  }

  // 2. Scan for Step-by-Step Frameworks (List Infographics)
  if (lower.includes('step') || lower.includes('pillar') || lower.includes('rule') || lower.includes('formula')) {
    const targetWord = words.find((w) => {
      const l = w.word.toLowerCase();
      return l.includes('step') || l.includes('pillar') || l.includes('rule') || l.includes('formula');
    });

    if (targetWord) {
      visualOpportunities.push({
        id: `vis-opp-list-${Date.now()}`,
        projectId,
        source: 'multimodal',
        start: targetWord.start,
        end: Math.min(targetWord.start + 3.0, words[words.length - 1].end),
        confidence: 0.91,
        type: 'list_infographic',
        keyword: targetWord.word,
        reason: 'Structured methodology is easier to retain when presented as an elevated checklist graphic.',
        suggestedAssetPrompt: 'Floating modern glassmorphic 3-point checklist badge card',
        evidence: `Framework keyword "${targetWord.word}" spoken at ${targetWord.start.toFixed(2)}s`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 3. Scan for Tech & AI Mentions
  if (lower.includes(' ai') || lower.includes('algorithm') || lower.includes('software') || lower.includes('neural')) {
    const techWord = words.find((w) => {
      const l = w.word.toLowerCase();
      return l.includes('ai') || l.includes('algorithm') || l.includes('software');
    });

    if (techWord) {
      visualOpportunities.push({
        id: `vis-opp-tech-${Date.now()}`,
        projectId,
        source: 'multimodal',
        start: techWord.start,
        end: Math.min(techWord.start + 2.5, words[words.length - 1].end),
        confidence: 0.92,
        type: 'tech_graphic',
        keyword: techWord.word,
        reason: 'Technical terminology benefits from futuristic HUD overlay or schematic graphic.',
        suggestedAssetPrompt: 'Futuristic AI neural node connection animation in crimson and white',
        evidence: `Technology term "${techWord.word}" spoken at ${techWord.start.toFixed(2)}s`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 4. Generate Semantic B-Roll Queries (Contextual, descriptive search prompts)
  // Instead of naive single-word searches, synthesize complete visual narrative concepts
  if (lower.includes('brand') || lower.includes('world')) {
    bRollQueries.push({
      id: `broll-1-${Date.now()}`,
      projectId,
      source: 'multimodal',
      start: words[0].start,
      end: Math.min(words[0].start + 4.0, words[words.length - 1].end),
      confidence: 0.93,
      query: 'creative director sketching brand universe architecture in modern architectural studio',
      reason: 'Visually depicts the metaphor of building a world beyond a traditional business logo.',
      visualType: 'cinematic_b_roll',
      targetDurationSeconds: 3.5,
      evidence: 'Matches conceptual metaphor in clip opening',
      createdAt: new Date().toISOString(),
    });
  } else if (lower.includes('distribution') || lower.includes('audience') || lower.includes('traffic')) {
    bRollQueries.push({
      id: `broll-2-${Date.now()}`,
      projectId,
      source: 'multimodal',
      start: words[0].start,
      end: Math.min(words[0].start + 4.0, words[words.length - 1].end),
      confidence: 0.91,
      query: 'digital content distribution network glowing data connections spreading globally across screen',
      reason: 'Visualizes traffic scaling and distribution pipelines.',
      visualType: 'motion_graphic',
      targetDurationSeconds: 4.0,
      evidence: 'Matches distribution infrastructure narrative',
      createdAt: new Date().toISOString(),
    });
  } else {
    // Default contextual B-roll query derived from opening hook
    const hookWords = words.slice(0, 8).map((w) => w.word).join(' ');
    bRollQueries.push({
      id: `broll-default-${Date.now()}`,
      projectId,
      source: 'multimodal',
      start: words[0].start,
      end: Math.min(words[0].start + 3.5, words[words.length - 1].end),
      confidence: 0.86,
      query: `cinematic macro shot of focused professional executing high-stakes project (${hookWords.slice(0, 30)})`,
      reason: 'Reinforces focus and energy during the introductory premise.',
      visualType: 'cinematic_b_roll',
      targetDurationSeconds: 3.5,
      evidence: 'Hooks opening visual retention',
      createdAt: new Date().toISOString(),
    });
  }

  return {
    visualOpportunities,
    bRollQueries,
  };
}
