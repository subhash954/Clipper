/**
 * CANONICAL EDIT DECISION LIST (EDL) & TIMELINE DATA MODEL
 * Authoritative non-destructive editing specification for Clipper (Phase 5).
 */

export type TrackType = 'VIDEO' | 'AUDIO' | 'BROLL' | 'CAPTION' | 'OVERLAY';

export interface TimelineItem {
  id: string;
  trackId: string;
  sourceMediaId: string;
  sourceStart: number;    // In-point in source media (seconds, >= 0)
  sourceEnd: number;      // Out-point in source media (seconds, > sourceStart)
  timelineStart: number;  // Position on presentation timeline (seconds, >= 0)
  timelineEnd: number;    // End on presentation timeline (seconds, > timelineStart)
  speed: number;          // Playback rate (> 0, standard 1.0)
  enabled: boolean;       // Active in rendering / preview
  label?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimelineTrack {
  id: string;
  timelineId: string;
  type: TrackType;
  index: number;
  name: string;
  isMuted: boolean;
  isLocked: boolean;
  items: TimelineItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Timeline {
  id: string;
  projectId: string;
  version: number;
  duration: number;       // Max presentation duration across all tracks (seconds)
  timebase: string;       // e.g. '30fps', '60fps', 'ms'
  status: 'active' | 'archived';
  currentOperationIndex?: number; // Pointer to current position in operations journal
  tracks: TimelineTrack[];
  createdAt: string;
  updatedAt: string;
}

export type EDLOperationType =
  | 'SPLIT'
  | 'TRIM'
  | 'DELETE_ITEM'
  | 'DELETE_RANGE'
  | 'MOVE_ITEM'
  | 'INSERT_ITEM'
  | 'SET_SPEED'
  | 'SET_ENABLED'
  | 'UNDO'
  | 'REDO';

export interface EDLOperation {
  id: string;
  timelineId: string;
  type: EDLOperationType | string;
  params: Record<string, any>;
  inverseParams: Record<string, any>;
  snapshotBefore?: TimelineTrack[];
  snapshotAfter?: TimelineTrack[];
  version: number;        // Version of the timeline after this operation was committed
  userId?: string;
  createdAt: string;
}

export interface EditResult {
  timeline: Timeline;
  operation: EDLOperation;
}
