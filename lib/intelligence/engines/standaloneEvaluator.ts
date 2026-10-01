import { StandaloneEvaluation, SemanticSegment } from '../types';

/**
 * Standalone Value Test Engine
 * Guarantees that a candidate clip is intellectually self-contained and intelligible
 * without requiring the full context of the original long-form video.
 */
export function evaluateStandaloneValue(params: {
  clipText: string;
  clipStart: number;
  clipEnd: number;
  allSegments: SemanticSegment[];
}): StandaloneEvaluation {
  const { clipText, clipStart, clipEnd, allSegments } = params;
  const lower = clipText.trim().toLowerCase();
  const firstSentence = clipText.split(/[.!?]/)[0].trim().toLowerCase();
  const firstWords = firstSentence.split(/\s+/).slice(0, 5);

  let contextRequired = false;
  let contextScore = 90;
  let standaloneScore = 88;
  let payoffCompleteness = 85;
  let danglingReference: string | undefined = undefined;

  // 1. Detect Dangling Transitionals
  const danglingPhrases = [
    'as i said earlier',
    'as we discussed',
    'like i mentioned',
    'as mentioned before',
    'remember what i said',
    'and that is why',
    'and then',
    'so that is how',
  ];

  for (const phrase of danglingPhrases) {
    if (lower.startsWith(phrase)) {
      contextRequired = true;
      danglingReference = `Dangling introductory transitional phrase: "${phrase}"`;
      standaloneScore -= 30;
      contextScore -= 35;
      break;
    }
  }

  // 2. Detect Ambiguous Opening Pronouns & Demonstratives
  if (!danglingReference && firstWords.length > 0) {
    const openingWord = firstWords[0].replace(/[^a-z]/g, '');
    const openingTwo = `${openingWord} ${firstWords[1] ? firstWords[1].replace(/[^a-z]/g, '') : ''}`;

    if (['he', 'she', 'they', 'it'].includes(openingWord)) {
      contextRequired = true;
      danglingReference = `Clip opens with unresolved third-person pronoun: "${openingWord}"`;
      standaloneScore -= 28;
      contextScore -= 30;
    } else if (['this', 'that', 'these', 'those'].includes(openingWord) && !['this is', 'this secret', 'this framework', 'this one'].includes(openingTwo)) {
      contextRequired = true;
      danglingReference = `Clip opens with ambiguous demonstrative pronoun: "${openingWord}"`;
      standaloneScore -= 20;
      contextScore -= 22;
    }
  }

  // 3. Evaluate Payoff Completeness
  // Check if clip ends mid-thought or contains an explicit conclusion/insight
  const hasStrongPayoff =
    lower.includes('because') ||
    lower.includes('means that') ||
    lower.includes('result is') ||
    lower.includes('the key is') ||
    lower.includes('bottom line') ||
    lower.includes('step');

  if (hasStrongPayoff) {
    payoffCompleteness = 94;
    standaloneScore += 6;
  } else if (lower.endsWith('and') || lower.endsWith('or') || lower.endsWith('so') || lower.endsWith('but')) {
    payoffCompleteness = 45;
    standaloneScore -= 25;
  }

  // Determine adjustment recommendation
  let recommendedAdjustment: StandaloneEvaluation['recommendedAdjustment'] = {
    action: 'none',
    reason: 'Clip has clear self-contained standalone context.',
  };

  if (contextRequired) {
    // Check if we can expand backward by incorporating the immediately preceding segment
    const precedingSeg = allSegments
      .filter((s) => s.end <= clipStart && clipStart - s.end <= 4.0)
      .sort((a, b) => b.end - a.end)[0];

    if (precedingSeg && clipEnd - precedingSeg.start <= 65) {
      recommendedAdjustment = {
        action: 'expand_backward',
        adjustedStart: precedingSeg.start,
        adjustedEnd: clipEnd,
        reason: `Expand start backwards by ${(clipStart - precedingSeg.start).toFixed(1)}s to capture prerequisite context: "${precedingSeg.text.slice(0, 40)}..."`,
      };
      // Context expansion recovers standalone score
      standaloneScore += 18;
      contextScore += 20;
    } else {
      recommendedAdjustment = {
        action: 'reject',
        reason: `Clip lacks standalone context (${danglingReference}) and antecedent cannot be cleanly prepended within short-form duration constraints.`,
      };
    }
  }

  return {
    contextRequired,
    contextScore: Math.min(100, Math.max(0, contextScore)),
    standaloneScore: Math.min(100, Math.max(0, standaloneScore)),
    payoffCompleteness: Math.min(100, Math.max(0, payoffCompleteness)),
    danglingReferenceDetected: danglingReference,
    recommendedAdjustment,
  };
}
