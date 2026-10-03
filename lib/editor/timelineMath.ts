/**
 * CANONICAL TIMELINE MATH MODULE
 * Authoritative, pure mathematical calculations for Clipper EDL & Non-Destructive Editing (Phase 5).
 * Zero UI dependencies. Exact millisecond/rational precision.
 */

import { TimelineItem, TimelineTrack } from './edlTypes';
import { ClipperError } from '../errors';

export const EPSILON = 0.001; // 1 millisecond tolerance

/**
 * Rounds a number to exactly 3 decimal places (millisecond resolution)
 * to avoid IEEE-754 floating-point drift.
 */
export function round3(val: number): number {
  if (!Number.isFinite(val)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Non-finite number encountered in timeline math: ${val}`, 400);
  }
  return Math.round(val * 1000) / 1000;
}

/**
 * Validates non-negative finite time value
 */
export function isValidTime(val: number): boolean {
  return Number.isFinite(val) && val >= 0;
}

/**
 * Validates positive finite speed value
 */
export function isValidSpeed(val: number): boolean {
  return Number.isFinite(val) && val > 0;
}

/**
 * Validates a time range where end > start
 */
export function isValidRange(start: number, end: number): boolean {
  return isValidTime(start) && isValidTime(end) && round3(end) > round3(start);
}

/**
 * Converts a timeline presentation time to source media time
 */
export function timelineTimeToSourceTime(timelineTime: number, item: TimelineItem): number {
  if (!isValidTime(timelineTime)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Invalid timeline time: ${timelineTime}`, 400);
  }
  if (!isValidSpeed(item.speed)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Invalid item speed: ${item.speed}`, 400);
  }

  const offset = timelineTime - item.timelineStart;
  const sourceTime = item.sourceStart + (offset * item.speed);
  const rounded = round3(sourceTime);
  return Math.max(item.sourceStart, Math.min(item.sourceEnd, rounded));
}

/**
 * Converts a source media time to timeline presentation time
 */
export function sourceTimeToTimelineTime(sourceTime: number, item: TimelineItem): number {
  if (!isValidTime(sourceTime)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Invalid source time: ${sourceTime}`, 400);
  }
  if (!isValidSpeed(item.speed)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Invalid item speed: ${item.speed}`, 400);
  }

  const offset = sourceTime - item.sourceStart;
  const timelineTime = item.timelineStart + (offset / item.speed);
  return round3(timelineTime);
}

/**
 * Calculates presentation duration from source range and speed
 */
export function calculatePresentationDuration(sourceStart: number, sourceEnd: number, speed: number = 1.0): number {
  if (!isValidRange(sourceStart, sourceEnd)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Invalid source range: [${sourceStart}, ${sourceEnd}]`, 400);
  }
  if (!isValidSpeed(speed)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Invalid playback speed: ${speed}`, 400);
  }
  return round3((sourceEnd - sourceStart) / speed);
}

/**
 * Splits a timeline item into two contiguous, non-overlapping items at a split point.
 * Preserves source media identity and timeline integrity.
 */
export function splitItem(
  item: TimelineItem,
  splitTimelineTime: number,
  newItemAId?: string,
  newItemBId?: string
): { itemA: TimelineItem; itemB: TimelineItem } {
  const tStart = round3(item.timelineStart);
  const tEnd = round3(item.timelineEnd);
  const splitT = round3(splitTimelineTime);

  // Split point must be strictly inside the item presentation bounds
  if (splitT <= tStart + EPSILON || splitT >= tEnd - EPSILON) {
    throw new ClipperError(
      'INVALID_SPLIT_POINT',
      `Split point ${splitT}s is outside valid interior bounds (${tStart}s, ${tEnd}s) for item ${item.id}`,
      400
    );
  }

  if (!isValidSpeed(item.speed)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Invalid speed ${item.speed}`, 400);
  }

  const timelineDurationA = round3(splitT - tStart);
  const sourceDurationA = round3(timelineDurationA * item.speed);
  const splitSource = round3(item.sourceStart + sourceDurationA);

  if (splitSource <= item.sourceStart + EPSILON || splitSource >= item.sourceEnd - EPSILON) {
    throw new ClipperError(
      'INVALID_SPLIT_POINT',
      `Calculated source split point ${splitSource}s is outside source bounds [${item.sourceStart}s, ${item.sourceEnd}s]`,
      400
    );
  }

  const now = new Date().toISOString();

  const itemA: TimelineItem = {
    ...item,
    id: newItemAId || crypto.randomUUID(),
    sourceStart: item.sourceStart,
    sourceEnd: splitSource,
    timelineStart: tStart,
    timelineEnd: splitT,
    updatedAt: now,
  };

  const itemB: TimelineItem = {
    ...item,
    id: newItemBId || crypto.randomUUID(),
    sourceStart: splitSource,
    sourceEnd: item.sourceEnd,
    timelineStart: splitT,
    timelineEnd: tEnd,
    updatedAt: now,
  };

  return { itemA, itemB };
}

/**
 * Trims a timeline item non-destructively to new in/out presentation points.
 * Calculates corresponding source start/end positions based on playback speed.
 */
export function trimItem(
  item: TimelineItem,
  newTimelineStart: number,
  newTimelineEnd: number,
  maxSourceDuration?: number
): TimelineItem {
  const startT = round3(newTimelineStart);
  const endT = round3(newTimelineEnd);

  if (!isValidRange(startT, endT)) {
    throw new ClipperError('INVALID_TRIM_RANGE', `Trim range must satisfy start >= 0 and end > start: [${startT}, ${endT}]`, 400);
  }
  if (!isValidSpeed(item.speed)) {
    throw new ClipperError('INVALID_TIMELINE_MATH', `Invalid speed ${item.speed}`, 400);
  }

  const startShift = round3((startT - item.timelineStart) * item.speed);
  const endShift = round3((endT - item.timelineEnd) * item.speed);

  const newSourceStart = round3(item.sourceStart + startShift);
  const newSourceEnd = round3(item.sourceEnd + endShift);

  if (newSourceStart < 0) {
    throw new ClipperError('INVALID_TRIM_BOUNDS', `New source start ${newSourceStart}s cannot be negative`, 400);
  }
  if (newSourceEnd <= newSourceStart) {
    throw new ClipperError('INVALID_TRIM_BOUNDS', `New source end ${newSourceEnd}s must be greater than source start ${newSourceStart}s`, 400);
  }
  if (maxSourceDuration !== undefined && newSourceEnd > round3(maxSourceDuration)) {
    throw new ClipperError(
      'INVALID_TRIM_BOUNDS',
      `New source end ${newSourceEnd}s exceeds source media duration ${maxSourceDuration}s`,
      400
    );
  }

  return {
    ...item,
    sourceStart: newSourceStart,
    sourceEnd: newSourceEnd,
    timelineStart: startT,
    timelineEnd: endT,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Compacts items on a track so that they are contiguous with zero gaps.
 * Item 0 starts at 0.0, Item 1 starts at Item 0's end, and so on.
 */
export function compactTrack(items: TimelineItem[]): TimelineItem[] {
  const sorted = [...items].sort((a, b) => a.timelineStart - b.timelineStart);
  let currentPos = 0.0;

  return sorted.map((item) => {
    const duration = round3(item.timelineEnd - item.timelineStart);
    const newStart = round3(currentPos);
    const newEnd = round3(currentPos + duration);
    currentPos = newEnd;

    return {
      ...item,
      timelineStart: newStart,
      timelineEnd: newEnd,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Excises a presentation range [rangeStart, rangeEnd] from a track.
 * If ripple = true, shifts subsequent items to the left by the excised duration.
 * If ripple = false, leaves a gap.
 */
export function deleteRangeFromTrack(
  items: TimelineItem[],
  rangeStart: number,
  rangeEnd: number,
  ripple: boolean = true
): TimelineItem[] {
  const rStart = round3(rangeStart);
  const rEnd = round3(rangeEnd);

  if (!isValidRange(rStart, rEnd)) {
    throw new ClipperError('INVALID_RANGE', `Delete range must satisfy start >= 0 and end > start: [${rStart}, ${rEnd}]`, 400);
  }

  const excisedDuration = round3(rEnd - rStart);
  const result: TimelineItem[] = [];

  for (const item of items) {
    const iStart = round3(item.timelineStart);
    const iEnd = round3(item.timelineEnd);

    // Case 1: Item is completely before delete range
    if (iEnd <= rStart + EPSILON) {
      result.push(item);
      continue;
    }

    // Case 2: Item is completely after delete range
    if (iStart >= rEnd - EPSILON) {
      if (ripple) {
        result.push({
          ...item,
          timelineStart: round3(iStart - excisedDuration),
          timelineEnd: round3(iEnd - excisedDuration),
          updatedAt: new Date().toISOString(),
        });
      } else {
        result.push(item);
      }
      continue;
    }

    // Case 3: Item is completely contained within delete range (dropped)
    if (iStart >= rStart - EPSILON && iEnd <= rEnd + EPSILON) {
      continue; // Dropped completely
    }

    // Case 4: Item spans across delete range entirely (needs internal cut -> splits into left and right)
    if (iStart < rStart - EPSILON && iEnd > rEnd + EPSILON) {
      // Left piece: [iStart, rStart]
      const leftTrimmed = trimItem(item, iStart, rStart);
      result.push(leftTrimmed);

      // Right piece: [rEnd, iEnd]
      const rightTrimmed = trimItem(item, rEnd, iEnd);
      if (ripple) {
        result.push({
          ...rightTrimmed,
          id: crypto.randomUUID(),
          timelineStart: round3(rStart),
          timelineEnd: round3(rStart + (iEnd - rEnd)),
          updatedAt: new Date().toISOString(),
        });
      } else {
        result.push({
          ...rightTrimmed,
          id: crypto.randomUUID(),
          updatedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    // Case 5: Item overlaps start boundary (left part kept)
    if (iStart < rStart && iEnd > rStart) {
      const leftTrimmed = trimItem(item, iStart, rStart);
      result.push(leftTrimmed);
      continue;
    }

    // Case 6: Item overlaps end boundary (right part kept)
    if (iStart < rEnd && iEnd > rEnd) {
      const rightTrimmed = trimItem(item, rEnd, iEnd);
      if (ripple) {
        const remainingDuration = round3(iEnd - rEnd);
        result.push({
          ...rightTrimmed,
          timelineStart: round3(rStart),
          timelineEnd: round3(rStart + remainingDuration),
          updatedAt: new Date().toISOString(),
        });
      } else {
        result.push(rightTrimmed);
      }
      continue;
    }
  }

  return result.sort((a, b) => a.timelineStart - b.timelineStart);
}

/**
 * Calculates max presentation duration across all tracks in the timeline
 */
export function recalculateTimelineDuration(tracks: TimelineTrack[]): number {
  let maxDuration = 0.0;
  for (const track of tracks) {
    for (const item of track.items) {
      if (item.enabled && item.timelineEnd > maxDuration) {
        maxDuration = item.timelineEnd;
      }
    }
  }
  return round3(maxDuration);
}

/**
 * Finds the active timeline item on a track at a specific presentation playhead time
 */
export function findItemAtTime(track: TimelineTrack, timelineTime: number): TimelineItem | null {
  const t = round3(timelineTime);
  for (const item of track.items) {
    if (item.enabled && t >= round3(item.timelineStart) && t < round3(item.timelineEnd)) {
      return item;
    }
  }
  // Boundary fallback if playhead is exactly at end of last item
  if (track.items.length > 0) {
    const last = track.items[track.items.length - 1];
    if (last.enabled && Math.abs(t - round3(last.timelineEnd)) < EPSILON) {
      return last;
    }
  }
  return null;
}
