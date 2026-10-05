import { CaptionCue, CaptionWord } from './types';

/**
 * Deterministically finds the active word within a caption cue (or list of words)
 * at a given playback time in seconds.
 *
 * Interval semantics:
 * - Half-open interval [start, end) for intermediate words.
 * - Closed interval [start, end] for the final word of the cue to prevent
 *   a 1-frame boundary blackout at the exact boundary.
 *
 * @param cue CaptionCue or object with words array
 * @param timeInSeconds Playback time in seconds (absolute media time)
 * @returns The active CaptionWord or null if no word is active
 */
export function getActiveCaptionWord<T extends { word: string; start: number; end: number } = CaptionWord>(
  cue: { words?: T[] },
  timeInSeconds: number
): T | null {
  if (
    !cue ||
    !cue.words ||
    !Array.isArray(cue.words) ||
    cue.words.length === 0 ||
    typeof timeInSeconds !== 'number' ||
    isNaN(timeInSeconds) ||
    timeInSeconds < 0
  ) {
    return null;
  }

  const words = cue.words;
  const n = words.length;

  for (let i = 0; i < n; i++) {
    const w = words[i];
    const isLast = i === n - 1;

    if (isLast) {
      // Closed interval [start, end] for the final word
      if (timeInSeconds >= w.start && timeInSeconds <= w.end) {
        return w;
      }
    } else {
      // Half-open interval [start, end) for intermediate words
      if (timeInSeconds >= w.start && timeInSeconds < w.end) {
        return w;
      }
    }
  }

  return null;
}

/**
 * Deterministically finds the active cue from a list of caption cues
 * at a given playback time in seconds.
 *
 * Interval semantics:
 * - Half-open interval [start, end) for intermediate cues.
 * - Closed interval [start, end] for the final cue.
 */
export function getActiveCaptionCue(
  cues: CaptionCue[],
  timeInSeconds: number
): CaptionCue | null {
  if (
    !Array.isArray(cues) ||
    cues.length === 0 ||
    typeof timeInSeconds !== 'number' ||
    isNaN(timeInSeconds) ||
    timeInSeconds < 0
  ) {
    return null;
  }

  const n = cues.length;
  for (let i = 0; i < n; i++) {
    const cue = cues[i];
    const isLast = i === n - 1;

    if (isLast) {
      if (timeInSeconds >= cue.start && timeInSeconds <= cue.end) {
        return cue;
      }
    } else {
      if (timeInSeconds >= cue.start && timeInSeconds < cue.end) {
        return cue;
      }
    }
  }

  return null;
}
