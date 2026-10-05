import { CaptionEmphasis } from '../types';

export interface CaptionEmphasisInput {
  projectId: string;
  words: Array<{ word: string; start: number; end: number }>;
}

/**
 * Caption Emphasis Intelligence Engine
 * Identifies high-salience power words, contrarian verbs, and numerical values
 * to apply dynamic stylistic emphasis in vertical subtitles.
 */
export function extractCaptionEmphases(params: CaptionEmphasisInput): CaptionEmphasis[] {
  const { projectId, words } = params;
  const emphases: CaptionEmphasis[] = [];

  const contrarianSet = new Set(['NEVER', 'STOP', 'NOT', "DON'T", 'WRONG', 'MYTH', 'MISTAKE', 'LIES']);
  const powerSet = new Set(['SECRET', 'PILLAR', 'FRAMEWORK', 'FORMULA', 'SYSTEM', 'CRUCIAL', 'TRUTH', 'AI', 'DIE']);

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const clean = w.word.replace(/[^a-zA-Z0-9$%]/g, '');
    const upper = clean.toUpperCase();

    // 1. Numerical & Monetary Values
    if (/\d+/.test(clean) || clean.includes('$') || clean.includes('%')) {
      emphases.push({
        id: `cap-emp-num-${i}-${Date.now()}`,
        projectId,
        source: 'transcript',
        start: w.start,
        end: w.end,
        confidence: 0.98,
        confidenceSource: 'heuristic',
        confidenceType: 'rule_based_salience',
        text: w.word,
        style: 'highlight_yellow',
        reason: 'Quantitative figures capture rapid ocular attention in dynamic captions.',
        evidence: `Numerical token "${clean}" spoken at ${w.start.toFixed(2)}s`,
        createdAt: new Date().toISOString(),
      });
    }
    // 2. Contrarian & Negative Assertions
    else if (contrarianSet.has(upper)) {
      emphases.push({
        id: `cap-emp-con-${i}-${Date.now()}`,
        projectId,
        source: 'transcript',
        start: w.start,
        end: w.end,
        confidence: 0.96,
        confidenceSource: 'heuristic',
        confidenceType: 'rule_based_salience',
        text: w.word,
        style: 'highlight_red',
        reason: 'Contrarian verbs create cognitive tension and pattern interruption.',
        evidence: `Contrarian token "${clean}" spoken at ${w.start.toFixed(2)}s`,
        createdAt: new Date().toISOString(),
      });
    }
    // 3. Power Framework Keywords
    else if (powerSet.has(upper)) {
      emphases.push({
        id: `cap-emp-pwr-${i}-${Date.now()}`,
        projectId,
        source: 'transcript',
        start: w.start,
        end: w.end,
        confidence: 0.94,
        confidenceSource: 'heuristic',
        confidenceType: 'rule_based_salience',
        text: w.word,
        style: 'box_badge',
        reason: 'Core conceptual anchor word deserving visual badge treatment.',
        evidence: `Power keyword "${clean}" spoken at ${w.start.toFixed(2)}s`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return emphases;
}
