/**
 * CLIPPER CONTENT FACTORY — MULTI-PLATFORM ADAPTATION ENGINE
 * Phase 9, 10, 12, 14, 15, 16, 39
 * 
 * Compiles ContentOpportunity into platform-specific ContentAsset with real RenderSpecs,
 * multi-aspect framing (9:16, 4:5, 1:1, 16:9), caption treatments, B-roll overlays, and duration targets.
 */

import { CanonicalRenderSpec, TimelineClip } from '@/lib/editor/types';
import { createDefaultRenderSpec, setCanvasAspectRatio } from '@/lib/editor/timelineEngine';
import { WordTimestamp } from '@/lib/types';
import { VisualOpportunity } from '@/lib/intelligence/types';
import {
  ContentOpportunity,
  ContentAsset,
  ContentVariant,
  SupportedPlatform,
  BrandKit,
  BrandVoice,
  GeneratedHook
} from './types';
import { getPlatformProfile, validatePlatformConstraints } from './platformProfiles';
import { generateContentBrief, generateTitles, generateHashtags, generatePlatformCopy, generateThumbnailConcept, generateCTA } from './copywritingEngines';

export interface AdaptationOptions {
  platform: SupportedPlatform;
  targetDurationSeconds?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  captionStyle?: 'minimal' | 'bold' | 'dynamic' | 'karaoke' | 'clean' | 'emphasis';
  brollDensity?: 'none' | 'light' | 'dynamic' | 'heavy';
  audioMode?: 'voice_only' | 'voice_music' | 'voice_music_sfx';
  brandKit?: BrandKit;
  brandVoice?: BrandVoice;
  sourceMediaUrl?: string;
  sourceWords?: WordTimestamp[];
  visualOpportunities?: VisualOpportunity[];
}

/**
 * Creates a fully configured ContentAsset from an opportunity and target platform
 */
export function adaptOpportunityToPlatform(
  opportunity: ContentOpportunity,
  options: AdaptationOptions
): { asset: ContentAsset; durationOptimized: boolean; needsLongerFormat: boolean } {
  const profile = getPlatformProfile(options.platform);
  const now = new Date().toISOString();

  // 1. Duration Optimization (Phase 10)
  const naturalDuration = opportunity.sourceEnd - opportunity.sourceStart;
  let targetDuration = options.targetDurationSeconds || Math.min(naturalDuration, profile.maxDurationSeconds);
  let needsLongerFormat = false;

  if (targetDuration > profile.maxDurationSeconds) {
    targetDuration = profile.maxDurationSeconds;
    needsLongerFormat = true;
  }

  // Clip window
  const clipStart = opportunity.sourceStart;
  const clipEnd = Math.min(opportunity.sourceEnd, clipStart + targetDuration);
  const actualDuration = clipEnd - clipStart;

  // 2. Aspect Ratio & Canvas (Phase 12)
  const targetAspect = options.aspectRatio || profile.recommendedAspectRatios[0] || '9:16';

  // 3. Create Canonical RenderSpec for this asset
  let baseSpec = createDefaultRenderSpec({
    projectId: opportunity.projectId,
    durationSeconds: actualDuration,
    sourceUrl: options.sourceMediaUrl || 'https://assets.mixkit.co/videos/preview/mixkit-vertical-camera-pan-of-trees-in-a-forest-42898-large.mp4',
  });

  if (targetAspect !== '9:16') {
    baseSpec = setCanvasAspectRatio(baseSpec, targetAspect);
  }

  // Adjust source clip offsets non-destructively
  const videoTrack = baseSpec.tracks.find((t) => t.type === 'VIDEO');
  if (videoTrack && videoTrack.clips.length > 0) {
    videoTrack.clips[0].sourceStart = clipStart;
    videoTrack.clips[0].sourceEnd = clipEnd;
    videoTrack.clips[0].start = 0;
    videoTrack.clips[0].end = actualDuration;
  }

  // 4. Captions (Phase 14)
  if (options.sourceWords && options.sourceWords.length > 0) {
    const matchingWords = options.sourceWords
      .filter((w) => w.start >= clipStart && w.end <= clipEnd)
      .map((w) => ({
        word: w.word,
        start: Math.max(0, w.start - clipStart),
        end: Math.max(0, w.end - clipStart),
      }));

    baseSpec.captions = {
      ...baseSpec.captions,
      enabled: true,
      safeAreaEnabled: true,
      words: matchingWords,
    };
  }

  // 5. B-Roll Variants (Phase 15)
  if (options.brollDensity && options.brollDensity !== 'none' && options.visualOpportunities) {
    const brollTrack = baseSpec.tracks.find((t) => t.type === 'BROLL');
    if (brollTrack) {
      // Find matching visual opportunities in this window
      const inWindowOpps = options.visualOpportunities.filter(
        (vo) => vo.start >= clipStart && vo.end <= clipEnd
      );

      const maxInserts = options.brollDensity === 'light' ? 1 : options.brollDensity === 'dynamic' ? 2 : 4;
      inWindowOpps.slice(0, maxInserts).forEach((vo, idx) => {
        brollTrack.clips.push({
          id: `broll-${vo.id}-${idx}`,
          trackId: brollTrack.id,
          trackType: 'BROLL',
          title: `B-Roll: ${vo.keyword || 'Visual Overlay'}`,
          sourceStart: 0,
          sourceEnd: Math.min(3.5, vo.end - vo.start),
          start: Math.max(0, vo.start - clipStart),
          end: Math.min(actualDuration, vo.end - clipStart),
          sourceUrl: 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4',
          volume: 0,
        });
      });
    }
  }

  // 6. Audio Modes (Phase 16)
  if (options.audioMode === 'voice_music' || options.audioMode === 'voice_music_sfx') {
    const musicTrack = baseSpec.tracks.find((t) => t.type === 'MUSIC');
    if (musicTrack) {
      musicTrack.clips.push({
        id: `bg-music-${opportunity.id}`,
        trackId: musicTrack.id,
        trackType: 'MUSIC',
        title: 'Cinematic Ambient Background Music',
        sourceStart: 0,
        sourceEnd: actualDuration,
        start: 0,
        end: actualDuration,
        sourceUrl: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
        volume: 0.18,
      });
    }
  }

  // 7. Generate Brief & Copy
  const brief = generateContentBrief(opportunity, options.platform, {
    brandVoice: options.brandVoice,
    targetDurationSeconds: actualDuration,
  });
  const titles = generateTitles(opportunity, options.brandVoice);
  const hashtags = generateHashtags(opportunity, options.brandKit);
  const copy = generatePlatformCopy(opportunity, brief, hashtags);
  const thumbnailConcept = generateThumbnailConcept(opportunity);

  // Validate technical platform constraints
  const platformValidation = validatePlatformConstraints({
    platform: options.platform,
    durationSeconds: actualDuration,
    aspectRatio: targetAspect,
    title: titles[0]?.title,
    description: copy.youtubeDescription || copy.instagramCaption,
  });

  const asset: ContentAsset = {
    id: `asset-${opportunity.id}-${options.platform}`,
    projectId: opportunity.projectId,
    opportunityId: opportunity.id,
    briefId: brief.id,
    title: titles[0]?.title || opportunity.topic,
    description: copy.youtubeDescription || copy.instagramCaption || opportunity.hook,
    contentType: targetAspect === '9:16' ? (options.platform === 'tiktok' ? 'TIKTOK' : options.platform === 'instagram_reels' ? 'REEL' : 'YOUTUBE_SHORT') : 'SHORT_VIDEO',
    platform: options.platform,
    aspectRatio: targetAspect,
    durationSeconds: actualDuration,
    status: platformValidation.valid ? 'READY' : 'NEEDS_REVIEW',
    titles,
    copy,
    hashtags,
    cta: generateCTA('Audience Growth', opportunity.topic),
    thumbnailConcept,
    renderSpec: baseSpec,
    lockedFields: [],
    lineage: {
      ...opportunity.lineage,
      sourceStart: clipStart,
      sourceEnd: clipEnd,
      extractedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  return {
    asset,
    durationOptimized: actualDuration < naturalDuration,
    needsLongerFormat,
  };
}

/**
 * Generates creative variants for a ContentAsset (Phase 8 & 39)
 */
export function generateAssetVariants(
  baseAsset: ContentAsset,
  hooks: GeneratedHook[]
): ContentVariant[] {
  const variants: ContentVariant[] = [];

  // Generate 2 hook variants
  if (hooks.length >= 2) {
    variants.push({
      id: `var-hook-b-${baseAsset.id}`,
      assetId: baseAsset.id,
      name: 'Variant B: Contrarian Hook',
      variantType: 'HOOK',
      hookOverride: hooks[0],
      status: 'READY',
      createdAt: new Date().toISOString(),
    });

    if (hooks.length >= 3) {
      variants.push({
        id: `var-hook-c-${baseAsset.id}`,
        assetId: baseAsset.id,
        name: 'Variant C: Question Hook',
        variantType: 'HOOK',
        hookOverride: hooks[1],
        status: 'READY',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Generate an alternative aspect ratio variant (e.g. 4:5 for Instagram feed or 1:1 for LinkedIn)
  if (baseAsset.aspectRatio === '9:16' && baseAsset.renderSpec) {
    const squareSpec = setCanvasAspectRatio(baseAsset.renderSpec, '1:1');
    variants.push({
      id: `var-aspect-sq-${baseAsset.id}`,
      assetId: baseAsset.id,
      name: 'Variant: 1:1 Square Feed',
      variantType: 'ASPECT_RATIO',
      aspectRatioOverride: '1:1',
      renderSpecOverride: squareSpec,
      status: 'READY',
      createdAt: new Date().toISOString(),
    });
  }

  return variants;
}
