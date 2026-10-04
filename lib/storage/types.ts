/**
 * CLIPPER STORAGE ARCHITECTURE — PROVIDER-AGNOSTIC TYPES
 * Phase 2: Production-grade cloud media storage contracts
 */

export type MediaAssetStatus =
  | 'INITIATED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'VALIDATING'
  | 'PROBING'
  | 'READY_FOR_PROCESSING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'DELETING'
  | 'DELETED';

export type StorageProviderType = 'bunny' | 's3' | 'r2' | 'b2' | 'local';

export interface StorageObjectMetadata {
  key: string;
  sizeBytes: number;
  contentType: string;
  etag?: string;
  checksum?: string;
  lastModified: Date;
  isDirectory: boolean;
  customMetadata?: Record<string, string>;
}

export interface UploadOptions {
  contentType?: string;
  checksum?: string;
  customMetadata?: Record<string, string>;
}

export interface StorageUploadResult {
  key: string;
  publicUrl: string;
  sizeBytes: number;
  etag?: string;
  checksum?: string;
}

export interface CreateUploadSessionParams {
  userId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  expiresInSeconds?: number;
}

export interface UploadSession {
  sessionId: string;
  storageKey: string;
  uploadUrl: string;
  provider: StorageProviderType;
  chunkSizeBytes: number;
  expiresAt: string;
  totalBytes?: number;
  partsReceived: number[];
  status: 'pending' | 'completed' | 'aborted';
}

export interface UploadPartReceipt {
  partNumber: number;
  etag?: string;
  sizeBytes: number;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
  downloadFilename?: string;
  contentType?: string;
  userIp?: string;
}

/**
 * Low-level provider interface for interchangeable cloud object storage
 */
export interface IStorageProvider {
  readonly providerType: StorageProviderType;
  readonly storageZoneOrBucket: string;

  upload(key: string, data: Buffer | Uint8Array, options?: UploadOptions): Promise<StorageUploadResult>;
  getObject(key: string): Promise<Buffer>;
  objectExists(key: string): Promise<boolean>;
  getObjectMetadata(key: string): Promise<StorageObjectMetadata | null>;
  deleteObject(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;
  moveObject(sourceKey: string, destinationKey: string): Promise<void>;
  getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  getSignedUploadUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  downloadToFile(
    key: string,
    destinationPath: string,
    options?: { maxSizeBytes?: number }
  ): Promise<{ sizeBytes: number }>;
}

export const MAX_MEDIA_DOWNLOAD_BYTES = 500 * 1024 * 1024; // 500 MB = 524,288,000 bytes

/**
 * High-level authoritative storage service for the application
 */
export interface IStorageService {
  createUploadSession(params: CreateUploadSessionParams): Promise<UploadSession>;
  upload(key: string, data: Buffer | Uint8Array, options?: UploadOptions): Promise<StorageUploadResult>;
  uploadMultipartPart(sessionId: string, partNumber: number, data: Buffer | Uint8Array): Promise<UploadPartReceipt>;
  completeMultipartUpload(sessionId: string, parts: UploadPartReceipt[]): Promise<StorageUploadResult>;
  abortMultipartUpload(sessionId: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  getSignedUploadUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  deleteObject(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  objectExists(key: string): Promise<boolean>;
  getObjectMetadata(key: string): Promise<StorageObjectMetadata | null>;
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;
  moveObject(sourceKey: string, destinationKey: string): Promise<void>;
  generateCanonicalStorageKey(params: {
    userId: string;
    projectId: string;
    mediaId: string;
    artifactType: 'source' | 'proxy' | 'thumbnails' | 'audio' | 'captions' | 'renders' | 'analysis';
    fileName: string;
  }): string;
  generateCanonicalKey?(params: {
    userId: string;
    projectId: string;
    mediaId: string;
    artifactType: 'source' | 'proxy' | 'thumbnails' | 'audio' | 'captions' | 'renders' | 'analysis';
    fileName: string;
  }): string;
  uploadObject?(
    key: string,
    data: Buffer | Uint8Array | NodeJS.ReadableStream,
    options?: UploadOptions & { contentLength?: number }
  ): Promise<StorageUploadResult>;
  exists?(key: string): Promise<boolean>;
  getDownloadUrl?(key: string, options?: SignedUrlOptions): Promise<{ downloadUrl: string }>;
  getObjectStream?(key: string): Promise<any>;
  downloadObjectToFile(
    key: string,
    destinationPath: string,
    options?: { maxSizeBytes?: number }
  ): Promise<{ sizeBytes: number }>;
}
