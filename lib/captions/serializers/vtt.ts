import { CaptionCue } from '../types';
import { validateCanonicalCuesForSerialization } from './common';

/**
 * Formats seconds into WebVTT timestamp format: HH:MM:SS.mmm
 * @param seconds Floating point seconds
 */
export function formatVttTimestamp(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    throw new RangeError(`Invalid timestamp for WebVTT formatting: ${seconds}`);
  }

  const totalMilliseconds = Math.round(seconds * 1000);
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (num: number, size: number) => String(num).padStart(size, '0');

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(milliseconds, 3)}`;
}

export interface VttSerializeOptions {
  includeCueId?: boolean;
}

/**
 * Deterministically generates a valid WebVTT string from an array of CaptionCues.
 * Contains standard WEBVTT header, proper millisecond dot separators, and Unicode preservation.
 *
 * @param cues Array of CaptionCue objects
 * @param options Serialization options
 * @returns Clean WebVTT formatted string
 */
export function generateWebVtt(cues: CaptionCue[], options?: VttSerializeOptions): string {
  const { includeCueId = true } = options || {};

  if (!Array.isArray(cues)) {
    throw new RangeError('Cues must be an array');
  }

  if (cues.length === 0) {
    return 'WEBVTT\n';
  }

  // Pre-validate all cues strictly before serializing without silent reordering
  validateCanonicalCuesForSerialization(cues, 'WebVTT');

  const blocks: string[] = ['WEBVTT\n'];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const seq = cue.sequence ?? i + 1;
    const startStr = formatVttTimestamp(cue.start);
    const endStr = formatVttTimestamp(cue.end);
    const text = cue.text.trim();

    if (includeCueId) {
      blocks.push(`${seq}\n${startStr} --> ${endStr}\n${text}`);
    } else {
      blocks.push(`${startStr} --> ${endStr}\n${text}`);
    }
  }

  return blocks.join('\n') + '\n';
}
