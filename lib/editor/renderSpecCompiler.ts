import fs from 'fs';
import { CanonicalRenderSpec } from './types';
import { RenderClipOptions, renderClipWithFfmpeg, RenderResult } from '../renderEngine';
import { probeMedia } from '../media/probeService';
import { EditOperation } from '../types';

export interface RenderSpecValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a CanonicalRenderSpec before queueing or starting an FFmpeg render (Phase 37)
 */
export function validateRenderSpec(spec: CanonicalRenderSpec): RenderSpecValidationResult {
  const errors: string[] = [];

  if (!spec) {
    return { valid: false, errors: ['RenderSpec is null or undefined'] };
  }

  if (!spec.sourceAsset?.url || typeof spec.sourceAsset.url !== 'string' || spec.sourceAsset.url.trim() === '') {
    errors.push('RenderSpec sourceAsset.url is missing or empty.');
  }

  if (typeof spec.duration !== 'number' || spec.duration <= 0) {
    errors.push(`Invalid render duration: ${spec.duration}. Duration must be greater than 0 seconds.`);
  }

  if (!spec.canvas || spec.canvas.width <= 0 || spec.canvas.height <= 0) {
    errors.push('Invalid canvas dimensions. Width and height must be positive numbers.');
  }

  // Ensure there is at least one active video clip
  const videoTrack = spec.tracks.find((t) => t.type === 'VIDEO');
  if (!videoTrack || videoTrack.clips.length === 0) {
    errors.push('RenderSpec must contain at least one VIDEO track with valid footage clips.');
  } else {
    for (const clip of videoTrack.clips) {
      if (clip.end <= clip.start) {
        errors.push(`Clip ${clip.id} has invalid timing: start (${clip.start}) >= end (${clip.end}).`);
      }
      if (clip.sourceEnd <= clip.sourceStart) {
        errors.push(`Clip ${clip.id} has invalid source bounds: sourceStart (${clip.sourceStart}) >= sourceEnd (${clip.sourceEnd}).`);
      }
    }
  }

  // Captions timing validation
  if (spec.captions?.enabled && spec.captions.words?.length > 0) {
    for (let i = 0; i < spec.captions.words.length; i++) {
      const w = spec.captions.words[i];
      if (w.start < 0 || w.end < w.start) {
        errors.push(`Caption word "${w.word}" at index ${i} has invalid timestamps [${w.start}, ${w.end}].`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Compiles a CanonicalRenderSpec into RenderClipOptions for the FFmpeg engine (Phase 38)
 */
export function compileRenderSpecToClipOptions(spec: CanonicalRenderSpec): RenderClipOptions {
  const videoTrack = spec.tracks.find((t) => t.type === 'VIDEO');
  const mainClip = videoTrack?.clips[0];

  const startTime = mainClip ? mainClip.sourceStart : 0;
  const duration = spec.duration || (mainClip ? mainClip.end - mainClip.start : 30);

  // Map cuts from RenderSpec
  const cuts: EditOperation[] = (spec.cuts || []).map((c) => ({
    id: c.id,
    type: 'CUT' as const,
    start: c.start,
    end: c.end,
    label: c.reason || c.type,
    enabled: true,
    reason: c.type === 'manual' ? 'manual_cut' : c.type,
  }));

  // Map B-Roll from BROLL track
  const brollTrack = spec.tracks.find((t) => t.type === 'BROLL');
  const brollOperations: EditOperation[] = (brollTrack?.clips || []).map((b) => ({
    id: b.id,
    type: 'BROLL' as const,
    start: b.start,
    end: b.end,
    label: b.title,
    enabled: !b.isDisabled,
    word: b.title,
  }));

  return {
    inputMedia: spec.sourceAsset.url,
    startTime,
    duration,
    words: (spec.captions?.words || []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
    subtitleStyle: spec.captions?.style,
    visualSettings: {
      aspectRatio: spec.canvas.aspectRatio,
      trackingMode: spec.reframe.mode,
      showProgressBar: true,
      splitScreenEnabled: false,
      satisfyingVideoType: 'none',
      progressBarColor: '#DC2626',
      progressBarHeight: 8,
      showCustomLogo: false,
      customLogoText: '@ClipperCreator',
      logoPosition: 'top-right',
      showIntroHook: false,
      introHookText: '',
      backgroundBlur: false,
      manualPosition: { x: 0.5, y: 0.5, zoom: 1.0 },
      lockFraming: false,
    },
    audioSettings: {
      studioSoundEnabled: spec.audioMix.studioCleanEnabled,
      volumeNormalization: spec.audioMix.loudnormEnabled,
      autoDucking: spec.audioMix.smartDucking.enabled,
      backgroundMusicEnabled: false,
      musicTrack: 'lofi',
      musicVolume: 0.3,
      dubbingEnabled: false,
      dubbingLanguage: 'en',
    },
    cuts,
    brollOperations,
    isProUser: true,
    reframeTrack: spec.reframe.track,
    aspectRatio: spec.canvas.aspectRatio,
    trackingMode: spec.reframe.mode,
  };
}

/**
 * Post-FFmpeg render validation probing the generated MP4 file (Phase 39)
 */
export async function validateRenderOutput(
  filePath: string,
  expectedMinDuration: number = 0.5
): Promise<{ valid: boolean; error?: string; metadata?: any }> {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: `Rendered output file was not found at path: ${filePath}` };
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    return { valid: false, error: 'Rendered output file is empty (0 bytes).' };
  }

  const probe = await probeMedia(filePath);
  if (!probe.isValid) {
    return { valid: false, error: `Output media validation failed: ${probe.error}` };
  }

  if (probe.duration < expectedMinDuration) {
    return {
      valid: false,
      error: `Rendered output duration too short: ${probe.duration}s (expected >= ${expectedMinDuration}s).`,
      metadata: probe,
    };
  }

  if (!probe.hasVideo) {
    return { valid: false, error: 'Rendered output lacks a valid video track.', metadata: probe };
  }

  return { valid: true, metadata: probe };
}

/**
 * Complete server render execution from CanonicalRenderSpec with pre- and post-validation (Phases 38-40)
 */
export async function executeRenderFromSpec(
  jobId: string,
  spec: CanonicalRenderSpec,
  onProgress?: (progress: number, stage: string) => void
): Promise<RenderResult> {
  // 1. Pre-render validation
  const validation = validateRenderSpec(spec);
  if (!validation.valid) {
    throw new Error(`RENDER_VALIDATION_FAILED: ${validation.errors.join('; ')}`);
  }

  // 2. Compile RenderSpec to options
  const clipOptions = compileRenderSpecToClipOptions(spec);

  // 3. Render via FFmpeg
  const result = await renderClipWithFfmpeg(jobId, clipOptions, onProgress);

  // 4. Probe post-render output
  const outputValidation = await validateRenderOutput(result.filePath, 0.5);
  if (!outputValidation.valid) {
    throw new Error(`RENDER_OUTPUT_CORRUPTED: ${outputValidation.error}`);
  }

  return result;
}
