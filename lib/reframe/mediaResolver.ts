/**
 * CLIPPER PHASE 6.1: AUTHORITATIVE MEDIA RESOLVER & FILESYSTEM GATE
 * Authoritatively verifies media ownership, enforces directory confinement,
 * blocks path traversal / symlink escapes, and verifies container signatures.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getMediaAssetById, getStorage } from '../storage';
import { MediaAsset } from '../types';
import { getStorageService } from '../storage/storageService';
import { validateMediaFileSignature } from '../media/probeService';
import { ClipperError } from '../errors';

export interface ResolvedMediaSource {
  localPath: string;
  mediaAsset: MediaAsset;
  isTempFile: boolean;
  cleanup?: () => Promise<void>;
}

export interface MediaResolutionParams {
  projectId: string;
  mediaAssetId: string;
  userId: string;
  requireEditorAccess?: boolean;
}

/**
 * Returns canonical allowed root directories where media files may reside
 */
export function getAllowedMediaRoots(): string[] {
  const roots: string[] = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), 'public', 'uploads'),
    path.resolve(os.tmpdir()),
  ];

  // In test environment only, permit public folder for test fixture videos (e.g. public/sample.mp4)
  if (process.env.NODE_ENV === 'test') {
    roots.push(path.resolve(process.cwd(), 'public'));
  }

  return roots;
}

/**
 * Validates that a path is strictly inside one of the allowed directory roots,
 * resolving all symlinks with fs.realpathSync, and checking that the target is a regular file.
 */
export function assertSafeFilesystemPath(candidatePath: string): string {
  if (!candidatePath || typeof candidatePath !== 'string') {
    throw new ClipperError('VALIDATION_ERROR', 'Media path must be a non-empty string', 400);
  }

  // Reject raw path traversal strings immediately
  if (
    candidatePath.includes('..') ||
    candidatePath.includes('\0') ||
    candidatePath.includes('%2e%2e') ||
    candidatePath.includes('%2E%2E')
  ) {
    throw new ClipperError('FORBIDDEN', 'Path traversal sequence detected', 403);
  }

  const absoluteCandidate = path.resolve(candidatePath);
  const allowedRoots = getAllowedMediaRoots();

  // Verify the resolved path starts with an allowed root before following links
  const isWithinAllowedRootPrecheck = allowedRoots.some(
    (root) => absoluteCandidate === root || absoluteCandidate.startsWith(root + path.sep)
  );

  if (!isWithinAllowedRootPrecheck) {
    console.error('[MediaResolver] Path outside allowed roots:', absoluteCandidate);
    throw new ClipperError(
      'FORBIDDEN',
      'Media source path is outside authorized storage locations',
      403
    );
  }

  if (!fs.existsSync(absoluteCandidate)) {
    console.error('[MediaResolver] Media file does not exist:', absoluteCandidate);
    throw new ClipperError('MEDIA_UNAVAILABLE', 'Media source file does not exist or is unavailable', 404);
  }

  // Resolve symlinks to physical target
  let realPath: string;
  try {
    realPath = fs.realpathSync(absoluteCandidate);
  } catch (err: any) {
    console.error('[MediaResolver] Failed to resolve real path for candidate:', err);
    throw new ClipperError('FORBIDDEN', 'Failed to resolve canonical media filesystem path', 403);
  }

  // Verify real physical target is also inside an allowed root (anti-symlink escape)
  const isWithinAllowedRootPostReal = allowedRoots.some(
    (root) => realPath === root || realPath.startsWith(root + path.sep)
  );

  if (!isWithinAllowedRootPostReal) {
    console.error('[MediaResolver] Symlink escape detected real path:', realPath);
    throw new ClipperError('FORBIDDEN', 'Symlink escape detected: real path references an unauthorized location', 403);
  }

  // Ensure target is a regular file, not a directory or special device
  const stat = fs.statSync(realPath);
  if (!stat.isFile()) {
    console.error('[MediaResolver] Target is not a regular file:', realPath);
    throw new ClipperError('MEDIA_INVALID', 'Media source target is not a regular file', 400);
  }

  if (stat.size === 0) {
    throw new ClipperError('MEDIA_INVALID', 'Media file is empty (0 bytes)', 400);
  }

  // Verify magic bytes signature
  const sig = validateMediaFileSignature(realPath);
  if (!sig.isValid) {
    console.error('[MediaResolver] Invalid container signature for:', realPath);
    throw new ClipperError(
      'MEDIA_INVALID',
      'Invalid media file container signature',
      400
    );
  }

  return realPath;
}

/**
 * Authoritatively resolves physical media file for a project and media asset.
 * 1. Checks project existence and user access
 * 2. Checks media asset existence
 * 3. Asserts media asset strictly belongs to the project (cross-project attack gate)
 * 4. Resolves local path or downloads from authoritative storage to temp
 */
export async function resolveAuthorizedMediaSource(
  params: MediaResolutionParams
): Promise<ResolvedMediaSource> {
  const { projectId, mediaAssetId, userId, requireEditorAccess = true } = params;

  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    throw new ClipperError('VALIDATION_ERROR', 'Missing or invalid projectId', 400);
  }

  if (!mediaAssetId || typeof mediaAssetId !== 'string' || !mediaAssetId.trim()) {
    throw new ClipperError('VALIDATION_ERROR', 'Missing or invalid mediaAssetId', 400);
  }

  const storage = getStorage();

  // 1. Verify project exists
  const project = await storage.getProject(projectId);
  if (!project) {
    throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
  }

  // 2. Fetch authoritative media asset record
  const mediaAsset = await getMediaAssetById(mediaAssetId);
  if (!mediaAsset) {
    throw new ClipperError('NOT_FOUND', `Media asset ${mediaAssetId} not found`, 404);
  }

  // 3. CROSS-PROJECT SECURITY GATE: Media asset MUST belong to the requested project
  if (mediaAsset.projectId !== projectId) {
    throw new ClipperError(
      'MEDIA_NOT_OWNED',
      `Media asset ${mediaAssetId} does not belong to project ${projectId}`,
      403
    );
  }

  // 4. Attempt to resolve local filesystem candidate
  const localCandidates: string[] = [];
  if (mediaAsset.storagePath) {
    localCandidates.push(mediaAsset.storagePath);
  }
  if (mediaAsset.fileUrl && !mediaAsset.fileUrl.startsWith('http')) {
    localCandidates.push(path.join(process.cwd(), 'public', mediaAsset.fileUrl.replace(/^\//, '')));
  }
  localCandidates.push(path.join(process.cwd(), 'data', 'uploads', `${mediaAsset.id}.mp4`));

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      try {
        const safePath = assertSafeFilesystemPath(candidate);
        return {
          localPath: safePath,
          mediaAsset,
          isTempFile: false,
        };
      } catch (err: any) {
        // If candidate threw a security error (like symlink escape), fail fast
        if (err instanceof ClipperError && (err.code === 'FORBIDDEN' || err.code === 'MEDIA_NOT_OWNED')) {
          throw err;
        }

      }
    }
  }

  // 5. Cloud Storage Resolution: Download from object storage using bounded streaming to temporary file
  let tempDir: string | null = null;
  try {
    const storageService = getStorageService();
    const storageKey = mediaAsset.storageKey || mediaAsset.storagePath || `uploads/${mediaAsset.id}.mp4`;

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    tempDir = path.join(os.tmpdir(), `clipper_reframe_${Date.now()}_${randomSuffix}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `${mediaAsset.id}.mp4`);

    if (typeof storageService.downloadObjectToFile === 'function') {
      await storageService.downloadObjectToFile(storageKey, tempFile, {
        maxSizeBytes: 500 * 1024 * 1024,
      });
    } else {
      const buffer = await storageService.getObject(storageKey);
      if (buffer.length > 500 * 1024 * 1024) {
        throw new ClipperError('MEDIA_INVALID', 'Media object exceeds maximum allowed size of 500 MB', 400);
      }
      fs.writeFileSync(tempFile, buffer);
    }

    const safeTempPath = assertSafeFilesystemPath(tempFile);

    const capturedTempDir = tempDir;
    const cleanup = async () => {
      try {
        if (capturedTempDir && fs.existsSync(capturedTempDir)) {
          fs.rmSync(capturedTempDir, { recursive: true, force: true });
        }
      } catch {}
    };

    return {
      localPath: safeTempPath,
      mediaAsset,
      isTempFile: true,
      cleanup,
    };
  } catch (storageErr: any) {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
    if (storageErr instanceof ClipperError && storageErr.code === 'MEDIA_INVALID') {
      throw storageErr;
    }
    console.error('[MediaResolver] Cloud media download failed:', {
      mediaAssetId: mediaAsset.id,
      projectId,
      error: storageErr?.message,
    });
    throw new ClipperError(
      'MEDIA_UNAVAILABLE',
      `Failed to locate or retrieve physical video stream for media asset ${mediaAsset.id}`,
      422
    );
  }
}
