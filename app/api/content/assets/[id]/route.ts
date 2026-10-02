import { NextRequest, NextResponse } from 'next/server';
import { getContentAssetById, saveContentAsset, getOpportunitiesForProject } from '@/lib/factory/contentStore';
import { partiallyRegenerateAsset } from '@/lib/factory/batchService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await getContentAssetById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, asset });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch asset' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await getContentAssetById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const body = await req.json();

    // 1. Partial regeneration request
    if (body.regenerateFields && Array.isArray(body.regenerateFields)) {
      const opps = await getOpportunitiesForProject(asset.projectId);
      const opp = opps.find((o) => o.id === asset.opportunityId);
      if (!opp) {
        return NextResponse.json({ error: 'Source opportunity not found' }, { status: 404 });
      }

      const updated = partiallyRegenerateAsset(asset, body.regenerateFields, opp);
      await saveContentAsset(updated);
      return NextResponse.json({ success: true, asset: updated });
    }

    // 2. Direct field updates or locking
    const updated = {
      ...asset,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    await saveContentAsset(updated);
    return NextResponse.json({ success: true, asset: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update asset' }, { status: 500 });
  }
}
