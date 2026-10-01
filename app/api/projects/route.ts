import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { getSavedProjects, saveProject } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const storage = getStorage();
      const project = await storage.getProject(id);
      if (!project) {
        return NextResponse.json({ error: `Project ${id} not found` }, { status: 404 });
      }
      return NextResponse.json({ success: true, project });
    }

    const projects = await getSavedProjects();
    return NextResponse.json({ success: true, count: projects.length, projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await saveProject(body);
    return NextResponse.json({ success: true, project: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
