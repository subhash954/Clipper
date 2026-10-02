/**
 * CLIPPER PUBLISHING API — IN-APP NOTIFICATIONS
 * GET /api/publishing/notifications
 * PATCH /api/publishing/notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listInAppNotifications,
  markNotificationAsRead,
} from '@/lib/publishing/automationEngine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || 'default-workspace';
  const unreadOnly = searchParams.get('unread') === 'true';

  const notifications = listInAppNotifications(workspaceId, unreadOnly);
  return NextResponse.json({ notifications, count: notifications.length });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, workspaceId = 'default-workspace' } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing notification id.' }, { status: 400 });
    }

    const success = markNotificationAsRead(id, workspaceId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
