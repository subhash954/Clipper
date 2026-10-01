import { NextRequest, NextResponse } from 'next/server';
import { getStorage, ensureValidUuid } from '@/lib/storage';
import { Project } from '@/lib/types';
import { getAuthenticatedUser, requireProjectAccess, AuthError } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const storage = getStorage();

    if (id) {
      try {
        await requireProjectAccess(user, id, 'viewer');
      } catch (authErr: any) {
        return NextResponse.json({ error: authErr.message }, { status: authErr.statusCode || 403 });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return NextResponse.json({ error: `Project ${id} not found` }, { status: 404 });
      }
      return NextResponse.json({ success: true, project });
    }

    const allProjects = await storage.listProjects();
    // Enforce tenant isolation: users only see their own projects (admins see all)
    const userProjects = allProjects.filter((p) => {
      if (user.role === 'admin') return true;
      if (user.isDevUser) return true;
      return p.userId === user.id;
    });

    return NextResponse.json({ success: true, count: userProjects.length, projects: userProjects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const storage = getStorage();

    const targetId = ensureValidUuid(body.id);

    // If updating an existing project, verify ownership
    if (body.id) {
      const existing = await storage.getProject(targetId);
      if (existing) {
        try {
          await requireProjectAccess(user, targetId, 'editor');
        } catch (authErr: any) {
          return NextResponse.json({ error: authErr.message }, { status: authErr.statusCode || 403 });
        }
      }
    }

    const project: Project = {
      id: targetId,
      userId: user.id,
      workspaceId: user.workspaceId,
      sourceExternalId: body.sourceExternalId || undefined,
      title: body.title || body.videoTitle || 'Untitled Video',
      channelName: body.channelName || 'Clipper Creator',
      thumbnailUrl: body.thumbnailUrl || '',
      sourceUrl: body.sourceUrl || body.youtubeUrl || body.videoUrl || '',
      sourceType: body.sourceType || 'youtube',
      workflowType: body.workflowType || 'youtube_to_shorts',
      durationSeconds: body.durationSeconds || ((body.durationMinutes || 0) * 60) || 60,
      status: body.status || 'completed',
      clipsCount: body.clips?.length || body.clipsCount || 0,
      clips: (body.clips || []).map((c: any) => ({
        ...c,
        id: ensureValidUuid(c.id),
      })),
      transcript: body.transcript || (body.words ? { text: '', words: body.words, source: 'user_upload' } : undefined),
      costs: body.costs,
      isMediaAvailable: body.isMediaAvailable ?? true,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveProject(project);
    return NextResponse.json({ success: true, project: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    try {
      await requireProjectAccess(user, id, 'owner');
    } catch (authErr: any) {
      return NextResponse.json({ error: authErr.message }, { status: authErr.statusCode || 403 });
    }

    const storage = getStorage();
    const deleted = await storage.deleteProject(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
