import crypto from 'crypto';
import { WordTimestamp, SubtitleLanguage, TranscriptTimingPrecision } from '../types';
import {
  CaptionCue,
  CaptionWord,
  CaptionSegmentationConfig,
  DEFAULT_SEGMENTATION_CONFIG,
  CaptionEmphasisStyle,
} from './types';
import { CaptionEmphasis } from '../intelligence/types';
import { ClipperError } from '../errors';

export interface SegmentTranscriptParams {
  projectId: string;
  transcriptId?: string;
  words: Array<WordTimestamp | { word: string; start: number; end: number; confidence?: number; speaker?: number; wordIndex?: number }>;
  mediaDuration?: number;
  language?: SubtitleLanguage;
  timingPrecision?: TranscriptTimingPrecision;
  config?: CaptionSegmentationConfig;
  emphases?: CaptionEmphasis[];
  timestamp?: string;
}

/**
 * Generates a deterministic RFC 4122 v4-formatted UUID from a seed string.
 */
export function generateDeterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Terminal sentence-ending punctuation across supported languages
 * including Devanagari purna viram (।).
 */
const TERMINAL_PUNCTUATION_REGEX = /[.!?।]$/;

/**
 * Mid-sentence clause punctuation for secondary break opportunities.
 */
const CLAUSE_PUNCTUATION_REGEX = /[,;:\-—–]$/;

/**
 * Counts characters in a string in a Unicode-aware manner.
 */
export function getUnicodeCharacterCount(text: string): number {
  if (!text) return 0;
  // Use Intl.Segmenter or array spreading to count grapheme clusters
  return [...text].length;
}

/**
 * Deterministically segments authoritative transcript words into professional caption cues.
 *
 * Enforces:
 * - Natural pauses between speech
 * - Sentence boundaries and punctuation
 * - Maximum words per cue
 * - Maximum characters per line and cue
 * - Reading speed (characters per second / CPS)
 * - Speaker changes
 * - Contained word timestamps without fabricating or shifting word times
 * - Non-overlapping monotonic cues
 */
export function segmentTranscriptIntoCues(params: SegmentTranscriptParams): CaptionCue[] {
  const {
    projectId,
    transcriptId,
    words: inputWords,
    mediaDuration,
    language = 'en',
    timingPrecision = 'exact_word',
    config: userConfig,
    emphases = [],
  } = params;

  if (inputWords === undefined || inputWords === null || !Array.isArray(inputWords)) {
    throw new ClipperError('VALIDATION_ERROR', 'Words must be a valid array');
  }

  if (inputWords.length === 0) {
    return [];
  }

  if (mediaDuration !== undefined) {
    if (typeof mediaDuration !== 'number' || isNaN(mediaDuration) || !isFinite(mediaDuration) || mediaDuration <= 0) {
      throw new ClipperError(
        'VALIDATION_ERROR',
        `mediaDuration must be a positive finite number, received: ${mediaDuration}`
      );
    }
  }

  // Strict Authoritative Source Validation (Fail closed: No silent filtering, No silent sorting)
  for (let i = 0; i < inputWords.length; i++) {
    const w = inputWords[i];
    if (!w) {
      throw new ClipperError('VALIDATION_ERROR', `Word at index ${i} is missing or null`);
    }
    if (typeof w.word !== 'string' || w.word.trim().length === 0) {
      throw new ClipperError('VALIDATION_ERROR', `Word at index ${i} has empty text`);
    }
    if (typeof w.start !== 'number' || isNaN(w.start) || !isFinite(w.start)) {
      throw new ClipperError('VALIDATION_ERROR', `Word at index ${i} has non-finite start timestamp: ${w.start}`);
    }
    if (typeof w.end !== 'number' || isNaN(w.end) || !isFinite(w.end)) {
      throw new ClipperError('VALIDATION_ERROR', `Word at index ${i} has non-finite end timestamp: ${w.end}`);
    }
    if (w.start < 0) {
      throw new ClipperError('VALIDATION_ERROR', `Word at index ${i} has negative start timestamp: ${w.start}`);
    }
    if (w.end <= w.start) {
      throw new ClipperError(
        'VALIDATION_ERROR',
        `Word at index ${i} has end timestamp ${w.end} <= start timestamp ${w.start}`
      );
    }
    if (mediaDuration !== undefined && w.start > mediaDuration) {
      throw new ClipperError(
        'VALIDATION_ERROR',
        `Word at index ${i} start ${w.start} exceeds media duration ${mediaDuration}`
      );
    }
    if (i > 0) {
      const prev = inputWords[i - 1];
      if (w.start < prev.start) {
        throw new ClipperError(
          'VALIDATION_ERROR',
          `Word timestamps move backwards at index ${i}: ${w.start} < ${prev.start}`
        );
      }
      const currIdx = (w as any).wordIndex;
      const prevIdx = (prev as any).wordIndex;
      if (typeof currIdx === 'number' && typeof prevIdx === 'number' && currIdx <= prevIdx) {
        throw new ClipperError(
          'VALIDATION_ERROR',
          `Word order contradicts wordIndex at index ${i}: ${currIdx} <= ${prevIdx}`
        );
      }
    }
  }

  const validWords = inputWords;

  const config: Required<CaptionSegmentationConfig> = {
    ...DEFAULT_SEGMENTATION_CONFIG,
    ...userConfig,
  };

  // Pre-index emphases by time interval and token match
  const emphasisLookup = new Map<string, CaptionEmphasis>();
  for (const emp of emphases) {
    const key = `${emp.start.toFixed(2)}:${emp.end.toFixed(2)}`;
    emphasisLookup.set(key, emp);
  }

  const cues: CaptionCue[] = [];
  let currentChunk: typeof validWords = [];
  let chunkStart = validWords[0].start;
  let currentSpeaker = validWords[0].speaker;
  let accumulatedChars = 0;

  for (let i = 0; i < validWords.length; i++) {
    const wordObj = validWords[i];
    const isFirstWordInChunk = currentChunk.length === 0;
    const isLastWordOverall = i === validWords.length - 1;
    const nextWord = !isLastWordOverall ? validWords[i + 1] : null;

    if (isFirstWordInChunk) {
      chunkStart = wordObj.start;
      currentSpeaker = wordObj.speaker;
      accumulatedChars = 0;
    }

    currentChunk.push(wordObj);
    const wordClean = wordObj.word.trim();
    accumulatedChars += getUnicodeCharacterCount(wordClean) + (isFirstWordInChunk ? 0 : 1);

    const currentDuration = wordObj.end - chunkStart;
    const currentCps = currentDuration > 0 ? accumulatedChars / currentDuration : 0;

    // Check boundary conditions for splitting
    let shouldBreak = false;

    if (isLastWordOverall) {
      shouldBreak = true;
    } else if (nextWord) {
      // 1. Speaker change
      if (
        config.respectSpeakerChanges &&
        wordObj.speaker !== undefined &&
        nextWord.speaker !== undefined &&
        wordObj.speaker !== nextWord.speaker
      ) {
        shouldBreak = true;
      }

      // 2. Natural pause threshold
      const pauseAfter = nextWord.start - wordObj.end;
      if (pauseAfter >= config.pauseThresholdSeconds) {
        shouldBreak = true;
      }

      // 3. Terminal punctuation (. ! ? ।)
      if (config.respectPunctuation && TERMINAL_PUNCTUATION_REGEX.test(wordClean)) {
        shouldBreak = true;
      }

      // 4. Maximum words reached
      if (currentChunk.length >= config.maxWordsPerCue) {
        shouldBreak = true;
      }

      // 5. Maximum duration reached or next word would exceed max duration
      const nextWordDuration = nextWord ? nextWord.end - chunkStart : currentDuration;
      if (currentDuration >= config.maxCueDurationSeconds || (nextWord && nextWordDuration > config.maxCueDurationSeconds)) {
        shouldBreak = true;
      }

      // 6. Character limit reached or next word would exceed limit (lines * charsPerLine)
      const maxAllowedChars = config.maxCharsPerLine * config.maxLinesPerCue;
      const nextWordChars = 1 + getUnicodeCharacterCount(nextWord.word.trim());
      if (accumulatedChars >= maxAllowedChars || accumulatedChars + nextWordChars > maxAllowedChars) {
        shouldBreak = true;
      }

      // 7. Secondary clause break if above min words
      if (
        !shouldBreak &&
        currentChunk.length >= config.minWordsPerCue &&
        CLAUSE_PUNCTUATION_REGEX.test(wordClean) &&
        (currentDuration >= config.minCueDurationSeconds || currentChunk.length >= 4)
      ) {
        shouldBreak = true;
      }

      // 8. CPS reading speed threshold: lookahead candidate testing
      if (!shouldBreak && nextWord) {
        const nextWordClean = nextWord.word.trim();
        const nextWordChars = 1 + getUnicodeCharacterCount(nextWordClean);
        const candidateChars = accumulatedChars + nextWordChars;
        const candidateDuration = nextWord.end - chunkStart;
        const candidateCps = candidateDuration > 0 ? candidateChars / candidateDuration : 0;

        if (currentChunk.length >= 1 && (candidateCps > config.maxCps || currentCps > config.maxCps)) {
          shouldBreak = true;
        }
      }
    }

    if (shouldBreak && currentChunk.length > 0) {
      const cueSeq = cues.length + 1;
      const lastWordInChunk = currentChunk[currentChunk.length - 1];
      let cueEnd = lastWordInChunk.end;

      // Handle minimum cue duration if gap allows, without exceeding next word start or media duration
      const cueDuration = cueEnd - chunkStart;
      if (cueDuration < config.minCueDurationSeconds) {
        let maxAllowedEnd = cueEnd;
        if (nextWord) {
          maxAllowedEnd = Math.max(cueEnd, nextWord.start - config.minGapBetweenCuesSeconds);
        } else if (typeof mediaDuration === 'number' && isFinite(mediaDuration) && mediaDuration > 0) {
          maxAllowedEnd = mediaDuration;
        } else {
          // Do NOT fabricate cue duration when mediaDuration is omitted and no next word exists
          maxAllowedEnd = cueEnd;
        }

        const targetEnd = chunkStart + config.minCueDurationSeconds;
        cueEnd = Math.min(targetEnd, maxAllowedEnd);
        if (cueEnd < lastWordInChunk.end) {
          cueEnd = lastWordInChunk.end;
        }
      }

      // Clamping to media duration if given
      if (typeof mediaDuration === 'number' && isFinite(mediaDuration) && mediaDuration > 0) {
        if (chunkStart > mediaDuration) {
          // If the entire cue is beyond media duration, skip
          currentChunk = [];
          continue;
        }
        if (cueEnd > mediaDuration) {
          cueEnd = mediaDuration;
        }
      }

      // Format cue text
      const cueText = currentChunk.map((cw) => cw.word.trim()).join(' ');

      // Build CaptionWords with preserved timing and emphasis
      let dominantEmphasis: CaptionEmphasisStyle | undefined;
      const captionWords: CaptionWord[] = currentChunk.map((cw, cwIdx) => {
        const wordKey = `${cw.start.toFixed(2)}:${cw.end.toFixed(2)}`;
        const matchedEmp = emphasisLookup.get(wordKey);

        let isHighlighted = false;
        let emphasisStyle: CaptionEmphasisStyle | undefined;

        if (matchedEmp) {
          isHighlighted = true;
          emphasisStyle = matchedEmp.style as CaptionEmphasisStyle;
          if (!dominantEmphasis) {
            dominantEmphasis = emphasisStyle;
          }
        }

        const capWord: CaptionWord = {
          wordIndex: cwIdx,
          word: cw.word,
          start: cw.start,
          end: cw.end,
          confidence: cw.confidence,
          speaker: cw.speaker,
          highlighted: isHighlighted,
          emphasisStyle,
        };

        return capWord;
      });

      const cueSeed = `${projectId}:${cueSeq}:${chunkStart.toFixed(3)}:${cueEnd.toFixed(3)}:${cueText}`;
      const cueId = generateDeterministicUuid(cueSeed);

      cues.push({
        id: cueId,
        projectId,
        transcriptId,
        sequence: cueSeq,
        start: Number(chunkStart.toFixed(3)),
        end: Number(cueEnd.toFixed(3)),
        text: cueText,
        words: captionWords,
        speakerId: currentSpeaker !== undefined ? currentSpeaker : undefined,
        emphasis: dominantEmphasis,
        language,
        timingPrecision,
        source: 'generated',
        createdAt: params.timestamp || '1970-01-01T00:00:00.000Z',
        updatedAt: params.timestamp || '1970-01-01T00:00:00.000Z',
      });

      currentChunk = [];
    }
  }

  return cues;
}
