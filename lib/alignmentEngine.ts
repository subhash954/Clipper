import { WordTimestamp, Transcript, ViralClip, ClipAlignmentStatus, ClipQualityStatus } from './types';
import { CandidateMomentSuggestion } from './providers/geminiProvider';
import { calculateViralScore } from './scoring/viralScoring';

/**
 * Normalizes text for robust token comparison:
 * - Lowercases text
 * - Strips punctuation, quotes, brackets, and symbols
 * - Normalizes contractions (e.g. "don't" -> "dont", "it's" -> "its")
 * - Collapses consecutive whitespace
 */
export function normalizeToken(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['’]/g, '') // strip apostrophes for contraction matching
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates token-level Jaccard similarity between two token sequences
 */
function tokenSimilarity(seqA: string[], seqB: string[]): number {
  if (seqA.length === 0 || seqB.length === 0) return 0;
  const setA = new Set(seqA);
  const setB = new Set(seqB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Calculates temporal overlap ratio between two time intervals [s1, e1] and [s2, e2]
 */
export function calculateIntervalOverlap(
  s1: number,
  e1: number,
  s2: number,
  e2: number
): number {
  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);
  if (overlapEnd <= overlapStart) return 0;
  const overlapDuration = overlapEnd - overlapStart;
  const minDuration = Math.min(e1 - s1, e2 - s2);
  return minDuration > 0 ? overlapDuration / minDuration : 0;
}

/**
 * Finds the best contiguous window of transcript words that matches a target quote.
 * Returns the word index range [startIdx, endIdx] and an alignment confidence score (0.0 - 1.0).
 */
export function matchQuoteToTranscript(
  quote: string,
  words: WordTimestamp[]
): { startIdx: number; endIdx: number; confidence: number; matchType: 'exact' | 'strong_fuzzy' | 'weak' | 'none' } {
  if (!quote || words.length === 0) {
    return { startIdx: -1, endIdx: -1, confidence: 0, matchType: 'none' };
  }

  const cleanQuote = normalizeToken(quote);
  const quoteTokens = cleanQuote.split(/\s+/).filter(Boolean);
  if (quoteTokens.length === 0) {
    return { startIdx: -1, endIdx: -1, confidence: 0, matchType: 'none' };
  }

  const transcriptTokens = words.map((w) => normalizeToken(w.word));
  const fullTranscriptStr = transcriptTokens.join(' ');

  // 1. Direct exact substring match
  const exactPos = fullTranscriptStr.indexOf(cleanQuote);
  if (exactPos !== -1) {
    const charsBefore = fullTranscriptStr.slice(0, exactPos).trim();
    const startIdx = charsBefore.length > 0 ? charsBefore.split(/\s+/).length : 0;
    const endIdx = Math.min(words.length - 1, startIdx + quoteTokens.length - 1);
    return { startIdx, endIdx, confidence: 1.0, matchType: 'exact' };
  }

  // 2. Sliding window n-gram fuzzy matching
  const windowSize = quoteTokens.length;
  let bestStartIdx = -1;
  let bestScore = 0;

  for (let i = 0; i <= transcriptTokens.length - windowSize; i++) {
    const windowTokens = transcriptTokens.slice(i, i + windowSize);
    const sim = tokenSimilarity(quoteTokens, windowTokens);
    if (sim > bestScore) {
      bestScore = sim;
      bestStartIdx = i;
    }
    if (bestScore >= 0.95) break; // Near-perfect match found
  }

  if (bestScore >= 0.85) {
    return {
      startIdx: bestStartIdx,
      endIdx: Math.min(words.length - 1, bestStartIdx + windowSize - 1),
      confidence: parseFloat(bestScore.toFixed(2)),
      matchType: 'strong_fuzzy',
    };
  }

  if (bestScore >= 0.60) {
    return {
      startIdx: bestStartIdx,
      endIdx: Math.min(words.length - 1, bestStartIdx + windowSize - 1),
      confidence: parseFloat(bestScore.toFixed(2)),
      matchType: 'weak',
    };
  }

  return { startIdx: -1, endIdx: -1, confidence: parseFloat(bestScore.toFixed(2)), matchType: 'none' };
}

/**
 * Aligns candidate moments against the authentic transcript word stream.
 * NEVER fabricates timestamps when alignment fails: marks non-matching candidates
 * as 'needs_review' or rejects them.
 */
export function alignClipsToTranscript(params: {
  candidates: CandidateMomentSuggestion[];
  transcript: Transcript;
  totalDurationSeconds?: number;
}): ViralClip[] {
  const { candidates, transcript, totalDurationSeconds = 3600 } = params;
  const words = transcript.words;

  if (!words || words.length === 0) {
    throw new Error('Cannot align clips: Transcript contains no word-level timestamps.');
  }

  const rawClips: ViralClip[] = [];

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const targetQuote = candidate.importantLine || candidate.whyThisLineIsImportant;

    // Run transcript matching
    const match = matchQuoteToTranscript(targetQuote, words);

    let alignmentStatus: ClipAlignmentStatus = 'verified';
    let qualityStatus: ClipQualityStatus = 'verified';
    let startIdx = match.startIdx;
    let endIdx = match.endIdx;

    if (match.matchType === 'exact') {
      alignmentStatus = 'verified';
    } else if (match.matchType === 'strong_fuzzy') {
      alignmentStatus = 'approximate';
    } else if (match.matchType === 'weak') {
      alignmentStatus = 'needs_review';
      qualityStatus = 'needs_review';
    } else {
      // Alignment FAILED completely: do NOT invent timestamps or guess arbitrary positions!
      // Assign needs_review status with low confidence so creator can manually review or re-align
      alignmentStatus = 'needs_review';
      qualityStatus = 'needs_review';
    }

    // If no match was found at all, skip generating a fraudulent clip
    if (startIdx === -1 || endIdx === -1) {
      continue;
    }

    // Expand boundaries slightly to ensure natural sentence completion (15s to 60s)
    let startTime = words[startIdx]?.start ?? 0;
    let endTime = words[endIdx]?.end ?? startTime + 30;

    // Natural padding: pad backward up to 5s if words exist
    const paddedStartIdx = Math.max(0, startIdx - 5);
    startTime = words[paddedStartIdx]?.start ?? startTime;

    // Target a natural clip duration between 20s and 55s
    let duration = endTime - startTime;
    if (duration < 18) {
      const targetEndIdx = Math.min(words.length - 1, endIdx + 25);
      endTime = words[targetEndIdx]?.end ?? startTime + 25;
      endIdx = targetEndIdx;
      duration = endTime - startTime;
    } else if (duration > 60) {
      while (endIdx > paddedStartIdx && words[endIdx].end - startTime > 58) {
        endIdx--;
      }
      endTime = words[endIdx]?.end ?? startTime + 58;
      duration = endTime - startTime;
    }

    startTime = Math.max(0, parseFloat(startTime.toFixed(2)));
    endTime = Math.min(totalDurationSeconds, parseFloat(endTime.toFixed(2)));
    duration = parseFloat((endTime - startTime).toFixed(2));

    const clipWords = words.slice(paddedStartIdx, endIdx + 1);

    // Quality gate checks
    if (clipWords.length < 10 || duration < 12) {
      qualityStatus = 'needs_review';
    }

    // Multi-factor transparent scoring
    const scoreResult = calculateViralScore({
      title: candidate.title,
      importantLine: candidate.importantLine,
      whyThisLineIsImportant: candidate.whyThisLineIsImportant,
      keyMomentType: candidate.keyMomentType,
      duration,
      wordsCount: clipWords.length,
    });

    rawClips.push({
      id: `clip-${index + 1}-${Date.now()}`,
      title: candidate.title,
      hookSummary: candidate.whyThisLineIsImportant || candidate.importantLine,
      importantLine: candidate.importantLine,
      whyThisLineIsImportant: candidate.whyThisLineIsImportant,
      keyMomentType: candidate.keyMomentType,
      start: startTime,
      end: endTime,
      duration,
      viralScore: scoreResult.viralScore,
      scoreBreakdown: scoreResult.scoreBreakdown,
      confidence: match.confidence,
      alignmentStatus,
      alignmentConfidence: match.confidence,
      qualityStatus,
      words: clipWords,
      tags: [candidate.keyMomentType, `${Math.round(scoreResult.viralScore)}% Editorial Score`],
      hookStrength: scoreResult.scoreBreakdown.hook,
      retentionEstimate: Math.round(scoreResult.viralScore * 0.94),
      energyLevel: scoreResult.scoreBreakdown.emotion > 75 ? 'High' : 'Medium',
      bRollKeywords: ['business', 'focus', 'creator'],
      soundEffects: ['whoosh.mp3'],
      aiImagePrompt: `Cinematic frame visualizing ${candidate.title}`,
      youtubeScheduleTime: new Date(Date.now() + 86400000).toISOString(),
    });
  }

  // 3. Duplicate & Overlap Detection (Section 22)
  // If two clips overlap significantly (>60%), prioritize the one with higher alignment confidence & score
  const nonOverlappingClips: ViralClip[] = [];

  // Sort by score descending to give priority to the strongest moments
  rawClips.sort((a, b) => (b.viralScore || 0) - (a.viralScore || 0));

  for (const candidateClip of rawClips) {
    let hasSignificantOverlap = false;
    for (const accepted of nonOverlappingClips) {
      const overlapRatio = calculateIntervalOverlap(
        candidateClip.start,
        candidateClip.end,
        accepted.start,
        accepted.end
      );
      if (overlapRatio > 0.60) {
        hasSignificantOverlap = true;
        break;
      }
    }

    if (!hasSignificantOverlap) {
      nonOverlappingClips.push(candidateClip);
    }
  }

  // Sort back by timeline position and assign clean sequential ranks
  nonOverlappingClips.sort((a, b) => a.start - b.start);
  nonOverlappingClips.forEach((clip, idx) => {
    clip.rank = idx + 1;
  });

  return nonOverlappingClips;
}

/**
 * Converts absolute media timestamps to 0-relative clip timestamps.
 */
export function convertToRelativeWordTimestamps(
  words: WordTimestamp[],
  clipStartTime: number
): WordTimestamp[] {
  return words.map((w) => ({
    ...w,
    start: Math.max(0, parseFloat((w.start - clipStartTime).toFixed(2))),
    end: Math.max(0, parseFloat((w.end - clipStartTime).toFixed(2))),
  }));
}
