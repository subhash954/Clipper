import { ViralScoreBreakdown } from '../types';

export interface CalculatedViralScore {
  viralScore: number;
  confidence: number;
  scoreBreakdown: ViralScoreBreakdown;
  label: 'AI Editorial Score';
}

/**
 * Transparent, multi-factor scoring function for viral retention potential.
 * Evaluates real transcript text, hook structure, phrasing, length, and actionable value.
 */
export function calculateViralScore(params: {
  title: string;
  importantLine: string;
  whyThisLineIsImportant: string;
  keyMomentType: string;
  duration: number;
  wordsCount: number;
}): CalculatedViralScore {
  const { title, importantLine, whyThisLineIsImportant, keyMomentType, duration, wordsCount } = params;

  // 1. Hook Score: Opening curiosity, contrarian verbs, questions, numbers
  let hook = 75;
  const quoteUpper = importantLine.toUpperCase();
  const titleUpper = title.toUpperCase();

  if (quoteUpper.includes('NOT') || quoteUpper.includes("DON'T") || quoteUpper.includes('STOP') || quoteUpper.includes('NEVER')) {
    hook += 8; // Contrarian reframing
  }
  if (quoteUpper.includes('?') || titleUpper.includes('?')) {
    hook += 6; // Open loop question
  }
  if (/\d+/.test(importantLine) || /\d+/.test(title)) {
    hook += 6; // Specific numbers/metrics
  }
  if (importantLine.split(' ').length <= 15) {
    hook += 5; // Punchy, memorable length
  }
  hook = Math.min(99, Math.max(60, hook));

  // 2. Curiosity Score: Based on knowledge gap and moment category
  let curiosity = 70;
  if (keyMomentType === 'High-Curiosity Hook' || keyMomentType === 'Contrarian Truth') {
    curiosity += 18;
  } else if (keyMomentType === 'Actionable Secret') {
    curiosity += 14;
  } else if (keyMomentType === 'Core Framework') {
    curiosity += 10;
  } else {
    curiosity += 8;
  }
  if (whyThisLineIsImportant.toLowerCase().includes('reframe') || whyThisLineIsImportant.toLowerCase().includes('confront')) {
    curiosity += 6;
  }
  curiosity = Math.min(98, Math.max(55, curiosity));

  // 3. Value Score: Actionable frameworks, steps, takeaways
  let value = 72;
  if (quoteUpper.includes('PILLAR') || quoteUpper.includes('STEP') || quoteUpper.includes('RULE') || quoteUpper.includes('SECRET')) {
    value += 16;
  }
  if (keyMomentType === 'Core Framework' || keyMomentType === 'Actionable Secret') {
    value += 10;
  }
  if (wordsCount >= 40 && wordsCount <= 120) {
    value += 6; // Ideal pacing for high information density
  }
  value = Math.min(97, Math.max(50, value));

  // 4. Emotional Intensity: High energy verbs, urgent mindset
  let emotion = 68;
  const urgentWords = ['DISAPPEAR', 'DIE', 'SURVIVE', 'CRUCIAL', 'FAIL', 'POWERFUL', 'EXPLODE', 'WIN', 'UNSTOPPABLE'];
  const urgentCount = urgentWords.filter(w => quoteUpper.includes(w) || titleUpper.includes(w)).length;
  emotion += Math.min(22, urgentCount * 7);
  if (keyMomentType === 'Emotional Climax') {
    emotion += 12;
  }
  emotion = Math.min(98, Math.max(50, emotion));

  // 5. Standalone Completeness: Does the thought make complete sense in a 30-60s clip?
  let standalone = 80;
  if (duration >= 25 && duration <= 60) {
    standalone += 12; // Ideal standalone shorts duration
  } else if (duration < 15 || duration > 75) {
    standalone -= 15;
  }
  standalone = Math.min(96, Math.max(50, standalone));

  // Weighted overall viral score
  const viralScore = Math.round(
    hook * 0.28 +
    curiosity * 0.24 +
    value * 0.20 +
    emotion * 0.16 +
    standalone * 0.12
  );

  // Confidence based on input richness
  const confidence = parseFloat(
    Math.min(0.95, 0.70 + (wordsCount > 30 ? 0.15 : 0.05) + (importantLine.length > 20 ? 0.10 : 0.0)).toFixed(2)
  );

  return {
    viralScore: Math.min(99, Math.max(65, viralScore)),
    confidence,
    scoreBreakdown: {
      hook,
      curiosity,
      value,
      emotion,
      standalone,
    },
    label: 'AI Editorial Score',
  };
}
