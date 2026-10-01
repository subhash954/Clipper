import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { Project } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const storage = getStorage();

    if (id) {
      const project = await storage.getProject(id);
      if (!project) {
        return NextResponse.json({ error: `Project ${id} not found` }, { status: 404 });
      }
      return NextResponse.json({ success: true, project });
    }

    const projects = await storage.listProjects();
    return NextResponse.json({ success: true, count: projects.length, projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storage = getStorage();

    const project: Project = {
      id: body.id || `proj-${Date.now()}`,
      title: body.title || body.videoTitle || 'Untitled Video',
      channelName: body.channelName || 'Clipper Creator',
      thumbnailUrl: body.thumbnailUrl || '',
      sourceUrl: body.sourceUrl || body.youtubeUrl || body.videoUrl || '',
      sourceType: body.sourceType || 'youtube',
      workflowType: body.workflowType || 'youtube_to_shorts',
      durationSeconds: body.durationSeconds || ((body.durationMinutes || 0) * 60) || 60,
      status: body.status || 'completed',
      clipsCount: body.clips?.length || body.clipsCount || 0,
      clips: body.clips || [],
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    const storage = getStorage();
    const deleted = await storage.deleteProject(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
