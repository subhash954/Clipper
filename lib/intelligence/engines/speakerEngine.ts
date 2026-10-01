import { SpeakerProfile, SpeakerSegment, DialogueExchange } from '../types';

export interface DiarizedWord {
  word: string;
  start: number;
  end: number;
  speaker?: string | number;
  confidence?: number;
}

/**
 * Speaker Intelligence Engine
 * Processes actual diarization timestamps to extract profiles, speaking cadence,
 * turn-taking dynamics, and question-and-answer exchanges.
 */
export function analyzeSpeakers(params: {
  words: DiarizedWord[];
  projectId: string;
}): {
  profiles: SpeakerProfile[];
  segments: SpeakerSegment[];
  dialogueExchanges: DialogueExchange[];
} {
  const { words, projectId } = params;

  if (words.length === 0) {
    return {
      profiles: [],
      segments: [],
      dialogueExchanges: [],
    };
  }

  // 1. Group continuous word sequences by speaker
  const segments: SpeakerSegment[] = [];
  let currentSpeaker = words[0].speaker !== undefined ? String(words[0].speaker) : 'speaker_0';
  let segStart = words[0].start;
  let segEnd = words[0].end;
  let segWords: string[] = [words[0].word];
  let totalConfidence = words[0].confidence || 0.95;
  let wordCountInSeg = 1;

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const spk = w.speaker !== undefined ? String(w.speaker) : 'speaker_0';
    const gap = w.start - segEnd;

    // Break segment if speaker changes or prolonged pause > 2.5s
    if (spk !== currentSpeaker || gap > 2.5) {
      segments.push({
        speakerId: currentSpeaker,
        start: Number(segStart.toFixed(2)),
        end: Number(segEnd.toFixed(2)),
        text: segWords.join(' '),
        confidence: Number((totalConfidence / wordCountInSeg).toFixed(3)),
      });

      currentSpeaker = spk;
      segStart = w.start;
      segEnd = w.end;
      segWords = [w.word];
      totalConfidence = w.confidence || 0.95;
      wordCountInSeg = 1;
    } else {
      segEnd = w.end;
      segWords.push(w.word);
      totalConfidence += w.confidence || 0.95;
      wordCountInSeg++;
    }
  }

  // Push final segment
  if (segWords.length > 0) {
    segments.push({
      speakerId: currentSpeaker,
      start: Number(segStart.toFixed(2)),
      end: Number(segEnd.toFixed(2)),
      text: segWords.join(' '),
      confidence: Number((totalConfidence / wordCountInSeg).toFixed(3)),
    });
  }

  // 2. Compute Speaker Profiles
  const speakerStatsMap = new Map<
    string,
    {
      totalSpeakingTime: number;
      segmentsCount: number;
      totalWords: number;
      confidences: number[];
      interruptions: number;
    }
  >();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const duration = Math.max(0.1, seg.end - seg.start);
    const wordsInSeg = seg.text.split(/\s+/).length;

    if (!speakerStatsMap.has(seg.speakerId)) {
      speakerStatsMap.set(seg.speakerId, {
        totalSpeakingTime: 0,
        segmentsCount: 0,
        totalWords: 0,
        confidences: [],
        interruptions: 0,
      });
    }

    const stats = speakerStatsMap.get(seg.speakerId)!;
    stats.totalSpeakingTime += duration;
    stats.segmentsCount += 1;
    stats.totalWords += wordsInSeg;
    stats.confidences.push(seg.confidence);

    // Detect fast interruption: gap < 0.1s after previous speaker
    if (i > 0) {
      const prev = segments[i - 1];
      if (prev.speakerId !== seg.speakerId && seg.start - prev.end < 0.1) {
        stats.interruptions += 1;
      }
    }
  }

  const profiles: SpeakerProfile[] = [];
  let speakerIdx = 0;

  for (const [speakerId, stats] of speakerStatsMap.entries()) {
    const mins = stats.totalSpeakingTime / 60;
    const dominantWpm = mins > 0 ? Math.round(stats.totalWords / mins) : 140;
    const avgConfidence = stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length;

    // Default neutral labels (Speaker A, Speaker B) unless explicit names provided
    const displayLetter = String.fromCharCode(65 + speakerIdx);
    profiles.push({
      speakerId,
      displayLabel: `Speaker ${displayLetter}`,
      totalSpeakingTimeSeconds: Number(stats.totalSpeakingTime.toFixed(1)),
      segmentsCount: stats.segmentsCount,
      dominantSpeakingRateWpm: Math.min(260, Math.max(80, dominantWpm)),
      confidence: Number(avgConfidence.toFixed(3)),
      detectedInterruptionCount: stats.interruptions,
    });
    speakerIdx++;
  }

  // 3. Detect Dialogue Exchanges (Q&A turns)
  const dialogueExchanges: DialogueExchange[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    const next = segments[i + 1];

    if (current.speakerId !== next.speakerId && current.text.trim().endsWith('?')) {
      dialogueExchanges.push({
        id: `dlg-${i}-${Date.now()}`,
        questionSpeakerId: current.speakerId,
        answerSpeakerId: next.speakerId,
        questionStart: current.start,
        questionEnd: current.end,
        answerStart: next.start,
        answerEnd: next.end,
        topic: current.text.slice(0, 60),
      });
    }
  }

  return {
    profiles,
    segments,
    dialogueExchanges,
  };
}
