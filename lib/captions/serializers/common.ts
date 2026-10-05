import { CaptionCue } from '../types';
import { ClipperError } from '../../errors';

/**
 * Validates canonical caption cues before serialization.
 * Enforces strict order without silent reordering:
 * - cue array exists
 * - each cue exists
 * - sequence is valid and strictly increasing (sequence[i] > sequence[i-1])
 * - cue starts are monotonic (cue.start >= prev.start)
 * - cues do not overlap (cue.start >= prev.end)
 * - cue end > cue start (non-zero positive duration)
 * - timestamps are non-negative and finite
 * - text is non-empty
 * - word timestamps are valid and non-zero duration
 */
export function validateCanonicalCuesForSerialization(cues: CaptionCue[], format: string): void {
  if (!Array.isArray(cues)) {
    throw new ClipperError('VALIDATION_ERROR', `Cues must be an array for ${format} generation`, 400);
  }

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (!cue) {
      throw new ClipperError('VALIDATION_ERROR', `Cue at index ${i} is missing or null`, 400);
    }
    if (typeof cue.sequence !== 'number' || isNaN(cue.sequence) || !isFinite(cue.sequence)) {
      throw new ClipperError('VALIDATION_ERROR', `Cue at index ${i} has invalid sequence: ${cue.sequence}`, 400);
    }
    if (typeof cue.start !== 'number' || isNaN(cue.start) || !isFinite(cue.start) || cue.start < 0) {
      throw new ClipperError('VALIDATION_ERROR', `Cue at index ${i} has invalid start timestamp: ${cue.start}`, 400);
    }
    if (typeof cue.end !== 'number' || isNaN(cue.end) || !isFinite(cue.end) || cue.end <= cue.start) {
      throw new ClipperError(
        'VALIDATION_ERROR',
        `Cue at index ${i} has invalid end timestamp: ${cue.end} (start: ${cue.start})`,
        400
      );
    }
    if (typeof cue.text !== 'string' || cue.text.trim().length === 0) {
      throw new ClipperError('VALIDATION_ERROR', `Cue at index ${i} has empty text`, 400);
    }

    if (i > 0) {
      const prev = cues[i - 1];
      if (cue.sequence <= prev.sequence) {
        throw new ClipperError(
          'VALIDATION_ERROR',
          `Cue sequence is non-monotonic at index ${i}: ${cue.sequence} <= previous ${prev.sequence}`,
          400
        );
      }
      if (cue.start < prev.start) {
        throw new ClipperError(
          'VALIDATION_ERROR',
          `Cue start timestamps move backwards at index ${i}: ${cue.start} < previous ${prev.start}`,
          400
        );
      }
      if (cue.start < prev.end) {
        throw new ClipperError(
          'VALIDATION_ERROR',
          `Cues overlap at index ${i}: cue start ${cue.start} is before previous cue end ${prev.end}`,
          400
        );
      }
    }

    if (Array.isArray(cue.words) && cue.words.length > 0) {
      let prevWordStart = -1;
      let prevWordIndex = -1;

      for (let wIdx = 0; wIdx < cue.words.length; wIdx++) {
        const w = cue.words[wIdx];
        if (!w || typeof w.word !== 'string' || w.word.trim().length === 0) {
          throw new ClipperError('VALIDATION_ERROR', `Cue ${i} word at index ${wIdx} has empty text`, 400);
        }
        if (typeof w.start !== 'number' || isNaN(w.start) || !isFinite(w.start) || w.start < 0) {
          throw new ClipperError('VALIDATION_ERROR', `Cue ${i} word at index ${wIdx} has invalid start: ${w.start}`, 400);
        }
        if (typeof w.end !== 'number' || isNaN(w.end) || !isFinite(w.end) || w.end <= w.start) {
          throw new ClipperError(
            'VALIDATION_ERROR',
            `Cue ${i} word at index ${wIdx} has invalid end: ${w.end} <= start ${w.start}`,
            400
          );
        }

        // Containment inside cue boundaries
        if (w.start < cue.start || w.end > cue.end) {
          throw new ClipperError(
            'VALIDATION_ERROR',
            `Cue ${i} word at index ${wIdx} timing [${w.start}, ${w.end}] falls outside cue bounds [${cue.start}, ${cue.end}]`,
            400
          );
        }

        // Monotonic wordIndex progression when present
        if (typeof w.wordIndex === 'number') {
          if (w.wordIndex < 0) {
            throw new ClipperError(
              'VALIDATION_ERROR',
              `Cue ${i} word at index ${wIdx} has invalid negative wordIndex: ${w.wordIndex}`,
              400
            );
          }
          if (prevWordIndex >= 0 && w.wordIndex <= prevWordIndex) {
            throw new ClipperError(
              'VALIDATION_ERROR',
              `Cue ${i} wordIndex is non-monotonic at index ${wIdx}: ${w.wordIndex} <= previous ${prevWordIndex}`,
              400
            );
          }
          prevWordIndex = w.wordIndex;
        }

        // Monotonic word timing progression within cue
        if (prevWordStart >= 0 && w.start < prevWordStart) {
          throw new ClipperError(
            'VALIDATION_ERROR',
            `Cue ${i} word timing is non-monotonic at index ${wIdx}: ${w.start} < previous ${prevWordStart}`,
            400
          );
        }
        prevWordStart = w.start;
      }
    }
  }
}
