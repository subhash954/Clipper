/**
 * CLIPPER ANALYTICS API — SYNC PLATFORM METRICS
 * POST /api/analytics/sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncPublicationPerformance } from '@/lib/analytics/performanceStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publicationId, workspaceId = 'default-workspace', mockPayloadOverride } = body;

    if (!publicationId) {
      return NextResponse.json({ error: 'Missing publicationId.' }, { status: 400 });
    }

    const result = await syncPublicationPerformance(
      publicationId,
      workspaceId,
      mockPayloadOverride
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
