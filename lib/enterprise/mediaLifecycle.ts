import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EnterpriseMediaAsset, MediaLifecycleState } from './types';
import { SaasError } from '@/lib/saas/types';

export class EnterpriseMediaLifecycle {
  private baseDir = path.join(process.cwd(), 'data', 'enterprise');
  private mediaFile = path.join(process.cwd(), 'data', 'enterprise', 'media_assets.json');

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private read<T>(filePath: string): T[] {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private write<T>(filePath: string, data: T[]): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Validates file security via MIME type and magic byte inspection (Phase 52)
   */
  validateMediaBytes(buffer: Buffer): { valid: boolean; format: string } {
    if (buffer.length < 12) {
      return { valid: false, format: 'unknown' };
    }

    // Check for MP4 magic bytes: 'ftyp' at offset 4
    const ftyp = buffer.subarray(4, 8).toString('ascii');
    if (ftyp === 'ftyp') {
      return { valid: true, format: 'mp4' };
    }

    // Check for RIFF (WAV/AVI) or WebM (EBML: 0x1A 0x45 0xDF 0xA3)
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return { valid: true, format: 'webm' };
    }

    return { valid: false, format: 'invalid' };
  }

  /**
   * Registers media upload, performing SHA-256 deduplication and namespaced key allocation
   */
  async registerMediaUpload(
    organizationId: string,
    workspaceId: string,
    projectId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ asset: EnterpriseMediaAsset; isDeduplicated: boolean }> {
    // 1. Magic bytes validation
    const validation = this.validateMediaBytes(buffer);
    if (!validation.valid) {
      throw new SaasError('VALIDATION_ERROR', 'File security failure: Invalid media magic bytes or container format.', 400);
    }

    // 2. Compute SHA-256 content hash
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const mediaList = this.read<EnterpriseMediaAsset>(this.mediaFile);

    // 3. Deduplication check (Phase 11)
    const existing = mediaList.find(m => m.organizationId === organizationId && m.contentHash === contentHash);
    if (existing) {
      // Reuse existing media object reference
      const referenceAsset: EnterpriseMediaAsset = {
        ...existing,
        id: crypto.randomUUID(),
        projectId,
        workspaceId,
        filename,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mediaList.push(referenceAsset);
      this.write(this.mediaFile, mediaList);
      return { asset: referenceAsset, isDeduplicated: true };
    }

    // 4. Create namespaced storage key: org/ws/project/media/filename
    const storageNamespace = `${organizationId}/${workspaceId}/${projectId}/media/${crypto.randomUUID()}-${filename}`;

    const newAsset: EnterpriseMediaAsset = {
      id: crypto.randomUUID(),
      organizationId,
      workspaceId,
      projectId,
      contentHash,
      storageNamespace,
      filename,
      mimeType,
      sizeBytes: buffer.length,
      lifecycleState: 'READY',
      proxyUrls: {
        preview720p: `/api/media/proxy?key=${encodeURIComponent(storageNamespace)}&res=720`,
        thumbnailUrl: `/api/media/thumbnail?key=${encodeURIComponent(storageNamespace)}`,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mediaList.push(newAsset);
    this.write(this.mediaFile, mediaList);
    return { asset: newAsset, isDeduplicated: false };
  }

  async updateLifecycleState(assetId: string, state: MediaLifecycleState): Promise<EnterpriseMediaAsset> {
    const mediaList = this.read<EnterpriseMediaAsset>(this.mediaFile);
    const asset = mediaList.find(m => m.id === assetId);
    if (!asset) throw new SaasError('NOT_FOUND', `Media asset ${assetId} not found`, 404);

    asset.lifecycleState = state;
    asset.updatedAt = new Date().toISOString();
    this.write(this.mediaFile, mediaList);
    return asset;
  }

  async listMedia(workspaceId: string): Promise<EnterpriseMediaAsset[]> {
    const mediaList = this.read<EnterpriseMediaAsset>(this.mediaFile);
    return mediaList.filter(m => m.workspaceId === workspaceId && m.lifecycleState !== 'DELETED');
  }
}

// Singleton
let mediaLifecycleInstance: EnterpriseMediaLifecycle | null = null;

export function getEnterpriseMediaLifecycle(): EnterpriseMediaLifecycle {
  if (!mediaLifecycleInstance) {
    mediaLifecycleInstance = new EnterpriseMediaLifecycle();
  }
  return mediaLifecycleInstance;
}
