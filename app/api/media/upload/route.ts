import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { getStorageService } from '@/lib/storage/storageService';
import { getMediaProcessingService } from '@/lib/media/processingService';
import { formatErrorResponse, ClipperError } from '@/lib/errors';
import { MediaAsset } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB limit

export async function POST(req: NextRequest) {
  let tempFilePath = '';

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        new ClipperError('AUTH_REQUIRED', 'Authentication required. Please log in.', 401).toResponse(),
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = (formData.get('projectId') as string) || crypto.randomUUID();

    if (!file) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'No video file was uploaded.', 400).toResponse(),
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        new ClipperError(
          'VALIDATION_ERROR',
          `File exceeds maximum upload size of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`,
          400
        ).toResponse(),
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mediaId = crypto.randomUUID();
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(sanitizedOriginalName) || '.mp4';

    // Temporary scratch directory exclusively for local probing/transcoding during upload
    const tempDir = path.join(process.cwd(), 'data', 'temp_uploads', mediaId);
    fs.mkdirSync(tempDir, { recursive: true });
    tempFilePath = path.join(tempDir, `original${ext}`);
    fs.writeFileSync(tempFilePath, buffer);

    // 1. Process media asset: FFprobe deep inspection, thumbnail extraction, proxy generation
    const processingService = getMediaProcessingService();
    const processResult = await processingService.processMediaAsset({
      userId: user.id,
      projectId,
      mediaId,
      localSourcePath: tempFilePath,
    });

    const probe = processResult.probe;

    // 2. Upload immutable source video to authoritative Cloud Storage (Bunny Storage)
    const storageService = getStorageService();
    const storageKey = storageService.generateCanonicalStorageKey({
      userId: user.id,
      projectId,
      mediaId,
      artifactType: 'source',
      fileName: `original${ext}`,
    });

    const uploadResult = await storageService.upload(storageKey, buffer, {
      contentType: file.type || 'video/mp4',
    });

    // 3. Construct media asset record with immutable cloud URLs
    const mediaAsset: MediaAsset = {
      id: mediaId,
      projectId,
      userId: user.id,
      fileName: file.name,
      fileUrl: uploadResult.publicUrl,
      storagePath: uploadResult.key,
      storageProvider: storageService.getProvider().providerType,
      storageBucketOrZone: storageService.getProvider().storageZoneOrBucket,
      storageKey: uploadResult.key,
      originalFilename: file.name,
      sanitizedFilename: sanitizedOriginalName,
      mimeType: file.type || 'video/mp4',
      mediaType: 'video',
      sizeBytes: file.size,
      checksum: uploadResult.checksum,
      duration: probe.duration,
      durationSeconds: probe.duration,
      width: probe.width,
      height: probe.height,
      codec: probe.codec,
      videoCodec: probe.codec,
      audioCodec: probe.audioCodec,
      fps: probe.fps,
      frameRate: probe.fps,
      status: 'READY',
      processingStatus: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 4. Persist in database
    if (isSupabaseConfigured()) {
      await supabase.from('media_assets').upsert({
        id: mediaId,
        project_id: projectId,
        user_id: user.id,
        storage_provider: mediaAsset.storageProvider,
        storage_bucket_or_zone: mediaAsset.storageBucketOrZone,
        storage_key: mediaAsset.storageKey,
        original_filename: mediaAsset.originalFilename,
        sanitized_filename: mediaAsset.sanitizedFilename,
        mime_type: mediaAsset.mimeType,
        media_type: mediaAsset.mediaType,
        size_bytes: mediaAsset.sizeBytes,
        checksum: mediaAsset.checksum,
        duration_seconds: probe.duration,
        width: probe.width,
        height: probe.height,
        frame_rate: probe.fps,
        video_codec: probe.codec,
        audio_codec: probe.audioCodec || 'none',
        status: 'READY',
        processing_status: 'completed',
        created_at: mediaAsset.createdAt,
        updated_at: mediaAsset.updatedAt,
      });
    }

    return NextResponse.json({
      success: true,
      mediaAsset,
      probe,
      proxyUrl: processResult.proxyUrl,
      thumbnailUrl: processResult.thumbnailUrl,
    });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  } finally {
    // 5. Clean up temporary scratch processing files
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        const parentDir = path.dirname(tempFilePath);
        fs.rmSync(parentDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
