import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getStorage } from '@/lib/storage';
import { Project } from '@/lib/types';
import { ClipperError } from '@/lib/errors';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  workspaceId?: string;
  isDevUser?: boolean;
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AuthError';
  }
}

// Canonical deterministic development UUID (RFC 4122 compliant)
export const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
export const DEV_WORKSPACE_ID = '00000000-0000-0000-0000-000000000002';

/**
 * Extracts and verifies the authenticated user from the request session.
 * Derives identity strictly from server-verified tokens or server sessions.
 * Never trusts body.userId, query.userId, or client-supplied ownership.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 1. If Supabase is configured and token is present, verify via Supabase Auth
  if (isSupabaseConfigured() && token) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return null;
      }

      // Query profile role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      return {
        id: user.id,
        email: user.email || 'user@clipper.ai',
        role: profile?.role || 'owner',
        workspaceId: user.id,
      };
    } catch (err) {
      console.error('Server auth verification error:', err);
      return null;
    }
  }

  // 2. In development or test environments, allow isolated developer session
  const isDevOrTest = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_LOCAL_STORAGE === 'true';
  if (isDevOrTest) {
    // If client passes a test authorization token e.g. "Bearer test-user-uuid"
    if (token && token.startsWith('test-user-')) {
      return {
        id: token.replace('Bearer ', ''),
        email: 'test@clipper.ai',
        role: 'owner',
        workspaceId: token.replace('Bearer ', ''),
        isDevUser: true,
      };
    }

    // Default development user
    return {
      id: DEV_USER_ID,
      email: 'creator@clipper.ai',
      role: 'owner',
      workspaceId: DEV_WORKSPACE_ID,
      isDevUser: true,
    };
  }

  // 3. In production, unauthenticated requests FAIL CLOSED
  return null;
}

/**
 * Enforces authentication on API routes.
 * Returns the AuthenticatedUser or throws AuthError (yielding HTTP 401).
 */
export async function requireAuth(req: NextRequest): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    throw new AuthError('Authentication required. Missing or invalid session token.', 401);
  }
  return user;
}

/**
 * Enforces strict tenant isolation and project ownership.
 * Checks that the authenticated user owns or has access to the specified project.
 */
export async function requireProjectAccess(
  user: AuthenticatedUser,
  projectId: string,
  minRole: 'viewer' | 'editor' | 'admin' | 'owner' = 'viewer'
): Promise<Project> {
  const storage = getStorage();
  const project = await storage.getProject(projectId);

  if (!project || project.deletedAt) {
    throw new AuthError(`Project not found: ${projectId}`, 404);
  }

  // Admin users have global audit access
  if (user.role === 'admin') {
    return project;
  }

  // Role hierarchy enforcement: viewer (1) < editor (2) < owner (3) < admin (4)
  const ROLE_HIERARCHY: Record<string, number> = {
    viewer: 1,
    editor: 2,
    owner: 3,
    admin: 4,
  };

  const userLevel = ROLE_HIERARCHY[user.role] ?? 1;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 1;

  if (userLevel < requiredLevel) {
    throw new AuthError(`Forbidden: Role '${user.role}' does not satisfy required role '${minRole}'.`, 403);
  }

  // Strict tenant ownership check
  const effectiveOwner = project.userId || (user.isDevUser ? DEV_USER_ID : null);
  if (effectiveOwner === user.id) {
    return project;
  }

  // Legitimate workspace editor / collaborator check
  if (project.workspaceId && isSupabaseConfigured()) {
    const { data: member } = await supabase
      .from('organization_members')
      .select('role, status')
      .eq('workspace_id', project.workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (member) {
      const memberRole = member.role.toLowerCase();
      const memberLevel = ROLE_HIERARCHY[memberRole] ?? 1;
      if (memberLevel >= requiredLevel) {
        return project;
      }
    }
  }

  throw new AuthError('Forbidden: You do not have permission to access this project.', 403);
}

/**
 * Enforces that a media asset exists and is owned by the authenticated user (or user is admin).
 * Throws ClipperError with 404 if missing, or 403 MEDIA_NOT_OWNED if owned by another user.
 */
export async function requireMediaOwnership(
  user: AuthenticatedUser,
  mediaId: string
): Promise<{ id: string; userId: string }> {
  if (!mediaId) {
    throw new ClipperError('VALIDATION_ERROR', 'Media ID is required.', 400);
  }

  // 1. If Supabase is configured, check PostgreSQL media_assets table
  if (isSupabaseConfigured()) {
    const { data: mediaRow, error } = await supabase
      .from('media_assets')
      .select('id, user_id')
      .eq('id', mediaId)
      .maybeSingle();

    if (error || !mediaRow) {
      throw new ClipperError('NOT_FOUND', `Media asset ${mediaId} not found.`, 404);
    }

    if (user.role !== 'admin' && mediaRow.user_id !== user.id) {
      throw new ClipperError(
        'MEDIA_NOT_OWNED',
        `Cannot link media asset ${mediaId} belonging to another user.`,
        403
      );
    }

    return { id: mediaRow.id, userId: mediaRow.user_id };
  }

  // 2. In local/development storage, check data/media_assets.json
  const mediaFile = path.join(process.cwd(), 'data', 'media_assets.json');
  let list: any[] = [];
  if (fs.existsSync(mediaFile)) {
    try {
      list = JSON.parse(fs.readFileSync(mediaFile, 'utf-8'));
    } catch {
      list = [];
    }
  }

  const asset = list.find((m: any) => m.id === mediaId);
  if (asset) {
    const ownerId = asset.user_id || asset.userId;
    if (user.role !== 'admin' && ownerId && ownerId !== user.id) {
      throw new ClipperError(
        'MEDIA_NOT_OWNED',
        `Cannot link media asset ${mediaId} belonging to another user.`,
        403
      );
    }
    return { id: asset.id, userId: ownerId || user.id };
  }

  // If local media file exists and has records, but asset is not found
  if (process.env.NODE_ENV === 'production') {
    throw new ClipperError('NOT_FOUND', `Media asset ${mediaId} not found.`, 404);
  }

  return { id: mediaId, userId: user.id };
}

