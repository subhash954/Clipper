/**
 * LOCAL STORAGE PROVIDER
 * For isolated unit testing and local development only.
 * Strictly forbidden in production mode.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

export class LocalStorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = 'local';
  readonly storageZoneOrBucket: string = 'local-dev-bucket';
  private baseDir: string;

  constructor(customBaseDir?: string) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOCAL_STORAGE !== 'true') {
      throw new ClipperError(
        'CONFIGURATION_ERROR',
        'LocalStorageProvider is forbidden in production mode. Configure Bunny Storage or S3.',
        500
      );
    }
    this.baseDir = customBaseDir || path.join(process.cwd(), 'data', 'storage_mock');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveLocalPath(key: string): string {
    const safeKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    // Prevent directory traversal
    if (safeKey.includes('..')) {
      throw new ClipperError('VALIDATION_ERROR', 'Path traversal characters forbidden in storage key', 400);
    }
    return path.join(this.baseDir, safeKey);
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<StorageUploadResult> {
    const fullPath = this.resolveLocalPath(key);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    fs.writeFileSync(fullPath, buffer);

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      key: key.replace(/\\/g, '/').replace(/^\/+/, ''),
      publicUrl: `/api/media/download?key=${encodeURIComponent(key)}`,
      sizeBytes: buffer.length,
      checksum,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const fullPath = this.resolveLocalPath(key);
    if (!fs.existsSync(fullPath)) {
      throw new ClipperError('NOT_FOUND', `Object ${key} not found in local storage.`, 404);
    }
    return fs.readFileSync(fullPath);
  }

  async downloadToFile(
    key: string,
    destinationPath: string,
    options?: { maxSizeBytes?: number }
  ): Promise<{ sizeBytes: number }> {
    const fullPath = this.resolveLocalPath(key);
    if (!fs.existsSync(fullPath)) {
      throw new ClipperError('NOT_FOUND', `Object ${key} not found in local storage.`, 404);
    }

    const maxSizeBytes = options?.maxSizeBytes || MAX_MEDIA_DOWNLOAD_BYTES;
    const stats = fs.statSync(fullPath);
    if (stats.size > maxSizeBytes) {
      throw new ClipperError(
        'MEDIA_INVALID',
        `Media object exceeds maximum allowed size of ${maxSizeBytes} bytes`,
        400
      );
    }

    if (stats.size === 0) {
      throw new ClipperError('MEDIA_INVALID', 'Downloaded media file is empty (0 bytes)', 400);
    }

    const parentDir = path.dirname(destinationPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const tempPartialPath = `${destinationPath}.partial`;
    if (fs.existsSync(tempPartialPath)) {
      try { fs.unlinkSync(tempPartialPath); } catch {}
    }

    const readStream = fs.createReadStream(fullPath);
    const writeStream = fs.createWriteStream(tempPartialPath);
    let bytesWritten = 0;

    await new Promise<void>((resolve, reject) => {
      readStream.on('data', (chunk: Buffer | string) => {
        const chunkLen = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        bytesWritten += chunkLen;
        if (bytesWritten > maxSizeBytes) {
          readStream.destroy();
          writeStream.destroy();
          reject(
            new ClipperError(
              'MEDIA_INVALID',
              `Media object exceeds maximum allowed size of ${maxSizeBytes} bytes`,
              400
            )
          );
        }
      });
      readStream.on('error', (err) => {
        writeStream.destroy();
        reject(err);
      });
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
      readStream.pipe(writeStream);
    }).catch((err) => {
      if (fs.existsSync(tempPartialPath)) {
        try { fs.unlinkSync(tempPartialPath); } catch {}
      }
      if (fs.existsSync(destinationPath)) {
        try { fs.unlinkSync(destinationPath); } catch {}
      }
      throw err;
    });

    fs.renameSync(tempPartialPath, destinationPath);
    return { sizeBytes: bytesWritten };
  }

  async objectExists(key: string): Promise<boolean> {
    const fullPath = this.resolveLocalPath(key);
    return fs.existsSync(fullPath);
  }

  async getObjectMetadata(key: string): Promise<StorageObjectMetadata | null> {
    const fullPath = this.resolveLocalPath(key);
    if (!fs.existsSync(fullPath)) return null;

    const stats = fs.statSync(fullPath);
    const buffer = fs.readFileSync(fullPath);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      key: key.replace(/\\/g, '/').replace(/^\/+/, ''),
      sizeBytes: stats.size,
      contentType: 'application/octet-stream',
      checksum,
      lastModified: stats.mtime,
      isDirectory: stats.isDirectory(),
    };
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolveLocalPath(key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async deletePrefix(prefix: string): Promise<number> {
    const fullPrefixPath = this.resolveLocalPath(prefix);
    let deletedCount = 0;

    if (fs.existsSync(fullPrefixPath)) {
      const stats = fs.statSync(fullPrefixPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPrefixPath, { recursive: true, force: true });
        deletedCount = 1;
      } else {
        fs.unlinkSync(fullPrefixPath);
        deletedCount = 1;
      }
    }

    return deletedCount;
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
    return `/api/media/download?key=${encodeURIComponent(key)}`;
  }

  async getSignedUploadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    return `/api/media/upload?key=${encodeURIComponent(key)}`;
  }
}
