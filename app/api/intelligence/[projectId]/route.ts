import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, requireProjectAccess, AuthError } from '@/lib/auth/serverAuth';
import { getStorage } from '@/lib/storage';
import { analyzeVideoMultimodal } from '@/lib/intelligence/orchestrator';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId, 'viewer');

    const storage = getStorage();
    const project = await storage.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    if (!project.transcript || !project.transcript.words) {
      return NextResponse.json({ error: 'Project has no transcript.' }, { status: 400 });
    }

    const report = await analyzeVideoMultimodal({
      projectId: project.id,
      videoTitle: project.title,
      durationSeconds: project.durationSeconds || 60,
      words: project.transcript.words,
      channelName: project.channelName,
    });

    return NextResponse.json({ report });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
