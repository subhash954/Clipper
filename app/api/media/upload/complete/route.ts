import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { getStorageService } from '@/lib/storage/storageService';
import { getMediaProcessingService } from '@/lib/media/processingService';
import { formatErrorResponse, ClipperError } from '@/lib/errors';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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

    const body = await req.json().catch(() => ({}));
    const { sessionId, parts, projectId, mediaId } = body;

    if (!sessionId) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'sessionId is required.', 400).toResponse(),
        { status: 400 }
      );
    }

    const storageService = getStorageService();

    // 1. Complete multipart upload to authoritative cloud storage
    const uploadResult = await storageService.completeMultipartUpload(sessionId, parts || []);

    // 2. Derive storage key components
    // Format: users/{userId}/projects/{projectId}/media/{mediaId}/source/{fileName}
    const keyParts = uploadResult.key.split('/');
    const effectiveUserId = keyParts[1] || user.id;
    const effectiveProjectId = keyParts[3] || projectId || 'unknown-project';
    const effectiveMediaId = keyParts[5] || mediaId || crypto.randomUUID();

    // 3. Download assembled source from storage to temp scratch for probing & proxy generation
    const tempDir = path.join(process.cwd(), 'data', 'temp_verification', effectiveMediaId);
    fs.mkdirSync(tempDir, { recursive: true });
    tempFilePath = path.join(tempDir, path.basename(uploadResult.key));

    const sourceBuffer = await storageService.getObject(uploadResult.key);
    fs.writeFileSync(tempFilePath, sourceBuffer);

    // 4. Run deep probing, thumbnail extraction, and proxy generation
    const processingService = getMediaProcessingService();
    const processResult = await processingService.processMediaAsset({
      userId: effectiveUserId,
      projectId: effectiveProjectId,
      mediaId: effectiveMediaId,
      localSourcePath: tempFilePath,
    });

    const probe = processResult.probe;

    // 5. Update media_assets record in database with verified status and metadata
    const updatedMediaAsset = {
      id: effectiveMediaId,
      project_id: effectiveProjectId,
      user_id: effectiveUserId,
      storage_provider: storageService.getProvider().providerType,
      storage_bucket_or_zone: storageService.getProvider().storageZoneOrBucket,
      storage_key: uploadResult.key,
      file_url: uploadResult.publicUrl,
      size_bytes: uploadResult.sizeBytes,
      checksum: uploadResult.checksum,
      duration_seconds: probe.duration,
      width: probe.width,
      height: probe.height,
      frame_rate: probe.fps,
      video_codec: probe.codec,
      audio_codec: probe.audioCodec || 'none',
      status: 'READY',
      processing_status: 'completed',
      proxy_key: processResult.proxyKey,
      proxy_url: processResult.proxyUrl,
      thumbnail_key: processResult.thumbnailKey,
      thumbnail_url: processResult.thumbnailUrl,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      await supabase.from('media_assets').upsert(updatedMediaAsset);
    }

    return NextResponse.json({
      success: true,
      mediaAsset: updatedMediaAsset,
      probe,
    });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  } finally {
    // Clean up temporary verification file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        const parentDir = path.dirname(tempFilePath);
        fs.rmSync(parentDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
