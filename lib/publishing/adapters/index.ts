/**
 * CLIPPER SOCIAL PUBLISHING — PLATFORM ADAPTER REGISTRY
 * Phase 2, 7, 10
 */

import { SupportedPlatform } from '@/lib/factory/types';
import { SocialPlatformAdapter } from './types';
import { YouTubeAdapter } from './youtubeAdapter';
import { TikTokAdapter } from './tiktokAdapter';
import { InstagramAdapter } from './instagramAdapter';
import { LinkedInAdapter } from './linkedinAdapter';
import { XAdapter } from './xAdapter';

const adapters: Record<string, SocialPlatformAdapter> = {
  youtube_shorts: new YouTubeAdapter(),
  tiktok: new TikTokAdapter(),
  instagram_reels: new InstagramAdapter(),
  linkedin: new LinkedInAdapter(),
  x: new XAdapter(),
};

export function getPlatformAdapter(platform: SupportedPlatform): SocialPlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`Unsupported publishing platform: ${platform}`);
  }
  return adapter;
}

export function listSupportedAdapters(): SocialPlatformAdapter[] {
  return Object.values(adapters);
}

export * from './types';
export * from './youtubeAdapter';
export * from './tiktokAdapter';
export * from './instagramAdapter';
export * from './linkedinAdapter';
export * from './xAdapter';
