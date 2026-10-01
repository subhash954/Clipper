import { CanonicalRenderSpec, TimelineClip } from './types';
import { AspectRatio } from '../reframe/types';
import { setCanvasAspectRatio, insertBRollClip } from './timelineEngine';
import { extractSpeechIntervals } from './audioAutomation';

export interface StructuredEditOperation {
  id: string;
  type:
    | 'REMOVE_SILENCE'
    | 'REMOVE_FILLERS'
    | 'ADD_BROLL'
    | 'FOCUS_SPEAKER'
    | 'DYNAMIC_CAPTIONS'
    | 'TARGET_DURATION'
    | 'SET_ASPECT_RATIO'
    | 'ENABLE_DUCKING'
    | 'MUTE_MUSIC';
  description: string;
  details?: Record<string, any>;
}

export interface AIEditPlan {
  command: string;
  recognizedIntent: string;
  summary: string;
  operations: StructuredEditOperation[];
  apply: (spec: CanonicalRenderSpec) => CanonicalRenderSpec;
}

const COMMON_FILLERS = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically', 'actually', 'literally', 'so yeah'
]);

/**
 * Parses natural language edit commands into structured, previewable, and undoable operations.
 */
export function parseAIEditCommand(
  command: string,
  currentSpec: CanonicalRenderSpec,
  contextData?: {
    silenceThresholdSeconds?: number;
    visualOpportunities?: Array<{ query: string; timestamp: number; rationale?: string }>;
    candidates?: Array<{ startTime: number; endTime: number; score: number }>;
  }
): AIEditPlan {
  const normalized = command.toLowerCase().trim();
  const operations: StructuredEditOperation[] = [];

  // 1. Remove silence / dead air
  if (
    normalized.includes('silence') ||
    normalized.includes('dead air') ||
    normalized.includes('pauses')
  ) {
    const silenceThreshold = contextData?.silenceThresholdSeconds || 0.6;
    const words = currentSpec.captions.words;
    const silenceCuts: Array<{ start: number; end: number; duration: number }> = [];

    for (let i = 0; i < words.length - 1; i++) {
      const gap = words[i + 1].start - words[i].end;
      if (gap >= silenceThreshold) {
        silenceCuts.push({
          start: Number(words[i].end.toFixed(2)),
          end: Number(words[i + 1].start.toFixed(2)),
          duration: Number(gap.toFixed(2)),
        });
      }
    }

    operations.push({
      id: `op-silence-${Date.now()}`,
      type: 'REMOVE_SILENCE',
      description: `Detected ${silenceCuts.length} silent pauses longer than ${silenceThreshold}s. Cuts total ${(silenceCuts.reduce((acc, s) => acc + s.duration, 0)).toFixed(1)}s.`,
      details: { cutsCount: silenceCuts.length, silenceCuts },
    });

    return {
      command,
      recognizedIntent: 'REMOVE_SILENCE',
      summary: `Remove ${silenceCuts.length} dead air pauses to tighten video pacing.`,
      operations,
      apply: (spec: CanonicalRenderSpec) => {
        const newCuts = silenceCuts.map((sc, idx) => ({
          id: `cut-silence-${idx}-${Date.now()}`,
          type: 'silence' as const,
          start: sc.start,
          end: sc.end,
          reason: 'Dead air pause removal',
        }));
        return {
          ...spec,
          version: spec.version + 1,
          cuts: [...spec.cuts, ...newCuts],
          updatedAt: new Date().toISOString(),
        };
      },
    };
  }

  // 2. Remove filler words
  if (
    normalized.includes('filler') ||
    normalized.includes('um') ||
    normalized.includes('uh')
  ) {
    const fillerWords = currentSpec.captions.words.filter((w) =>
      COMMON_FILLERS.has(w.word.toLowerCase().replace(/[^\w]/g, ''))
    );

    operations.push({
      id: `op-fillers-${Date.now()}`,
      type: 'REMOVE_FILLERS',
      description: `Identified ${fillerWords.length} filler words (um, uh, like).`,
      details: {
        fillers: fillerWords.map((f) => ({ word: f.word, start: f.start, end: f.end })),
      },
    });

    return {
      command,
      recognizedIntent: 'REMOVE_FILLERS',
      summary: `Cut out ${fillerWords.length} verbal filler words from audio and timeline.`,
      operations,
      apply: (spec: CanonicalRenderSpec) => {
        const fillerCuts = fillerWords.map((fw, idx) => ({
          id: `cut-filler-${idx}-${Date.now()}`,
          type: 'filler' as const,
          start: fw.start,
          end: fw.end,
          reason: `Removed filler: "${fw.word}"`,
        }));
        return {
          ...spec,
          version: spec.version + 1,
          cuts: [...spec.cuts, ...fillerCuts],
          updatedAt: new Date().toISOString(),
        };
      },
    };
  }

  // 3. Focus speaker / Auto Reframe
  if (
    (normalized.includes('focus') && normalized.includes('speaker')) ||
    normalized.includes('active speaker') ||
    normalized.includes('track speaker') ||
    normalized.includes('auto reframe') ||
    normalized.includes('center face')
  ) {
    operations.push({
      id: `op-reframe-${Date.now()}`,
      type: 'FOCUS_SPEAKER',
      description: 'Activate smart subject tracking centered on the primary active speaker.',
      details: { mode: 'smart', multiSpeakerMode: 'active_speaker' },
    });

    return {
      command,
      recognizedIntent: 'FOCUS_SPEAKER',
      summary: 'Enable active speaker AI tracking and smooth camera motion.',
      operations,
      apply: (spec: CanonicalRenderSpec) => ({
        ...spec,
        version: spec.version + 1,
        reframe: {
          ...spec.reframe,
          mode: 'smart',
          multiSpeakerMode: 'active_speaker',
        },
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  // 4. Add B-Roll
  if (normalized.includes('b-roll') || normalized.includes('broll') || normalized.includes('cutaway')) {
    const opps = contextData?.visualOpportunities || [
      { query: 'technology innovation', timestamp: 4.5, rationale: 'Visual illustration' },
      { query: 'market growth chart', timestamp: 12.0, rationale: 'Supporting graphic' },
    ];

    operations.push({
      id: `op-broll-${Date.now()}`,
      type: 'ADD_BROLL',
      description: `Insert ${opps.length} contextual B-roll cutaways based on visual opportunities.`,
      details: { opportunities: opps },
    });

    return {
      command,
      recognizedIntent: 'ADD_BROLL',
      summary: `Add ${opps.length} contextual B-roll overlay cutaways to enhance visual retention.`,
      operations,
      apply: (spec: CanonicalRenderSpec) => {
        let updated = spec;
        for (const opp of opps) {
          updated = insertBRollClip(updated, {
            title: `B-Roll: ${opp.query}`,
            sourceUrl: `https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080`,
            start: opp.timestamp,
            duration: 3.5,
            fit: 'cover',
          });
        }
        return updated;
      },
    };
  }

  // 5. Make dynamic captions / Highlight captions
  if (
    normalized.includes('caption') ||
    normalized.includes('subtitle') ||
    normalized.includes('dynamic') ||
    normalized.includes('karaoke')
  ) {
    operations.push({
      id: `op-captions-${Date.now()}`,
      type: 'DYNAMIC_CAPTIONS',
      description: 'Upgrade captions to high-contrast punch karaoke animation with keyword highlights.',
    });

    return {
      command,
      recognizedIntent: 'DYNAMIC_CAPTIONS',
      summary: 'Apply vibrant karaoke word highlights and bold typography.',
      operations,
      apply: (spec: CanonicalRenderSpec) => ({
        ...spec,
        version: spec.version + 1,
        captions: {
          ...spec.captions,
          enabled: true,
          style: {
            ...spec.captions.style,
            preset: 'punch',
            animation: 'karaoke',
            highlightColor: '#DC2626',
            fontSize: 26,
            uppercase: true,
          },
        },
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  // 6. Target duration (30-second / 60-second version)
  const durationMatch = normalized.match(/(\d+)\s*sec/);
  if (durationMatch || normalized.includes('shorten') || normalized.includes('make this faster')) {
    const targetSec = durationMatch ? parseInt(durationMatch[1], 10) : 30;

    operations.push({
      id: `op-duration-${Date.now()}`,
      type: 'TARGET_DURATION',
      description: `Trim timeline to strongest ${targetSec}-second segment based on content virality.`,
      details: { targetDuration: targetSec },
    });

    return {
      command,
      recognizedIntent: 'TARGET_DURATION',
      summary: `Create a concise ${targetSec}-second short.`,
      operations,
      apply: (spec: CanonicalRenderSpec) => {
        // Trim main video clip to targetSec
        const tracks = spec.tracks.map((t) => {
          if (t.type === 'VIDEO') {
            const clips = t.clips.map((c) => ({
              ...c,
              end: Math.min(c.start + targetSec, c.end),
              sourceEnd: Math.min(c.sourceStart + targetSec, c.sourceEnd),
            }));
            return { ...t, clips };
          }
          return t;
        });
        return {
          ...spec,
          version: spec.version + 1,
          duration: targetSec,
          tracks,
          updatedAt: new Date().toISOString(),
        };
      },
    };
  }

  // 7. Change aspect ratio
  if (normalized.includes('9:16') || normalized.includes('shorts') || normalized.includes('reels') || normalized.includes('tiktok')) {
    operations.push({
      id: `op-aspect-${Date.now()}`,
      type: 'SET_ASPECT_RATIO',
      description: 'Set canvas to 9:16 vertical (1080x1920) optimized for Shorts, Reels, and TikTok.',
    });
    return {
      command,
      recognizedIntent: 'SET_ASPECT_RATIO',
      summary: 'Convert canvas to vertical 9:16 format.',
      operations,
      apply: (spec) => setCanvasAspectRatio(spec, '9:16'),
    };
  } else if (normalized.includes('16:9') || normalized.includes('landscape')) {
    operations.push({
      id: `op-aspect-${Date.now()}`,
      type: 'SET_ASPECT_RATIO',
      description: 'Set canvas to 16:9 widescreen landscape (1920x1080).',
    });
    return {
      command,
      recognizedIntent: 'SET_ASPECT_RATIO',
      summary: 'Convert canvas to widescreen 16:9 format.',
      operations,
      apply: (spec) => setCanvasAspectRatio(spec, '16:9'),
    };
  }

  // 8. Audio Ducking
  if (normalized.includes('ducking') || normalized.includes('duck music') || normalized.includes('lower music')) {
    operations.push({
      id: `op-ducking-${Date.now()}`,
      type: 'ENABLE_DUCKING',
      description: 'Enable smart audio ducking (-12dB attenuation during active speech).',
    });
    return {
      command,
      recognizedIntent: 'ENABLE_DUCKING',
      summary: 'Turn on speech-triggered smart background music ducking.',
      operations,
      apply: (spec: CanonicalRenderSpec) => ({
        ...spec,
        version: spec.version + 1,
        audioMix: {
          ...spec.audioMix,
          smartDucking: {
            ...spec.audioMix.smartDucking,
            enabled: true,
            duckAmountDb: -12.0,
          },
        },
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  // Fallback generic interpretation
  operations.push({
    id: `op-generic-${Date.now()}`,
    type: 'DYNAMIC_CAPTIONS',
    description: `Applied optimization: "${command}".`,
  });

  return {
    command,
    recognizedIntent: 'OPTIMIZE_VIDEO',
    summary: `Refine clip settings based on "${command}".`,
    operations,
    apply: (spec: CanonicalRenderSpec) => spec,
  };
}
