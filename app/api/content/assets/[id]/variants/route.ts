import { NextRequest, NextResponse } from 'next/server';
import { getContentAssetById, getOpportunitiesForProject } from '@/lib/factory/contentStore';
import { generateAssetVariants } from '@/lib/factory/adaptationEngine';
import { generateHooksForOpportunity } from '@/lib/factory/hookFactory';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await getContentAssetById(id);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const opps = await getOpportunitiesForProject(asset.projectId);
    const opp = opps.find((o) => o.id === asset.opportunityId);
    if (!opp) {
      return NextResponse.json({ error: 'Source opportunity not found' }, { status: 404 });
    }

    const hooks = generateHooksForOpportunity(opp);
    const variants = generateAssetVariants(asset, hooks);

    return NextResponse.json({
      success: true,
      variantsCount: variants.length,
      variants,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate variants' }, { status: 500 });
  }
}
