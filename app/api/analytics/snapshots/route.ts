/**
 * CLIPPER ANALYTICS API — PERFORMANCE SNAPSHOTS
 * GET /api/analytics/snapshots
 * POST /api/analytics/snapshots
 */

import { NextRequest, NextResponse } from 'next/server';
import { listSnapshots, recordSnapshot } from '@/lib/analytics/performanceStore';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || 'default-workspace';
  const publicationId = searchParams.get('publicationId') || undefined;
  const assetId = searchParams.get('assetId') || undefined;
  const platform = searchParams.get('platform') || undefined;

  const snapshots = listSnapshots(workspaceId, {
    publicationId,
    assetId,
    platform,
  });

  return NextResponse.json({ snapshots, count: snapshots.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId = 'default-workspace',
      publicationId,
      assetId,
      opportunityId,
      projectId = 'default-project',
      platform,
      views,
      likes,
      comments,
      shares,
      saves,
      watchTimeSeconds,
      averageViewDurationSeconds,
      completionRate,
      externalMetrics,
    } = body;

    if (!publicationId || !assetId || !platform || typeof views !== 'number') {
      return NextResponse.json(
        { error: 'Missing required snapshot fields (publicationId, assetId, platform, views).' },
        { status: 400 }
      );
    }

    const snapshot = recordSnapshot({
      workspaceId,
      publicationId,
      assetId,
      opportunityId,
      projectId,
      platform,
      capturedAt: new Date().toISOString(),
      views,
      likes: likes || 0,
      comments: comments || 0,
      shares: shares || 0,
      saves: saves || 0,
      watchTimeSeconds: watchTimeSeconds || 0,
      averageViewDurationSeconds: averageViewDurationSeconds || 0,
      completionRate,
      externalMetrics: externalMetrics || {},
    });

    return NextResponse.json({ success: true, snapshot });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
