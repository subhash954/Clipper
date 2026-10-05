import { CaptionCue } from '../types';

/**
 * Formats seconds into WebVTT timestamp format: HH:MM:SS.mmm
 * @param seconds Floating point seconds
 */
export function formatVttTimestamp(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00:00.000';
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

  if (!Array.isArray(cues) || cues.length === 0) {
    return 'WEBVTT\n';
  }

  const sorted = [...cues].sort((a, b) => a.start - b.start || a.sequence - b.sequence);
  const blocks: string[] = ['WEBVTT\n'];

  for (let i = 0; i < sorted.length; i++) {
    const cue = sorted[i];
    const seq = i + 1;
    const startStr = formatVttTimestamp(cue.start);
    const endStr = formatVttTimestamp(cue.end);
    const text = (cue.text || '').trim();

    if (text.length === 0) {
      continue;
    }

    if (includeCueId) {
      blocks.push(`${seq}\n${startStr} --> ${endStr}\n${text}`);
    } else {
      blocks.push(`${startStr} --> ${endStr}\n${text}`);
    }
  }

  return blocks.join('\n') + '\n';
}
