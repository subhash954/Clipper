/**
 * BUNNY STORAGE & CDN PROVIDER
 * Official Bunny Storage REST API + Bunny CDN Token Authentication
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import {
  IStorageProvider,
  StorageProviderType,
  StorageUploadResult,
  StorageObjectMetadata,
  UploadOptions,
  SignedUrlOptions,
  MAX_MEDIA_DOWNLOAD_BYTES,
} from '../types';
import { ClipperError } from '../../errors';

export interface BunnyStorageConfig {
  storageZone: string;
  apiKey: string;
  hostname?: string;
  cdnHostname?: string;
  cdnTokenKey?: string;
}

export class BunnyStorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = 'bunny';
  readonly storageZoneOrBucket: string;
  private apiKey: string;
  private hostname: string;
  private cdnHostname: string;
  private cdnTokenKey?: string;

  constructor(config?: Partial<BunnyStorageConfig>) {
    this.storageZoneOrBucket =
      config?.storageZone || process.env.BUNNY_STORAGE_ZONE || '';
    this.apiKey =
      config?.apiKey || process.env.BUNNY_STORAGE_API_KEY || '';
    this.hostname =
      config?.hostname ||
      process.env.BUNNY_STORAGE_HOSTNAME ||
      'storage.bunnycdn.com';
    this.cdnHostname =
      config?.cdnHostname ||
      process.env.BUNNY_CDN_HOSTNAME ||
      `${this.storageZoneOrBucket}.b-cdn.net`;
    this.cdnTokenKey =
      config?.cdnTokenKey || process.env.BUNNY_CDN_TOKEN_KEY;

    if (!this.storageZoneOrBucket || !this.apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new ClipperError(
          'CONFIGURATION_ERROR',
          'Bunny Storage is not configured. BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY are required.',
          500
        );
      }
    }
  }

  private normalizeKey(key: string): string {
    return key.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  private getStorageUrl(key: string): string {
    const normalized = this.normalizeKey(key);
    return `https://${this.hostname}/${this.storageZoneOrBucket}/${normalized}`;
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<StorageUploadResult> {
    const url = this.getStorageUrl(key);
    const contentType = options?.contentType || 'application/octet-stream';
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Compute checksum for verification
    const sha256Checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey: this.apiKey,
        'Content-Type': contentType,
        ...(options?.checksum ? { Checksum: options.checksum } : {}),
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new ClipperError(
        'STORAGE_UNAVAILABLE',
        `Bunny Storage upload failed (HTTP ${res.status}): ${errText || res.statusText}`,
        502,
        true,
        { key, status: res.status }
      );
    }

    const publicUrl = `https://${this.cdnHostname}/${this.normalizeKey(key)}`;

    return {
      key: this.normalizeKey(key),
      publicUrl,
      sizeBytes: buffer.length,
      checksum: sha256Checksum,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const url = this.getStorageUrl(key);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        AccessKey: this.apiKey,
      },
    });

    if (res.status === 404) {
      throw new ClipperError(
        'NOT_FOUND',
        `Object ${key} not found in Bunny Storage.`,
        404,
        false,
        { key }
      );
    }

    if (!res.ok) {
      throw new ClipperError(
        'STORAGE_UNAVAILABLE',
        `Failed to retrieve object ${key} from Bunny Storage (HTTP ${res.status})`,
        502,
        true,
        { key, status: res.status }
      );
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async downloadToFile(
    key: string,
    destinationPath: string,
    options?: { maxSizeBytes?: number }
  ): Promise<{ sizeBytes: number }> {
    const url = this.getStorageUrl(key);
    const maxSizeBytes = options?.maxSizeBytes || MAX_MEDIA_DOWNLOAD_BYTES;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        AccessKey: this.apiKey,
      },
    });

    if (res.status === 404) {
      throw new ClipperError(
        'NOT_FOUND',
        `Object ${key} not found in Bunny Storage.`,
        404,
        false,
        { key }
      );
    }

    if (!res.ok) {
      throw new ClipperError(
        'STORAGE_UNAVAILABLE',
        `Failed to retrieve object ${key} from Bunny Storage (HTTP ${res.status})`,
        502,
        true,
        { key, status: res.status }
      );
    }

    if (!res.body) {
      throw new ClipperError('STORAGE_UNAVAILABLE', 'Cloud response body is empty or unavailable', 502);
    }

    const parentDir = path.dirname(destinationPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const tempPartialPath = `${destinationPath}.partial`;
    if (fs.existsSync(tempPartialPath)) {
      try { fs.unlinkSync(tempPartialPath); } catch {}
    }

    const writeStream = fs.createWriteStream(tempPartialPath);
    let totalBytes = 0;

    try {
      if (typeof (res.body as any).getReader === 'function') {
        const reader = (res.body as ReadableStream<Uint8Array>).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            totalBytes += value.length;
            if (totalBytes > maxSizeBytes) {
              await reader.cancel();
              throw new ClipperError(
                'MEDIA_INVALID',
                `Media object exceeds maximum allowed size of ${maxSizeBytes} bytes`,
                400
              );
            }
            await new Promise<void>((resolve, reject) => {
              if (!writeStream.write(Buffer.from(value))) {
                writeStream.once('drain', resolve);
                writeStream.once('error', reject);
              } else {
                resolve();
              }
            });
          }
        }
      } else {
        // Node Readable stream iterator
        for await (const chunk of (res.body as any)) {
          const chunkBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += chunkBuf.length;
          if (totalBytes > maxSizeBytes) {
            throw new ClipperError(
              'MEDIA_INVALID',
              `Media object exceeds maximum allowed size of ${maxSizeBytes} bytes`,
              400
            );
          }
          await new Promise<void>((resolve, reject) => {
            if (!writeStream.write(chunkBuf)) {
              writeStream.once('drain', resolve);
              writeStream.once('error', reject);
            } else {
              resolve();
            }
          });
        }
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end((err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (totalBytes === 0) {
        throw new ClipperError('MEDIA_INVALID', 'Downloaded media file is empty (0 bytes)', 400);
      }

      fs.renameSync(tempPartialPath, destinationPath);
      return { sizeBytes: totalBytes };
    } catch (err) {
      try { writeStream.destroy(); } catch {}
      if (fs.existsSync(tempPartialPath)) {
        try { fs.unlinkSync(tempPartialPath); } catch {}
      }
      if (fs.existsSync(destinationPath)) {
        try { fs.unlinkSync(destinationPath); } catch {}
      }
      throw err;
    }
  }

  async objectExists(key: string): Promise<boolean> {
    const url = this.getStorageUrl(key);

    try {
      // Use Range: bytes=0-0 to avoid transferring full file payload
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          AccessKey: this.apiKey,
          Range: 'bytes=0-0',
        },
      });

      return res.status === 200 || res.status === 206;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(key: string): Promise<StorageObjectMetadata | null> {
    const normalized = this.normalizeKey(key);
    const parentDir = path.posix.dirname(normalized);
    const fileName = path.posix.basename(normalized);
    const listDir = parentDir === '.' ? '' : `${parentDir}/`;

    const listUrl = `https://${this.hostname}/${this.storageZoneOrBucket}/${listDir}`;

    try {
      const res = await fetch(listUrl, {
        method: 'GET',
        headers: {
          AccessKey: this.apiKey,
          Accept: 'application/json',
        },
      });

      if (!res.ok) return null;

      const items: any[] = await res.json();
      if (!Array.isArray(items)) return null;

      const item = items.find((i) => i.ObjectName === fileName && !i.IsDirectory);
      if (!item) return null;

      return {
        key: normalized,
        sizeBytes: Number(item.Length) || 0,
        contentType: 'application/octet-stream',
        checksum: item.Checksum,
        lastModified: item.LastChanged ? new Date(item.LastChanged) : new Date(),
        isDirectory: false,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const url = this.getStorageUrl(key);

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        AccessKey: this.apiKey,
      },
    });

    if (!res.ok && res.status !== 404) {
      throw new ClipperError(
        'STORAGE_UNAVAILABLE',
        `Failed to delete object ${key} from Bunny Storage (HTTP ${res.status})`,
        502,
        true,
        { key }
      );
    }
  }

  async deletePrefix(prefix: string): Promise<number> {
    const normalized = this.normalizeKey(prefix).replace(/\/?$/, '/');
    const url = `https://${this.hostname}/${this.storageZoneOrBucket}/${normalized}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        AccessKey: this.apiKey,
      },
    });

    if (!res.ok && res.status !== 404) {
      throw new ClipperError(
        'STORAGE_UNAVAILABLE',
        `Failed to delete prefix ${prefix} from Bunny Storage (HTTP ${res.status})`,
        502,
        true,
        { prefix }
      );
    }

    return 1;
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const data = await this.getObject(sourceKey);
    await this.upload(destinationKey, data);
  }

  async moveObject(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copyObject(sourceKey, destinationKey);
    await this.deleteObject(sourceKey);
  }

  async getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const normalized = this.normalizeKey(key);
    const cleanPath = `/${normalized}`;
    const expiresIn = options?.expiresInSeconds || 3600;
    const expires = Math.floor(Date.now() / 1000) + expiresIn;

    let baseUrl = `https://${this.cdnHostname}${cleanPath}`;

    if (!this.cdnTokenKey) {
      return baseUrl;
    }

    // Bunny CDN Token Authentication (SHA-256 HMAC-like token)
    const ip = options?.userIp || '';
    const hashable = `${this.cdnTokenKey}${cleanPath}${expires}${ip}`;
    const token = crypto
      .createHash('sha256')
      .update(hashable)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const params = new URLSearchParams();
    params.set('token', token);
    params.set('expires', expires.toString());
    if (options?.downloadFilename) {
      params.set('download', options.downloadFilename);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  async getSignedUploadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    // For Bunny Storage REST API, uploads are executed via the canonical storage endpoint
    return this.getStorageUrl(key);
  }
}
