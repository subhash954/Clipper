import { WordTimestamp, EditOperation } from '../types';

// Common conversational filler word tokens
const FILLER_TOKENS = new Set([
  'um',
  'uh',
  'uhm',
  'umm',
  'er',
  'ah',
  'hmm',
  'like',
  'basically',
  'literally',
  'actually'
]);

/**
 * Normalizes a single word for filler token inspection
 */
function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Detects authentic filler words and repeated adjacent tokens from real word timestamps.
 * Does not silently delete anything: produces an actionable EditOperation list.
 */
export function detectFillerWords(words: WordTimestamp[]): EditOperation[] {
  if (!words || words.length === 0) return [];

  const cuts: EditOperation[] = [];

  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const norm = normalizeWord(current.word);

    // 1. Direct filler token detection
    if (FILLER_TOKENS.has(norm)) {
      // For "like", "actually", "basically", check if it's isolated or standalone
      const isWeakFiller = norm === 'like' || norm === 'actually' || norm === 'basically';
      const duration = current.end - current.start;

      // Hesitation pause before or after increases confidence
      const hasPauseBefore = i > 0 && (current.start - words[i - 1].end) > 0.25;
      const hasPauseAfter = i < words.length - 1 && (words[i + 1].start - current.end) > 0.25;

      const confidence = isWeakFiller 
        ? (hasPauseBefore || hasPauseAfter ? 0.75 : 0.50)
        : (duration > 0.3 ? 0.95 : 0.88);

      cuts.push({
        id: `cut-filler-${i}-${Math.round(current.start * 100)}`,
        type: 'CUT',
        start: parseFloat(current.start.toFixed(2)),
        end: parseFloat(current.end.toFixed(2)),
        reason: 'filler',
        word: current.word,
        confidence,
        enabled: false, // Default to preview mode, user toggles to enable
      });
      continue;
    }

    // 2. Repeated adjacent word detection (e.g. "I... I think", "the... the video")
    if (i < words.length - 1) {
      const next = words[i + 1];
      const nextNorm = normalizeWord(next.word);
      if (norm.length > 1 && norm === nextNorm) {
        cuts.push({
          id: `cut-stutter-${i}-${Math.round(current.start * 100)}`,
          type: 'CUT',
          start: parseFloat(current.start.toFixed(2)),
          end: parseFloat(current.end.toFixed(2)),
          reason: 'filler',
          word: `${current.word} (repetition)`,
          confidence: 0.92,
          enabled: false,
        });
      }
    }
  }

  return cuts;
}

/**
 * Detects silent gaps between consecutive spoken words based on a customizable threshold.
 */
export function detectSilences(
  words: WordTimestamp[],
  thresholdSeconds: number = 0.5
): EditOperation[] {
  if (!words || words.length < 2) return [];

  const cuts: EditOperation[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].end;
    const gapEnd = words[i + 1].start;
    const gapDuration = gapEnd - gapStart;

    if (gapDuration >= thresholdSeconds) {
      cuts.push({
        id: `cut-silence-${i}-${Math.round(gapStart * 100)}`,
        type: 'CUT',
        start: parseFloat(gapStart.toFixed(2)),
        end: parseFloat(gapEnd.toFixed(2)),
        reason: 'silence',
        confidence: 0.98,
        enabled: false,
      });
    }
  }

  return cuts;
}

export interface VoiceEnergyPeak {
  start: number;
  end: number;
  wordsPerSecond: number;
  level: 'High' | 'Medium' | 'Normal';
  explanation: string;
}

/**
 * Calculates authentic voice energy cadence (speaking velocity / density) across the clip.
 * Replaces fake emotional certainty with genuine acoustic/lexical cadence measurements.
 */
export function calculateVoiceEnergy(
  words: WordTimestamp[],
  windowSeconds: number = 3.0
): VoiceEnergyPeak | null {
  if (!words || words.length < 6) return null;

  const clipStart = words[0].start;
  const clipEnd = words[words.length - 1].end;
  const totalDuration = clipEnd - clipStart;

  if (totalDuration < windowSeconds) return null;

  let maxWps = 0;
  let bestWindowStart = clipStart;
  let bestWindowEnd = clipStart + windowSeconds;

  // Slide window by 0.5s increments
  for (let t = clipStart; t <= clipEnd - windowSeconds; t += 0.5) {
    const winEnd = t + windowSeconds;
    const wordsInWindow = words.filter((w) => w.start >= t && w.end <= winEnd);
    const wps = wordsInWindow.length / windowSeconds;

    if (wps > maxWps) {
      maxWps = wps;
      bestWindowStart = t;
      bestWindowEnd = winEnd;
    }
  }

  const level: 'High' | 'Medium' | 'Normal' =
    maxWps >= 3.8 ? 'High' : maxWps >= 2.6 ? 'Medium' : 'Normal';

  return {
    start: parseFloat(bestWindowStart.toFixed(1)),
    end: parseFloat(bestWindowEnd.toFixed(1)),
    wordsPerSecond: parseFloat(maxWps.toFixed(1)),
    level,
    explanation: `Speaking cadence peaked at ${maxWps.toFixed(1)} words/sec between ${bestWindowStart.toFixed(1)}s - ${bestWindowEnd.toFixed(1)}s.`,
  };
}
