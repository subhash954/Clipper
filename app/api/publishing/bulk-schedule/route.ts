/**
 * CLIPPER PUBLISHING API — BULK SCHEDULER
 * POST /api/publishing/bulk-schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  previewBulkSchedule,
  executeBulkSchedule,
} from '@/lib/publishing/scheduleService';
import { BulkScheduleConfig } from '@/lib/publishing/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { config, dryRun = false }: { config: BulkScheduleConfig; dryRun?: boolean } = body;

    if (!config || !config.assetIds || config.assetIds.length === 0 || !config.connectionId) {
      return NextResponse.json(
        { error: 'Missing required bulk schedule config (assetIds, connectionId, platform).' },
        { status: 400 }
      );
    }

    if (dryRun) {
      const preview = previewBulkSchedule(config);
      return NextResponse.json({ preview, count: preview.length });
    }

    const result = await executeBulkSchedule(config);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
