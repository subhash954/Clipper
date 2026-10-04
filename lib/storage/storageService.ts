/**
 * CLIPPER MASTER STORAGE SERVICE
 * Provider-agnostic coordinator for cloud object storage & media uploads.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import {
  IStorageService,
  IStorageProvider,
  CreateUploadSessionParams,
  UploadSession,
  UploadPartReceipt,
  StorageUploadResult,
  StorageObjectMetadata,
  UploadOptions,
  SignedUrlOptions,
} from './types';
import { BunnyStorageProvider } from './providers/bunnyStorageProvider';
import { LocalStorageProvider } from './providers/localStorageProvider';
import { ClipperError } from '../errors';

export class StorageService implements IStorageService {
  private provider: IStorageProvider;
  private uploadSessions = new Map<
    string,
    {
      session: UploadSession;
      parts: Map<number, Buffer>;
    }
  >();

  constructor(customProvider?: IStorageProvider) {
    if (customProvider) {
      this.provider = customProvider;
      return;
    }

    const providerType = (process.env.STORAGE_PROVIDER || '').toLowerCase();

    if (providerType === 'bunny' || (process.env.BUNNY_STORAGE_ZONE && process.env.BUNNY_STORAGE_API_KEY)) {
      this.provider = new BunnyStorageProvider();
    } else if (process.env.NODE_ENV === 'production') {
      if (process.env.ALLOW_DEV_LOCAL_STORAGE === 'true') {
        this.provider = new LocalStorageProvider();
      } else {
        throw new ClipperError(
          'CONFIGURATION_ERROR',
          'Production media storage requires BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY.',
          500
        );
      }
    } else {
      this.provider = new LocalStorageProvider();
    }
  }

  getProvider(): IStorageProvider {
    return this.provider;
  }

  setProvider(provider: IStorageProvider): void {
    this.provider = provider;
  }

  generateCanonicalStorageKey(params: {
    userId: string;
    projectId: string;
    mediaId: string;
    artifactType: 'source' | 'proxy' | 'thumbnails' | 'audio' | 'captions' | 'renders' | 'analysis';
    fileName: string;
  }): string {
    const { userId, projectId, mediaId, artifactType, fileName } = params;

    // Strict validation against path traversal
    if (
      userId.includes('..') ||
      projectId.includes('..') ||
      mediaId.includes('..') ||
      fileName.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\')
    ) {
      throw new ClipperError('VALIDATION_ERROR', 'Path traversal attempt detected in storage key generation.', 400);
    }

    const sanitizedFile = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `users/${userId}/projects/${projectId}/media/${mediaId}/${artifactType}/${sanitizedFile}`;
  }

  async createUploadSession(params: CreateUploadSessionParams): Promise<UploadSession> {
    const { userId, projectId, fileName, sizeBytes } = params;
    const mediaId = crypto.randomUUID();
    const sessionId = `session-${crypto.randomUUID()}`;

    const ext = path.extname(fileName) || '.mp4';
    const storageKey = this.generateCanonicalStorageKey({
      userId,
      projectId,
      mediaId,
      artifactType: 'source',
      fileName: `original${ext}`,
    });

    const expiresInSeconds = params.expiresInSeconds || 3600;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const uploadUrl = await this.provider.getSignedUploadUrl(storageKey, {
      expiresInSeconds,
      contentType: params.mimeType,
    });

    const session: UploadSession = {
      sessionId,
      storageKey,
      uploadUrl,
      provider: this.provider.providerType,
      chunkSizeBytes: 5 * 1024 * 1024, // 5MB standard chunks
      expiresAt,
      totalBytes: sizeBytes,
      partsReceived: [],
      status: 'pending',
    };

    this.uploadSessions.set(sessionId, {
      session,
      parts: new Map(),
    });

    return session;
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<StorageUploadResult> {
    return this.provider.upload(key, data, options);
  }

  async uploadMultipartPart(
    sessionId: string,
    partNumber: number,
    data: Buffer | Uint8Array
  ): Promise<UploadPartReceipt> {
    const sessionRecord = this.uploadSessions.get(sessionId);
    if (!sessionRecord) {
      throw new ClipperError('NOT_FOUND', `Upload session ${sessionId} not found or expired.`, 404);
    }

    if (sessionRecord.session.status !== 'pending') {
      throw new ClipperError('VALIDATION_ERROR', `Upload session ${sessionId} is already ${sessionRecord.session.status}.`, 400);
    }

    if (new Date(sessionRecord.session.expiresAt).getTime() < Date.now()) {
      sessionRecord.session.status = 'aborted';
      throw new ClipperError('VALIDATION_ERROR', `Upload session ${sessionId} has expired.`, 400);
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    sessionRecord.parts.set(partNumber, buffer);

    if (!sessionRecord.session.partsReceived.includes(partNumber)) {
      sessionRecord.session.partsReceived.push(partNumber);
      sessionRecord.session.partsReceived.sort((a, b) => a - b);
    }

    const etag = crypto.createHash('md5').update(buffer).digest('hex');

    return {
      partNumber,
      etag,
      sizeBytes: buffer.length,
    };
  }

  async completeMultipartUpload(
    sessionId: string,
    parts: UploadPartReceipt[]
  ): Promise<StorageUploadResult> {
    const sessionRecord = this.uploadSessions.get(sessionId);
    if (!sessionRecord) {
      throw new ClipperError('NOT_FOUND', `Upload session ${sessionId} not found.`, 404);
    }

    // Sort parts by partNumber
    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const assembledChunks: Buffer[] = [];

    for (const part of sortedParts) {
      const partBuffer = sessionRecord.parts.get(part.partNumber);
      if (!partBuffer) {
        throw new ClipperError(
          'VALIDATION_ERROR',
          `Missing chunk part ${part.partNumber} for upload session ${sessionId}.`,
          400
        );
      }
      assembledChunks.push(partBuffer);
    }

    const finalBuffer = Buffer.concat(assembledChunks);

    // Upload complete assembled media to cloud storage provider
    const result = await this.provider.upload(sessionRecord.session.storageKey, finalBuffer);

    sessionRecord.session.status = 'completed';
    // Clean memory cache of chunks
    sessionRecord.parts.clear();

    return result;
  }

  async abortMultipartUpload(sessionId: string): Promise<void> {
    const sessionRecord = this.uploadSessions.get(sessionId);
    if (sessionRecord) {
      sessionRecord.session.status = 'aborted';
      sessionRecord.parts.clear();
      this.uploadSessions.delete(sessionId);
    }
  }

  async getObject(key: string): Promise<Buffer> {
    return this.provider.getObject(key);
  }

  async getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    return this.provider.getSignedDownloadUrl(key, options);
  }

  async getSignedUploadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    return this.provider.getSignedUploadUrl(key, options);
  }

  async deleteObject(key: string): Promise<void> {
    return this.provider.deleteObject(key);
  }

  async deletePrefix(prefix: string): Promise<number> {
    return this.provider.deletePrefix(prefix);
  }

  async objectExists(key: string): Promise<boolean> {
    return this.provider.objectExists(key);
  }

  async getObjectMetadata(key: string): Promise<StorageObjectMetadata | null> {
    return this.provider.getObjectMetadata(key);
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    return this.provider.copyObject(sourceKey, destinationKey);
  }

  async moveObject(sourceKey: string, destinationKey: string): Promise<void> {
    return this.provider.moveObject(sourceKey, destinationKey);
  }

  generateCanonicalKey(params: {
    userId: string;
    projectId: string;
    mediaId: string;
    artifactType: 'source' | 'proxy' | 'thumbnails' | 'audio' | 'captions' | 'renders' | 'analysis';
    fileName: string;
  }): string {
    return this.generateCanonicalStorageKey(params);
  }

  async exists(key: string): Promise<boolean> {
    return this.objectExists(key);
  }

  async getDownloadUrl(key: string, options?: SignedUrlOptions): Promise<{ downloadUrl: string }> {
    const downloadUrl = await this.getSignedDownloadUrl(key, options);
    return { downloadUrl };
  }

  async uploadObject(
    key: string,
    data: Buffer | Uint8Array | NodeJS.ReadableStream,
    options?: UploadOptions & { contentLength?: number }
  ): Promise<StorageUploadResult> {
    if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      return this.upload(key, data, options);
    }
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      data.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      data.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const result = await this.upload(key, buffer, options);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      data.on('error', reject);
    });
  }

  async getObjectStream(key: string): Promise<any> {
    const { Readable } = await import('stream');
    const buffer = await this.getObject(key);
    return Readable.from(buffer);
  }

  async downloadObjectToFile(
    key: string,
    destinationPath: string,
    options?: { maxSizeBytes?: number }
  ): Promise<{ sizeBytes: number }> {
    if (this.provider.downloadToFile) {
      return this.provider.downloadToFile(key, destinationPath, options);
    }

    const maxSizeBytes = options?.maxSizeBytes || 500 * 1024 * 1024;
    const buffer = await this.provider.getObject(key);
    if (buffer.length > maxSizeBytes) {
      throw new ClipperError(
        'MEDIA_INVALID',
        `Media object exceeds maximum allowed size of ${maxSizeBytes} bytes`,
        400
      );
    }
    if (buffer.length === 0) {
      throw new ClipperError('MEDIA_INVALID', 'Downloaded media file is empty (0 bytes)', 400);
    }

    const parentDir = path.dirname(destinationPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const tempPartial = `${destinationPath}.partial`;
    try {
      fs.writeFileSync(tempPartial, buffer);
      fs.renameSync(tempPartial, destinationPath);
      return { sizeBytes: buffer.length };
    } catch (err) {
      if (fs.existsSync(tempPartial)) {
        try { fs.unlinkSync(tempPartial); } catch {}
      }
      throw err;
    }
  }
}

// Global Singleton
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}

export function resetStorageServiceInstance(): void {
  storageServiceInstance = null;
}
