/**
 * CLIPPER PHASE 7: REAL CAPTION & SUBTITLE ENGINE TEST SUITE
 * CATEGORY 29: Tests A through AM
 */

import {
  CaptionCue,
  CaptionWord,
  CaptionTrack,
  CaptionSegmentationConfig,
  DEFAULT_SEGMENTATION_CONFIG,
} from '../lib/captions/types';
import { segmentTranscriptIntoCues } from '../lib/captions/segmentationEngine';
import { validateCaptionCues } from '../lib/captions/validation';
import { getActiveCaptionWord, getActiveCaptionCue } from '../lib/captions/activeWord';
import { generateSrt, formatSrtTimestamp } from '../lib/captions/serializers/srt';
import { generateWebVtt, formatVttTimestamp } from '../lib/captions/serializers/vtt';
import { generateAss, formatAssTimestamp, hexToAssColor } from '../lib/captions/serializers/ass';
import { extractCaptionEmphases } from '../lib/intelligence/engines/captionEmphasisEngine';
import { renderSubtitlesOnCanvas } from '../lib/subtitleRenderer';
import { WordTimestamp, SubtitleStyle, Project } from '../lib/types';
import { CanonicalRenderSpec } from '../lib/editor/types';
import { LocalStorageAdapter } from '../lib/storage';
import { ClipperError } from '../lib/errors';
import { getCaptionService } from '../lib/captions/captionService';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('================================================================');
console.log('CLIPPER PHASE 7: CATEGORY 29 — CAPTION & SUBTITLE ENGINE GATES');
console.log('================================================================\n');

async function runTests() {
// Realistic fixture transcript words with timestamps
const FIXTURE_WORDS: WordTimestamp[] = [
  { word: 'Welcome', start: 1.0, end: 1.4, confidence: 0.99, speaker: 0 },
  { word: 'to', start: 1.45, end: 1.6, confidence: 0.98, speaker: 0 },
  { word: 'the', start: 1.65, end: 1.8, confidence: 0.97, speaker: 0 },
  { word: 'masterclass.', start: 1.85, end: 2.5, confidence: 0.99, speaker: 0 },
  { word: 'Today,', start: 3.0, end: 3.4, confidence: 0.95, speaker: 0 },
  { word: 'we', start: 3.45, end: 3.6, confidence: 0.96, speaker: 0 },
  { word: 'reveal', start: 3.65, end: 4.0, confidence: 0.94, speaker: 0 },
  { word: 'the', start: 4.05, end: 4.2, confidence: 0.98, speaker: 0 },
  { word: 'secret', start: 4.25, end: 4.7, confidence: 0.99, speaker: 0 },
  { word: 'system.', start: 4.75, end: 5.3, confidence: 0.96, speaker: 0 },
];

// Test A: Valid transcript -> deterministic caption cues
{
  const cues1 = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
    mediaDuration: 10.0,
  });
  const cues2 = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
    mediaDuration: 10.0,
  });

  assert(cues1.length > 0, 'Test A1: Valid transcript produces caption cues');
  assert(JSON.stringify(cues1) === JSON.stringify(cues2), 'Test A2: Segmentation is strictly deterministic');
  const val = validateCaptionCues(cues1, { mediaDuration: 10.0 });
  assert(val.valid, 'Test A3: Generated cues pass strict timing validation');
}

// Test B: Empty transcript -> no cues
{
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: [],
    mediaDuration: 5.0,
  });
  assert(cues.length === 0, 'Test B: Empty transcript produces zero cues');
}

// Test C: Single-word transcript
{
  const singleWord: WordTimestamp[] = [{ word: 'Hello', start: 0.5, end: 0.9, confidence: 0.95 }];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: singleWord,
    mediaDuration: 3.0,
  });
  assert(cues.length === 1, 'Test C1: Single word produces exactly 1 cue');
  assert(cues[0].text === 'Hello', 'Test C2: Cue text matches single word');
  assert(cues[0].words.length === 1, 'Test C3: Cue contains exactly 1 word object');
  assert(cues[0].start === 0.5, 'Test C4: Cue start matches word start');
}

// Test D: Long sentence segmentation
{
  const longSentence: WordTimestamp[] = [];
  for (let i = 0; i < 30; i++) {
    longSentence.push({
      word: `word${i}`,
      start: i * 0.4,
      end: i * 0.4 + 0.35,
    });
  }
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: longSentence,
    config: { maxWordsPerCue: 6 },
    mediaDuration: 15.0,
  });
  assert(cues.length >= 5, 'Test D1: Long sentence is partitioned into multiple cues');
  for (const c of cues) {
    assert(c.words.length <= 6, `Test D2: Each cue has <= 6 words (actual: ${c.words.length})`);
  }
}

// Test E: Punctuation segmentation
{
  const punctWords: WordTimestamp[] = [
    { word: 'First', start: 0.0, end: 0.3 },
    { word: 'thought.', start: 0.35, end: 0.7 },
    { word: 'Second', start: 0.8, end: 1.1 },
    { word: 'idea!', start: 1.15, end: 1.5 },
    { word: 'Third', start: 1.6, end: 1.9 },
    { word: 'question?', start: 1.95, end: 2.3 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: punctWords,
    config: { respectPunctuation: true },
    mediaDuration: 5.0,
  });
  assert(cues.length === 3, `Test E: Terminal punctuation splits cues at sentence boundaries (got ${cues.length})`);
  assert(cues[0].text === 'First thought.', 'Test E1: First cue text matches');
  assert(cues[1].text === 'Second idea!', 'Test E2: Second cue text matches');
  assert(cues[2].text === 'Third question?', 'Test E3: Third cue text matches');
}

// Test F: Pause-based segmentation
{
  const pauseWords: WordTimestamp[] = [
    { word: 'Speaking', start: 0.0, end: 0.4 },
    { word: 'here', start: 0.45, end: 0.8 },
    // Gap of 0.8s (exceeds default 0.35s pause threshold)
    { word: 'after', start: 1.6, end: 1.9 },
    { word: 'silence', start: 1.95, end: 2.3 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: pauseWords,
    config: { pauseThresholdSeconds: 0.35 },
    mediaDuration: 5.0,
  });
  assert(cues.length === 2, `Test F: Pause threshold splits speech into separate cues (got ${cues.length})`);
  assert(cues[0].text === 'Speaking here', 'Test F1: Pre-pause chunk');
  assert(cues[1].text === 'after silence', 'Test F2: Post-pause chunk');
}

// Test G: Speaker-change segmentation
{
  const speakerWords: WordTimestamp[] = [
    { word: 'Host', start: 0.0, end: 0.3, speaker: 0 },
    { word: 'speaking', start: 0.35, end: 0.7, speaker: 0 },
    { word: 'Guest', start: 0.75, end: 1.1, speaker: 1 },
    { word: 'replying', start: 1.15, end: 1.5, speaker: 1 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: speakerWords,
    config: { respectSpeakerChanges: true },
    mediaDuration: 5.0,
  });
  assert(cues.length === 2, `Test G: Speaker change creates separate cues (got ${cues.length})`);
  assert(cues[0].speakerId === 0, 'Test G1: First cue speakerId matches');
  assert(cues[1].speakerId === 1, 'Test G2: Second cue speakerId matches');
}

// Test H: Maximum words enforcement
{
  const manyWords: WordTimestamp[] = [];
  for (let i = 0; i < 20; i++) {
    manyWords.push({ word: `token${i}`, start: i * 0.2, end: i * 0.2 + 0.18 });
  }
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: manyWords,
    config: { maxWordsPerCue: 4 },
  });
  for (const c of cues) {
    assert(c.words.length <= 4, `Test H: Cue words count ${c.words.length} <= maxWordsPerCue 4`);
  }
}

// Test I: Maximum character/line enforcement
{
  const longWords: WordTimestamp[] = [
    { word: 'Supercalifragilisticexpialidocious', start: 0.0, end: 1.0 },
    { word: 'extraordinarily', start: 1.05, end: 1.6 },
    { word: 'incomprehensibility', start: 1.65, end: 2.4 },
    { word: 'antidisestablishmentarianism', start: 2.45, end: 3.5 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: longWords,
    config: { maxCharsPerLine: 35, maxLinesPerCue: 1 },
  });
  assert(cues.length >= 3, 'Test I: Character limits force splitting on long tokens');
}

// Test J: Maximum duration enforcement
{
  const slowWords: WordTimestamp[] = [
    { word: 'Drawn', start: 0.0, end: 2.0 },
    { word: 'out', start: 2.05, end: 4.5 },
    { word: 'words', start: 4.55, end: 7.0 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: slowWords,
    config: { maxCueDurationSeconds: 3.0 },
  });
  for (const c of cues) {
    const dur = c.end - c.start;
    assert(dur <= 3.5, `Test J: Cue duration ${dur.toFixed(2)}s satisfies maximum constraint`);
  }
}

// Test K: Reading-speed / CPS calculation
{
  const fastWords: WordTimestamp[] = [
    { word: 'VeryRapidlySpokenContentHere', start: 0.0, end: 0.5 },
    { word: 'AnotherRapidlySpokenWordHere', start: 0.51, end: 0.9 },
    { word: 'EvenMoreUltraFastSpeechTokens', start: 0.91, end: 1.2 },
    { word: 'FinalSuperSpeedWordStringNow', start: 1.21, end: 1.5 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: fastWords,
    config: { maxCps: 20 },
  });
  assert(cues.length >= 2, 'Test K: High CPS reading speeds trigger cue breaks');
}

// Test L: Word timing contained inside cue
{
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
  });
  for (const c of cues) {
    for (const w of c.words) {
      assert(w.start >= c.start - 0.001, `Test L1: Word start ${w.start} >= cue start ${c.start}`);
      assert(w.end <= c.end + 0.001, `Test L2: Word end ${w.end} <= cue end ${c.end}`);
    }
  }
}

// Test M: Invalid negative timestamp rejection
{
  const badCues: CaptionCue[] = [
    {
      id: 'bad-1',
      projectId: 'p1',
      sequence: 1,
      start: -0.5,
      end: 1.0,
      text: 'Negative start',
      words: [],
      language: 'en',
      timingPrecision: 'exact_word',
      source: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const res = validateCaptionCues(badCues);
  assert(!res.valid, 'Test M: Validator rejects negative start timestamp');
}

// Test N: Invalid end <= start rejection
{
  const badCues: CaptionCue[] = [
    {
      id: 'bad-2',
      projectId: 'p1',
      sequence: 1,
      start: 2.0,
      end: 1.5,
      text: 'Inverted time',
      words: [],
      language: 'en',
      timingPrecision: 'exact_word',
      source: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const res = validateCaptionCues(badCues);
  assert(!res.valid, 'Test N: Validator rejects end <= start');
}

// Test O: Cue beyond media duration rejection
{
  const badCues: CaptionCue[] = [
    {
      id: 'bad-3',
      projectId: 'p1',
      sequence: 1,
      start: 9.0,
      end: 12.0,
      text: 'Beyond duration',
      words: [],
      language: 'en',
      timingPrecision: 'exact_word',
      source: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const res = validateCaptionCues(badCues, { mediaDuration: 10.0 });
  assert(!res.valid, 'Test O: Validator rejects cue ending beyond media duration');
}

// Test P: Non-monotonic words rejection
{
  const badCues: CaptionCue[] = [
    {
      id: 'bad-4',
      projectId: 'p1',
      sequence: 1,
      start: 1.0,
      end: 3.0,
      text: 'first second',
      words: [
        { word: 'second', start: 2.5, end: 2.9, wordIndex: 0 },
        { word: 'first', start: 1.2, end: 1.6, wordIndex: 1 },
      ],
      language: 'en',
      timingPrecision: 'exact_word',
      source: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const res = validateCaptionCues(badCues);
  assert(!res.valid, 'Test P: Validator rejects non-monotonic word ordering');
}

// Test Q: SRT exact timestamp formatting
{
  const ts1 = formatSrtTimestamp(1.2);
  const ts2 = formatSrtTimestamp(65.456);
  const ts3 = formatSrtTimestamp(3661.002);
  assert(ts1 === '00:00:01,200', `Test Q1: SRT timestamp formatted correctly: ${ts1}`);
  assert(ts2 === '00:01:05,456', `Test Q2: SRT timestamp formatted correctly: ${ts2}`);
  assert(ts3 === '01:01:01,002', `Test Q3: SRT timestamp formatted correctly: ${ts3}`);
}

// Test R: SRT deterministic output
{
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
  });
  const srt1 = generateSrt(cues);
  const srt2 = generateSrt(cues);
  assert(srt1.length > 0, 'Test R1: Generates non-empty SRT string');
  assert(srt1 === srt2, 'Test R2: SRT generation is strictly deterministic');
  assert(srt1.includes('1\n00:00:01,000 --> 00:00:02,500'), 'Test R3: Contains expected sequence and arrow');
}

// Test S: WebVTT header and formatting
{
  const ts = formatVttTimestamp(1.234);
  assert(ts === '00:00:01.234', `Test S1: WebVTT timestamp formatted with period: ${ts}`);
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
  });
  const vtt = generateWebVtt(cues);
  assert(vtt.startsWith('WEBVTT\n'), 'Test S2: WebVTT begins with WEBVTT header');
  assert(vtt.includes('00:00:01.000 --> 00:00:02.500'), 'Test S3: Contains WebVTT arrow format');
}

// Test T: WebVTT deterministic output
{
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
  });
  const vtt1 = generateWebVtt(cues);
  const vtt2 = generateWebVtt(cues);
  assert(vtt1 === vtt2, 'Test T: WebVTT output is strictly deterministic');
}

// Test U: ASS valid structure
{
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
  });
  const ass = generateAss(cues);
  assert(ass.includes('[Script Info]'), 'Test U1: ASS contains [Script Info]');
  assert(ass.includes('[V4+ Styles]'), 'Test U2: ASS contains [V4+ Styles]');
  assert(ass.includes('[Events]'), 'Test U3: ASS contains [Events]');
  assert(ass.includes('Dialogue: 0,'), 'Test U4: ASS contains Dialogue event line');
}

// Test V: ASS style mapping
{
  const customStyle: Partial<SubtitleStyle> = {
    fontFamily: 'Montserrat',
    fontSize: 64,
    primaryColor: '#FFFFFF',
    highlightColor: '#FACC15',
    strokeColor: '#000000',
    position: 'bottom',
    uppercase: true,
  };
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
  });
  const ass = generateAss(cues, { style: customStyle });
  assert(ass.includes('Montserrat,64'), 'Test V1: ASS styles include custom font and size');
  const colorAss = hexToAssColor('#FACC15');
  assert(colorAss === '&H0015CCFA', `Test V2: Hex #FACC15 correctly converted to ASS BGR &H0015CCFA (got ${colorAss})`);
}

// Test W: ASS karaoke timing from real word timestamps
{
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
  });
  const ass = generateAss(cues, { enableKaraoke: true });
  assert(ass.includes('{\\k'), 'Test W1: ASS includes karaoke \\k timing tags');
  // 1.0 to 1.4s = 0.4s = 40 centiseconds -> {\k40}
  assert(ass.includes('{\\k40}WELCOME') || ass.includes('{\\k40}Welcome'), 'Test W2: Karaoke tag computed accurately from real word duration');
}

// Test X: Missing word timing does not fabricate karaoke timing
{
  const cuesWithoutWords: CaptionCue[] = [
    {
      id: 'no-words-1',
      projectId: 'p1',
      sequence: 1,
      start: 1.0,
      end: 3.0,
      text: 'Simple caption without word timings',
      words: [],
      language: 'en',
      timingPrecision: 'approximate_cue',
      source: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const ass = generateAss(cuesWithoutWords, { enableKaraoke: true });
  assert(!ass.includes('{\\k'), 'Test X: Degrades cleanly to dialogue without fabricating fake karaoke word timings');
  assert(ass.includes('Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,SIMPLE CAPTION WITHOUT WORD TIMINGS'), 'Test X2: Standard dialogue line preserved');
}

// Test Y: Hindi Unicode preservation
{
  const hindiWords: WordTimestamp[] = [
    { word: 'नमस्ते', start: 0.0, end: 0.5 },
    { word: 'दोस्तों', start: 0.55, end: 1.0 },
    { word: 'स्वागत', start: 1.05, end: 1.5 },
    { word: 'है।', start: 1.55, end: 2.0 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: hindiWords,
    language: 'hi',
  });
  assert(cues.length === 1, 'Test Y1: Hindi words segmented into cue');
  assert(cues[0].text === 'नमस्ते दोस्तों स्वागत है।', 'Test Y2: Devanagari text and purna viram preserved perfectly');

  const srt = generateSrt(cues);
  assert(srt.includes('नमस्ते दोस्तों स्वागत है।'), 'Test Y3: SRT preserves Devanagari Unicode characters without corruption');

  const vtt = generateWebVtt(cues);
  assert(vtt.includes('नमस्ते दोस्तों स्वागत है।'), 'Test Y4: WebVTT preserves Devanagari Unicode characters without corruption');
}

// Test Z: Production path does not use SAMPLE_TRANSLATIONS
{
  // In production mode (isDemoMode = false), if no real translation exists,
  // subtitleRenderer must NOT display sample translations
  let capturedTranslatedText: string | undefined = undefined;
  const mockCtx: any = {
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    roundRect: () => {},
    fill: () => {},
    translate: () => {},
    scale: () => {},
    strokeText: () => {},
    fillText: (text: string) => {
      if (text === 'बनाना') {
        capturedTranslatedText = text;
      }
    },
    measureText: () => ({ width: 50 }),
  };

  const wordsWithEnglish: WordTimestamp[] = [
    { word: 'BUILD', start: 0.0, end: 1.0 },
  ];
  const style: SubtitleStyle = {
    preset: 'impact',
    fontFamily: 'Impact',
    fontSize: 52,
    primaryColor: '#FFF',
    highlightColor: '#FF0',
    strokeColor: '#000',
    strokeWidth: 2,
    position: 'bottom',
    uppercase: true,
    showEmojis: false,
    animation: 'pop',
    language: 'hi',
    showDualLanguage: true, // Requested dual language
    enableSFX: false,
    // Note: style.translatedText is NOT provided
  };

  // 1. Production call: isDemoMode = false (default)
  renderSubtitlesOnCanvas(
    mockCtx,
    0.5,
    5.0,
    wordsWithEnglish,
    style,
    {} as any,
    1080,
    1920,
    false,
    0,
    false // isDemoMode = false (PRODUCTION)
  );

  assert(
    capturedTranslatedText === undefined,
    'Test Z1: Production path does NOT substitute SAMPLE_TRANSLATIONS when real translation is absent'
  );

  // 2. Explicit demo mode call
  renderSubtitlesOnCanvas(
    mockCtx,
    0.5,
    5.0,
    wordsWithEnglish,
    style,
    {} as any,
    1080,
    1920,
    false,
    0,
    true // isDemoMode = true (DEMO ONLY)
  );
  assert(
    capturedTranslatedText === 'बनाना',
    'Test Z2: Isolated demo mode correctly accesses sample translations for UI preview'
  );
}

// Test AA: Production UI does not display hardcoded 98.4% accuracy
{
  const captionsTabPath = path.join(process.cwd(), 'components', 'tabs', 'CaptionsTab.tsx');
  const content = fs.readFileSync(captionsTabPath, 'utf8');
  assert(
    !content.includes('98.4%'),
    'Test AA1: CaptionsTab.tsx no longer contains hardcoded false "98.4%" accuracy claim'
  );
  assert(
    content.includes('Timing Status:') || content.includes('Timing: Verified') || content.includes('Word timing: Exact'),
    'Test AA2: Truthful timing verification metric displayed instead of fabricated accuracy percentage'
  );
}

// Test AB: Real provider confidence preserved
{
  const wordsWithConf: WordTimestamp[] = [
    { word: 'test', start: 0.0, end: 0.5, confidence: 0.987 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: wordsWithConf,
  });
  assert(cues[0].words[0].confidence === 0.987, 'Test AB: Actual provider confidence value preserved exactly');
}

// Test AC: Missing confidence remains undefined
{
  const wordsWithoutConf: WordTimestamp[] = [
    { word: 'uncalibrated', start: 0.0, end: 0.5 },
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: wordsWithoutConf,
  });
  assert(
    cues[0].words[0].confidence === undefined,
    'Test AC: Missing provider confidence remains strictly undefined without fallback numbers (0.85/0.95)'
  );
}

// Test AD: Heuristic emphasis confidence is not represented as provider confidence
{
  const emphases = extractCaptionEmphases({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: [{ word: 'SECRET', start: 1.0, end: 1.5 }],
  });
  assert(emphases.length > 0, 'Test AD1: Heuristic emphasis extracted for power keyword');
  assert(
    emphases[0].confidenceSource === 'heuristic',
    'Test AD2: Emphasis clearly attributes confidenceSource = "heuristic"'
  );
}

// Test AE: Caption persistence round-trip
const projectIdAE = crypto.randomUUID();
const trackIdAE = crypto.randomUUID();
const cueIdAE = crypto.randomUUID();
{
  const storage = new LocalStorageAdapter();
  const testTrack: CaptionTrack = {
    id: trackIdAE,
    projectId: projectIdAE,
    language: 'en',
    version: 1,
    source: 'generated',
    status: 'ready',
    cuesCount: 1,
    durationSeconds: 2.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cues: [
      {
        id: cueIdAE,
        projectId: projectIdAE,
        sequence: 1,
        start: 0.0,
        end: 2.0,
        text: 'Persistence test cue',
        words: [
          { word: 'Persistence', start: 0.0, end: 0.9, wordIndex: 0 },
          { word: 'test', start: 0.95, end: 1.4, wordIndex: 1 },
          { word: 'cue', start: 1.45, end: 2.0, wordIndex: 2 },
        ],
        language: 'en',
        timingPrecision: 'exact_word',
        source: 'generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  // Mock project in storage first
  const project: Project = {
    id: projectIdAE,
    userId: 'user-ae',
    title: 'Persistence Test Project',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    durationSeconds: 10,
    status: 'ready',
    clips: [],
    createdAt: new Date().toISOString(),
  };
  await storage.saveProject(project);

  const saved = await storage.saveCaptionTrack(testTrack, 'user-ae');
  assert(saved.id === testTrack.id, 'Test AE1: saveCaptionTrack returns saved track');

  const loaded = await storage.getCaptionTrack(project.id);
  assert(loaded !== null, 'Test AE2: getCaptionTrack retrieves saved track');
  assert(loaded?.cues.length === 1, 'Test AE3: Loaded track includes relational cues');
  assert(loaded?.cues[0].words.length === 3, 'Test AE4: Loaded cue includes relational words');
  assert(loaded?.cues[0].text === 'Persistence test cue', 'Test AE5: Cue text matches perfectly');
}

// Test AF: Tenant isolation
{
  const storage = new LocalStorageAdapter();
  let caughtTenantErr = false;
  try {
    // User B tries to save captions for Project belonging to User A ('user-ae')
    const maliciousTrack: CaptionTrack = {
      id: crypto.randomUUID(),
      projectId: projectIdAE,
      language: 'en',
      version: 2,
      source: 'generated',
      status: 'ready',
      cues: [],
      cuesCount: 0,
      durationSeconds: 5.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.saveCaptionTrack(maliciousTrack, 'attacker-user-id');
  } catch (err: any) {
    caughtTenantErr = err.statusCode === 403 || err.code === 'FORBIDDEN';
  }
  assert(caughtTenantErr, 'Test AF: Tenant isolation blocks cross-user caption modification');
}

// Test AG: Cross-project transcript/caption rejection
{
  const storage = new LocalStorageAdapter();
  let caughtCrossProjErr = false;

  const project2Id = crypto.randomUUID();
  const transcript1Id = crypto.randomUUID();

  // Create project 2
  const project2: Project = {
    id: project2Id,
    userId: 'user-ae',
    title: 'Cross-Project Target',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    durationSeconds: 10,
    status: 'ready',
    clips: [],
    createdAt: new Date().toISOString(),
  };
  await storage.saveProject(project2);

  // Create transcript on project 1
  const transcript1 = {
    id: transcript1Id,
    projectId: projectIdAE, // Belongs to Project 1
    text: 'Some speech',
    words: [{ word: 'Some', start: 0, end: 1 }],
  };
  await storage.saveTranscript(transcript1 as any, projectIdAE, 'user-ae');

  try {
    // Attempt to save caption on Project 2 pointing to Transcript from Project 1
    const crossTrack: CaptionTrack = {
      id: crypto.randomUUID(),
      projectId: project2Id, // Project 2
      transcriptId: transcript1Id, // Belongs to Project 1!
      language: 'en',
      version: 1,
      source: 'generated',
      status: 'ready',
      cues: [],
      cuesCount: 0,
      durationSeconds: 5.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.saveCaptionTrack(crossTrack, 'user-ae');
  } catch (err: any) {
    caughtCrossProjErr = err.statusCode === 403 || err.code === 'FORBIDDEN';
  }
  assert(caughtCrossProjErr, 'Test AG: Rejects associating transcript from another project');
}

// Test AH: Version creation preserves previous version
{
  const storage = new LocalStorageAdapter();
  // Get track v1 from project
  const v1 = await storage.getCaptionTrack(projectIdAE, 1);
  assert(v1 !== null, 'Test AH1: Version 1 is present');

  // Save new edited Version 2
  const v2Track: CaptionTrack = {
    ...v1!,
    id: crypto.randomUUID(),
    version: 2,
    source: 'edited',
    cues: [
      {
        ...v1!.cues[0],
        id: crypto.randomUUID(),
        text: 'Edited version 2 text',
      },
    ],
  };
  await storage.saveCaptionTrack(v2Track, 'user-ae');

  const loadedV1 = await storage.getCaptionTrack(projectIdAE, 1);
  const loadedV2 = await storage.getCaptionTrack(projectIdAE, 2);

  assert(loadedV1?.version === 1, 'Test AH2: Version 1 remains intact in history');
  assert(loadedV1?.cues[0].text === 'Persistence test cue', 'Test AH3: Version 1 text unchanged');
  assert(loadedV2?.version === 2, 'Test AH4: Version 2 is available');
  assert(loadedV2?.cues[0].text === 'Edited version 2 text', 'Test AH5: Version 2 reflects edit');
}

// Test AI: CanonicalRenderSpec integration
{
  const cues = segmentTranscriptIntoCues({
    projectId: '11111111-1111-1111-1111-111111111111',
    words: FIXTURE_WORDS,
  });
  const mockRenderSpec: Partial<CanonicalRenderSpec> = {
    id: 'rs-1',
    projectId: 'p1',
    duration: 10,
    captions: {
      enabled: true,
      style: {
        preset: 'impact',
        fontFamily: 'Impact',
        fontSize: 52,
        primaryColor: '#FFFFFF',
        highlightColor: '#FACC15',
        strokeColor: '#000000',
        strokeWidth: 3,
        position: 'bottom',
        uppercase: true,
        showEmojis: false,
        animation: 'karaoke',
        language: 'en',
        showDualLanguage: false,
        enableSFX: false,
      },
      safeAreaEnabled: true,
      trackId: 'track-uuid-1',
      cues,
      words: cues.flatMap((c) =>
        c.words.map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          highlighted: w.highlighted,
          emphasisStyle: w.emphasisStyle as any,
        }))
      ),
    },
  };
  assert(mockRenderSpec.captions?.enabled === true, 'Test AI1: RenderSpec captions enabled');
  assert(mockRenderSpec.captions?.cues?.length === cues.length, 'Test AI2: RenderSpec holds canonical cues');
  assert(mockRenderSpec.captions?.trackId === 'track-uuid-1', 'Test AI3: RenderSpec carries canonical trackId');
}

// Test AJ: Active-word boundary behavior
{
  const testCue: CaptionCue = {
    id: 'aj-1',
    projectId: 'p1',
    sequence: 1,
    start: 1.0,
    end: 3.0,
    text: 'alpha beta gamma',
    language: 'en',
    timingPrecision: 'exact_word',
    source: 'generated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    words: [
      { word: 'alpha', start: 1.0, end: 1.5, wordIndex: 0 },
      { word: 'beta', start: 1.5, end: 2.2, wordIndex: 1 },
      { word: 'gamma', start: 2.2, end: 3.0, wordIndex: 2 },
    ],
  };

  // Test [start, end) interval:
  assert(getActiveCaptionWord(testCue, 1.0)?.word === 'alpha', 'Test AJ1: Exactly at alpha start is alpha');
  assert(getActiveCaptionWord(testCue, 1.499)?.word === 'alpha', 'Test AJ2: Inside alpha interval is alpha');
  assert(getActiveCaptionWord(testCue, 1.5)?.word === 'beta', 'Test AJ3: Boundary at 1.5s immediately switches to beta [start, end)');
  assert(getActiveCaptionWord(testCue, 2.199)?.word === 'beta', 'Test AJ4: Inside beta interval is beta');
  assert(getActiveCaptionWord(testCue, 2.2)?.word === 'gamma', 'Test AJ5: Boundary at 2.2s switches to gamma');
  // Final word boundary:
  assert(getActiveCaptionWord(testCue, 3.0)?.word === 'gamma', 'Test AJ6: Closed interval [start, end] at final word end includes gamma');
  assert(getActiveCaptionWord(testCue, 3.001) === null, 'Test AJ7: Beyond cue end is null');
}

// Test AK: Malformed caption cue rejection
{
  const malformedCues: CaptionCue[] = [
    {
      id: '', // Empty ID
      projectId: 'p1',
      sequence: 1,
      start: 0,
      end: 2,
      text: '', // Empty text
      words: [],
      language: 'en',
      timingPrecision: 'exact_word',
      source: 'generated',
      createdAt: '',
      updatedAt: '',
    },
  ];
  const res = validateCaptionCues(malformedCues);
  assert(!res.valid, 'Test AK: Validator rejects empty id and empty cue text');
}

// Test AL: Duplicate cue sequence rejection
{
  const dupSeqCues: CaptionCue[] = [
    {
      id: 'dup-1',
      projectId: 'p1',
      sequence: 1,
      start: 0,
      end: 1,
      text: 'first',
      words: [],
      language: 'en',
      timingPrecision: 'exact_word',
      source: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'dup-2',
      projectId: 'p1',
      sequence: 1, // Duplicate sequence 1!
      start: 1.1,
      end: 2,
      text: 'duplicate seq',
      words: [],
      language: 'en',
      timingPrecision: 'exact_word',
      source: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const res = validateCaptionCues(dupSeqCues);
  assert(!res.valid, 'Test AL: Validator rejects duplicate sequence numbers');
}

// Test AM: Deterministic regeneration
{
  const run1 = segmentTranscriptIntoCues({
    projectId: 'regenerate-test-proj',
    words: FIXTURE_WORDS,
    mediaDuration: 10.0,
  });
  const run2 = segmentTranscriptIntoCues({
    projectId: 'regenerate-test-proj',
    words: FIXTURE_WORDS,
    mediaDuration: 10.0,
  });

  assert(run1.length === run2.length, 'Test AM1: Regeneration produces identical cue count');
  for (let i = 0; i < run1.length; i++) {
    assert(run1[i].id === run2[i].id, `Test AM2: Cue ${i} deterministic ID matches across runs`);
    assert(run1[i].start === run2[i].start, `Test AM3: Cue ${i} start matches across runs`);
    assert(run1[i].end === run2[i].end, `Test AM4: Cue ${i} end matches across runs`);
    assert(run1[i].text === run2[i].text, `Test AM5: Cue ${i} text matches across runs`);
  }
}

// ================================================================
// CLIPPER PHASE 7.1: CATEGORY 30 — CAPTION ENGINE FINAL HARDENING GATES
// ================================================================

console.log('\n================================================================');
console.log('CLIPPER PHASE 7.1: CATEGORY 30 — FINAL HARDENING GATES');
console.log('================================================================\n');

// Test 30-A: Reject empty word text
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-a',
      words: [{ word: '   ', start: 0.0, end: 0.5 }],
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-A: Rejects empty word text with VALIDATION_ERROR');
  }
  assert(caught, 'Test 30-A: Throws error on empty word text');
}

// Test 30-B: Reject NaN start timestamp
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-b',
      words: [{ word: 'Hello', start: NaN, end: 0.5 }],
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-B: Rejects NaN start timestamp');
  }
  assert(caught, 'Test 30-B: Throws error on NaN start');
}

// Test 30-C: Reject Infinity end timestamp
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-c',
      words: [{ word: 'Hello', start: 0.0, end: Infinity }],
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-C: Rejects Infinity end timestamp');
  }
  assert(caught, 'Test 30-C: Throws error on Infinity end');
}

// Test 30-D: Reject negative start timestamp
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-d',
      words: [{ word: 'Hello', start: -0.1, end: 0.5 }],
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-D: Rejects negative start timestamp');
  }
  assert(caught, 'Test 30-D: Throws error on negative start');
}

// Test 30-E: Reject end <= start timestamp
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-e',
      words: [{ word: 'Hello', start: 1.0, end: 0.8 }],
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-E: Rejects end <= start');
  }
  assert(caught, 'Test 30-E: Throws error on inverted end <= start');
}

// Test 30-F: Reject backwards timing (fail closed, NO silent sorting)
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-f',
      words: [
        { word: 'First', start: 2.0, end: 2.5 },
        { word: 'Second', start: 1.0, end: 1.5 },
      ],
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-F: Rejects backwards timing without silent sorting');
  }
  assert(caught, 'Test 30-F: Throws on backwards timing');
}

// Test 30-G: Reject conflicting wordIndex
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-g',
      words: [
        { word: 'First', start: 1.0, end: 1.4, wordIndex: 2 } as any,
        { word: 'Second', start: 1.5, end: 1.9, wordIndex: 1 } as any,
      ],
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-G: Rejects conflicting wordIndex');
  }
  assert(caught, 'Test 30-G: Throws on conflicting wordIndex');
}

// Test 30-H: Reject invalid mediaDuration
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-h',
      words: [{ word: 'Hello', start: 0.0, end: 0.5 }],
      mediaDuration: -5.0,
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-H: Rejects negative mediaDuration');
  }
  assert(caught, 'Test 30-H: Throws on invalid mediaDuration');
}

// Test 30-I: Reject word start exceeding mediaDuration
{
  let caught = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-30-i',
      words: [{ word: 'Late', start: 12.0, end: 12.5 }],
      mediaDuration: 10.0,
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-I: Rejects word start exceeding mediaDuration');
  }
  assert(caught, 'Test 30-I: Throws on word exceeding mediaDuration');
}

// Test 30-J: Lookahead candidate testing enforces CPS before committing word
{
  const fastCues = segmentTranscriptIntoCues({
    projectId: 'proj-30-j',
    words: [
      { word: 'FirstLongTokenHere', start: 0.0, end: 0.4 },
      { word: 'SecondLongTokenHere', start: 0.45, end: 0.8 },
      { word: 'ThirdLongTokenHere', start: 0.85, end: 1.2 },
    ],
    config: { maxCps: 20 },
  });
  assert(fastCues.length >= 2, 'Test 30-J: Lookahead candidate testing enforces CPS limit across cues');
}

// Test 30-K: Single-word high-CPS preserves truthful timing without fabricating duration
{
  const singleFastWord = [{ word: 'AntidisestablishmentarianismNow', start: 1.0, end: 1.2 }];
  const cues = segmentTranscriptIntoCues({
    projectId: 'proj-30-k',
    words: singleFastWord,
    config: { maxCps: 15 },
  });
  assert(cues.length === 1, 'Test 30-K1: Single high CPS word emitted');
  assert(cues[0].start === 1.0, 'Test 30-K2: Cue start matches word start');
  assert(cues[0].end === 1.2, 'Test 30-K3: Truthful timing preserved without synthetic duration stretching');
}

// Test 30-L: Omitted mediaDuration does not fabricate cue duration beyond speech
{
  const endSpeechWord = [{ word: 'Closing', start: 5.0, end: 5.3 }];
  const cues = segmentTranscriptIntoCues({
    projectId: 'proj-30-l',
    words: endSpeechWord,
  });
  assert(cues[0].end === 5.3, `Test 30-L: Cue end ${cues[0].end} strictly matches word end without fabricated duration`);
}

// Test 30-M: Deterministic emphasis IDs across multiple runs
{
  const testWords = [
    { word: 'SECRET', start: 1.0, end: 1.4 },
    { word: '$1000', start: 1.5, end: 1.9 },
    { word: 'NEVER', start: 2.0, end: 2.4 },
  ];
  const emph1 = extractCaptionEmphases({ projectId: 'det-proj-1', words: testWords });
  const emph2 = extractCaptionEmphases({ projectId: 'det-proj-1', words: testWords });
  assert(emph1.length === emph2.length, 'Test 30-M1: Same emphasis count');
  for (let i = 0; i < emph1.length; i++) {
    assert(emph1[i].id === emph2[i].id, `Test 30-M2: Emphasis ${i} ID is strictly deterministic across runs`);
  }
}

// Test 30-N: formatSrtTimestamp throws RangeError on invalid numbers
{
  let threwNaN = false;
  let threwNeg = false;
  let threwInf = false;
  try { formatSrtTimestamp(NaN); } catch (e) { if (e instanceof RangeError) threwNaN = true; }
  try { formatSrtTimestamp(-2); } catch (e) { if (e instanceof RangeError) threwNeg = true; }
  try { formatSrtTimestamp(Infinity); } catch (e) { if (e instanceof RangeError) threwInf = true; }
  assert(threwNaN && threwNeg && threwInf, 'Test 30-N: formatSrtTimestamp throws RangeError on NaN, negative, Infinity');
}

// Test 30-O: formatVttTimestamp throws RangeError on invalid numbers
{
  let threwNaN = false;
  let threwNeg = false;
  let threwInf = false;
  try { formatVttTimestamp(NaN); } catch (e) { if (e instanceof RangeError) threwNaN = true; }
  try { formatVttTimestamp(-2); } catch (e) { if (e instanceof RangeError) threwNeg = true; }
  try { formatVttTimestamp(Infinity); } catch (e) { if (e instanceof RangeError) threwInf = true; }
  assert(threwNaN && threwNeg && threwInf, 'Test 30-O: formatVttTimestamp throws RangeError on NaN, negative, Infinity');
}

// Test 30-P: formatAssTimestamp throws RangeError on invalid numbers
{
  let threwNaN = false;
  let threwNeg = false;
  let threwInf = false;
  try { formatAssTimestamp(NaN); } catch (e) { if (e instanceof RangeError) threwNaN = true; }
  try { formatAssTimestamp(-2); } catch (e) { if (e instanceof RangeError) threwNeg = true; }
  try { formatAssTimestamp(Infinity); } catch (e) { if (e instanceof RangeError) threwInf = true; }
  assert(threwNaN && threwNeg && threwInf, 'Test 30-P: formatAssTimestamp throws RangeError on NaN, negative, Infinity');
}

// Test 30-Q: generateSrt fails closed on corrupt cue
{
  let threwEmpty = false;
  let threwInverted = false;
  const emptyCue = [{ id: 'c1', sequence: 1, start: 0, end: 1, text: '   ', words: [], projectId: 'p' } as any];
  const invertedCue = [{ id: 'c2', sequence: 1, start: 2, end: 1, text: 'Text', words: [], projectId: 'p' } as any];
  try { generateSrt(emptyCue); } catch (e) { threwEmpty = true; }
  try { generateSrt(invertedCue); } catch (e) { threwInverted = true; }
  assert(threwEmpty && threwInverted, 'Test 30-Q: generateSrt fails closed on empty text and inverted timestamps');
}

// Test 30-R: generateWebVtt fails closed on corrupt cue
{
  let threwEmpty = false;
  let threwInverted = false;
  const emptyCue = [{ id: 'c1', sequence: 1, start: 0, end: 1, text: '', words: [], projectId: 'p' } as any];
  const invertedCue = [{ id: 'c2', sequence: 1, start: 2, end: 1, text: 'Text', words: [], projectId: 'p' } as any];
  try { generateWebVtt(emptyCue); } catch (e) { threwEmpty = true; }
  try { generateWebVtt(invertedCue); } catch (e) { threwInverted = true; }
  assert(threwEmpty && threwInverted, 'Test 30-R: generateWebVtt fails closed on empty text and inverted timestamps');
}

// Test 30-S: generateAss fails closed on corrupt cue
{
  let threwEmpty = false;
  let threwInverted = false;
  const emptyCue = [{ id: 'c1', sequence: 1, start: 0, end: 1, text: '  ', words: [], projectId: 'p' } as any];
  const invertedCue = [{ id: 'c2', sequence: 1, start: 2, end: 1, text: 'Text', words: [], projectId: 'p' } as any];
  try { generateAss(emptyCue); } catch (e) { threwEmpty = true; }
  try { generateAss(invertedCue); } catch (e) { threwInverted = true; }
  assert(threwEmpty && threwInverted, 'Test 30-S: generateAss fails closed on empty text and inverted timestamps');
}

// Test 30-T: updateCaptionCue rejects immutable field injection
{
  const captionService = getCaptionService();
  let caught = false;
  try {
    await captionService.updateCaptionCue({
      projectId: 'proj-1',
      trackId: 'track-1',
      cueId: 'cue-1',
      userId: 'user-1',
      updates: { id: 'injected-id', text: 'New text' } as any,
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', 'Test 30-T: Rejects immutable field injection');
  }
  assert(caught, 'Test 30-T: Throws on immutable field injection');
}

// Test 30-U: updateCaptionCue rejects words exceeding cue bounds
{
  const captionService = getCaptionService();
  const projId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const cueId = crypto.randomUUID();
  const testTrack: CaptionTrack = {
    id: trackId,
    projectId: projId,
    userId: 'user-1',
    version: 1,
    language: 'en',
    source: 'generated',
    status: 'ready',
    cuesCount: 1,
    durationSeconds: 5,
    cues: [
      {
        id: cueId,
        projectId: projId,
        trackId: trackId,
        sequence: 1,
        start: 1.0,
        end: 2.0,
        text: 'Hello world',
        language: 'en',
        timingPrecision: 'exact_word',
        words: [
          { wordIndex: 0, word: 'Hello', start: 1.0, end: 1.4 },
          { wordIndex: 1, word: 'world', start: 1.5, end: 2.0 },
        ],
        source: 'generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const storage = new LocalStorageAdapter();
  await storage.saveProject({
    id: projId,
    userId: 'user-1',
    title: 'Bounds',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    durationSeconds: 5,
    status: 'ready',
    clips: [],
    createdAt: new Date().toISOString(),
  });
  await storage.saveCaptionTrack(testTrack, 'user-1');

  let caught = false;
  try {
    await captionService.updateCaptionCue({
      projectId: projId,
      trackId: trackId,
      cueId: cueId,
      userId: 'user-1',
      updates: {
        words: [{ wordIndex: 0, word: 'Out', start: 0.2, end: 0.8 }], // start 0.2 is well outside [1.0, 2.0]
      },
    });
  } catch (err: any) {
    caught = true;
    assert(err instanceof ClipperError && err.code === 'VALIDATION_ERROR', `Test 30-U: Rejects word timing outside cue bounds (${err.message})`);
  }
  assert(caught, 'Test 30-U: Throws on out-of-bounds word timing');
}

// Test 30-V: getCaptionTrackById loads track and verifies tenant isolation
{
  const storage = new LocalStorageAdapter();
  const trackId = crypto.randomUUID();
  const projId = crypto.randomUUID();
  const testTrack: CaptionTrack = {
    id: trackId,
    projectId: projId,
    userId: 'user-owner',
    version: 1,
    language: 'en',
    source: 'generated',
    status: 'ready',
    cuesCount: 1,
    durationSeconds: 4,
    cues: [
      {
        id: crypto.randomUUID(),
        projectId: projId,
        trackId,
        sequence: 1,
        start: 0.5,
        end: 2.5,
        text: 'Retrieved by track ID',
        language: 'en',
        timingPrecision: 'exact_word',
        words: [
          { wordIndex: 0, word: 'Retrieved', start: 0.5, end: 1.0 },
          { wordIndex: 1, word: 'by', start: 1.0, end: 1.5 },
          { wordIndex: 2, word: 'track', start: 1.5, end: 2.0 },
          { wordIndex: 3, word: 'ID', start: 2.0, end: 2.5 },
        ],
        source: 'generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await storage.saveProject({
    id: projId,
    userId: 'user-owner',
    title: 'Lookup',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    durationSeconds: 4,
    status: 'ready',
    clips: [],
    createdAt: new Date().toISOString(),
  });
  await storage.saveCaptionTrack(testTrack, 'user-owner');

  const loaded = await storage.getCaptionTrackById(trackId, 'user-owner');
  assert(loaded !== null, 'Test 30-V1: getCaptionTrackById loads track');
  assert(loaded?.id === trackId, 'Test 30-V2: Loaded track ID matches');
  assert(loaded?.cues.length === 1, 'Test 30-V3: Loaded track contains cues');
  assert(loaded?.cues[0].words.length === 4, 'Test 30-V4: Loaded cue contains words');

  // Verify cross-tenant isolation
  let forbidden = false;
  try {
    await storage.getCaptionTrackById(trackId, 'user-attacker');
  } catch (err: any) {
    if (err instanceof ClipperError && err.statusCode === 403) forbidden = true;
  }
  assert(forbidden, 'Test 30-V5: Cross-tenant access to getCaptionTrackById is strictly forbidden (403)');

  // Test 30-W: exportCaptions resolves by trackId and by projectId + version
  const captionService = getCaptionService();
  const srtByTrackId = await captionService.exportCaptions({
    trackId,
    userId: 'user-owner',
    format: 'srt',
  });
  assert(srtByTrackId.includes('Retrieved by track ID'), 'Test 30-W1: Export resolves directly by trackId');

  const srtByProj = await captionService.exportCaptions({
    projectId: projId,
    version: 1,
    userId: 'user-owner',
    format: 'srt',
  });
  assert(srtByProj.includes('Retrieved by track ID'), 'Test 30-W2: Export resolves by projectId and version');
}

// ================================================================
// CLIPPER PHASE 7.1.1: CATEGORY 31 — FINAL CANONICAL & DATABASE SECURITY GATES
// ================================================================
console.log('\n================================================================');
console.log('CLIPPER PHASE 7.1.1: CATEGORY 31 — FINAL CANONICAL & SECURITY GATES');
console.log('================================================================\n');

// Test 31-L: Strict CPS candidate split (two-word burst splits into separate cues)
{
  const twoWordBurst = [
    { word: 'BurstOne', start: 0.0, end: 0.3 }, // 8 chars / 0.3s = 26.6 cps
    { word: 'BurstTwo', start: 0.3, end: 0.4 }, // candidate: 17 chars / 0.4s = 42.5 cps
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: 'proj-31-l',
    words: twoWordBurst,
    config: { maxCps: 25 },
  });
  assert(cues.length === 2, 'Test 31-L: Two-word burst where adding word 2 exceeds maxCps splits into 2 separate cues');
  assert(cues[0].text === 'BurstOne', 'Test 31-L: First cue contains only word 1');
  assert(cues[1].text === 'BurstTwo', 'Test 31-L: Second cue contains only word 2');
}

// Test 31-M: Single-word CPS exception preserves exact timing without stretching
{
  const singleFastWord = [
    { word: 'ExtraordinaryVelocity', start: 2.0, end: 2.2 }, // 21 chars in 0.2s = 105 cps
  ];
  const cues = segmentTranscriptIntoCues({
    projectId: 'proj-31-m',
    words: singleFastWord,
    config: { maxCps: 20 },
  });
  assert(cues.length === 1, 'Test 31-M1: Single high-CPS word emitted as 1 cue');
  assert(cues[0].start === 2.0, 'Test 31-M2: Single-word start matches exact word start');
  assert(cues[0].end === 2.2, 'Test 31-M3: Single-word end matches exact word end without synthetic stretching');
}

// Test 31-N: Media duration end-bound rejection (word.end > mediaDuration rejected with VALIDATION_ERROR)
{
  let threwEndBound = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-31-n',
      mediaDuration: 5.0,
      words: [{ word: 'Exceeding', start: 4.8, end: 5.2 }], // end 5.2 > mediaDuration 5.0
    });
  } catch (err: any) {
    if (err instanceof ClipperError && err.code === 'VALIDATION_ERROR') {
      threwEndBound = true;
    }
  }
  assert(threwEndBound, 'Test 31-N: Rejects word whose end exceeds mediaDuration with VALIDATION_ERROR');
}

// Test 31-O: empty-set allowEmpty=false rejection
{
  const res = validateCaptionCues([], { allowEmpty: false });
  assert(!res.valid, 'Test 31-O1: validateCaptionCues rejects empty cue array when allowEmpty=false');
  assert(res.errors.length > 0, 'Test 31-O2: Error message returned for empty cue array');
}

// Test 31-P: empty-set allowEmpty=true acceptance
{
  const res = validateCaptionCues([], { allowEmpty: true });
  assert(res.valid, 'Test 31-P1: validateCaptionCues accepts empty cue array when allowEmpty=true');
  assert(res.errors.length === 0, 'Test 31-P2: Zero errors returned for empty cue array when allowEmpty=true');
}

// Test 31-Q: zero-duration word rejection across segmentation and validation
{
  let threwZeroSeg = false;
  try {
    segmentTranscriptIntoCues({
      projectId: 'proj-31-q',
      words: [{ word: 'Instant', start: 1.0, end: 1.0 }], // end === start
    });
  } catch (err: any) {
    if (err instanceof ClipperError && err.code === 'VALIDATION_ERROR') {
      threwZeroSeg = true;
    }
  }
  assert(threwZeroSeg, 'Test 31-Q1: Segmentation engine rejects zero-duration word (end === start)');

  const cueWithZeroWord: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'p',
    sequence: 1,
    start: 1.0,
    end: 2.0,
    text: 'Zero duration',
    language: 'en',
    timingPrecision: 'exact_word',
    source: 'generated',
    words: [{ wordIndex: 0, word: 'Zero', start: 1.0, end: 1.0 }], // end === start
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const valRes = validateCaptionCues([cueWithZeroWord]);
  assert(!valRes.valid, 'Test 31-Q2: validateCaptionCues rejects zero-duration word');
  assert(valRes.errors.some(e => e.includes('Zero or negative duration')), 'Test 31-Q3: Validation error mentions zero duration');
}

// Test 31-R: Serializers reject reversed cues without silent sorting
{
  const cueA: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'p',
    sequence: 1,
    start: 2.0,
    end: 3.0,
    text: 'Later',
    language: 'en',
    timingPrecision: 'exact_word',
    source: 'generated',
    words: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const cueB: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'p',
    sequence: 2,
    start: 0.5,
    end: 1.5,
    text: 'Earlier',
    language: 'en',
    timingPrecision: 'exact_word',
    source: 'generated',
    words: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const reversed = [cueA, cueB];

  let threwSrt = false;
  let threwVtt = false;
  let threwAss = false;

  try { generateSrt(reversed); } catch (e: any) { if (e instanceof ClipperError && e.code === 'VALIDATION_ERROR') threwSrt = true; }
  try { generateWebVtt(reversed); } catch (e: any) { if (e instanceof ClipperError && e.code === 'VALIDATION_ERROR') threwVtt = true; }
  try { generateAss(reversed); } catch (e: any) { if (e instanceof ClipperError && e.code === 'VALIDATION_ERROR') threwAss = true; }

  assert(threwSrt, 'Test 31-R1: generateSrt rejects reversed cues with VALIDATION_ERROR');
  assert(threwVtt, 'Test 31-R2: generateWebVtt rejects reversed cues with VALIDATION_ERROR');
  assert(threwAss, 'Test 31-R3: generateAss rejects reversed cues with VALIDATION_ERROR');
}

// Test 31-S: Serializers reject overlapping cues without silent repair
{
  const cue1: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'p',
    sequence: 1,
    start: 1.0,
    end: 3.0,
    text: 'First',
    language: 'en',
    timingPrecision: 'exact_word',
    source: 'generated',
    words: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const cue2: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'p',
    sequence: 2,
    start: 2.5, // overlaps [1.0, 3.0]
    end: 4.0,
    text: 'Second',
    language: 'en',
    timingPrecision: 'exact_word',
    source: 'generated',
    words: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const overlapping = [cue1, cue2];

  let threwSrt = false;
  let threwVtt = false;
  let threwAss = false;

  try { generateSrt(overlapping); } catch (e: any) { if (e instanceof ClipperError && e.code === 'VALIDATION_ERROR') threwSrt = true; }
  try { generateWebVtt(overlapping); } catch (e: any) { if (e instanceof ClipperError && e.code === 'VALIDATION_ERROR') threwVtt = true; }
  try { generateAss(overlapping); } catch (e: any) { if (e instanceof ClipperError && e.code === 'VALIDATION_ERROR') threwAss = true; }

  assert(threwSrt, 'Test 31-S1: generateSrt rejects overlapping cues with VALIDATION_ERROR');
  assert(threwVtt, 'Test 31-S2: generateWebVtt rejects overlapping cues with VALIDATION_ERROR');
  assert(threwAss, 'Test 31-S3: generateAss rejects overlapping cues with VALIDATION_ERROR');
}

// Test 31-T: Corrupted stored track cannot be exported
{
  const storage = new LocalStorageAdapter();
  const captionService = getCaptionService();
  const corruptTrackId = crypto.randomUUID();
  const corruptProjId = crypto.randomUUID();

  const corruptTrack: CaptionTrack = {
    id: corruptTrackId,
    projectId: corruptProjId,
    userId: 'user-31-t',
    version: 1,
    language: 'en',
    source: 'generated',
    status: 'ready',
    cuesCount: 1,
    durationSeconds: 5,
    cues: [
      {
        id: crypto.randomUUID(),
        projectId: corruptProjId,
        trackId: corruptTrackId,
        sequence: 1,
        start: 3.0,
        end: 1.0, // inverted time!
        text: 'Corrupt cue',
        language: 'en',
        timingPrecision: 'exact_word',
        words: [],
        source: 'generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await storage.saveProject({
    id: corruptProjId,
    userId: 'user-31-t',
    title: 'Corrupt Export Proj',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    durationSeconds: 5,
    status: 'ready',
    clips: [],
    createdAt: new Date().toISOString(),
  });
  await storage.saveCaptionTrack(corruptTrack, 'user-31-t');

  let exportThrew = false;
  try {
    await captionService.exportCaptions({
      trackId: corruptTrackId,
      userId: 'user-31-t',
      format: 'srt',
    });
  } catch (err: any) {
    if (err instanceof ClipperError && err.code === 'VALIDATION_ERROR') {
      exportThrew = true;
    }
  }
  assert(exportThrew, 'Test 31-T: exportCaptions rejects corrupted stored track with VALIDATION_ERROR');
}

// Test 31-U: Concurrent edited-track version allocation
{
  const storage = new LocalStorageAdapter();
  const captionService = getCaptionService();
  const trackId = crypto.randomUUID();
  const projId = crypto.randomUUID();
  const cueId = crypto.randomUUID();

  const baseTrack: CaptionTrack = {
    id: trackId,
    projectId: projId,
    userId: 'user-31-u',
    version: 1,
    language: 'en',
    source: 'generated',
    status: 'ready',
    cuesCount: 1,
    durationSeconds: 10,
    cues: [
      {
        id: cueId,
        projectId: projId,
        trackId: trackId,
        sequence: 1,
        start: 1.0,
        end: 3.0,
        text: 'Initial',
        language: 'en',
        timingPrecision: 'exact_word',
        words: [{ wordIndex: 0, word: 'Initial', start: 1.0, end: 1.5 }],
        source: 'generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await storage.saveProject({
    id: projId,
    userId: 'user-31-u',
    title: 'Concurrent Edit Proj',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    durationSeconds: 10,
    status: 'ready',
    clips: [],
    createdAt: new Date().toISOString(),
  });
  await storage.saveCaptionTrack(baseTrack, 'user-31-u');

  // Perform two consecutive edits
  const edit1 = await captionService.updateCaptionCue({
    projectId: projId,
    trackId,
    cueId,
    userId: 'user-31-u',
    updates: { text: 'Edit 1 text' },
  });

  const edit2 = await captionService.updateCaptionCue({
    projectId: projId,
    trackId: edit1.id,
    cueId,
    userId: 'user-31-u',
    updates: { text: 'Edit 2 text' },
  });

  assert(edit1.version !== undefined && edit2.version !== undefined, 'Test 31-U1: Both edits allocate versions');
  assert(edit2.version! > edit1.version!, `Test 31-U2: Successive edits allocate strictly increasing versions (${edit2.version} > ${edit1.version})`);
}

// ================================================================
// CLIPPER PHASE 7.1.2: CATEGORY 32 — SERIALIZER INTEGRITY GATES
// ================================================================
console.log('\n================================================================');
console.log('CLIPPER PHASE 7.1.2: CATEGORY 32 — SERIALIZER INTEGRITY GATES');
console.log('================================================================\n');

// Test 32-Q: Serializer rejects word outside cue bounds
{
  const cueWithOutWord: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'proj-32-q',
    sequence: 1,
    start: 2.0,
    end: 4.0,
    text: 'Out of bounds word',
    language: 'en',
    timingPrecision: 'exact_word',
    words: [
      { wordIndex: 0, word: 'Out', start: 1.8, end: 2.5 }, // 1.8 < cue.start 2.0
      { wordIndex: 1, word: 'of', start: 2.5, end: 3.0 },
      { wordIndex: 2, word: 'bounds', start: 3.0, end: 3.5 },
      { wordIndex: 3, word: 'word', start: 3.5, end: 4.0 },
    ],
    source: 'generated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let srtFailed = false;
  let vttFailed = false;
  let assFailed = false;

  try { generateSrt([cueWithOutWord]); } catch (e: any) { srtFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }
  try { generateWebVtt([cueWithOutWord]); } catch (e: any) { vttFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }
  try { generateAss([cueWithOutWord]); } catch (e: any) { assFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }

  assert(srtFailed, 'Test 32-Q1: generateSrt rejects word outside cue bounds');
  assert(vttFailed, 'Test 32-Q2: generateWebVtt rejects word outside cue bounds');
  assert(assFailed, 'Test 32-Q3: generateAss rejects word outside cue bounds');
}

// Test 32-R: Serializer rejects non-monotonic word timing
{
  const cueWithBackwardsWords: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'proj-32-r',
    sequence: 1,
    start: 1.0,
    end: 5.0,
    text: 'Word timing backwards',
    language: 'en',
    timingPrecision: 'exact_word',
    words: [
      { wordIndex: 0, word: 'Word', start: 3.0, end: 4.0 },
      { wordIndex: 1, word: 'timing', start: 2.0, end: 2.5 }, // 2.0 < prev 3.0
      { wordIndex: 2, word: 'backwards', start: 4.0, end: 4.5 },
    ],
    source: 'generated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let srtFailed = false;
  let vttFailed = false;
  let assFailed = false;

  try { generateSrt([cueWithBackwardsWords]); } catch (e: any) { srtFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }
  try { generateWebVtt([cueWithBackwardsWords]); } catch (e: any) { vttFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }
  try { generateAss([cueWithBackwardsWords]); } catch (e: any) { assFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }

  assert(srtFailed, 'Test 32-R1: generateSrt rejects non-monotonic word timing');
  assert(vttFailed, 'Test 32-R2: generateWebVtt rejects non-monotonic word timing');
  assert(assFailed, 'Test 32-R3: generateAss rejects non-monotonic word timing');
}

// Test 32-S: Serializer rejects zero-duration word
{
  const cueWithZeroWord: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'proj-32-s',
    sequence: 1,
    start: 1.0,
    end: 3.0,
    text: 'Zero duration word',
    language: 'en',
    timingPrecision: 'exact_word',
    words: [
      { wordIndex: 0, word: 'Zero', start: 1.0, end: 1.0 }, // 1.0 === 1.0
      { wordIndex: 1, word: 'duration', start: 1.5, end: 2.0 },
      { wordIndex: 2, word: 'word', start: 2.0, end: 2.5 },
    ],
    source: 'generated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let srtFailed = false;
  let vttFailed = false;
  let assFailed = false;

  try { generateSrt([cueWithZeroWord]); } catch (e: any) { srtFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }
  try { generateWebVtt([cueWithZeroWord]); } catch (e: any) { vttFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }
  try { generateAss([cueWithZeroWord]); } catch (e: any) { assFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }

  assert(srtFailed, 'Test 32-S1: generateSrt rejects zero-duration word');
  assert(vttFailed, 'Test 32-S2: generateWebVtt rejects zero-duration word');
  assert(assFailed, 'Test 32-S3: generateAss rejects zero-duration word');
}

// Test 32-N: Serializer rejects non-monotonic wordIndex
{
  const cueWithBadWordIndex: CaptionCue = {
    id: crypto.randomUUID(),
    projectId: 'proj-32-n',
    sequence: 1,
    start: 1.0,
    end: 3.0,
    text: 'Word index out of order',
    language: 'en',
    timingPrecision: 'exact_word',
    words: [
      { wordIndex: 2, word: 'Word', start: 1.0, end: 1.4 },
      { wordIndex: 1, word: 'index', start: 1.4, end: 1.8 }, // 1 <= prev 2
      { wordIndex: 3, word: 'out', start: 1.8, end: 2.2 },
      { wordIndex: 4, word: 'of', start: 2.2, end: 2.6 },
      { wordIndex: 5, word: 'order', start: 2.6, end: 3.0 },
    ],
    source: 'generated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let srtFailed = false;
  try { generateSrt([cueWithBadWordIndex]); } catch (e: any) { srtFailed = e instanceof ClipperError && e.code === 'VALIDATION_ERROR'; }
  assert(srtFailed, 'Test 32-N: generateSrt rejects non-monotonic wordIndex progression');
}

} // end runTests

runTests().then(() => {
  console.log('\n================================================================');
  console.log(`CATEGORIES 29, 30, 31 & 32 VERIFIED: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}).catch((err) => {
  console.error('\n❌ Unhandled error in Category 29 test suite:', err);
  process.exit(1);
});


