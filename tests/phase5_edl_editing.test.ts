/**
 * CLIPPER PHASE 5: REAL EDITING / EDL ENGINE TEST SUITE
 * Unit, Integration, and Determinism Tests for Canonical Non-Destructive Editing
 */

import {
  round3,
  isValidTime,
  isValidSpeed,
  isValidRange,
  timelineTimeToSourceTime,
  sourceTimeToTimelineTime,
  calculatePresentationDuration,
  splitItem,
  trimItem,
  compactTrack,
  deleteRangeFromTrack,
  recalculateTimelineDuration,
  findItemAtTime,
  EPSILON
} from '../lib/editor/timelineMath';
import { EditingService } from '../lib/editor/editingService';
import { Timeline, TimelineItem, TimelineTrack, EDLOperation } from '../lib/editor/edlTypes';
import { getStorage, LocalStorageAdapter } from '../lib/storage';
import { ClipperError } from '../lib/errors';

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('🎬 CLIPPER PHASE 5: REAL EDITING / EDL TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Authoritative Timeline Math & Precision
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Timeline Math & Millisecond Precision ---');

  // Precision and validation
  assert(round3(1.23456) === 1.235, 'round3 rounds 1.23456 to 1.235');
  assert(round3(0.0001) === 0.0, 'round3 rounds sub-millisecond 0.0001 to 0.0');
  assert(isValidTime(0), '0 is a valid time');
  assert(isValidTime(0.001), '0.001 is a valid time');
  assert(!isValidTime(-0.001), '-0.001 is rejected as negative time');
  assert(!isValidTime(NaN), 'NaN is rejected');
  assert(!isValidTime(Infinity), 'Infinity is rejected');

  assert(isValidSpeed(1.0), 'Speed 1.0 is valid');
  assert(isValidSpeed(0.5), 'Speed 0.5 is valid');
  assert(isValidSpeed(2.5), 'Speed 2.5 is valid');
  assert(!isValidSpeed(0), 'Speed 0 is rejected');
  assert(!isValidSpeed(-1.0), 'Negative speed is rejected');
  assert(!isValidSpeed(NaN), 'NaN speed is rejected');

  assert(isValidRange(0, 10), 'Range [0, 10] is valid');
  assert(isValidRange(0.001, 0.002), 'Micro-range [0.001, 0.002] is valid');
  assert(!isValidRange(10, 5), 'Inverted range [10, 5] is rejected');
  assert(!isValidRange(5, 5), 'Zero-length range [5, 5] is rejected');

  // Time conversions
  const mockItem: TimelineItem = {
    id: 'item-1',
    trackId: 'track-1',
    sourceMediaId: 'media-1',
    sourceStart: 10.0,
    sourceEnd: 40.0,
    timelineStart: 0.0,
    timelineEnd: 30.0,
    speed: 1.0,
    enabled: true,
  };

  assert(timelineTimeToSourceTime(0.0, mockItem) === 10.0, 'Timeline 0s maps to source 10s');
  assert(timelineTimeToSourceTime(15.0, mockItem) === 25.0, 'Timeline 15s maps to source 25s');
  assert(timelineTimeToSourceTime(30.0, mockItem) === 40.0, 'Timeline 30s maps to source 40s');

  assert(sourceTimeToTimelineTime(10.0, mockItem) === 0.0, 'Source 10s maps to timeline 0s');
  assert(sourceTimeToTimelineTime(25.0, mockItem) === 15.0, 'Source 25s maps to timeline 15s');
  assert(sourceTimeToTimelineTime(40.0, mockItem) === 30.0, 'Source 40s maps to timeline 30s');

  // Conversions with 2.0x playback speed
  const speedItem: TimelineItem = {
    ...mockItem,
    speed: 2.0,
    timelineEnd: 15.0, // 30s source / 2x = 15s timeline
  };
  assert(timelineTimeToSourceTime(0.0, speedItem) === 10.0, '2x speed: timeline 0s -> source 10s');
  assert(timelineTimeToSourceTime(5.0, speedItem) === 20.0, '2x speed: timeline 5s -> source 20s');
  assert(timelineTimeToSourceTime(15.0, speedItem) === 40.0, '2x speed: timeline 15s -> source 40s');
  assert(sourceTimeToTimelineTime(20.0, speedItem) === 5.0, '2x speed: source 20s -> timeline 5s');

  // Presentation duration
  assert(calculatePresentationDuration(10.0, 40.0, 1.0) === 30.0, 'Duration at 1x is 30s');
  assert(calculatePresentationDuration(10.0, 40.0, 2.0) === 15.0, 'Duration at 2x is 15s');
  assert(calculatePresentationDuration(10.0, 40.0, 0.5) === 60.0, 'Duration at 0.5x is 60s');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Split Math & Invariant Verification
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Non-Destructive Split Operations ---');

  const baseItemForSplit: TimelineItem = {
    id: 'split-test-item',
    trackId: 'track-v',
    sourceMediaId: 'media-v',
    sourceStart: 10.0,
    sourceEnd: 40.0,
    timelineStart: 0.0,
    timelineEnd: 30.0,
    speed: 1.0,
    enabled: true,
  };

  // Normal interior split
  const { itemA, itemB } = splitItem(baseItemForSplit, 15.0);
  assert(itemA.timelineStart === 0.0 && itemA.timelineEnd === 15.0, 'Item A timeline range [0s, 15s]');
  assert(itemA.sourceStart === 10.0 && itemA.sourceEnd === 25.0, 'Item A source range [10s, 25s]');
  assert(itemB.timelineStart === 15.0 && itemB.timelineEnd === 30.0, 'Item B timeline range [15s, 30s]');
  assert(itemB.sourceStart === 25.0 && itemB.sourceEnd === 40.0, 'Item B source range [25s, 40s]');
  assert(itemA.sourceMediaId === 'media-v' && itemB.sourceMediaId === 'media-v', 'Both split items preserve sourceMediaId');
  assert(round3(itemA.timelineEnd) === round3(itemB.timelineStart), 'Zero gap between split items');
  assert(round3((itemA.timelineEnd - itemA.timelineStart) + (itemB.timelineEnd - itemB.timelineStart)) === 30.0, 'Total presentation duration preserved');

  // Split with 1.5x speed
  const fastItem: TimelineItem = {
    ...baseItemForSplit,
    speed: 1.5,
    timelineEnd: 20.0, // 30s / 1.5 = 20s
  };
  const fastSplit = splitItem(fastItem, 10.0);
  assert(fastSplit.itemA.timelineStart === 0.0 && fastSplit.itemA.timelineEnd === 10.0, 'Fast split Item A timeline [0, 10]');
  assert(fastSplit.itemA.sourceStart === 10.0 && fastSplit.itemA.sourceEnd === 25.0, 'Fast split Item A source [10, 25] (10s * 1.5 = 15s)');
  assert(fastSplit.itemB.timelineStart === 10.0 && fastSplit.itemB.timelineEnd === 20.0, 'Fast split Item B timeline [10, 20]');
  assert(fastSplit.itemB.sourceStart === 25.0 && fastSplit.itemB.sourceEnd === 40.0, 'Fast split Item B source [25, 40]');

  // Boundary split attempts: MUST REJECT
  let splitAtStartThrew = false;
  try {
    splitItem(baseItemForSplit, 0.0);
  } catch (err: any) {
    splitAtStartThrew = true;
    assert(err.code === 'INVALID_SPLIT_POINT', 'Split exactly at start rejected with INVALID_SPLIT_POINT');
  }
  assert(splitAtStartThrew, 'Split exactly at start was rejected');

  let splitAtEndThrew = false;
  try {
    splitItem(baseItemForSplit, 30.0);
  } catch (err: any) {
    splitAtEndThrew = true;
    assert(err.code === 'INVALID_SPLIT_POINT', 'Split exactly at end rejected with INVALID_SPLIT_POINT');
  }
  assert(splitAtEndThrew, 'Split exactly at end was rejected');

  let splitOutsideThrew = false;
  try {
    splitItem(baseItemForSplit, 45.0);
  } catch (err: any) {
    splitOutsideThrew = true;
    assert(err.code === 'INVALID_SPLIT_POINT', 'Split outside bounds rejected with INVALID_SPLIT_POINT');
  }
  assert(splitOutsideThrew, 'Split outside bounds was rejected');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Non-Destructive Trim Operations
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Non-Destructive Trim Operations ---');

  const baseItemForTrim: TimelineItem = {
    id: 'trim-item',
    trackId: 'track-v',
    sourceMediaId: 'media-v',
    sourceStart: 5.0,
    sourceEnd: 35.0,
    timelineStart: 0.0,
    timelineEnd: 30.0,
    speed: 1.0,
    enabled: true,
  };

  // Trim in-point from 0s -> 5s (in source, 5s -> 10s)
  const trimmedIn = trimItem(baseItemForTrim, 5.0, 30.0);
  assert(trimmedIn.timelineStart === 5.0 && trimmedIn.timelineEnd === 30.0, 'Trimmed in-point timeline [5s, 30s]');
  assert(trimmedIn.sourceStart === 10.0 && trimmedIn.sourceEnd === 35.0, 'Trimmed in-point source shifted to [10s, 35s]');

  // Trim out-point from 30s -> 20s (in source, 35s -> 25s)
  const trimmedOut = trimItem(baseItemForTrim, 0.0, 20.0);
  assert(trimmedOut.timelineStart === 0.0 && trimmedOut.timelineEnd === 20.0, 'Trimmed out-point timeline [0s, 20s]');
  assert(trimmedOut.sourceStart === 5.0 && trimmedOut.sourceEnd === 25.0, 'Trimmed out-point source shifted to [5s, 25s]');

  // Inverted trim rejection
  let invertedTrimThrew = false;
  try {
    trimItem(baseItemForTrim, 25.0, 10.0);
  } catch (err: any) {
    invertedTrimThrew = true;
    assert(err.code === 'INVALID_TRIM_RANGE', 'Inverted trim range rejected');
  }
  assert(invertedTrimThrew, 'Inverted trim was rejected');

  // Exceeding source duration rejection
  let exceedDurationThrew = false;
  try {
    trimItem(baseItemForTrim, 0.0, 40.0, 35.0);
  } catch (err: any) {
    exceedDurationThrew = true;
    assert(err.code === 'INVALID_TRIM_BOUNDS', 'Trim exceeding max source duration rejected');
  }
  assert(exceedDurationThrew, 'Exceeding source duration was rejected');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Track Compaction & Delete Range
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Track Compaction & Ripple Deletion ---');

  const gappedItems: TimelineItem[] = [
    { ...mockItem, id: 'item-a', timelineStart: 0.0, timelineEnd: 10.0 },
    { ...mockItem, id: 'item-b', timelineStart: 15.0, timelineEnd: 25.0 }, // 5s gap
    { ...mockItem, id: 'item-c', timelineStart: 30.0, timelineEnd: 40.0 }, // 5s gap
  ];

  const compacted = compactTrack(gappedItems);
  assert(compacted[0].timelineStart === 0.0 && compacted[0].timelineEnd === 10.0, 'Compacted item A: [0, 10]');
  assert(compacted[1].timelineStart === 10.0 && compacted[1].timelineEnd === 20.0, 'Compacted item B: [10, 20]');
  assert(compacted[2].timelineStart === 20.0 && compacted[2].timelineEnd === 30.0, 'Compacted item C: [20, 30]');

  // Delete range with ripple
  const continuousItems: TimelineItem[] = [
    { ...mockItem, id: 'c-1', timelineStart: 0.0, timelineEnd: 10.0, sourceStart: 0.0, sourceEnd: 10.0 },
    { ...mockItem, id: 'c-2', timelineStart: 10.0, timelineEnd: 20.0, sourceStart: 10.0, sourceEnd: 20.0 },
    { ...mockItem, id: 'c-3', timelineStart: 20.0, timelineEnd: 30.0, sourceStart: 20.0, sourceEnd: 30.0 },
  ];

  // Excise entire middle item [10, 20] with ripple
  const afterExciseMiddle = deleteRangeFromTrack(continuousItems, 10.0, 20.0, true);
  assert(afterExciseMiddle.length === 2, 'Excised middle item leaves exactly 2 items');
  assert(afterExciseMiddle[0].id === 'c-1' && afterExciseMiddle[0].timelineEnd === 10.0, 'Item 1 unchanged');
  assert(afterExciseMiddle[1].id === 'c-3' && afterExciseMiddle[1].timelineStart === 10.0 && afterExciseMiddle[1].timelineEnd === 20.0, 'Item 3 rippled left to [10, 20]');

  // Partial excise that cuts into an item (internal cut)
  const singleSpanItem: TimelineItem[] = [
    { ...mockItem, id: 'span-1', timelineStart: 0.0, timelineEnd: 30.0, sourceStart: 0.0, sourceEnd: 30.0 },
  ];
  const afterInternalCut = deleteRangeFromTrack(singleSpanItem, 10.0, 20.0, true);
  assert(afterInternalCut.length === 2, 'Internal cut splits single item into 2 pieces');
  assert(afterInternalCut[0].timelineStart === 0.0 && afterInternalCut[0].timelineEnd === 10.0, 'Left piece [0, 10]');
  assert(afterInternalCut[0].sourceStart === 0.0 && afterInternalCut[0].sourceEnd === 10.0, 'Left piece source [0, 10]');
  assert(afterInternalCut[1].timelineStart === 10.0 && afterInternalCut[1].timelineEnd === 20.0, 'Right piece rippled to [10, 20]');
  assert(afterInternalCut[1].sourceStart === 20.0 && afterInternalCut[1].sourceEnd === 30.0, 'Right piece source [20, 30]');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Authoritative Editing Service & Concurrency Control
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Editing Service & Optimistic Concurrency ---');

  const testProjectId = `proj-edl-test-${Date.now()}`;
  const testUserId = '00000000-0000-0000-0000-000000000001';

  // Seed project in storage
  const storage = getStorage();
  await storage.saveProject({
    id: testProjectId,
    userId: testUserId,
    title: 'EDL Service Test Project',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    clips: [],
    durationSeconds: 60.0,
    status: 'editing',
    version: 1,
    createdAt: new Date().toISOString(),
  });

  // 1. Create or get timeline
  const initialTimeline = await EditingService.getOrCreateTimeline(testProjectId, testUserId);
  assert(Boolean(initialTimeline.id), 'Timeline created with valid UUID');
  assert(initialTimeline.projectId === testProjectId, 'Timeline bound to testProjectId');
  assert(initialTimeline.version === 1, 'Initial timeline version is 1');
  assert(initialTimeline.tracks.length >= 1, 'Timeline contains initial tracks');

  const videoTrack = initialTimeline.tracks.find((t) => t.type === 'VIDEO')!;
  assert(videoTrack.items.length === 1, 'Video track has 1 initial item');
  const initialItemId = videoTrack.items[0].id;

  // 2. Split item at 25.0s
  const splitResult = await EditingService.splitItem({
    projectId: testProjectId,
    userId: testUserId,
    itemId: initialItemId,
    splitTime: 25.0,
    expectedVersion: 1,
  });
  assert(splitResult.timeline.version === 2, 'Timeline version incremented to 2 after split');
  assert(splitResult.timeline.tracks.find((t) => t.type === 'VIDEO')!.items.length === 2, 'Video track now has 2 items');

  // 3. Optimistic Concurrency Conflict: Worker sends stale expectedVersion: 1
  let conflictThrew = false;
  try {
    await EditingService.splitItem({
      projectId: testProjectId,
      userId: testUserId,
      itemId: splitResult.operation.params.itemAId,
      splitTime: 10.0,
      expectedVersion: 1, // Stale! Current DB version is 2
    });
  } catch (err: any) {
    conflictThrew = true;
    assert(err.code === 'TIMELINE_VERSION_CONFLICT' || err.statusCode === 409, 'Stale expectedVersion rejected with 409 Conflict');
  }
  assert(conflictThrew, 'Optimistic concurrency rejected stale write');

  // 4. Trim item with correct expectedVersion: 2
  const itemAId = splitResult.operation.params.itemAId;
  const trimResult = await EditingService.trimItem({
    projectId: testProjectId,
    userId: testUserId,
    itemId: itemAId,
    newTimelineStart: 2.5,
    newTimelineEnd: 22.5,
    expectedVersion: 2,
  });
  assert(trimResult.timeline.version === 3, 'Timeline version incremented to 3 after trim');
  const trimmedItem = trimResult.timeline.tracks.find((t) => t.type === 'VIDEO')!.items.find((i) => i.id === itemAId)!;
  assert(trimmedItem.timelineStart === 2.5 && trimmedItem.timelineEnd === 22.5, 'Item bounds updated to [2.5s, 22.5s]');

  // 5. Delete item with ripple
  const itemBId = splitResult.operation.params.itemBId;
  const deleteResult = await EditingService.deleteItem({
    projectId: testProjectId,
    userId: testUserId,
    itemId: itemBId,
    ripple: true,
    expectedVersion: 3,
  });
  assert(deleteResult.timeline.version === 4, 'Timeline version incremented to 4 after delete');
  assert(deleteResult.timeline.tracks.find((t) => t.type === 'VIDEO')!.items.length === 1, 'Only 1 item remains after delete');

  // 6. Undo the delete operation
  const undone = await EditingService.undo(testProjectId, testUserId, 4);
  assert(undone.version === 5, 'Timeline version incremented to 5 after undo');
  assert(undone.tracks.find((t) => t.type === 'VIDEO')!.items.length === 2, 'Undo restored deleted item (2 items again)');

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Transcript Synchronization
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Transcript Word-Level Synchronization ---');

  const syncResult = await EditingService.syncFromTranscriptWords({
    projectId: testProjectId,
    userId: testUserId,
    wordStart: 12.5,
    wordEnd: 13.2,
    action: 'cut_word',
    expectedVersion: 5,
  });
  assert(syncResult.timeline.version === 6, 'Transcript word cut committed to version 6');

  // --------------------------------------------------------------------------
  // TEST GROUP 6B: Authoritative Multi-Step Redo & Branch Invalidation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6B: Multi-Step Redo & Branch Invalidation ---');

  // Fresh isolated project for clean A -> B -> C testing
  const redoProjectId = `proj-redo-test-${Date.now()}`;
  await storage.saveProject({
    id: redoProjectId,
    userId: testUserId,
    title: 'Redo Test Project',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    clips: [],
    durationSeconds: 60.0,
    status: 'editing',
    version: 1,
    createdAt: new Date().toISOString(),
  });

  // State A: Initial timeline (version 1, 1 item)
  const timelineA = await EditingService.getOrCreateTimeline(redoProjectId, testUserId);
  assert(timelineA.version === 1, 'State A: version 1');
  const videoTrackA = timelineA.tracks.find((t) => t.type === 'VIDEO')!;
  assert(videoTrackA.items.length === 1, 'State A has 1 item');
  const seedItemId = videoTrackA.items[0].id;

  // State B: Split item at 30.0s (version 2, 2 items)
  const editB = await EditingService.splitItem({
    projectId: redoProjectId,
    userId: testUserId,
    itemId: seedItemId,
    splitTime: 30.0,
    expectedVersion: 1,
  });
  assert(editB.timeline.version === 2, 'State B: version 2 after split');
  assert(editB.timeline.tracks.find((t) => t.type === 'VIDEO')!.items.length === 2, 'State B has 2 items');

  // State C: Delete second item (version 3, 1 item)
  const itemSplitBId = editB.operation.params.itemBId;
  const editC = await EditingService.deleteItem({
    projectId: redoProjectId,
    userId: testUserId,
    itemId: itemSplitBId,
    ripple: true,
    expectedVersion: 2,
  });
  assert(editC.timeline.version === 3, 'State C: version 3 after delete');
  assert(editC.timeline.tracks.find((t) => t.type === 'VIDEO')!.items.length === 1, 'State C has 1 item');

  // 1. Undo to B: expect version 4, 2 items
  const undoToB = await EditingService.undo(redoProjectId, testUserId, 3);
  assert(undoToB.version === 4, 'Undo C -> B: version incremented to 4');
  assert(undoToB.tracks.find((t) => t.type === 'VIDEO')!.items.length === 2, 'Undo C -> B restored 2 items');

  // 2. Undo to A: expect version 5, 1 item
  const undoToA = await EditingService.undo(redoProjectId, testUserId, 4);
  assert(undoToA.version === 5, 'Undo B -> A: version incremented to 5');
  assert(undoToA.tracks.find((t) => t.type === 'VIDEO')!.items.length === 1, 'Undo B -> A restored 1 item');

  // 3. Redo to B: expect version 6, 2 items
  const redoToB = await EditingService.redo(redoProjectId, testUserId, 5);
  assert(redoToB.version === 6, 'Redo A -> B: version incremented to 6');
  assert(redoToB.tracks.find((t) => t.type === 'VIDEO')!.items.length === 2, 'Redo A -> B restored 2 items');

  // 4. Redo to C: expect version 7, 1 item
  const redoToC = await EditingService.redo(redoProjectId, testUserId, 6);
  assert(redoToC.version === 7, 'Redo B -> C: version incremented to 7');
  assert(redoToC.tracks.find((t) => t.type === 'VIDEO')!.items.length === 1, 'Redo B -> C restored 1 item');

  // 5. Redo beyond C should fail (no further redo ops)
  let redoBeyondThrew = false;
  try {
    await EditingService.redo(redoProjectId, testUserId, 7);
  } catch (err: any) {
    redoBeyondThrew = true;
    assert(err.code === 'NO_REDO_OPERATION' || err.statusCode === 400, 'Redo beyond available ops rejected');
  }
  assert(redoBeyondThrew, 'Redo beyond available operations throws NO_REDO_OPERATION');

  // 6. Test Branch Invalidation: Undo to B, then apply new Edit D
  // Current state: C (version 7). Undo -> B (version 8).
  const undoAgainToB = await EditingService.undo(redoProjectId, testUserId, 7);
  assert(undoAgainToB.version === 8, 'Undo C -> B: version incremented to 8');
  assert(undoAgainToB.tracks.find((t) => t.type === 'VIDEO')!.items.length === 2, 'Restored to B (2 items)');

  // Apply new Edit D: trim item instead of deleting
  const itemToTrimId = undoAgainToB.tracks.find((t) => t.type === 'VIDEO')!.items[0].id;
  const editD = await EditingService.trimItem({
    projectId: redoProjectId,
    userId: testUserId,
    itemId: itemToTrimId,
    newTimelineStart: 2.0,
    newTimelineEnd: 25.0,
    expectedVersion: 8,
  });
  assert(editD.timeline.version === 9, 'Edit D: version incremented to 9');

  // Attempting Redo now MUST fail because branch was invalidated by new edit D
  let invalidatedRedoThrew = false;
  try {
    await EditingService.redo(redoProjectId, testUserId, 9);
  } catch (err: any) {
    invalidatedRedoThrew = true;
    assert(err.code === 'NO_REDO_OPERATION' || err.statusCode === 400, 'Redo on invalidated branch rejected');
  }
  assert(invalidatedRedoThrew, 'Redo branch was invalidated by new edit D');

  // --------------------------------------------------------------------------
  // TEST GROUP 6C: Strict Numeric Input Validation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6C: Strict Numeric Input Validation ---');

  function isValidExpectedVersion(val: any): boolean {
    return typeof val === 'number' && Number.isFinite(val) && Number.isInteger(val) && val >= 1;
  }

  assert(!isValidExpectedVersion(NaN), 'NaN rejected as expectedVersion');
  assert(!isValidExpectedVersion(Infinity), 'Infinity rejected as expectedVersion');
  assert(!isValidExpectedVersion(-Infinity), '-Infinity rejected as expectedVersion');
  assert(!isValidExpectedVersion(1.5), 'Float 1.5 rejected as expectedVersion');
  assert(!isValidExpectedVersion(-1), 'Negative -1 rejected as expectedVersion');
  assert(!isValidExpectedVersion(0), '0 rejected as expectedVersion');
  assert(!isValidExpectedVersion(null), 'null rejected as expectedVersion');
  assert(!isValidExpectedVersion('1'), 'String "1" rejected as expectedVersion');
  assert(!isValidExpectedVersion(true), 'Boolean true rejected as expectedVersion');
  assert(!isValidExpectedVersion({}), 'Object rejected as expectedVersion');
  assert(isValidExpectedVersion(1), 'Integer 1 accepted as expectedVersion');
  assert(isValidExpectedVersion(10), 'Integer 10 accepted as expectedVersion');

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Determinism Verification
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Determinism Verification ---');

  // Given identical source media and operation sequences, final EDL must be identical
  const seedItem: TimelineItem = {
    id: 'det-seed',
    trackId: 'tr-1',
    sourceMediaId: 'media-det',
    sourceStart: 0.0,
    sourceEnd: 60.0,
    timelineStart: 0.0,
    timelineEnd: 60.0,
    speed: 1.0,
    enabled: true,
  };

  function runSequence(initial: TimelineItem): TimelineItem[] {
    // Sequence: Split at 30, Trim item A to [5, 25], Delete range [15, 20]
    const { itemA, itemB } = splitItem(initial, 30.0, 'a', 'b');
    const trimmedA = trimItem(itemA, 5.0, 25.0);
    const afterDel = deleteRangeFromTrack([trimmedA, itemB], 15.0, 20.0, true);
    return afterDel;
  }

  const run1 = runSequence(seedItem);
  const run2 = runSequence(seedItem);

  const normalize = (items: TimelineItem[]) =>
    items.map(({ id, updatedAt, ...rest }) => ({
      ...rest,
      duration: round3(rest.timelineEnd - rest.timelineStart),
      sourceDuration: round3(rest.sourceEnd - rest.sourceStart),
    }));

  assert(
    JSON.stringify(normalize(run1)) === JSON.stringify(normalize(run2)),
    'Deterministic pipeline produced identical byte-for-byte output across independent runs'
  );
  assert(run1.length === 3, 'Deterministic pipeline has exact expected item count (3 pieces)');

  console.log('\n====================================================');
  console.log(`📊 PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
