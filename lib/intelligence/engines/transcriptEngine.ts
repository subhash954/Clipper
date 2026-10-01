import { SemanticSegment, SemanticSegmentType } from '../types';

export interface RawTranscriptWord {
  word: string;
  start: number;
  end: number;
  speaker?: string | number;
  confidence?: number;
}

/**
 * Transcript Intelligence Engine
 * Parses real word-level timestamps into grammatically bounded semantic segments,
 * categorizing contrarian assertions, actionable secrets, frameworks, statistics, and narrative conclusions.
 */
export function extractSemanticSegments(params: {
  words: RawTranscriptWord[];
  projectId: string;
  videoTitle?: string;
}): SemanticSegment[] {
  const { words, projectId, videoTitle = 'Video' } = params;

  if (words.length === 0) return [];

  const sentences: Array<{
    words: RawTranscriptWord[];
    text: string;
    start: number;
    end: number;
    speaker: string;
    avgConfidence: number;
  }> = [];

  let currentWords: RawTranscriptWord[] = [];
  let currentStart = words[0].start;
  let currentSpeaker = words[0].speaker !== undefined ? String(words[0].speaker) : 'speaker_0';

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    const isLastWord = i === words.length - 1;
    const cleanWord = w.word.trim();
    const hasPunctuation = /[.!?]$/.test(cleanWord);
    const pauseAfter = !isLastWord ? words[i + 1].start - w.end : 0;
    const nextSpeaker = !isLastWord && words[i + 1].speaker !== undefined ? String(words[i + 1].speaker) : 'speaker_0';
    const speakerChanged = !isLastWord && nextSpeaker !== currentSpeaker;

    // Sentence break rule: punctuation, prolonged silence > 1.2s, speaker change, or maximum 30 words
    if (hasPunctuation || pauseAfter > 1.2 || speakerChanged || currentWords.length >= 28 || isLastWord) {
      const sentenceText = currentWords.map((cw) => cw.word).join(' ').trim();
      if (sentenceText.length > 0) {
        const sumConf = currentWords.reduce((acc, cw) => acc + (cw.confidence || 0.95), 0);
        sentences.push({
          words: [...currentWords],
          text: sentenceText,
          start: Number(currentStart.toFixed(2)),
          end: Number(w.end.toFixed(2)),
          speaker: currentSpeaker,
          avgConfidence: Number((sumConf / currentWords.length).toFixed(3)),
        });
      }

      if (!isLastWord) {
        currentWords = [];
        currentStart = words[i + 1].start;
        currentSpeaker = nextSpeaker;
      }
    }
  }

  // Classify each sentence into a rich SemanticSegment
  const segments: SemanticSegment[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const upper = s.text.toUpperCase();
    const lower = s.text.toLowerCase();

    let segmentType: SemanticSegmentType = 'general_statement';
    let importance = 70;
    let topic = 'General';
    let subtopic = 'Insight';

    // 1. Statistics & Metrics
    if (/\d+/.test(s.text) && (s.text.includes('%') || upper.includes('PERCENT') || s.text.includes('$') || upper.includes('MILLION') || upper.includes('LAKH') || upper.includes('CRORE'))) {
      segmentType = 'statistic';
      importance = 85;
      subtopic = 'Quantitative Proof';
    }
    // 2. Contrarian Statements
    else if (
      /\b(NOT|DON'T|STOP|NEVER)\b/i.test(s.text) ||
      lower.includes('instead of') ||
      lower.includes('the truth is') ||
      /\bmyth\b/i.test(s.text)
    ) {
      segmentType = 'contrarian_statement';
      importance = 88;
      subtopic = 'Contrarian Truth';
    }
    // 3. Questions
    else if (s.text.trim().endsWith('?') || lower.startsWith('why') || lower.startsWith('how') || lower.startsWith('what if')) {
      segmentType = 'question';
      importance = 82;
      subtopic = 'Curiosity Hook';
    }
    // 4. Actionable Advice & Frameworks
    else if (
      lower.includes('framework') ||
      lower.includes('step') ||
      lower.includes('rule') ||
      lower.includes('formula') ||
      lower.includes('pillar') ||
      lower.includes('how to') ||
      lower.includes('secret')
    ) {
      segmentType = upper.includes('FRAMEWORK') || upper.includes('PILLAR') ? 'core_framework' : 'actionable_advice';
      importance = 86;
      subtopic = 'Actionable Methodology';
    }
    // 5. Analogies & Stories
    else if (lower.includes("it's like") || lower.includes('think of it as') || lower.includes('imagine if')) {
      segmentType = 'analogy';
      importance = 80;
      subtopic = 'Mental Model';
    } else if (lower.includes('years ago') || lower.includes('when i started') || lower.includes('i remember')) {
      segmentType = 'story';
      importance = 84;
      subtopic = 'Personal Narrative';
    }
    // 6. Conclusions & Punchlines
    else if (lower.includes('the bottom line') || lower.includes('in summary') || lower.includes('ultimately') || lower.includes('so remember')) {
      segmentType = 'conclusion';
      importance = 85;
      subtopic = 'Core Takeaway';
    }

    // Dynamic topic extraction from video title and vocabulary
    if (upper.includes('BRAND') || upper.includes('MARKETING')) topic = 'Branding & Growth';
    else if (upper.includes('AI') || upper.includes('TECH') || upper.includes('SOFTWARE')) topic = 'Technology & AI';
    else if (upper.includes('REVENUE') || upper.includes('MONEY') || upper.includes('SALES')) topic = 'Business & Sales';
    else if (videoTitle) topic = videoTitle.slice(0, 30);

    segments.push({
      id: `sem-seg-${i}-${Date.now()}`,
      projectId,
      source: 'transcript',
      start: s.start,
      end: s.end,
      confidence: s.avgConfidence,
      text: s.text,
      speakerId: s.speaker,
      topic,
      subtopic,
      segmentType,
      importance,
      wordsCount: s.words.length,
      evidence: `Grammatically parsed utterance from ${s.start}s to ${s.end}s`,
      createdAt: new Date().toISOString(),
    });
  }

  return segments;
}
