import { NextRequest, NextResponse } from 'next/server';
import { getSavedProjects, saveProject } from '@/lib/db';

export async function GET() {
  try {
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
