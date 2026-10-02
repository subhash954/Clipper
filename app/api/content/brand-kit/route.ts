import { NextRequest, NextResponse } from 'next/server';
import { getBrandKit, saveBrandKit } from '@/lib/factory/contentStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default-workspace';
    const brandKit = await getBrandKit(workspaceId);
    return NextResponse.json({ success: true, brandKit });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch brand kit' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.brandKit) {
      return NextResponse.json({ error: 'Missing brandKit payload' }, { status: 400 });
    }
    await saveBrandKit(body.brandKit);
    return NextResponse.json({ success: true, brandKit: body.brandKit });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save brand kit' }, { status: 500 });
  }
}
