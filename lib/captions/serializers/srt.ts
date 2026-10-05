import { CaptionCue } from '../types';

/**
 * Formats seconds into SRT timestamp format: HH:MM:SS,mmm
 * @param seconds Floating point seconds
 */
export function formatSrtTimestamp(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00:00,000';
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
  if (!Array.isArray(cues) || cues.length === 0) {
    return '';
  }

  // Sort cues deterministically by start time, then sequence
  const sorted = [...cues].sort((a, b) => a.start - b.start || a.sequence - b.sequence);

  const blocks: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cue = sorted[i];
    const seq = i + 1;
    const startStr = formatSrtTimestamp(cue.start);
    const endStr = formatSrtTimestamp(cue.end);
    const text = (cue.text || '').trim();

    if (text.length === 0) {
      continue;
    }

    blocks.push(`${seq}\n${startStr} --> ${endStr}\n${text}`);
  }

  return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}
