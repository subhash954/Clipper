import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { EditingService } from '@/lib/editor/editingService';
import { formatErrorResponse } from '@/lib/errors';

function isValidFiniteNumber(val: any, min?: number, max?: number): val is number {
  if (typeof val !== 'number') return false;
  if (!Number.isFinite(val)) return false;
  if (Number.isNaN(val)) return false;
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
}

function isValidExpectedVersion(val: any): val is number {
  return typeof val === 'number' && Number.isFinite(val) && Number.isInteger(val) && val >= 1;
}

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

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    if (!isValidExpectedVersion(expectedVersion)) {
      return NextResponse.json(
        { error: 'Missing or invalid expectedVersion: must be a finite integer >= 1' },
        { status: 400 }
      );
    }

    await requireProjectAccess(user, projectId, 'editor');

    if (action === 'split') {
      const { itemId, splitTime } = body;
      if (!itemId || typeof itemId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 });
      }
      if (!isValidFiniteNumber(splitTime, 0)) {
        return NextResponse.json({ error: 'Invalid splitTime: must be a non-negative finite number' }, { status: 400 });
      }
      const result = await EditingService.splitItem({
        projectId,
        userId: user.id,
        itemId,
        splitTime,
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'trim') {
      const { itemId, newTimelineStart, newTimelineEnd } = body;
      if (!itemId || typeof itemId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 });
      }
      if (!isValidFiniteNumber(newTimelineStart, 0) || !isValidFiniteNumber(newTimelineEnd, 0) || newTimelineEnd <= newTimelineStart) {
        return NextResponse.json(
          { error: 'Invalid trim bounds: newTimelineStart and newTimelineEnd must be non-negative finite numbers with end > start' },
          { status: 400 }
        );
      }
      const result = await EditingService.trimItem({
        projectId,
        userId: user.id,
        itemId,
        newTimelineStart,
        newTimelineEnd,
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'delete_item') {
      const { itemId, ripple = true } = body;
      if (!itemId || typeof itemId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 });
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
      if (!trackId || typeof trackId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid trackId' }, { status: 400 });
      }
      if (!isValidFiniteNumber(startTime, 0) || !isValidFiniteNumber(endTime, 0) || endTime <= startTime) {
        return NextResponse.json(
          { error: 'Invalid range: startTime and endTime must be non-negative finite numbers with endTime > startTime' },
          { status: 400 }
        );
      }
      const result = await EditingService.deleteRange({
        projectId,
        userId: user.id,
        trackId,
        startTime,
        endTime,
        ripple: Boolean(ripple),
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'move_item') {
      const { itemId, newTimelineStart, targetTrackId } = body;
      if (!itemId || typeof itemId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 });
      }
      if (!isValidFiniteNumber(newTimelineStart, 0)) {
        return NextResponse.json({ error: 'Invalid newTimelineStart: must be a non-negative finite number' }, { status: 400 });
      }
      const result = await EditingService.moveItem({
        projectId,
        userId: user.id,
        itemId,
        newTimelineStart,
        targetTrackId: typeof targetTrackId === 'string' ? targetTrackId : undefined,
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'set_speed') {
      const { itemId, speed } = body;
      if (!itemId || typeof itemId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 });
      }
      if (!isValidFiniteNumber(speed) || speed <= 0) {
        return NextResponse.json({ error: 'Invalid speed: must be a strictly positive finite number' }, { status: 400 });
      }
      const result = await EditingService.setSpeed({
        projectId,
        userId: user.id,
        itemId,
        speed,
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'set_enabled') {
      const { itemId, enabled } = body;
      if (!itemId || typeof itemId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 });
      }
      if (typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'Missing or invalid enabled: must be boolean' }, { status: 400 });
      }
      const result = await EditingService.setEnabled({
        projectId,
        userId: user.id,
        itemId,
        enabled,
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'sync_words') {
      const { wordStart, wordEnd, wordAction, trackId } = body;
      if (!isValidFiniteNumber(wordStart, 0) || !isValidFiniteNumber(wordEnd, 0) || wordEnd <= wordStart) {
        return NextResponse.json(
          { error: 'Invalid word range: wordStart and wordEnd must be finite numbers with wordEnd > wordStart' },
          { status: 400 }
        );
      }
      if (!wordAction || !['split_at_start', 'split_at_end', 'cut_word'].includes(wordAction)) {
        return NextResponse.json({ error: 'Invalid wordAction' }, { status: 400 });
      }
      const result = await EditingService.syncFromTranscriptWords({
        projectId,
        userId: user.id,
        wordStart,
        wordEnd,
        action: wordAction,
        trackId: typeof trackId === 'string' ? trackId : undefined,
        expectedVersion,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'undo') {
      const timeline = await EditingService.undo(projectId, user.id, expectedVersion);
      return NextResponse.json({ success: true, timeline });
    }

    if (action === 'redo') {
      const timeline = await EditingService.redo(projectId, user.id, expectedVersion);
      return NextResponse.json({ success: true, timeline });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
