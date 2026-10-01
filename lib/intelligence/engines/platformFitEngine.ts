import { PlatformFitAssessment, TargetSocialPlatform, HookCandidate, StandaloneEvaluation } from '../types';

export interface PlatformFitInput {
  durationSeconds: number;
  hook: HookCandidate;
  standalone: StandaloneEvaluation;
  topic: string;
}

/**
 * Platform Fit Intelligence Engine
 * Evaluates candidate clips across 6 major social platforms based on audience expectations,
 * duration thresholds, hook urgency, and professional vs entertainment tone.
 * Labeled strictly as editorial fit assessment — never guaranteed performance.
 */
export function evaluatePlatformFit(input: PlatformFitInput): Record<string, PlatformFitAssessment> {
  const { durationSeconds, hook, standalone, topic } = input;
  const isBusinessOrCareer = /business|marketing|brand|career|money|finance|software|ai|coding/i.test(topic);

  // 1. YouTube Shorts
  // Ideal: 25s - 58s, strong educational payoff, high standalone value
  let shortsScore = 80;
  const shortsRationale: string[] = [];
  const shortsRecs: string[] = [];
  if (durationSeconds >= 25 && durationSeconds <= 58) {
    shortsScore += 12;
    shortsRationale.push('Duration aligns with YouTube Shorts algorithm sweet spot (25-55s).');
  } else if (durationSeconds > 58) {
    shortsScore -= 18;
    shortsRationale.push('Approaches or exceeds YouTube Shorts 60s hard limit.');
    shortsRecs.push('Trim ending pauses or trim setup to guarantee sub-60s length.');
  }
  if (standalone.standaloneScore >= 85) {
    shortsScore += 6;
    shortsRationale.push('High standalone completeness suited for search and suggested recommendations.');
  }

  // 2. TikTok
  // Ideal: 15s - 45s, ultra-fast hook (< 2s), high emotional or contrarian charge
  let tiktokScore = 78;
  const tiktokRationale: string[] = [];
  const tiktokRecs: string[] = [];
  if (hook.hookType === 'Contrarian' || hook.hookType === 'Shock' || hook.hookType === 'Problem') {
    tiktokScore += 16;
    tiktokRationale.push(`High pattern-interruption ${hook.hookType} hook stops rapid FYP scrolling.`);
  }
  if (durationSeconds <= 38) {
    tiktokScore += 6;
    tiktokRationale.push('Concise duration maximizes re-watch probability.');
  } else {
    tiktokRecs.push('Consider trimming secondary examples to heighten delivery pace.');
  }

  // 3. Instagram Reels
  // Ideal: 20s - 45s, visual polish, relatable personal insight or aesthetic value
  let reelsScore = 82;
  const reelsRationale: string[] = ['Strong visual suitability for 9:16 vertical Explore feed.'];
  const reelsRecs: string[] = ['Pair with high-contrast centered captions.'];
  if (durationSeconds <= 45) {
    reelsScore += 10;
  }

  // 4. LinkedIn
  // Ideal: 30s - 90s, business frameworks, professional lessons, career insights
  let linkedInScore = 65;
  const linkedInRationale: string[] = [];
  const linkedInRecs: string[] = [];
  if (isBusinessOrCareer) {
    linkedInScore += 26;
    linkedInRationale.push('Subject matter directly aligns with LinkedIn professional feed interests.');
  } else {
    linkedInScore -= 12;
    linkedInRationale.push('Consumer/entertainment topic may have lower organic reach on professional feeds.');
  }
  if (hook.hookType === 'Promise' || hook.hookType === 'Statistic') {
    linkedInScore += 8;
    linkedInRationale.push('Evidence-based opening resonates strongly with B2B audience.');
  }
  linkedInRecs.push('Add an accompanying text post with 3 key takeaway bullet points.');

  // 5. X (Twitter)
  // Ideal: 20s - 60s, polarizing or contrarian debates, immediate punchline
  let xScore = 72;
  const xRationale: string[] = [];
  const xRecs: string[] = [];
  if (hook.hookType === 'Contrarian' || hook.hookType === 'Question') {
    xScore += 18;
    xRationale.push('Contrarian debate prompts strong quote-tweet engagement on X.');
  }
  xRecs.push('Extract the pivotal contrarian quote as the tweet caption.');

  // 6. Facebook Reels
  let fbScore = 70;
  const fbRationale: string[] = ['Broad demographic appeal.'];
  const fbRecs: string[] = ['Ensure audio mix is clear for mobile speaker playback.'];

  function toSuitability(score: number): PlatformFitAssessment['suitability'] {
    if (score >= 90) return 'exceptional';
    if (score >= 78) return 'good';
    if (score >= 65) return 'average';
    return 'poor';
  }

  return {
    'YouTube Shorts': {
      platform: 'YouTube Shorts',
      score: Math.min(99, Math.max(40, shortsScore)),
      suitability: toSuitability(shortsScore),
      rationale: shortsRationale,
      recommendations: shortsRecs,
    },
    'Instagram Reels': {
      platform: 'Instagram Reels',
      score: Math.min(99, Math.max(40, reelsScore)),
      suitability: toSuitability(reelsScore),
      rationale: reelsRationale,
      recommendations: reelsRecs,
    },
    TikTok: {
      platform: 'TikTok',
      score: Math.min(99, Math.max(40, tiktokScore)),
      suitability: toSuitability(tiktokScore),
      rationale: tiktokRationale,
      recommendations: tiktokRecs,
    },
    LinkedIn: {
      platform: 'LinkedIn',
      score: Math.min(99, Math.max(40, linkedInScore)),
      suitability: toSuitability(linkedInScore),
      rationale: linkedInRationale,
      recommendations: linkedInRecs,
    },
    X: {
      platform: 'X',
      score: Math.min(99, Math.max(40, xScore)),
      suitability: toSuitability(xScore),
      rationale: xRationale,
      recommendations: xRecs,
    },
    Facebook: {
      platform: 'Facebook',
      score: Math.min(99, Math.max(40, fbScore)),
      suitability: toSuitability(fbScore),
      rationale: fbRationale,
      recommendations: fbRecs,
    },
  };
}
