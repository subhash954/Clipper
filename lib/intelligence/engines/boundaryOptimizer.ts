import { OptimizedBoundary } from '../types';

export interface WordBoundaryInfo {
  word: string;
  start: number;
  end: number;
}

/**
 * Real Clip Boundary Optimizer
 * Prevents cut-off syllables, mid-word decapitation, mid-sentence amputations,
 * and awkward trailing dead air.
 */
export function optimizeClipBoundaries(params: {
  targetStart: number;
  targetEnd: number;
  allWords: WordBoundaryInfo[];
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
}): OptimizedBoundary {
  const {
    targetStart,
    targetEnd,
    allWords,
    minDurationSeconds = 15,
    maxDurationSeconds = 60,
  } = params;

  const notes: string[] = [];

  if (allWords.length === 0) {
    return {
      originalStart: targetStart,
      originalEnd: targetEnd,
      recommendedStart: targetStart,
      recommendedEnd: targetEnd,
      leadingPaddingSeconds: 0,
      trailingPaddingSeconds: 0,
      confidence: 0.5,
      boundaryNotes: ['No word timestamps available for boundary snapping'],
    };
  }

  // 1. Find the nearest initial word at or right around targetStart
  let startWordIndex = allWords.findIndex((w) => w.start >= targetStart - 0.25);
  if (startWordIndex === -1) startWordIndex = 0;

  // Check if targetStart lands squarely in the middle of a word
  const midStartWord = allWords.find((w) => targetStart > w.start && targetStart < w.end);
  if (midStartWord) {
    notes.push(`Start timestamp was mid-word ("${midStartWord.word}"). Clamped cleanly to start.`);
    startWordIndex = allWords.indexOf(midStartWord);
  }

  const startWord = allWords[startWordIndex];
  // Add small 0.08s pre-roll so the consonant onset isn't clipped
  const recommendedStart = Math.max(0, Number((startWord.start - 0.08).toFixed(2)));
  const leadingPaddingSeconds = Number((startWord.start - recommendedStart).toFixed(2));

  // 2. Find the optimal concluding word
  let candidateEndWords = allWords.filter(
    (w) => w.end <= targetEnd + 1.5 && w.end >= recommendedStart + minDurationSeconds
  );

  if (candidateEndWords.length === 0) {
    candidateEndWords = allWords.filter((w) => w.end >= recommendedStart + minDurationSeconds);
  }

  // Prefer a word with terminal punctuation (period, exclamation, question mark)
  let endWord = candidateEndWords[candidateEndWords.length - 1] || allWords[allWords.length - 1];

  for (let i = candidateEndWords.length - 1; i >= 0; i--) {
    const w = candidateEndWords[i];
    const duration = w.end - recommendedStart;
    if (duration > maxDurationSeconds) continue;

    if (/[.!?]$/.test(w.word.trim())) {
      endWord = w;
      notes.push(`Snapped end cleanly to terminal sentence boundary: "${w.word}"`);
      break;
    }
  }

  // Add 0.25s post-roll decay so the vocal ring-out doesn't sound abrupt
  const recommendedEnd = Number((endWord.end + 0.25).toFixed(2));
  const trailingPaddingSeconds = 0.25;

  let confidence = 0.95;
  const finalDuration = recommendedEnd - recommendedStart;

  if (finalDuration < minDurationSeconds) {
    notes.push(`Duration (${finalDuration.toFixed(1)}s) is below recommended minimum (${minDurationSeconds}s).`);
    confidence -= 0.15;
  } else if (finalDuration > maxDurationSeconds) {
    notes.push(`Duration (${finalDuration.toFixed(1)}s) exceeds target short-form maximum (${maxDurationSeconds}s).`);
    confidence -= 0.1;
  }

  return {
    originalStart: targetStart,
    originalEnd: targetEnd,
    recommendedStart,
    recommendedEnd,
    leadingPaddingSeconds,
    trailingPaddingSeconds,
    confidence: Number(confidence.toFixed(2)),
    boundaryNotes: notes,
  };
}
