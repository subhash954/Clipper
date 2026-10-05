import { CaptionCue, CaptionWord } from './types';

export interface CaptionValidationOptions {
  mediaDuration?: number;
  allowEmpty?: boolean;
  toleranceSeconds?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Strictly validates an array of caption cues.
 * Enforces non-negative bounds, finite numbers, start < end, monotonic progression,
 * contained word boundaries, non-empty cue text, valid sequence numbers, and media bounds.
 */
export function validateCaptionCues(
  cues: CaptionCue[],
  options?: CaptionValidationOptions
): ValidationResult {
  const errors: string[] = [];
  const { mediaDuration, allowEmpty = false, toleranceSeconds = 0.001 } = options || {};

  if (!Array.isArray(cues)) {
    return { valid: false, errors: ['Caption cues must be an array.'] };
  }

  if (cues.length === 0) {
    if (!allowEmpty) {
      return { valid: true, errors: [] };
    }
    return { valid: true, errors: [] };
  }

  const seenSequences = new Set<number>();
  const seenIds = new Set<string>();

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const cuePrefix = `Cue index ${i} (seq ${cue.sequence ?? 'unknown'}):`;

    if (!cue.id || typeof cue.id !== 'string') {
      errors.push(`${cuePrefix} Missing or invalid cue id.`);
    } else {
      if (seenIds.has(cue.id)) {
        errors.push(`${cuePrefix} Duplicate cue id "${cue.id}".`);
      }
      seenIds.add(cue.id);
    }

    // Sequence validation: 1-based monotonic integer progression
    if (typeof cue.sequence !== 'number' || isNaN(cue.sequence) || !isFinite(cue.sequence)) {
      errors.push(`${cuePrefix} Invalid sequence number (${cue.sequence}).`);
    } else {
      if (seenSequences.has(cue.sequence)) {
        errors.push(`${cuePrefix} Duplicate sequence number ${cue.sequence}.`);
      }
      seenSequences.add(cue.sequence);

      if (i > 0) {
        const prevSeq = cues[i - 1].sequence;
        if (typeof prevSeq === 'number' && cue.sequence <= prevSeq) {
          errors.push(
            `${cuePrefix} Non-monotonic sequence progression: current ${cue.sequence} <= previous ${prevSeq}.`
          );
        }
      }
    }

    // Timestamp validation
    if (typeof cue.start !== 'number' || isNaN(cue.start) || !isFinite(cue.start) || cue.start < 0) {
      errors.push(`${cuePrefix} Invalid start timestamp (${cue.start}). Must be finite number >= 0.`);
    }

    if (typeof cue.end !== 'number' || isNaN(cue.end) || !isFinite(cue.end)) {
      errors.push(`${cuePrefix} Invalid end timestamp (${cue.end}). Must be finite number.`);
    } else if (cue.end <= cue.start) {
      errors.push(
        `${cuePrefix} Inverted or zero-duration timestamp: end (${cue.end}) <= start (${cue.start}).`
      );
    }

    // Media duration bounds check
    if (typeof mediaDuration === 'number' && isFinite(mediaDuration) && mediaDuration > 0) {
      if (cue.start > mediaDuration + toleranceSeconds) {
        errors.push(
          `${cuePrefix} Cue start (${cue.start}s) exceeds media duration (${mediaDuration}s).`
        );
      }
      if (cue.end > mediaDuration + toleranceSeconds) {
        errors.push(
          `${cuePrefix} Cue end (${cue.end}s) exceeds media duration (${mediaDuration}s).`
        );
      }
    }

    // Text validation
    if (typeof cue.text !== 'string' || cue.text.trim().length === 0) {
      errors.push(`${cuePrefix} Empty cue text.`);
    }

    // Word-level validation
    if (Array.isArray(cue.words) && cue.words.length > 0) {
      let previousWordStart = -1;

      for (let wIdx = 0; wIdx < cue.words.length; wIdx++) {
        const w = cue.words[wIdx];
        const wordPrefix = `${cuePrefix} Word ${wIdx} ("${w.word ?? ''}"):`;

        if (typeof w.word !== 'string' || w.word.trim().length === 0) {
          errors.push(`${wordPrefix} Empty word text.`);
        }

        if (typeof w.start !== 'number' || isNaN(w.start) || !isFinite(w.start) || w.start < 0) {
          errors.push(`${wordPrefix} Invalid start timestamp (${w.start}).`);
        }

        if (typeof w.end !== 'number' || isNaN(w.end) || !isFinite(w.end)) {
          errors.push(`${wordPrefix} Invalid end timestamp (${w.end}).`);
        } else if (w.end < w.start) {
          errors.push(`${wordPrefix} Word end (${w.end}) < start (${w.start}).`);
        }

        // Word must be contained within cue boundaries
        if (typeof cue.start === 'number' && typeof w.start === 'number') {
          if (w.start < cue.start - toleranceSeconds) {
            errors.push(
              `${wordPrefix} Word start (${w.start}s) precedes cue start (${cue.start}s).`
            );
          }
        }

        if (typeof cue.end === 'number' && typeof w.end === 'number') {
          if (w.end > cue.end + toleranceSeconds) {
            errors.push(
              `${wordPrefix} Word end (${w.end}s) exceeds cue end (${cue.end}s).`
            );
          }
        }

        // Monotonic word progression inside cue
        if (typeof w.start === 'number') {
          if (previousWordStart >= 0 && w.start < previousWordStart - toleranceSeconds) {
            errors.push(
              `${wordPrefix} Non-monotonic word start progression (${w.start}s < previous ${previousWordStart}s).`
            );
          }
          previousWordStart = w.start;
        }

        // Confidence validation if present
        if (w.confidence !== undefined) {
          if (
            typeof w.confidence !== 'number' ||
            isNaN(w.confidence) ||
            !isFinite(w.confidence) ||
            w.confidence < 0 ||
            w.confidence > 1
          ) {
            errors.push(`${wordPrefix} Out-of-bounds confidence value (${w.confidence}).`);
          }
        }
      }

      // Check text consistency with words
      const wordsJoined = cue.words.map((w) => w.word.trim()).join(' ');
      const cueTextTrimmed = cue.text.trim();
      // Allow minor punctuation differences, but tokens should match
      const wordTokens = wordsJoined.replace(/[^\p{L}\p{N}]/gu, '');
      const cueTokens = cueTextTrimmed.replace(/[^\p{L}\p{N}]/gu, '');
      if (wordTokens.length > 0 && cueTokens.length > 0 && wordTokens !== cueTokens) {
        errors.push(
          `${cuePrefix} Cue text ("${cueTextTrimmed}") is inconsistent with its words ("${wordsJoined}").`
        );
      }
    }

    // Sequence-level chronological validation with previous cue
    if (i > 0) {
      const prevCue = cues[i - 1];
      if (typeof prevCue.start === 'number' && typeof cue.start === 'number') {
        if (cue.start < prevCue.start) {
          errors.push(
            `${cuePrefix} Starts (${cue.start}s) before previous cue starts (${prevCue.start}s).`
          );
        }
        // Disallow overlapping intervals
        if (cue.start < prevCue.end - toleranceSeconds) {
          errors.push(
            `${cuePrefix} Overlaps previous cue: starts at ${cue.start}s before previous ended at ${prevCue.end}s.`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
