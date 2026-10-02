/**
 * CLIPPER ANALYTICS API — LEARNED INSIGHTS & RECOMMENDATIONS
 * GET /api/analytics/insights
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  computeLearnedWeights,
  calibrateEditorialPredictions,
} from '@/lib/analytics/learningEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default-workspace';

    const [learnedWeights, calibrations] = await Promise.all([
      computeLearnedWeights(workspaceId),
      calibrateEditorialPredictions(workspaceId),
    ]);

    return NextResponse.json({
      learnedWeights,
      calibrations,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
