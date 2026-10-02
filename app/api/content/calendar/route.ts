import { NextRequest, NextResponse } from 'next/server';
import { getCalendarItems, scheduleContentItem } from '@/lib/factory/contentStore';
import { ContentCalendarItem } from '@/lib/factory/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;

    const items = await getCalendarItems(projectId);
    return NextResponse.json({ success: true, count: items.length, items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch calendar' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assetId, projectId, platform, scheduledAt, campaign, pillar, notes } = body;

    if (!assetId || !projectId || !platform || !scheduledAt) {
      return NextResponse.json({ error: 'Missing required schedule fields' }, { status: 400 });
    }

    const item: ContentCalendarItem = {
      id: `cal-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`,
      assetId,
      projectId,
      platform,
      scheduledAt,
      status: 'scheduled',
      campaign,
      pillar,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await scheduleContentItem(item);
    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to schedule item' }, { status: 500 });
  }
}
