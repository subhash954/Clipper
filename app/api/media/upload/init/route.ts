import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getAuthenticatedUser, requireProjectAccess } from '@/lib/auth/serverAuth';
import { getStorageService } from '@/lib/storage/storageService';
import { getStorage } from '@/lib/storage';
import { formatErrorResponse, ClipperError } from '@/lib/errors';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const MAX_MEDIA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB limit
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v'];
const ALLOWED_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'application/octet-stream',
];

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        new ClipperError('AUTH_REQUIRED', 'Authentication required. Please log in.', 401).toResponse(),
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { projectId, fileName, mimeType, sizeBytes } = body;

    if (!projectId) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'projectId is required to initialize an upload session.', 400).toResponse(),
        { status: 400 }
      );
    }

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'fileName is required.', 400).toResponse(),
        { status: 400 }
      );
    }

    // Verify user owns or can edit the project
    await requireProjectAccess(user, projectId, 'editor');

    // Validate extension
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        new ClipperError(
          'MEDIA_INVALID',
          `Unsupported file format: ${ext}. Supported formats: MP4, MOV, WebM.`,
          400
        ).toResponse(),
        { status: 400 }
      );
    }

    // Validate size limit
    if (sizeBytes && sizeBytes > MAX_MEDIA_BYTES) {
      return NextResponse.json(
        new ClipperError(
          'VALIDATION_ERROR',
          `File exceeds maximum upload size of ${MAX_MEDIA_BYTES / (1024 * 1024 * 1024)}GB.`,
          400
        ).toResponse(),
        { status: 400 }
      );
    }

    const storageService = getStorageService();
    const session = await storageService.createUploadSession({
      userId: user.id,
      projectId,
      fileName,
      mimeType: mimeType || 'video/mp4',
      sizeBytes,
    });

    const mediaId = path.basename(path.dirname(path.dirname(session.storageKey)));
    const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Register media asset record in database with INITIATED status
    const mediaAsset = {
      id: mediaId,
      project_id: projectId,
      user_id: user.id,
      storage_provider: session.provider,
      storage_bucket_or_zone: storageService.getProvider().storageZoneOrBucket,
      storage_key: session.storageKey,
      original_filename: fileName,
      sanitized_filename: sanitizedFilename,
      mime_type: mimeType || 'video/mp4',
      media_type: 'video',
      size_bytes: sizeBytes || 0,
      status: 'INITIATED',
      upload_session_id: session.sessionId,
      processing_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      await supabase.from('media_assets').upsert(mediaAsset);
    }

    return NextResponse.json({
      success: true,
      session,
      mediaAsset,
    });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
