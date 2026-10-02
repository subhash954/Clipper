/**
 * CLIPPER CONTENT FACTORY — PLATFORM CONSTRAINTS & EDITORIAL PROFILES
 * Phase 11, 13, 50
 */

import { PlatformProfile, SupportedPlatform, ContentAsset } from './types';

export const PLATFORM_PROFILES: Record<SupportedPlatform, PlatformProfile> = {
  youtube_shorts: {
    platform: 'youtube_shorts',
    displayName: 'YouTube Shorts',
    maxDurationSeconds: 60,
    minDurationSeconds: 5,
    recommendedAspectRatios: ['9:16'],
    captionSafeAreas: {
      topPercent: 8,
      bottomPercent: 22,
      leftPercent: 6,
      rightPercent: 18, // Leave room for like/comment stack
    },
    titleLimits: {
      maxCharacters: 100,
      optimalCharacters: 60,
    },
    descriptionLimits: {
      maxCharacters: 5000,
    },
    hashtagRules: {
      maxCount: 5,
      placement: 'title',
    },
    thumbnailRules: {
      width: 1080,
      height: 1920,
      maxBytes: 2 * 1024 * 1024,
    },
    editorialProfile: {
      openingPacing: 'fast',
      captionDensity: 'high',
      visualDensity: 'high',
      formalityPreference: 'energetic',
    },
  },

  instagram_reels: {
    platform: 'instagram_reels',
    displayName: 'Instagram Reels',
    maxDurationSeconds: 90,
    minDurationSeconds: 3,
    recommendedAspectRatios: ['9:16', '4:5'],
    captionSafeAreas: {
      topPercent: 10,
      bottomPercent: 25, // Bottom username & caption overlay
      leftPercent: 6,
      rightPercent: 16, // Like, comment, share icons
    },
    titleLimits: {
      maxCharacters: 125,
      optimalCharacters: 80,
    },
    descriptionLimits: {
      maxCharacters: 2200,
    },
    hashtagRules: {
      maxCount: 10,
      placement: 'description_end',
    },
    thumbnailRules: {
      width: 1080,
      height: 1920,
      maxBytes: 4 * 1024 * 1024,
    },
    editorialProfile: {
      openingPacing: 'fast',
      captionDensity: 'medium',
      visualDensity: 'medium',
      formalityPreference: 'casual',
    },
  },

  tiktok: {
    platform: 'tiktok',
    displayName: 'TikTok',
    maxDurationSeconds: 180,
    minDurationSeconds: 5,
    recommendedAspectRatios: ['9:16'],
    captionSafeAreas: {
      topPercent: 8,
      bottomPercent: 24, // Sound title, description text
      leftPercent: 6,
      rightPercent: 16, // Profile, like, comment, bookmark, share
    },
    titleLimits: {
      maxCharacters: 150,
      optimalCharacters: 75,
    },
    descriptionLimits: {
      maxCharacters: 4000,
    },
    hashtagRules: {
      maxCount: 6,
      placement: 'description_end',
    },
    thumbnailRules: {
      width: 1080,
      height: 1920,
      maxBytes: 2 * 1024 * 1024,
    },
    editorialProfile: {
      openingPacing: 'fast',
      captionDensity: 'high',
      visualDensity: 'high',
      formalityPreference: 'energetic',
    },
  },

  linkedin: {
    platform: 'linkedin',
    displayName: 'LinkedIn Video',
    maxDurationSeconds: 600, // 10 minutes
    minDurationSeconds: 15,
    recommendedAspectRatios: ['1:1', '4:5', '16:9'],
    captionSafeAreas: {
      topPercent: 6,
      bottomPercent: 12,
      leftPercent: 6,
      rightPercent: 6,
    },
    titleLimits: {
      maxCharacters: 150,
      optimalCharacters: 90,
    },
    descriptionLimits: {
      maxCharacters: 3000,
    },
    hashtagRules: {
      maxCount: 5,
      placement: 'description_end',
    },
    thumbnailRules: {
      width: 1920,
      height: 1080,
      maxBytes: 5 * 1024 * 1024,
    },
    editorialProfile: {
      openingPacing: 'measured',
      captionDensity: 'medium',
      visualDensity: 'low',
      formalityPreference: 'professional',
    },
  },

  x: {
    platform: 'x',
    displayName: 'X (Twitter)',
    maxDurationSeconds: 140,
    minDurationSeconds: 3,
    recommendedAspectRatios: ['16:9', '1:1', '9:16'],
    captionSafeAreas: {
      topPercent: 6,
      bottomPercent: 10,
      leftPercent: 6,
      rightPercent: 6,
    },
    titleLimits: {
      maxCharacters: 280,
      optimalCharacters: 180,
    },
    descriptionLimits: {
      maxCharacters: 280,
    },
    hashtagRules: {
      maxCount: 3,
      placement: 'description_end',
    },
    thumbnailRules: {
      width: 1200,
      height: 675,
      maxBytes: 3 * 1024 * 1024,
    },
    editorialProfile: {
      openingPacing: 'fast',
      captionDensity: 'medium',
      visualDensity: 'medium',
      formalityPreference: 'direct',
    },
  },

  facebook: {
    platform: 'facebook',
    displayName: 'Facebook Video',
    maxDurationSeconds: 240,
    minDurationSeconds: 5,
    recommendedAspectRatios: ['1:1', '4:5', '16:9'],
    captionSafeAreas: {
      topPercent: 8,
      bottomPercent: 15,
      leftPercent: 6,
      rightPercent: 6,
    },
    titleLimits: {
      maxCharacters: 100,
      optimalCharacters: 60,
    },
    descriptionLimits: {
      maxCharacters: 2000,
    },
    hashtagRules: {
      maxCount: 4,
      placement: 'description_end',
    },
    thumbnailRules: {
      width: 1280,
      height: 720,
      maxBytes: 4 * 1024 * 1024,
    },
    editorialProfile: {
      openingPacing: 'measured',
      captionDensity: 'medium',
      visualDensity: 'medium',
      formalityPreference: 'casual',
    },
  },
};

/**
 * Returns the profile for a given platform
 */
export function getPlatformProfile(platform: SupportedPlatform): PlatformProfile {
  return PLATFORM_PROFILES[platform] || PLATFORM_PROFILES.youtube_shorts;
}

/**
 * Validates whether an asset satisfies the technical constraints of its target platform
 */
export function validatePlatformConstraints(asset: {
  platform: SupportedPlatform;
  durationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  title?: string;
  description?: string;
}): { valid: boolean; errors: string[] } {
  const profile = getPlatformProfile(asset.platform);
  const errors: string[] = [];

  if (asset.durationSeconds > profile.maxDurationSeconds) {
    errors.push(
      `Duration (${asset.durationSeconds}s) exceeds ${profile.displayName} maximum limit of ${profile.maxDurationSeconds}s.`
    );
  }

  if (asset.durationSeconds < profile.minDurationSeconds) {
    errors.push(
      `Duration (${asset.durationSeconds}s) is below ${profile.displayName} minimum limit of ${profile.minDurationSeconds}s.`
    );
  }

  if (!profile.recommendedAspectRatios.includes(asset.aspectRatio)) {
    errors.push(
      `Aspect ratio ${asset.aspectRatio} is not recommended for ${profile.displayName}. (Supported: ${profile.recommendedAspectRatios.join(', ')})`
    );
  }

  if (asset.title && asset.title.length > profile.titleLimits.maxCharacters) {
    errors.push(
      `Title length (${asset.title.length} chars) exceeds ${profile.displayName} limit of ${profile.titleLimits.maxCharacters}.`
    );
  }

  if (asset.description && asset.description.length > profile.descriptionLimits.maxCharacters) {
    errors.push(
      `Description length (${asset.description.length} chars) exceeds ${profile.displayName} limit of ${profile.descriptionLimits.maxCharacters}.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
