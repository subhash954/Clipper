import { ContentTypeClassification, ContentPrimaryType, SpeakerProfile, Scene } from '../types';

export interface ClassifierInput {
  title: string;
  transcript: string;
  speakers: SpeakerProfile[];
  scenes: Scene[];
  durationSeconds: number;
}

/**
 * Content Type Classification Engine
 * Synthesizes visual scenes, speaker counts, and narrative cues to categorize video genre.
 */
export function classifyContentType(input: ClassifierInput): ContentTypeClassification {
  const { title, transcript, speakers, scenes, durationSeconds } = input;
  const upperTitle = title.toUpperCase();
  const lower = transcript.toLowerCase();
  const detectedSignals: string[] = [];

  const slideSceneCount = scenes.filter(
    (s) => s.sceneType === 'presentation_slide' || s.sceneType === 'screen_share'
  ).length;

  let primaryType: ContentPrimaryType = 'Talking Head';
  let secondaryType: string | undefined = undefined;
  let confidence = 0.88;

  // Signal 1: Speaker Count
  if (speakers.length >= 2) {
    detectedSignals.push(`Multi-speaker structure (${speakers.length} speakers detected)`);
    if (upperTitle.includes('PODCAST') || lower.includes('welcome back to the podcast')) {
      primaryType = 'Podcast';
      secondaryType = 'Interview';
      confidence = 0.96;
    } else if (upperTitle.includes('INTERVIEW') || lower.includes('thank you for having me') || lower.includes('my guest today')) {
      primaryType = 'Interview';
      secondaryType = 'Podcast';
      confidence = 0.94;
    } else if (lower.includes('i disagree') || lower.includes('counter argument')) {
      primaryType = 'Debate';
      confidence = 0.89;
    } else {
      primaryType = 'Podcast';
    }
  }

  // Signal 2: Visual Screen Shares & Slides
  if (slideSceneCount >= 2) {
    detectedSignals.push(`On-screen instructional media (${slideSceneCount} slides/shares)`);
    if (upperTitle.includes('TUTORIAL') || lower.includes('in this tutorial') || lower.includes('step by step')) {
      primaryType = 'Tutorial';
      confidence = 0.95;
    } else if (upperTitle.includes('WEBINAR') || lower.includes('welcome to this webinar')) {
      primaryType = 'Webinar';
      confidence = 0.93;
    } else if (upperTitle.includes('DEMO') || lower.includes('let me show you how this works')) {
      primaryType = 'Product Demo';
      confidence = 0.92;
    } else {
      primaryType = 'Presentation';
    }
  }

  // Signal 3: Single Speaker Content
  if (speakers.length <= 1 && slideSceneCount < 2) {
    if (lower.includes('how to') || lower.includes('framework') || lower.includes('three rules')) {
      primaryType = 'Educational';
      secondaryType = 'Talking Head';
      confidence = 0.91;
    } else if (lower.includes('never give up') || lower.includes('mindset') || lower.includes('believe in yourself')) {
      primaryType = 'Motivational';
      secondaryType = 'Talking Head';
      confidence = 0.92;
    } else {
      primaryType = 'Talking Head';
      confidence = 0.90;
    }
    detectedSignals.push('Single focal presenter with direct audience address');
  }

  return {
    primaryType,
    secondaryType,
    confidence: Number(confidence.toFixed(2)),
    detectedSignals,
  };
}
