import { CaptionCue } from '../types';
import { validateCanonicalCuesForSerialization } from './common';

/**
 * Formats seconds into SRT timestamp format: HH:MM:SS,mmm
 * @param seconds Floating point seconds
 */
export function formatSrtTimestamp(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    throw new RangeError(`Invalid timestamp for SRT formatting: ${seconds}`);
  }

  const totalMilliseconds = Math.round(seconds * 1000);
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (num: number, size: number) => String(num).padStart(size, '0');

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(milliseconds, 3)}`;
}

/**
 * Deterministically generates a valid SRT subtitle string from an array of CaptionCues.
 * Preserves Unicode (Devanagari/Hindi, Spanish accents, etc.) and enforces strictly monotonic
 * 1-based sequence numbering.
 *
 * @param cues Array of CaptionCue objects
 * @returns Clean, deterministic SRT formatted string
 */
export function generateSrt(cues: CaptionCue[]): string {
  if (!Array.isArray(cues)) {
    throw new RangeError('Cues must be an array');
  }

  if (cues.length === 0) {
    return '';
  }

  // Pre-validate all cues strictly before serializing without silent reordering
  validateCanonicalCuesForSerialization(cues, 'SRT');

  const blocks: string[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const seq = cue.sequence ?? i + 1;
    const startStr = formatSrtTimestamp(cue.start);
    const endStr = formatSrtTimestamp(cue.end);
    const text = cue.text.trim();

    blocks.push(`${seq}\n${startStr} --> ${endStr}\n${text}`);
  }

  return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}
