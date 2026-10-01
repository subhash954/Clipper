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
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { projectId } = await context.params;
    await requireProjectAccess(user, projectId, 'viewer');

    const storage = getStorage();
    const project = await storage.getProject(projectId);
    if (!project || !project.transcript?.words) {
      return NextResponse.json({ error: 'Project or transcript missing.' }, { status: 404 });
    }

    const report = await analyzeVideoMultimodal({
      projectId: project.id,
      videoTitle: project.title,
      durationSeconds: project.durationSeconds || 60,
      words: project.transcript.words,
    });

    return NextResponse.json({
      speakers: report.speakers,
      dialogueExchanges: report.dialogueExchanges,
      activeSpeakers: report.activeSpeakers,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
