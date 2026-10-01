import { AIEditorialScore, EditorialDimensionScores, HookCandidate, StandaloneEvaluation } from '../types';

/**
 * AI Editorial Scoring Engine
 * Computes an honest, transparent multi-dimensional assessment of short-form editorial potency.
 * Strictly labeled as 'AI EDITORIAL ANALYSIS' — never fabricated analytics.
 */
export function calculateAIEditorialScore(params: {
  title: string;
  transcript: string;
  durationSeconds: number;
  wordsCount: number;
  hook: HookCandidate;
  standalone: StandaloneEvaluation;
  hasVisualSceneChanges?: boolean;
}): AIEditorialScore {
  const {
    title,
    transcript,
    durationSeconds,
    wordsCount,
    hook,
    standalone,
    hasVisualSceneChanges = true,
  } = params;

  const upper = transcript.toUpperCase();
  const lower = transcript.toLowerCase();

  // 1. Hook Quality (Directly from semantic Hook Candidate score)
  const hookQuality = hook.score;

  // 2. Curiosity (Knowledge gap & open cognitive loops)
  let curiosity = 72;
  if (hook.hookType === 'Contrarian' || hook.hookType === 'Question' || hook.hookType === 'Curiosity') {
    curiosity += 18;
  }
  if (lower.includes('secret') || lower.includes('mistake') || lower.includes('truth')) {
    curiosity += 6;
  }
  curiosity = Math.min(99, Math.max(55, curiosity));

  // 3. Standalone Value (From standalone evaluator)
  const standaloneValue = standalone.standaloneScore;

  // 4. Conceptual Intensity (High-stakes verbs and provocative claims)
  let conceptualIntensity = 70;
  const powerWords = ['EXPLODE', 'DIE', 'CRUCIAL', 'SURVIVE', 'FAIL', 'POWERFUL', 'OBSOLETE', 'DOMINATE'];
  const powerCount = powerWords.filter((w) => upper.includes(w)).length;
  conceptualIntensity += Math.min(22, powerCount * 8);
  if (hook.hookType === 'Shock' || hook.hookType === 'Problem') {
    conceptualIntensity += 6;
  }
  conceptualIntensity = Math.min(98, Math.max(50, conceptualIntensity));

  // 5. Information Density (Words per second & actionable density)
  let informationDensity = 72;
  const wps = durationSeconds > 0 ? wordsCount / durationSeconds : 2.5;
  if (wps >= 2.4 && wps <= 3.4) {
    informationDensity += 16; // Sweet spot for retention
  } else if (wps > 3.8) {
    informationDensity += 4; // Overwhelming
  } else if (wps < 1.8) {
    informationDensity -= 12; // Lethargic
  }
  informationDensity = Math.min(96, Math.max(50, informationDensity));

  // 6. Specificity (Exact metrics, step numbers, named entities)
  let specificity = 68;
  if (/\d+/.test(transcript) || /\d+/.test(title)) specificity += 14;
  if (lower.includes('step 1') || lower.includes('step 2') || lower.includes('first thing')) specificity += 12;
  specificity = Math.min(96, Math.max(50, specificity));

  // 7. Novelty (Contrarian framing vs generic platitudes)
  let novelty = 70;
  if (hook.hookType === 'Contrarian') novelty += 20;
  if (lower.includes('stop doing') || lower.includes('instead of')) novelty += 8;
  novelty = Math.min(98, Math.max(50, novelty));

  // 8. Narrative Completeness
  let narrativeCompleteness = 75;
  if (standalone.payoffCompleteness > 80) narrativeCompleteness += 15;
  narrativeCompleteness = Math.min(98, Math.max(50, narrativeCompleteness));

  // 9. Payoff Quality
  const payoffQuality = standalone.payoffCompleteness;

  // 10. Visual Potential
  let visualPotential = 70;
  if (hasVisualSceneChanges) visualPotential += 14;
  if (specificity > 80) visualPotential += 8; // Charts / text graphic potential
  visualPotential = Math.min(95, Math.max(50, visualPotential));

  // 11. Platform Fit
  let platformFit = 80;
  if (durationSeconds >= 20 && durationSeconds <= 55) platformFit += 12;
  if (hookQuality >= 85) platformFit += 6;
  platformFit = Math.min(98, Math.max(50, platformFit));

  const dimensionScores: EditorialDimensionScores = {
    hookQuality,
    curiosity,
    standaloneValue,
    conceptualIntensity,
    informationDensity,
    specificity,
    novelty,
    narrativeCompleteness,
    payoffQuality,
    visualPotential,
    platformFit,
  };

  // Weighted overall AI editorial score
  const overallScore = Math.round(
    hookQuality * 0.22 +
    curiosity * 0.16 +
    standaloneValue * 0.14 +
    payoffQuality * 0.14 +
    informationDensity * 0.10 +
    novelty * 0.08 +
    conceptualIntensity * 0.06 +
    specificity * 0.05 +
    platformFit * 0.05
  );

  let confidence = 0.94;
  if (wordsCount < 25) confidence -= 0.15;
  if (standalone.contextRequired) confidence -= 0.1;

  const editorialSummary = `High-curiosity ${hook.hookType} hook (${hookQuality}/100) with strong standalone comprehension (${standaloneValue}/100) and delivery pacing of ${wps.toFixed(1)} wps.`;

  return {
    overallScore,
    dimensionScores,
    label: 'AI EDITORIAL ANALYSIS',
    editorialSummary,
    confidence: Number(confidence.toFixed(2)),
  };
}
