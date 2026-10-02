/**
 * CLIPPER CONTENT FACTORY — PERSISTENCE, SEARCH, & DEDUPLICATION STORE
 * Phase 28, 29, 30, 31, 45, 47, 48, 49
 * 
 * Provides unified dual persistence (Supabase + resilient local JSON storage in data/factory/),
 * natural language search, multi-facet filtering, media checksum deduplication, and calendar scheduling.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import {
  ContentOpportunity,
  ContentAsset,
  ContentBrief,
  ContentVariant,
  ContentCalendarItem,
  BrandKit,
  ContentLibraryFilter
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'factory');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
    return defaultValue;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return defaultValue;
  }
}

function writeJsonFile<T>(filename: string, data: T) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================================================
// CHECKSUM & MEDIA DEDUPLICATION (Phase 48 & 49)
// ============================================================================

export function computeObjectChecksum(obj: any): string {
  const normalized = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function computeFileChecksum(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ============================================================================
// CONTENT OPPORTUNITY STORE
// ============================================================================

export async function saveOpportunities(opportunities: ContentOpportunity[]): Promise<void> {
  const current = readJsonFile<ContentOpportunity[]>('opportunities.json', []);
  const map = new Map<string, ContentOpportunity>(current.map((o) => [o.id, o]));
  for (const opp of opportunities) {
    map.set(opp.id, opp);
  }
  writeJsonFile('opportunities.json', Array.from(map.values()));

  if (supabase) {
    try {
      const records = opportunities.map((o) => ({
        id: o.id,
        project_id: o.projectId,
        source_start: o.sourceStart,
        source_end: o.sourceEnd,
        source_transcript: o.sourceTranscript,
        topic: o.topic,
        subtopic: o.subtopic,
        content_type: o.contentType,
        hook: o.hook,
        payoff: o.payoff,
        score: o.score,
        confidence: o.confidence,
        evidence: o.evidence,
        platform_fit: o.platformFit,
        pillars: o.pillars,
        status: o.status,
        lineage: o.lineage,
      }));
      await supabase.from('content_opportunities').upsert(records);
    } catch {
      // Fallback silently
    }
  }
}

export async function getOpportunitiesForProject(projectId: string): Promise<ContentOpportunity[]> {
  const list = readJsonFile<ContentOpportunity[]>('opportunities.json', []);
  return list.filter((o) => o.projectId === projectId);
}

// ============================================================================
// CONTENT ASSET STORE & SEARCH (Phase 29 & 45)
// ============================================================================

export async function saveContentAsset(asset: ContentAsset): Promise<void> {
  const assets = readJsonFile<ContentAsset[]>('assets.json', []);
  const idx = assets.findIndex((a) => a.id === asset.id);
  if (idx >= 0) {
    assets[idx] = asset;
  } else {
    assets.push(asset);
  }
  writeJsonFile('assets.json', assets);

  if (supabase) {
    try {
      await supabase.from('content_assets').upsert({
        id: asset.id,
        project_id: asset.projectId,
        opportunity_id: asset.opportunityId,
        brief_id: asset.briefId,
        title: asset.title,
        description: asset.description,
        content_type: asset.contentType,
        platform: asset.platform,
        aspect_ratio: asset.aspectRatio,
        duration_seconds: asset.durationSeconds,
        status: asset.status,
        render_spec: asset.renderSpec,
        lineage: asset.lineage,
        metadata: {
          titles: asset.titles,
          copy: asset.copy,
          hashtags: asset.hashtags,
          cta: asset.cta,
          thumbnailConcept: asset.thumbnailConcept,
        },
      });
    } catch {
      // Fallback silently
    }
  }
}

export async function getContentAssetById(id: string): Promise<ContentAsset | null> {
  const assets = readJsonFile<ContentAsset[]>('assets.json', []);
  return assets.find((a) => a.id === id) || null;
}

export async function searchContentLibrary(filter: ContentLibraryFilter): Promise<ContentAsset[]> {
  let assets = readJsonFile<ContentAsset[]>('assets.json', []);

  if (filter.projectId) {
    assets = assets.filter((a) => a.projectId === filter.projectId);
  }

  if (filter.platform) {
    assets = assets.filter((a) => a.platform === filter.platform);
  }

  if (filter.contentType) {
    assets = assets.filter((a) => a.contentType === filter.contentType);
  }

  if (filter.status) {
    assets = assets.filter((a) => a.status === filter.status);
  }

  if (filter.minScore !== undefined) {
    assets = assets.filter((a) => (a.qualityAudit?.score ?? 80) >= filter.minScore!);
  }

  if (filter.maxDuration !== undefined) {
    assets = assets.filter((a) => a.durationSeconds <= filter.maxDuration!);
  }

  if (filter.query) {
    const q = filter.query.toLowerCase().trim();
    assets = assets.filter((a) => {
      return (
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.cta.toLowerCase().includes(q) ||
        (a.titles && a.titles.some((t) => t.title.toLowerCase().includes(q))) ||
        (a.lineage && a.lineage.sourceClipId?.toLowerCase().includes(q))
      );
    });
  }

  return assets;
}

// ============================================================================
// CONTENT CALENDAR STORE (Phase 28)
// ============================================================================

export async function scheduleContentItem(item: ContentCalendarItem): Promise<void> {
  const items = readJsonFile<ContentCalendarItem[]>('calendar.json', []);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  writeJsonFile('calendar.json', items);

  if (supabase) {
    try {
      await supabase.from('content_calendar').upsert({
        id: item.id,
        asset_id: item.assetId,
        project_id: item.projectId,
        platform: item.platform,
        scheduled_at: item.scheduledAt,
        status: item.status,
        campaign: item.campaign,
        pillar: item.pillar,
        notes: item.notes,
      });
    } catch {
      // Fallback
    }
  }
}

export async function getCalendarItems(projectId?: string): Promise<ContentCalendarItem[]> {
  const items = readJsonFile<ContentCalendarItem[]>('calendar.json', []);
  if (projectId) {
    return items.filter((i) => i.projectId === projectId);
  }
  return items;
}

// ============================================================================
// BRAND KIT STORE (Phase 19)
// ============================================================================

export function getDefaultBrandKit(workspaceId: string = 'default-workspace'): BrandKit {
  return {
    id: `bk-${workspaceId}`,
    workspaceId,
    name: 'Clipper Creator Studio',
    logoUrl: '/favicon.ico',
    fonts: {
      heading: 'Inter',
      body: 'Inter',
      captions: 'Montserrat Black',
    },
    colors: {
      primary: '#DC2626',
      secondary: '#1E293B',
      accent: '#FACC15',
      background: '#FFFFFF',
      text: '#0F172A',
    },
    captionPreset: 'karaoke',
    defaultCta: 'Follow @Clipper for more video intelligence.',
    socialHandles: {
      youtube: '@ClipperAI',
      instagram: '@clipper.ai',
      tiktok: '@clipper.ai',
      linkedin: 'clipper-ai',
      x: '@clipper_ai',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveBrandKit(kit: BrandKit): Promise<void> {
  const kits = readJsonFile<BrandKit[]>('brandkits.json', []);
  const idx = kits.findIndex((k) => k.workspaceId === kit.workspaceId);
  if (idx >= 0) {
    kits[idx] = kit;
  } else {
    kits.push(kit);
  }
  writeJsonFile('brandkits.json', kits);
}

export async function getBrandKit(workspaceId: string = 'default-workspace'): Promise<BrandKit> {
  const kits = readJsonFile<BrandKit[]>('brandkits.json', []);
  const found = kits.find((k) => k.workspaceId === workspaceId);
  return found || getDefaultBrandKit(workspaceId);
}
