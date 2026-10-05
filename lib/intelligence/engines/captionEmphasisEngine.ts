import crypto from 'crypto';
import { CaptionEmphasis } from '../types';

export interface CaptionEmphasisInput {
  projectId: string;
  words: Array<{ word: string; start: number; end: number }>;
  timestamp?: string;
}

function generateDeterministicEmphasisId(
  prefix: string,
  projectId: string,
  index: number,
  start: number,
  end: number,
  style: string
): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${projectId}:${index}:${start.toFixed(3)}:${end.toFixed(3)}:${style}`)
    .digest('hex')
    .slice(0, 16);
  return `cap-emp-${prefix}-${hash}`;
}

/**
 * Caption Emphasis Intelligence Engine
 * Identifies high-salience power words, contrarian verbs, and numerical values
 * to apply dynamic stylistic emphasis in vertical subtitles.
 */
export function extractCaptionEmphases(params: CaptionEmphasisInput): CaptionEmphasis[] {
  const { projectId, words, timestamp = '1970-01-01T00:00:00.000Z' } = params;
  const emphases: CaptionEmphasis[] = [];

  const contrarianSet = new Set(['NEVER', 'STOP', 'NOT', "DON'T", 'WRONG', 'MYTH', 'MISTAKE', 'LIES']);
  const powerSet = new Set(['SECRET', 'PILLAR', 'FRAMEWORK', 'FORMULA', 'SYSTEM', 'CRUCIAL', 'TRUTH', 'AI', 'DIE']);

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const clean = w.word.replace(/[^a-zA-Z0-9$%]/g, '');
    const upper = clean.toUpperCase();

    // 1. Numerical & Monetary Values
    if (/\d+/.test(clean) || clean.includes('$') || clean.includes('%')) {
      const style = 'highlight_yellow';
      emphases.push({
        id: generateDeterministicEmphasisId('num', projectId, i, w.start, w.end, style),
        projectId,
        source: 'transcript',
        start: w.start,
        end: w.end,
        confidence: 0.98,
        confidenceSource: 'heuristic',
        confidenceType: 'rule_based_salience',
        text: w.word,
        style,
        reason: 'Quantitative figures capture rapid ocular attention in dynamic captions.',
        evidence: `Numerical token "${clean}" spoken at ${w.start.toFixed(2)}s`,
        createdAt: timestamp,
      });
    }
    // 2. Contrarian & Negative Assertions
    else if (contrarianSet.has(upper)) {
      const style = 'highlight_red';
      emphases.push({
        id: generateDeterministicEmphasisId('con', projectId, i, w.start, w.end, style),
        projectId,
        source: 'transcript',
        start: w.start,
        end: w.end,
        confidence: 0.96,
        confidenceSource: 'heuristic',
        confidenceType: 'rule_based_salience',
        text: w.word,
        style,
        reason: 'Contrarian verbs create cognitive tension and pattern interruption.',
        evidence: `Contrarian token "${clean}" spoken at ${w.start.toFixed(2)}s`,
        createdAt: timestamp,
      });
    }
    // 3. Power Framework Keywords
    else if (powerSet.has(upper)) {
      const style = 'box_badge';
      emphases.push({
        id: generateDeterministicEmphasisId('pwr', projectId, i, w.start, w.end, style),
        projectId,
        source: 'transcript',
        start: w.start,
        end: w.end,
        confidence: 0.94,
        confidenceSource: 'heuristic',
        confidenceType: 'rule_based_salience',
        text: w.word,
        style,
        reason: 'Core conceptual anchor word deserving visual badge treatment.',
        evidence: `Power keyword "${clean}" spoken at ${w.start.toFixed(2)}s`,
        createdAt: timestamp,
      });
    }
  }

  return emphases;
}
