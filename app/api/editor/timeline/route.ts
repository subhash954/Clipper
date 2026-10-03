import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { EditingService } from '@/lib/editor/editingService';
import { formatErrorResponse, ClipperError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'viewer');
    const timeline = await EditingService.getOrCreateTimeline(projectId, user.id);

    return NextResponse.json({
      success: true,
      timeline,
    });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { action, projectId, expectedVersion } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }
    if (expectedVersion === undefined || typeof expectedVersion !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid expectedVersion (must be integer for optimistic locking)' },
        { status: 400 }
      );
    }

    await requireProjectAccess(user, projectId, 'editor');

    if (action === 'split') {
      const { itemId, splitTime } = body;
      if (!itemId || splitTime === undefined) {
        return NextResponse.json({ error: 'Missing itemId or splitTime' }, { status: 400 });
      }
      const result = await EditingService.splitItem({
        projectId,
        userId: user.id,
        itemId,
        splitTime: Number(splitTime),
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'trim') {
      const { itemId, newTimelineStart, newTimelineEnd } = body;
      if (!itemId || newTimelineStart === undefined || newTimelineEnd === undefined) {
        return NextResponse.json({ error: 'Missing itemId, newTimelineStart, or newTimelineEnd' }, { status: 400 });
      }
      const result = await EditingService.trimItem({
        projectId,
        userId: user.id,
        itemId,
        newTimelineStart: Number(newTimelineStart),
        newTimelineEnd: Number(newTimelineEnd),
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'delete_item') {
      const { itemId, ripple = true } = body;
      if (!itemId) {
        return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
      }
      const result = await EditingService.deleteItem({
        projectId,
        userId: user.id,
        itemId,
        ripple: Boolean(ripple),
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'delete_range') {
      const { trackId, startTime, endTime, ripple = true } = body;
      if (!trackId || startTime === undefined || endTime === undefined) {
        return NextResponse.json({ error: 'Missing trackId, startTime, or endTime' }, { status: 400 });
      }
      const result = await EditingService.deleteRange({
        projectId,
        userId: user.id,
        trackId,
        startTime: Number(startTime),
        endTime: Number(endTime),
        ripple: Boolean(ripple),
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'move_item') {
      const { itemId, newTimelineStart, targetTrackId } = body;
      if (!itemId || newTimelineStart === undefined) {
        return NextResponse.json({ error: 'Missing itemId or newTimelineStart' }, { status: 400 });
      }
      const result = await EditingService.moveItem({
        projectId,
        userId: user.id,
        itemId,
        newTimelineStart: Number(newTimelineStart),
        targetTrackId,
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'set_speed') {
      const { itemId, speed } = body;
      if (!itemId || speed === undefined) {
        return NextResponse.json({ error: 'Missing itemId or speed' }, { status: 400 });
      }
      const result = await EditingService.setSpeed({
        projectId,
        userId: user.id,
        itemId,
        speed: Number(speed),
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'set_enabled') {
      const { itemId, enabled } = body;
      if (!itemId || enabled === undefined) {
        return NextResponse.json({ error: 'Missing itemId or enabled' }, { status: 400 });
      }
      const result = await EditingService.setEnabled({
        projectId,
        userId: user.id,
        itemId,
        enabled: Boolean(enabled),
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'sync_words') {
      const { wordStart, wordEnd, wordAction } = body;
      if (wordStart === undefined || wordEnd === undefined || !wordAction) {
        return NextResponse.json({ error: 'Missing wordStart, wordEnd, or wordAction' }, { status: 400 });
      }
      const result = await EditingService.syncFromTranscriptWords({
        projectId,
        userId: user.id,
        wordStart: Number(wordStart),
        wordEnd: Number(wordEnd),
        action: wordAction,
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'undo') {
      const timeline = await EditingService.undo(projectId, user.id, expectedVersion);
      return NextResponse.json({ success: true, timeline });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
