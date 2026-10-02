import { NextRequest, NextResponse } from 'next/server';
import { getOpportunitiesForProject } from '@/lib/factory/contentStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const opportunities = await getOpportunitiesForProject(projectId);
    return NextResponse.json({ success: true, opportunities });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch opportunities' }, { status: 500 });
  }
}
