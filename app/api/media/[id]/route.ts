import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { getStorageService } from '@/lib/storage/storageService';
import { formatErrorResponse, ClipperError } from '@/lib/errors';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        new ClipperError('AUTH_REQUIRED', 'Authentication required. Please log in.', 401).toResponse(),
        { status: 401 }
      );
    }

    const { id: mediaId } = await params;
    if (!mediaId) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'Media ID parameter is required.', 400).toResponse(),
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        mediaAsset: { id: mediaId, userId: user.id },
      });
    }

    const { data: asset, error } = await supabase
      .from('media_assets')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (error || !asset) {
      return NextResponse.json(
        new ClipperError('NOT_FOUND', `Media asset ${mediaId} not found.`, 404).toResponse(),
        { status: 404 }
      );
    }

    // Ownership check
    if (user.role !== 'admin' && asset.user_id !== user.id) {
      return NextResponse.json(
        new ClipperError('FORBIDDEN', 'Forbidden: You do not have permission to access this media asset.', 403).toResponse(),
        { status: 403 }
      );
    }

    const storageService = getStorageService();
    const signedDownloadUrl = asset.storage_key
      ? await storageService.getSignedDownloadUrl(asset.storage_key, { expiresInSeconds: 7200 })
      : asset.file_url;

    return NextResponse.json({
      success: true,
      mediaAsset: {
        ...asset,
        signedDownloadUrl,
      },
    });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        new ClipperError('AUTH_REQUIRED', 'Authentication required. Please log in.', 401).toResponse(),
        { status: 401 }
      );
    }

    const { id: mediaId } = await params;
    if (!mediaId) {
      return NextResponse.json(
        new ClipperError('VALIDATION_ERROR', 'Media ID parameter is required.', 400).toResponse(),
        { status: 400 }
      );
    }

    let storageKey = '';
    let projectId = '';
    let assetUserId = user.id;

    if (isSupabaseConfigured()) {
      const { data: asset, error } = await supabase
        .from('media_assets')
        .select('*')
        .eq('id', mediaId)
        .single();

      if (asset) {
        if (user.role !== 'admin' && asset.user_id !== user.id) {
          return NextResponse.json(
            new ClipperError('FORBIDDEN', 'Forbidden: You do not have permission to delete this media asset.', 403).toResponse(),
            { status: 403 }
          );
        }
        storageKey = asset.storage_key || '';
        projectId = asset.project_id || '';
        assetUserId = asset.user_id;

        // Mark DELETING
        await supabase
          .from('media_assets')
          .update({ status: 'DELETING', updated_at: new Date().toISOString() })
          .eq('id', mediaId);
      }
    }

    // Purge from cloud storage
    const storageService = getStorageService();
    if (storageKey) {
      // Delete the entire media prefix to remove source, proxy, thumbnails, audio
      const mediaPrefix = storageKey.substring(0, storageKey.indexOf('/source/'));
      if (mediaPrefix) {
        await storageService.deletePrefix(mediaPrefix);
      } else {
        await storageService.deleteObject(storageKey);
      }
    }

    if (isSupabaseConfigured()) {
      await supabase.from('media_assets').delete().eq('id', mediaId);
    }

    return NextResponse.json({
      success: true,
      deletedMediaId: mediaId,
    });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
