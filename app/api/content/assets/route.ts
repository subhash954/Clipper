import { NextRequest, NextResponse } from 'next/server';
import { searchContentLibrary, saveContentAsset } from '@/lib/factory/contentStore';
import { ContentLibraryFilter } from '@/lib/factory/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter: ContentLibraryFilter = {
      projectId: searchParams.get('projectId') || undefined,
      platform: (searchParams.get('platform') as any) || undefined,
      contentType: (searchParams.get('contentType') as any) || undefined,
      status: (searchParams.get('status') as any) || undefined,
      query: searchParams.get('query') || undefined,
      minScore: searchParams.get('minScore') ? parseFloat(searchParams.get('minScore')!) : undefined,
      maxDuration: searchParams.get('maxDuration') ? parseFloat(searchParams.get('maxDuration')!) : undefined,
    };

    const assets = await searchContentLibrary(filter);
    return NextResponse.json({ success: true, count: assets.length, assets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to search assets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.asset || !body.asset.id) {
      return NextResponse.json({ error: 'Invalid asset payload' }, { status: 400 });
    }

    await saveContentAsset(body.asset);
    return NextResponse.json({ success: true, asset: body.asset });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save asset' }, { status: 500 });
  }
}
