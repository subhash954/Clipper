import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, requireProjectAccess, AuthError } from '@/lib/auth/serverAuth';
import { getStorage } from '@/lib/storage';
import { analyzeVideoMultimodal } from '@/lib/intelligence/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, skipCache = false } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId.' }, { status: 400 });
    }

    // Tenant authorization check
    await requireProjectAccess(user, projectId, 'editor');

    const storage = getStorage();
    const project = await storage.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    if (!project.transcript || !project.transcript.words || project.transcript.words.length === 0) {
      return NextResponse.json(
        { error: 'Project does not have a transcript yet. Please run ingestion/transcription first.' },
        { status: 400 }
      );
    }

    // Determine media file path if stored locally
    let mediaFilePath: string | undefined = undefined;
    if (project.sourceUrl && project.sourceUrl.startsWith('/uploads/')) {
      mediaFilePath = `${process.cwd()}/public${project.sourceUrl}`;
    }

    const report = await analyzeVideoMultimodal({
      projectId: project.id,
      videoTitle: project.title,
      mediaFilePath,
      durationSeconds: project.durationSeconds || 60,
      words: project.transcript.words,
      channelName: project.channelName,
      skipCache,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Multimodal intelligence error:', err);
    return NextResponse.json({ error: err.message || 'Internal intelligence error' }, { status: 500 });
  }
}
