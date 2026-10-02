import { NextRequest, NextResponse } from 'next/server';
import { getOpportunitiesForProject, saveContentAsset } from '@/lib/factory/contentStore';
import { adaptOpportunityToPlatform } from '@/lib/factory/adaptationEngine';
import { auditContentAsset } from '@/lib/factory/qualityGates';
import { sampleTranscriptWords } from '@/lib/sampleData';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;
    const body = await req.json();
    const {
      projectId,
      platform = 'youtube_shorts',
      aspectRatio,
      targetDurationSeconds,
      captionStyle,
      brollDensity,
      audioMode,
      words,
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const opps = await getOpportunitiesForProject(projectId);
    const opportunity = opps.find((o) => o.id === opportunityId);
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const sourceWords = (words && words.length > 0) ? words : sampleTranscriptWords;

    const { asset, durationOptimized, needsLongerFormat } = adaptOpportunityToPlatform(opportunity, {
      platform,
      aspectRatio,
      targetDurationSeconds,
      captionStyle,
      brollDensity,
      audioMode,
      sourceWords,
    });

    // Run Quality Gates Audit
    const audit = auditContentAsset(asset);
    asset.qualityAudit = audit;
    if (!audit.passed) {
      asset.status = 'NEEDS_REVIEW';
    } else {
      asset.status = 'READY';
    }

    // Persist generated asset
    await saveContentAsset(asset);

    return NextResponse.json({
      success: true,
      asset,
      durationOptimized,
      needsLongerFormat,
      audit,
    });
  } catch (err: any) {
    console.error('Asset generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
