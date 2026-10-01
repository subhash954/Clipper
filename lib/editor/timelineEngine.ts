import {
  CanonicalRenderSpec,
  TimelineTrack,
  TimelineClip,
  TrackType,
  ExportSettings,
} from './types';
import { AspectRatio, TrackingMode, ReframeTrack } from '../reframe/types';
import { SubtitleStyle } from '../types';

/**
 * Creates a default initialized CanonicalRenderSpec
 */
export function createDefaultRenderSpec(params: {
  projectId: string;
  sourceUrl: string;
  durationSeconds: number;
  width?: number;
  height?: number;
  words?: Array<{ word: string; start: number; end: number }>;
  defaultStyle?: SubtitleStyle;
}): CanonicalRenderSpec {
  const {
    projectId,
    sourceUrl,
    durationSeconds,
    width = 1920,
    height = 1080,
    words = [],
    defaultStyle,
  } = params;

  const defaultExportSettings: ExportSettings = {
    resolution: '1080p',
    targetWidth: 1080,
    targetHeight: 1920,
    fps: 30,
    codec: 'h264',
    bitrateKbps: 8000,
    captionBurnIn: true,
    filename: `clipper_${projectId}_9x16.mp4`,
    preset: 'Shorts',
  };

  const initialVideoClip: TimelineClip = {
    id: `clip-main-${Date.now()}`,
    trackId: 'track-video',
    trackType: 'VIDEO',
    title: 'Main Source Footage',
    start: 0,
    end: durationSeconds,
    sourceStart: 0,
    sourceEnd: durationSeconds,
    sourceUrl,
    volume: 1.0,
    opacity: 1.0,
    isMuted: false,
    isDisabled: false,
    isLocked: false,
    layout: {
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
      fit: 'cover',
    },
  };

  const tracks: TimelineTrack[] = [
    {
      id: 'track-overlay',
      type: 'OVERLAY',
      name: 'Text & Graphics',
      order: 0,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      clips: [],
    },
    {
      id: 'track-broll',
      type: 'BROLL',
      name: 'B-Roll & Cutaways',
      order: 1,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      clips: [],
    },
    {
      id: 'track-caption',
      type: 'CAPTION',
      name: 'Subtitles',
      order: 2,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      clips: [],
    },
    {
      id: 'track-video',
      type: 'VIDEO',
      name: 'Main Video',
      order: 3,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      clips: [initialVideoClip],
    },
    {
      id: 'track-music',
      type: 'MUSIC',
      name: 'Background Music',
      order: 4,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      clips: [],
    },
    {
      id: 'track-sfx',
      type: 'SFX',
      name: 'Sound Effects',
      order: 5,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      clips: [],
    },
  ];

  const standardStyle: SubtitleStyle = defaultStyle || {
    preset: 'punch',
    fontFamily: 'Inter',
    fontSize: 24,
    primaryColor: '#FFFFFF',
    highlightColor: '#DC2626',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'middle',
    uppercase: true,
    showEmojis: true,
    animation: 'karaoke',
    language: 'en',
    showDualLanguage: false,
    enableSFX: false,
  };

  return {
    id: `spec-${projectId}-${Date.now()}`,
    projectId,
    version: 1,
    sourceAsset: {
      url: sourceUrl,
      duration: durationSeconds,
      width,
      height,
    },
    duration: durationSeconds,
    canvas: {
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
      backgroundColor: '#000000',
    },
    tracks,
    cuts: [],
    captions: {
      enabled: true,
      style: standardStyle,
      safeAreaEnabled: true,
      words: words.map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })),
    },
    reframe: {
      mode: 'smart',
      safeMargins: true,
      multiSpeakerMode: 'active_speaker',
    },
    audioMix: {
      masterVolume: 1.0,
      studioCleanEnabled: true,
      loudnormEnabled: true,
      targetLufs: -14.0,
      smartDucking: {
        enabled: true,
        duckAmountDb: -12.0,
        attackMs: 150,
        releaseMs: 350,
      },
    },
    textOverlays: [],
    imageOverlays: [],
    exportSettings: defaultExportSettings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Trims a clip's in or out point non-destructively
 */
export function trimClip(
  spec: CanonicalRenderSpec,
  clipId: string,
  newStart: number,
  newEnd: number
): CanonicalRenderSpec {
  if (newEnd <= newStart) return spec;

  const nextTracks = spec.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const startShift = newStart - clip.start;
      const endShift = newEnd - clip.end;
      return {
        ...clip,
        start: Number(newStart.toFixed(2)),
        end: Number(newEnd.toFixed(2)),
        sourceStart: Number(Math.max(0, clip.sourceStart + startShift).toFixed(2)),
        sourceEnd: Number(Math.max(0, clip.sourceEnd + endShift).toFixed(2)),
      };
    }),
  }));

  return {
    ...spec,
    version: spec.version + 1,
    tracks: nextTracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Splits a clip at playhead position into two non-destructive segments
 */
export function splitClipAt(
  spec: CanonicalRenderSpec,
  clipId: string,
  splitTime: number
): CanonicalRenderSpec {
  let targetClip: TimelineClip | null = null;
  let targetTrackId: string | null = null;

  for (const track of spec.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) {
      targetClip = found;
      targetTrackId = track.id;
      break;
    }
  }

  if (!targetClip || !targetTrackId) return spec;
  if (splitTime <= targetClip.start + 0.1 || splitTime >= targetClip.end - 0.1) {
    return spec; // Split point outside clip bounds
  }

  const offset = splitTime - targetClip.start;
  const clipA: TimelineClip = {
    ...targetClip,
    id: `clip-part1-${Date.now()}`,
    end: Number(splitTime.toFixed(2)),
    sourceEnd: Number((targetClip.sourceStart + offset).toFixed(2)),
  };

  const clipB: TimelineClip = {
    ...targetClip,
    id: `clip-part2-${Date.now()}`,
    start: Number(splitTime.toFixed(2)),
    sourceStart: Number((targetClip.sourceStart + offset).toFixed(2)),
  };

  const nextTracks = spec.tracks.map((track) => {
    if (track.id !== targetTrackId) return track;
    const nextClips: TimelineClip[] = [];
    for (const c of track.clips) {
      if (c.id === clipId) {
        nextClips.push(clipA, clipB);
      } else {
        nextClips.push(c);
      }
    }
    return { ...track, clips: nextClips };
  });

  return {
    ...spec,
    version: spec.version + 1,
    tracks: nextTracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Moves a clip to a new start time or track
 */
export function moveClip(
  spec: CanonicalRenderSpec,
  clipId: string,
  newStart: number,
  newTrackId?: string
): CanonicalRenderSpec {
  let clipToMove: TimelineClip | null = null;

  for (const track of spec.tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) {
      clipToMove = found;
      break;
    }
  }

  if (!clipToMove) return spec;

  const duration = clipToMove.end - clipToMove.start;
  const newEnd = Number((newStart + duration).toFixed(2));
  const finalTrackId = newTrackId || clipToMove.trackId;

  const nextTracks = spec.tracks.map((track) => {
    // Remove from original track
    let filtered = track.clips.filter((c) => c.id !== clipId);
    // Add to target track
    if (track.id === finalTrackId) {
      const moved: TimelineClip = {
        ...clipToMove!,
        trackId: finalTrackId,
        start: Number(newStart.toFixed(2)),
        end: newEnd,
      };
      filtered.push(moved);
      filtered.sort((a, b) => a.start - b.start);
    }
    return { ...track, clips: filtered };
  });

  return {
    ...spec,
    version: spec.version + 1,
    tracks: nextTracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deletes a clip from timeline
 */
export function deleteClip(spec: CanonicalRenderSpec, clipId: string): CanonicalRenderSpec {
  const nextTracks = spec.tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((c) => c.id !== clipId),
  }));

  return {
    ...spec,
    version: spec.version + 1,
    tracks: nextTracks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Switches Canvas Aspect Ratio & Recalculates Target Canvas Bounds
 */
export function setCanvasAspectRatio(spec: CanonicalRenderSpec, aspectRatio: AspectRatio): CanonicalRenderSpec {
  let width = 1080;
  let height = 1920;

  if (aspectRatio === '1:1') {
    width = 1080;
    height = 1080;
  } else if (aspectRatio === '16:9') {
    width = 1920;
    height = 1080;
  } else if (aspectRatio === '4:5') {
    width = 864;
    height = 1080;
  }

  return {
    ...spec,
    version: spec.version + 1,
    canvas: {
      ...spec.canvas,
      aspectRatio,
      width,
      height,
    },
    exportSettings: {
      ...spec.exportSettings,
      targetWidth: width,
      targetHeight: height,
      preset: aspectRatio === '9:16' ? 'Shorts' : aspectRatio === '1:1' ? 'Square' : 'Landscape',
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Inserts a B-Roll clip into track-broll
 */
export function insertBRollClip(
  spec: CanonicalRenderSpec,
  params: {
    title: string;
    sourceUrl: string;
    start: number;
    duration: number;
    fit?: 'cover' | 'contain' | 'pip' | 'fullscreen';
  }
): CanonicalRenderSpec {
  const { title, sourceUrl, start, duration, fit = 'cover' } = params;
  const end = Number((start + duration).toFixed(2));

  const newClip: TimelineClip = {
    id: `broll-${Date.now()}`,
    trackId: 'track-broll',
    trackType: 'BROLL',
    title,
    sourceUrl,
    start: Number(start.toFixed(2)),
    end,
    sourceStart: 0,
    sourceEnd: duration,
    volume: 0, // B-roll is typically visual only
    opacity: 1.0,
    layout: {
      x: 0,
      y: 0,
      width: spec.canvas.width,
      height: spec.canvas.height,
      fit,
    },
  };

  const nextTracks = spec.tracks.map((t) => {
    if (t.id === 'track-broll') {
      const clips = [...t.clips, newClip].sort((a, b) => a.start - b.start);
      return { ...t, clips };
    }
    return t;
  });

  return {
    ...spec,
    version: spec.version + 1,
    tracks: nextTracks,
    updatedAt: new Date().toISOString(),
  };
}
