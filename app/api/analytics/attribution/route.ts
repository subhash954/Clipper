/**
 * CLIPPER ANALYTICS API — CREATIVE ATTRIBUTION & LEADERBOARDS
 * GET /api/analytics/attribution
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildAttributionGraph,
  getHookCategoryLeaderboard,
  getDurationLeaderboard,
} from '@/lib/analytics/attributionGraph';
import { SupportedPlatform } from '@/lib/factory/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default-workspace';
    const platform = searchParams.get('platform') as SupportedPlatform | undefined;

    const [attributions, hookLeaderboard, durationLeaderboard] = await Promise.all([
      buildAttributionGraph(workspaceId),
      getHookCategoryLeaderboard(workspaceId),
      getDurationLeaderboard(workspaceId, platform),
    ]);

    return NextResponse.json({
      attributions,
      hookLeaderboard,
      durationLeaderboard,
      count: attributions.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
