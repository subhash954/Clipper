/**
 * AUTHORITATIVE EDITING & EDL SERVICE (Phase 5)
 * Non-destructive timeline mutation orchestrator with optimistic concurrency,
 * relational integrity, tenant validation, and undo/redo journaling.
 */

import { getStorage } from '../storage';
import { Timeline, TimelineTrack, TimelineItem, EDLOperation, EditResult } from './edlTypes';
import { CameraPath } from '../reframe/types';
import { validateCameraPath } from '../reframe/validation';

import {
  splitItem as mathSplitItem,
  trimItem as mathTrimItem,
  deleteRangeFromTrack,
  recalculateTimelineDuration,
  round3,
  isValidSpeed,
  isValidRange
} from './timelineMath';
import { ClipperError } from '../errors';

export class EditingService {
  /**
   * Retrieves canonical timeline or creates default initial timeline from project media
   */
  static async getOrCreateTimeline(
    projectId: string,
    userId: string
  ): Promise<Timeline> {
    const storage = getStorage();
    const existing = await storage.getTimeline(projectId);
    if (existing) {
      return existing;
    }

    // Load project to seed initial timeline from media asset
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new ClipperError('NOT_FOUND', `Project ${projectId} not found`, 404);
    }
    if (project.userId && project.userId !== userId) {
      throw new ClipperError('FORBIDDEN', 'Access denied to project', 403);
    }

    const duration = round3(project.durationSeconds && project.durationSeconds > 0 ? project.durationSeconds : 30);
    const mediaAssetId = project.activeMediaId || undefined;

    const timelineId = crypto.randomUUID();
    const videoTrackId = crypto.randomUUID();
    const audioTrackId = crypto.randomUUID();
    const brollTrackId = crypto.randomUUID();
    const captionTrackId = crypto.randomUUID();

    const initialVideoItem: TimelineItem = {
      id: crypto.randomUUID(),
      trackId: videoTrackId,
      sourceMediaId: mediaAssetId || crypto.randomUUID(),
      sourceStart: 0.0,
      sourceEnd: duration,
      timelineStart: 0.0,
      timelineEnd: duration,
      speed: 1.0,
      enabled: true,
      label: 'Main Footage',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const initialTracks: TimelineTrack[] = [
      {
        id: videoTrackId,
        timelineId,
        type: 'VIDEO',
        index: 0,
        name: 'Main Video',
        isMuted: false,
        isLocked: false,
        items: [initialVideoItem],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: audioTrackId,
        timelineId,
        type: 'AUDIO',
        index: 1,
        name: 'Audio Track',
        isMuted: false,
        isLocked: false,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: brollTrackId,
        timelineId,
        type: 'BROLL',
        index: 2,
        name: 'B-Roll & Overlays',
        isMuted: false,
        isLocked: false,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: captionTrackId,
        timelineId,
        type: 'CAPTION',
        index: 3,
        name: 'Dynamic Subtitles',
        isMuted: false,
        isLocked: false,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const initialTimeline: Timeline = {
      id: timelineId,
      projectId,
      version: 1,
      duration,
      timebase: '30fps',
      status: 'active',
      tracks: initialTracks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await storage.saveTimeline(initialTimeline, undefined, userId);
  }

  /**
   * Splits a timeline item at a specific presentation timestamp non-destructively
   */
  static async splitItem(params: {
    projectId: string;
    userId: string;
    itemId: string;
    splitTime: number;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, itemId, splitTime, expectedVersion } = params;
    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    let targetTrack: TimelineTrack | null = null;
    let targetItem: TimelineItem | null = null;

    for (const track of timeline.tracks) {
      const found = track.items.find((i) => i.id === itemId);
      if (found) {
        targetTrack = track;
        targetItem = found;
        break;
      }
    }

    if (!targetTrack || !targetItem) {
      throw new ClipperError('NOT_FOUND', `Timeline item ${itemId} not found`, 404);
    }

    const { itemA, itemB } = mathSplitItem(targetItem, splitTime);

    const updatedTracks = timeline.tracks.map((track) => {
      if (track.id !== targetTrack!.id) return track;
      const nextItems: TimelineItem[] = [];
      for (const item of track.items) {
        if (item.id === itemId) {
          nextItems.push(itemA, itemB);
        } else {
          nextItems.push(item);
        }
      }
      return {
        ...track,
        items: nextItems.sort((a, b) => a.timelineStart - b.timelineStart),
        updatedAt: new Date().toISOString(),
      };
    });

    const operation: EDLOperation = {
      id: crypto.randomUUID(),
      timelineId: timeline.id,
      type: 'SPLIT',
      params: { itemId, splitTime, itemAId: itemA.id, itemBId: itemB.id },
      inverseParams: { itemAId: itemA.id, itemBId: itemB.id, originalItem: targetItem, trackId: targetTrack.id },
      version: expectedVersion + 1,
      userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTimeline: Timeline = {
      ...timeline,
      tracks: updatedTracks,
      duration: recalculateTimelineDuration(updatedTracks),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveTimeline(updatedTimeline, expectedVersion, userId, operation);
    return { timeline: saved, operation };
  }

  /**
   * Trims a timeline item's in/out points non-destructively
   */
  static async trimItem(params: {
    projectId: string;
    userId: string;
    itemId: string;
    newTimelineStart: number;
    newTimelineEnd: number;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, itemId, newTimelineStart, newTimelineEnd, expectedVersion } = params;
    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    let targetTrack: TimelineTrack | null = null;
    let targetItem: TimelineItem | null = null;

    for (const track of timeline.tracks) {
      const found = track.items.find((i) => i.id === itemId);
      if (found) {
        targetTrack = track;
        targetItem = found;
        break;
      }
    }

    if (!targetTrack || !targetItem) {
      throw new ClipperError('NOT_FOUND', `Timeline item ${itemId} not found`, 404);
    }

    const trimmed = mathTrimItem(targetItem, newTimelineStart, newTimelineEnd);

    const updatedTracks = timeline.tracks.map((track) => {
      if (track.id !== targetTrack!.id) return track;
      return {
        ...track,
        items: track.items.map((i) => (i.id === itemId ? trimmed : i)).sort((a, b) => a.timelineStart - b.timelineStart),
        updatedAt: new Date().toISOString(),
      };
    });

    const operation: EDLOperation = {
      id: crypto.randomUUID(),
      timelineId: timeline.id,
      type: 'TRIM',
      params: { itemId, newTimelineStart, newTimelineEnd },
      inverseParams: { itemId, originalItem: targetItem, trackId: targetTrack.id },
      version: expectedVersion + 1,
      userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTimeline: Timeline = {
      ...timeline,
      tracks: updatedTracks,
      duration: recalculateTimelineDuration(updatedTracks),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveTimeline(updatedTimeline, expectedVersion, userId, operation);
    return { timeline: saved, operation };
  }

  /**
   * Deletes a single timeline item with optional ripple compaction
   */
  static async deleteItem(params: {
    projectId: string;
    userId: string;
    itemId: string;
    ripple?: boolean;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, itemId, ripple = true, expectedVersion } = params;
    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    let targetTrack: TimelineTrack | null = null;
    let targetItem: TimelineItem | null = null;

    for (const track of timeline.tracks) {
      const found = track.items.find((i) => i.id === itemId);
      if (found) {
        targetTrack = track;
        targetItem = found;
        break;
      }
    }

    if (!targetTrack || !targetItem) {
      throw new ClipperError('NOT_FOUND', `Timeline item ${itemId} not found`, 404);
    }

    const nextItems = deleteRangeFromTrack(targetTrack.items, targetItem.timelineStart, targetItem.timelineEnd, ripple);

    const updatedTracks = timeline.tracks.map((track) => {
      if (track.id !== targetTrack!.id) return track;
      return {
        ...track,
        items: nextItems,
        updatedAt: new Date().toISOString(),
      };
    });

    const operation: EDLOperation = {
      id: crypto.randomUUID(),
      timelineId: timeline.id,
      type: 'DELETE_ITEM',
      params: { itemId, ripple },
      inverseParams: { originalItem: targetItem, trackId: targetTrack.id, ripple, previousItems: targetTrack.items },
      version: expectedVersion + 1,
      userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTimeline: Timeline = {
      ...timeline,
      tracks: updatedTracks,
      duration: recalculateTimelineDuration(updatedTracks),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveTimeline(updatedTimeline, expectedVersion, userId, operation);
    return { timeline: saved, operation };
  }

  /**
   * Excises an arbitrary time range across a track with optional ripple compaction
   */
  static async deleteRange(params: {
    projectId: string;
    userId: string;
    trackId: string;
    startTime: number;
    endTime: number;
    ripple?: boolean;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, trackId, startTime, endTime, ripple = true, expectedVersion } = params;
    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    const targetTrack = timeline.tracks.find((t) => t.id === trackId);
    if (!targetTrack) {
      throw new ClipperError('NOT_FOUND', `Track ${trackId} not found`, 404);
    }

    const originalItems = targetTrack.items;
    const nextItems = deleteRangeFromTrack(targetTrack.items, startTime, endTime, ripple);

    const updatedTracks = timeline.tracks.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        items: nextItems,
        updatedAt: new Date().toISOString(),
      };
    });

    const operation: EDLOperation = {
      id: crypto.randomUUID(),
      timelineId: timeline.id,
      type: 'DELETE_RANGE',
      params: { trackId, startTime, endTime, ripple },
      inverseParams: { trackId, originalItems },
      version: expectedVersion + 1,
      userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTimeline: Timeline = {
      ...timeline,
      tracks: updatedTracks,
      duration: recalculateTimelineDuration(updatedTracks),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveTimeline(updatedTimeline, expectedVersion, userId, operation);
    return { timeline: saved, operation };
  }

  /**
   * Moves a timeline item to a new presentation start time or different track
   */
  static async moveItem(params: {
    projectId: string;
    userId: string;
    itemId: string;
    newTimelineStart: number;
    targetTrackId?: string;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, itemId, newTimelineStart, targetTrackId, expectedVersion } = params;
    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    let sourceTrack: TimelineTrack | null = null;
    let targetItem: TimelineItem | null = null;

    for (const track of timeline.tracks) {
      const found = track.items.find((i) => i.id === itemId);
      if (found) {
        sourceTrack = track;
        targetItem = found;
        break;
      }
    }

    if (!sourceTrack || !targetItem) {
      throw new ClipperError('NOT_FOUND', `Item ${itemId} not found`, 404);
    }

    const destTrackId = targetTrackId || sourceTrack.id;
    const itemDuration = round3(targetItem.timelineEnd - targetItem.timelineStart);
    const startT = round3(newTimelineStart);
    const endT = round3(startT + itemDuration);

    const movedItem: TimelineItem = {
      ...targetItem,
      trackId: destTrackId,
      timelineStart: startT,
      timelineEnd: endT,
      updatedAt: new Date().toISOString(),
    };

    const updatedTracks = timeline.tracks.map((track) => {
      let items = track.items.filter((i) => i.id !== itemId);
      if (track.id === destTrackId) {
        items.push(movedItem);
        items.sort((a, b) => a.timelineStart - b.timelineStart);
      }
      return {
        ...track,
        items,
        updatedAt: new Date().toISOString(),
      };
    });

    const operation: EDLOperation = {
      id: crypto.randomUUID(),
      timelineId: timeline.id,
      type: 'MOVE_ITEM',
      params: { itemId, newTimelineStart, targetTrackId: destTrackId },
      inverseParams: { itemId, originalStart: targetItem.timelineStart, originalTrackId: sourceTrack.id },
      version: expectedVersion + 1,
      userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTimeline: Timeline = {
      ...timeline,
      tracks: updatedTracks,
      duration: recalculateTimelineDuration(updatedTracks),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveTimeline(updatedTimeline, expectedVersion, userId, operation);
    return { timeline: saved, operation };
  }

  /**
   * Sets the playback speed rate of an item non-destructively
   */
  static async setSpeed(params: {
    projectId: string;
    userId: string;
    itemId: string;
    speed: number;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, itemId, speed, expectedVersion } = params;
    if (!isValidSpeed(speed)) {
      throw new ClipperError('INVALID_SPEED', `Invalid playback speed: ${speed}`, 400);
    }

    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    let targetTrack: TimelineTrack | null = null;
    let targetItem: TimelineItem | null = null;

    for (const track of timeline.tracks) {
      const found = track.items.find((i) => i.id === itemId);
      if (found) {
        targetTrack = track;
        targetItem = found;
        break;
      }
    }

    if (!targetTrack || !targetItem) {
      throw new ClipperError('NOT_FOUND', `Item ${itemId} not found`, 404);
    }

    const sourceDuration = round3(targetItem.sourceEnd - targetItem.sourceStart);
    const newPresentationDuration = round3(sourceDuration / speed);
    const newTimelineEnd = round3(targetItem.timelineStart + newPresentationDuration);

    const updatedItem: TimelineItem = {
      ...targetItem,
      speed: round3(speed),
      timelineEnd: newTimelineEnd,
      updatedAt: new Date().toISOString(),
    };

    const updatedTracks = timeline.tracks.map((track) => {
      if (track.id !== targetTrack!.id) return track;
      return {
        ...track,
        items: track.items.map((i) => (i.id === itemId ? updatedItem : i)),
        updatedAt: new Date().toISOString(),
      };
    });

    const operation: EDLOperation = {
      id: crypto.randomUUID(),
      timelineId: timeline.id,
      type: 'SET_SPEED',
      params: { itemId, speed },
      inverseParams: { itemId, originalSpeed: targetItem.speed },
      version: expectedVersion + 1,
      userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTimeline: Timeline = {
      ...timeline,
      tracks: updatedTracks,
      duration: recalculateTimelineDuration(updatedTracks),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveTimeline(updatedTimeline, expectedVersion, userId, operation);
    return { timeline: saved, operation };
  }

  /**
   * Toggles an item's enabled state (mute visual/audio without excising from EDL)
   */
  static async setEnabled(params: {
    projectId: string;
    userId: string;
    itemId: string;
    enabled: boolean;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, itemId, enabled, expectedVersion } = params;
    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    let targetTrack: TimelineTrack | null = null;
    let targetItem: TimelineItem | null = null;

    for (const track of timeline.tracks) {
      const found = track.items.find((i) => i.id === itemId);
      if (found) {
        targetTrack = track;
        targetItem = found;
        break;
      }
    }

    if (!targetTrack || !targetItem) {
      throw new ClipperError('NOT_FOUND', `Item ${itemId} not found`, 404);
    }

    const updatedItem: TimelineItem = {
      ...targetItem,
      enabled,
      updatedAt: new Date().toISOString(),
    };

    const updatedTracks = timeline.tracks.map((track) => {
      if (track.id !== targetTrack!.id) return track;
      return {
        ...track,
        items: track.items.map((i) => (i.id === itemId ? updatedItem : i)),
        updatedAt: new Date().toISOString(),
      };
    });

    const operation: EDLOperation = {
      id: crypto.randomUUID(),
      timelineId: timeline.id,
      type: 'SET_ENABLED',
      params: { itemId, enabled },
      inverseParams: { itemId, originalEnabled: targetItem.enabled },
      version: expectedVersion + 1,
      userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTimeline: Timeline = {
      ...timeline,
      tracks: updatedTracks,
      duration: recalculateTimelineDuration(updatedTracks),
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveTimeline(updatedTimeline, expectedVersion, userId, operation);
    return { timeline: saved, operation };
  }

  /**
   * Synchronizes transcript word clicks or selections to create exact non-destructive cuts or splits
   */
  static async syncFromTranscriptWords(params: {
    projectId: string;
    userId: string;
    wordStart: number;
    wordEnd: number;
    action: 'split_at_start' | 'split_at_end' | 'cut_word';
    trackId?: string;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, wordStart, wordEnd, action, expectedVersion } = params;
    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    const videoTrack = timeline.tracks.find((t) => (params.trackId ? t.id === params.trackId : t.type === 'VIDEO'));
    if (!videoTrack) {
      throw new ClipperError('NOT_FOUND', 'Target video track not found', 404);
    }

    if (action === 'split_at_start') {
      const item = videoTrack.items.find((i) => wordStart > i.timelineStart + 0.001 && wordStart < i.timelineEnd - 0.001);
      if (!item) {
        throw new ClipperError('INVALID_SPLIT_POINT', `Word start ${wordStart}s does not fall interior to any video clip`, 400);
      }
      return await this.splitItem({
        projectId,
        userId,
        itemId: item.id,
        splitTime: wordStart,
        expectedVersion,
      });
    }

    if (action === 'split_at_end') {
      const item = videoTrack.items.find((i) => wordEnd > i.timelineStart + 0.001 && wordEnd < i.timelineEnd - 0.001);
      if (!item) {
        throw new ClipperError('INVALID_SPLIT_POINT', `Word end ${wordEnd}s does not fall interior to any video clip`, 400);
      }
      return await this.splitItem({
        projectId,
        userId,
        itemId: item.id,
        splitTime: wordEnd,
        expectedVersion,
      });
    }

    // action === 'cut_word'
    return await this.deleteRange({
      projectId,
      userId,
      trackId: videoTrack.id,
      startTime: wordStart,
      endTime: wordEnd,
      ripple: true,
      expectedVersion,
    });
  }

  /**
   * Non-destructively attaches an authoritative camera path / auto-reframe plan
   * to a timeline item or all video items, incrementing timeline version and recording an EDL operation.
   */
  static async applyReframe(params: {
    projectId: string;
    userId: string;
    cameraPath: CameraPath;
    itemId?: string;
    expectedVersion: number;
  }): Promise<EditResult> {
    const { projectId, userId, cameraPath, itemId, expectedVersion } = params;

    if (!Number.isFinite(expectedVersion) || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new ClipperError('VALIDATION_ERROR', 'expectedVersion must be a positive integer >= 1', 400);
    }

    const validatedCameraPath = validateCameraPath(cameraPath);

    const storage = getStorage();
    const timeline = await storage.getTimeline(projectId);
    if (!timeline) {
      throw new ClipperError('NOT_FOUND', `Timeline for project ${projectId} not found`, 404);
    }

    if (timeline.version !== expectedVersion) {
      throw new ClipperError(
        'TIMELINE_VERSION_CONFLICT',
        `Version conflict: expected ${expectedVersion}, found ${timeline.version}`,
        409,
        true,
        { expectedVersion, currentVersion: timeline.version }
      );
    }

    // Verify item ownership and ensure it belongs to a VIDEO track
    if (itemId) {
      let foundTrack: TimelineTrack | null = null;
      let foundTargetItem: TimelineItem | null = null;

      for (const track of timeline.tracks) {
        const found = track.items.find((i) => i.id === itemId);
        if (found) {
          foundTrack = track;
          foundTargetItem = found;
          break;
        }
      }

      if (!foundTrack || !foundTargetItem) {
        throw new ClipperError('NOT_FOUND', `Timeline item ${itemId} not found in project timeline`, 404);
      }

      if (foundTrack.type !== 'VIDEO') {
        throw new ClipperError(
          'VALIDATION_ERROR',
          `Reframe can only be applied to VIDEO items; track ${foundTrack.id} is type ${foundTrack.type}`,
          400
        );
      }

    }

    let foundItem = false;
    const previousReframeMap: Record<string, any> = {};

    const updatedTracks = timeline.tracks.map((track) => {
      const isVideoTrack = track.type === 'VIDEO';
      return {
        ...track,
        items: track.items.map((item) => {
          if ((itemId && item.id === itemId && isVideoTrack) || (!itemId && isVideoTrack)) {
            foundItem = true;
            previousReframeMap[item.id] = item.metadata?.reframe || null;
            return {
              ...item,
              metadata: {
                ...(item.metadata || {}),
                reframe: validatedCameraPath,
              },
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        }),
        updatedAt: new Date().toISOString(),
      };
    });

    if (itemId && !foundItem) {
      throw new ClipperError('NOT_FOUND', `Timeline item ${itemId} not found`, 404);
    }

    const operation: EDLOperation = {
      id: crypto.randomUUID(),
      timelineId: timeline.id,
      type: 'SET_REFRAME',
      params: { itemId, cameraPath: validatedCameraPath },
      inverseParams: { itemId, previousReframeMap },
      version: expectedVersion + 1,
      userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTimeline: Timeline = {

      ...timeline,
      tracks: updatedTracks,
      updatedAt: new Date().toISOString(),
    };

    const saved = await storage.saveTimeline(updatedTimeline, expectedVersion, userId, operation);
    return { timeline: saved, operation };
  }

  /**
   * Reverts the most recent EDL operation deterministically using the journal cursor
   */
  static async undo(projectId: string, userId: string, expectedVersion: number): Promise<Timeline> {
    const storage = getStorage();
    return await storage.undoTimeline(projectId, userId, expectedVersion);
  }

  /**
   * Re-applies an undone EDL operation deterministically using the journal cursor
   */
  static async redo(projectId: string, userId: string, expectedVersion: number): Promise<Timeline> {
    const storage = getStorage();
    return await storage.redoTimeline(projectId, userId, expectedVersion);
  }
}

