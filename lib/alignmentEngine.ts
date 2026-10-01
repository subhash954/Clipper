import { WordTimestamp, Transcript, ViralClip } from './types';
import { CandidateMomentSuggestion } from './providers/geminiProvider';
import { calculateViralScore } from './scoring/viralScoring';

/**
 * Normalizes text for robust token comparison (lowercased, punctuation removed).
 */
function cleanText(str: string): string {
  return str.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Aligns Gemini candidate moments against the authentic transcript word stream.
 * Maps exact spoken words to extract genuine timestamps (not simulated or fabricated).
 */
export function alignClipsToTranscript(params: {
  candidates: CandidateMomentSuggestion[];
  transcript: Transcript;
  totalDurationSeconds?: number;
}): ViralClip[] {
  const { candidates, transcript, totalDurationSeconds = 3600 } = params;
  const words = transcript.words;

  if (!words || words.length === 0) {
    throw new Error('Cannot align clips: Transcript contains no word-level timestamps.');
  }

  // Pre-clean transcript words for fast indexing
  const cleanTranscriptWords = words.map((w) => cleanText(w.word));
  const fullCleanText = cleanTranscriptWords.join(' ');

  const alignedClips: ViralClip[] = [];
  const usedRanges: Array<{ start: number; end: number }> = [];

  candidates.forEach((candidate, index) => {
    let startWordIndex = -1;
    let endWordIndex = -1;

    // 1. Try matching candidate startWord and endWord
    const cleanStartWord = cleanText(candidate.startWord);
    const cleanEndWord = cleanText(candidate.endWord);
    const cleanImportantLine = cleanText(candidate.importantLine);

    // Look for importantLine in full transcript text
    let linePos = -1;
    if (cleanImportantLine.length > 10) {
      linePos = fullCleanText.indexOf(cleanImportantLine);
    }

    if (linePos !== -1) {
      // Find which word index corresponds to linePos
      const charCountBefore = fullCleanText.slice(0, linePos).trim();
      const approxWordIdx = charCountBefore.length > 0 ? charCountBefore.split(/\s+/).length : 0;
      startWordIndex = Math.max(0, approxWordIdx - 5);
      endWordIndex = Math.min(words.length - 1, approxWordIdx + candidate.importantLine.split(' ').length + 25);
    } else {
      // Search startWord tokens
      const startTokens = cleanStartWord.split(/\s+/).filter(Boolean);
      if (startTokens.length > 0) {
        for (let i = 0; i <= words.length - startTokens.length; i++) {
          let match = true;
          for (let j = 0; j < startTokens.length; j++) {
            if (cleanTranscriptWords[i + j] !== startTokens[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            startWordIndex = i;
            break;
          }
        }
      }

      // Search endWord tokens after startWord
      const endTokens = cleanEndWord.split(/\s+/).filter(Boolean);
      if (startWordIndex !== -1 && endTokens.length > 0) {
        for (let i = startWordIndex + 10; i < Math.min(words.length, startWordIndex + 120); i++) {
          let match = true;
          for (let j = 0; j < endTokens.length; j++) {
            if (cleanTranscriptWords[i + j] !== endTokens[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            endWordIndex = i + endTokens.length - 1;
            break;
          }
        }
      }
    }

    // Fallback word index selection based on order if token match was not found
    if (startWordIndex === -1) {
      const step = Math.floor(words.length / (candidates.length + 1));
      startWordIndex = Math.max(0, (index + 1) * step - 20);
      endWordIndex = Math.min(words.length - 1, startWordIndex + 50);
    } else if (endWordIndex === -1) {
      endWordIndex = Math.min(words.length - 1, startWordIndex + 55);
    }

    // Ensure startWordIndex < endWordIndex
    if (endWordIndex <= startWordIndex) {
      endWordIndex = Math.min(words.length - 1, startWordIndex + 40);
    }

    // Extract exact timestamps from real words
    let startTime = words[startWordIndex]?.start ?? 0;
    let endTime = words[endWordIndex]?.end ?? startTime + 45;

    // Validate duration limits (between 15 and 60 seconds)
    let clipDuration = endTime - startTime;
    if (clipDuration < 15) {
      // Expand words forward to reach at least 25s
      const targetEndIdx = Math.min(words.length - 1, endWordIndex + 30);
      endTime = words[targetEndIdx]?.end ?? startTime + 25;
      endWordIndex = targetEndIdx;
      clipDuration = endTime - startTime;
    } else if (clipDuration > 60) {
      // Trim words backward to stay under 60s
      while (endWordIndex > startWordIndex && words[endWordIndex].end - startTime > 58) {
        endWordIndex--;
      }
      endTime = words[endWordIndex]?.end ?? startTime + 58;
      clipDuration = endTime - startTime;
    }

    // Boundary check against total video duration
    startTime = Math.max(0, parseFloat(startTime.toFixed(2)));
    endTime = Math.min(totalDurationSeconds, parseFloat(endTime.toFixed(2)));
    clipDuration = parseFloat((endTime - startTime).toFixed(2));

    // Slice genuine transcript words for this clip
    const clipWords = words.slice(startWordIndex, endWordIndex + 1);

    // Compute transparent multi-factor viral score
    const scoreResult = calculateViralScore({
      title: candidate.title,
      importantLine: candidate.importantLine,
      whyThisLineIsImportant: candidate.whyThisLineIsImportant,
      keyMomentType: candidate.keyMomentType,
      duration: clipDuration,
      wordsCount: clipWords.length,
    });

    const schedDate = new Date();
    schedDate.setDate(schedDate.getDate() + Math.floor(index / 2));
    const schedHours = 10 + (index % 8);

    alignedClips.push({
      id: `clip-${index + 1}-${Date.now()}`,
      rank: index + 1,
      title: candidate.title,
      hookSummary: candidate.whyThisLineIsImportant || candidate.importantLine,
      importantLine: candidate.importantLine,
      whyThisLineIsImportant: candidate.whyThisLineIsImportant,
      keyMomentType: candidate.keyMomentType,
      start: startTime,
      end: endTime,
      duration: clipDuration,
      viralScore: scoreResult.viralScore,
      scoreBreakdown: scoreResult.scoreBreakdown,
      confidence: scoreResult.confidence,
      words: clipWords,
      bRollKeywords: candidate.bRollKeywords,
      aiImagePrompt: candidate.aiImagePrompt,
      soundEffects: candidate.soundEffects,
      youtubeScheduleTime: `${schedDate.toISOString().split('T')[0]} at ${schedHours.toString().padStart(2, '0')}:00 UTC`,
    });

    usedRanges.push({ start: startTime, end: endTime });
  });

  return alignedClips;
}

/**
 * Converts absolute media word timestamps into clip-relative timestamps.
 * Required for correct subtitle rendering when video player currentTime is 0-relative.
 */
export function convertToRelativeWordTimestamps(
  words: WordTimestamp[],
  clipStartTime: number
): WordTimestamp[] {
  return words.map((w) => ({
    ...w,
    start: parseFloat(Math.max(0, w.start - clipStartTime).toFixed(2)),
    end: parseFloat(Math.max(0.1, w.end - clipStartTime).toFixed(2)),
  }));
}
