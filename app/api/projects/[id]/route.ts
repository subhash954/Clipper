import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { getStorageService } from '@/lib/storage/storageService';
import { getAuthenticatedUser, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse, ClipperError } from '@/lib/errors';
import { isValidProjectTransition, Project, ProjectStatus } from '@/lib/types';
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

    const { id } = await params;
    const project = await requireProjectAccess(user, id, 'viewer');

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
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

    const { id } = await params;
    const existing = await requireProjectAccess(user, id, 'editor');
    const body = await req.json();
    const storage = getStorage();

    // 1. Validate status transitions if requested
    if (body.status && body.status !== existing.status) {
      if (!isValidProjectTransition(existing.status, body.status as ProjectStatus)) {
        throw new ClipperError(
          'INVALID_PROJECT_STATE',
          `Invalid project status transition from '${existing.status}' to '${body.status}'.`,
          400,
          false,
          { fromStatus: existing.status, toStatus: body.status }
        );
      }
    }

    // 2. Validate media asset ownership if attaching activeMediaId
    if (body.activeMediaId && body.activeMediaId !== existing.activeMediaId && isSupabaseConfigured()) {
      try {
        const { data: mediaRow } = await supabase
          .from('media_assets')
          .select('id, user_id')
          .eq('id', body.activeMediaId)
          .maybeSingle();

        if (mediaRow && mediaRow.user_id !== user.id && user.role !== 'admin') {
          throw new ClipperError(
            'MEDIA_NOT_OWNED',
            `Cannot link media asset ${body.activeMediaId} belonging to another user.`,
            403
          );
        }
      } catch (mediaErr: any) {
        if (mediaErr instanceof ClipperError) throw mediaErr;
        // Non-blocking query failure
      }
    }

    // 3. Assemble merged project
    const updated: Project = {
      ...existing,
      title: body.title !== undefined ? body.title : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      channelName: body.channelName !== undefined ? body.channelName : existing.channelName,
      thumbnailUrl: body.thumbnailUrl !== undefined ? body.thumbnailUrl : existing.thumbnailUrl,
      sourceUrl: body.sourceUrl !== undefined ? body.sourceUrl : existing.sourceUrl,
      sourceType: body.sourceType !== undefined ? body.sourceType : existing.sourceType,
      workflowType: body.workflowType !== undefined ? body.workflowType : existing.workflowType,
      durationSeconds: body.durationSeconds !== undefined ? body.durationSeconds : existing.durationSeconds,
      status: (body.status as ProjectStatus) || existing.status,
      errorMessage: body.errorMessage !== undefined ? body.errorMessage : existing.errorMessage,
      activeMediaId: body.activeMediaId !== undefined ? body.activeMediaId : existing.activeMediaId,
      activeVersionId: body.activeVersionId !== undefined ? body.activeVersionId : existing.activeVersionId,
      isMediaAvailable: body.isMediaAvailable !== undefined ? body.isMediaAvailable : existing.isMediaAvailable,
      clips: body.clips !== undefined ? body.clips : existing.clips,
      clipsCount: body.clips !== undefined ? body.clips.length : existing.clipsCount,
      transcript: body.transcript !== undefined ? body.transcript : existing.transcript,
      costs: body.costs !== undefined ? body.costs : existing.costs,
      updatedAt: new Date().toISOString(),
    };

    // 4. Save with Optimistic Concurrency Control (expectedVersion)
    const saved = await storage.saveProject(updated, body.expectedVersion);
    return NextResponse.json({ success: true, project: saved });
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

    const { id } = await params;
    await requireProjectAccess(user, id, 'owner');

    const storageService = getStorageService();
    try {
      const projectPrefix = `users/${user.id}/projects/${id}/`;
      await storageService.deletePrefix(projectPrefix);
    } catch {
      // Non-fatal if storage prefix was already empty
    }

    const storage = getStorage();
    const deleted = await storage.deleteProject(id, user.id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
