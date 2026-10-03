'use client';

import React, { useRef, useState, useMemo } from 'react';
import { ViralClip, WordTimestamp, EditOperation } from '@/lib/types';
import { Timeline, TimelineItem, TimelineTrack } from '@/lib/editor/edlTypes';
import { ReframeTrack } from '@/lib/reframe/types';
import {
  Film,
  Scissors,
  Music2,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Trash2,
  Split,
  Undo2,
  Redo2,
  Gauge,
  Check,
  ChevronRight,
  Eye,
  Type
} from 'lucide-react';

interface CreatorTimelineProps {
  clip?: ViralClip | null;
  timeline?: Timeline | null;
  currentTime: number; // in presentation seconds
  onSeek: (time: number) => void;
  cuts?: EditOperation[];
  words?: WordTimestamp[];
  timingPrecision?: 'exact_word' | 'approximate_cue';
  onWordClick?: (word: WordTimestamp) => void;
  reframeTrack?: ReframeTrack;
  onSplit?: (splitTime: number) => void;
  onDeleteClip?: (clipId: string) => void;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string) => void;
  onTrimClip?: (clipId: string, newStart: number, newEnd: number) => void;
  showIntelligenceMarkers?: boolean;
  // Phase 5 Authoritative EDL Callbacks
  onTimelineSplit?: (itemId: string, splitTime: number) => void;
  onTimelineTrim?: (itemId: string, newStart: number, newEnd: number) => void;
  onTimelineDelete?: (itemId: string, ripple: boolean) => void;
  onTimelineUndo?: () => void;
  onTimelineRedo?: () => void;
  onTimelineSpeed?: (itemId: string, speed: number) => void;
  onTranscriptSyncAction?: (word: WordTimestamp, action: 'cut_word' | 'split_at_start' | 'split_at_end') => void;
}

export const CreatorTimeline: React.FC<CreatorTimelineProps> = ({
  clip,
  timeline,
  currentTime,
  onSeek,
  cuts = [],
  words = [],
  timingPrecision = 'exact_word',
  onWordClick,
  reframeTrack,
  onSplit,
  onDeleteClip,
  selectedClipId,
  onSelectClip,
  onTrimClip,
  showIntelligenceMarkers = true,
  onTimelineSplit,
  onTimelineTrim,
  onTimelineDelete,
  onTimelineUndo,
  onTimelineRedo,
  onTimelineSpeed,
  onTranscriptSyncAction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeWordAction, setActiveWordAction] = useState<WordTimestamp | null>(null);

  // Determine active duration from canonical timeline or fallback clip
  const totalDuration = useMemo(() => {
    if (timeline && timeline.duration > 0) return timeline.duration;
    if (clip && clip.duration > 0) return clip.duration;
    return 30.0;
  }, [timeline, clip]);

  const clipStart = clip?.start || 0;
  const presentationCurrent = Math.max(0, Math.min(totalDuration, currentTime));
  const playheadPercent = Math.min(100, Math.max(0, (presentationCurrent / totalDuration) * 100));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    handleScrub(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    handleScrub(e);
  };

  const handlePointerUp = () => {
    setIsScrubbing(false);
  };

  const handleScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = clickX / rect.width;
    const targetTime = ratio * totalDuration;
    onSeek(Number(targetTime.toFixed(3)));
  };

  // Resolve tracks from canonical timeline if available, otherwise construct from clip
  const videoItems: TimelineItem[] = useMemo(() => {
    if (timeline) {
      const vTrack = timeline.tracks.find((t) => t.type === 'VIDEO');
      if (vTrack && vTrack.items.length > 0) {
        return vTrack.items;
      }
    }
    // Fallback single item from clip
    return [
      {
        id: clip?.id || 'clip-fallback',
        trackId: 'track-video',
        sourceMediaId: 'media-0',
        sourceStart: clipStart,
        sourceEnd: clipStart + totalDuration,
        timelineStart: 0,
        timelineEnd: totalDuration,
        speed: 1.0,
        enabled: true,
        label: clip?.title || 'Main Video',
      },
    ];
  }, [timeline, clip, totalDuration, clipStart]);

  const activeVideoItem = useMemo(() => {
    return videoItems.find((i) => i.id === selectedItemId) || videoItems[0] || null;
  }, [videoItems, selectedItemId]);

  const handleSplitClick = () => {
    if (!activeVideoItem) return;
    if (onTimelineSplit) {
      onTimelineSplit(activeVideoItem.id, presentationCurrent);
    } else if (onSplit) {
      onSplit(presentationCurrent);
    }
  };

  const handleDeleteClick = (ripple: boolean = true) => {
    if (!activeVideoItem) return;
    if (onTimelineDelete) {
      onTimelineDelete(activeVideoItem.id, ripple);
    } else if (onDeleteClip) {
      onDeleteClip(activeVideoItem.id);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden select-none font-sans text-slate-100">
      
      {/* 1. TOP TIMELINE TOOLBAR */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
        
        {/* Left: Real Action Controls */}
        <div className="flex items-center gap-2">
          
          {/* Split at Playhead Button */}
          <button
            type="button"
            onClick={handleSplitClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer border border-slate-700/80 shadow-2xs"
            title="Split selected item at current playhead position"
          >
            <Split className="w-3.5 h-3.5 text-red-400" />
            <span>Split (S)</span>
          </button>

          {/* Delete Item Button */}
          <button
            type="button"
            onClick={() => handleDeleteClick(true)}
            disabled={videoItems.length <= 1}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-colors border shadow-2xs ${
              videoItems.length > 1
                ? 'bg-slate-800 hover:bg-rose-950/40 text-rose-300 border-slate-700/80 cursor-pointer'
                : 'bg-slate-900 text-slate-600 border-slate-800/80 cursor-not-allowed'
            }`}
            title="Delete selected item with ripple compaction"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Ripple Delete</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            {onTimelineUndo && (
              <button
                type="button"
                onClick={onTimelineUndo}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/80"
                title="Undo last EDL operation"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onTimelineRedo && (
              <button
                type="button"
                onClick={onTimelineRedo}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/80"
                title="Redo operation"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Speed Presets */}
          {onTimelineSpeed && activeVideoItem && (
            <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              {[1.0, 1.25, 1.5].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onTimelineSpeed(activeVideoItem.id, spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                    activeVideoItem.speed === spd
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Center: Presentation Timebase Display */}
        <div className="flex items-center gap-3 font-mono text-[11px] bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
          <span className="text-red-400 font-bold">{presentationCurrent.toFixed(2)}s</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{totalDuration.toFixed(2)}s</span>
          {timeline?.version && (
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-sans font-semibold">
              v{timeline.version}
            </span>
          )}
        </div>

        {/* Right: Zoom Level Controls */}
        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.25))}
            className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* 2. TIMELINE TRACKS CONTAINER & SCRUB AREA */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative p-4 space-y-3 cursor-crosshair overflow-x-auto min-h-[220px]"
      >
        
        {/* TIME RULER TICKS */}
        <div className="relative h-5 w-full border-b border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
          {Array.from({ length: 9 }).map((_, idx) => {
            const timeVal = (totalDuration / 8) * idx;
            return (
              <div key={idx} className="flex flex-col items-center">
                <span>{timeVal.toFixed(1)}s</span>
                <div className="w-px h-1.5 bg-slate-700 mt-0.5" />
              </div>
            );
          })}
        </div>

        {/* PLAYHEAD VERTICAL NEEDLE */}
        <div
          className="absolute top-0 bottom-0 z-30 pointer-events-none transition-transform duration-75"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="w-0.5 h-full bg-red-500 shadow-sm shadow-red-500/80" />
          <div className="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-1.5 shadow-md border-2 border-white" />
        </div>

        {/* TRACK 1: Main Video (Relational EDL Items) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-blue-400" />
              <span>Video Track ({videoItems.length} items)</span>
            </span>
            <span className="text-[10px] text-slate-500">Non-Destructive EDL</span>
          </div>

          <div className="relative h-12 w-full bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex items-center p-1 gap-1">
            {videoItems.map((item, idx) => {
              const leftPct = Math.min(100, Math.max(0, (item.timelineStart / totalDuration) * 100));
              const widthPct = Math.min(
                100 - leftPct,
                Math.max(1, ((item.timelineEnd - item.timelineStart) / totalDuration) * 100)
              );
              const isSelected = selectedItemId === item.id || (!selectedItemId && idx === 0);

              return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItemId(item.id);
                  }}
                  className={`absolute top-1 bottom-1 rounded-lg flex items-center justify-between px-2 text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md ring-2 ring-blue-400 z-10'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700/80 border border-slate-700/60'
                  }`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${item.label || `Clip ${idx + 1}`} (${item.timelineStart.toFixed(2)}s - ${item.timelineEnd.toFixed(2)}s, Speed: ${item.speed}x)`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{item.label || `Part ${idx + 1}`}</span>
                    {item.speed !== 1.0 && (
                      <span className="text-[10px] px-1 rounded bg-black/40 text-amber-300 font-mono">
                        {item.speed}x
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono opacity-70 shrink-0">
                    {(item.timelineEnd - item.timelineStart).toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* TRACK 2: Word-Level Transcript Alignment (Phase 4 Synchronization) */}
        {words.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
              <span className="flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-amber-400" />
                <span>Transcript Synchronization ({words.length} words)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Exact Word Timestamps</span>
            </div>

            <div className="relative h-8 w-full bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex items-center p-1">
              {words.map((w, idx) => {
                const leftPct = Math.min(100, Math.max(0, (w.start / totalDuration) * 100));
                const widthPct = Math.min(100 - leftPct, Math.max(1.2, ((w.end - w.start) / totalDuration) * 100));
                const isActive = presentationCurrent >= w.start && presentationCurrent <= w.end;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveWordAction(w);
                      onSeek(w.start);
                    }}
                    className={`absolute top-1 bottom-1 rounded px-1 flex items-center justify-center text-[10px] font-bold truncate transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm ring-1 ring-amber-300 z-20'
                        : 'bg-amber-500/10 hover:bg-amber-500/30 text-amber-200 border border-amber-500/20'
                    }`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`"${w.word}" [${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s] - Click to synchronize edit`}
                  >
                    {w.word}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TRACK 3: Audio Waveform Cadence */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <Music2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audio Cadence & Energy</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">48 kHz Waveform</span>
          </div>

          <div className="relative h-6 w-full bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-between px-3 opacity-80">
            {Array.from({ length: 64 }).map((_, barIdx) => {
              const height = 30 + Math.sin(barIdx * 0.35) * 50 + ((barIdx * 11) % 20);
              return (
                <div
                  key={barIdx}
                  className="w-1 bg-emerald-500/70 rounded-full"
                  style={{ height: `${Math.min(100, Math.max(15, height))}%` }}
                />
              );
            })}
          </div>
        </div>

      </div>

      {/* 3. TRANSCRIPT WORD ACTION MODAL / QUICK ACTIONS */}
      {activeWordAction && onTranscriptSyncAction && (
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Word: "{activeWordAction.word}"</span>
            <span className="font-mono text-slate-400 text-[11px]">
              [{activeWordAction.start.toFixed(2)}s - {activeWordAction.end.toFixed(2)}s]
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onTranscriptSyncAction(activeWordAction, 'split_at_start');
                setActiveWordAction(null);
              }}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
            >
              Split at Start
            </button>
            <button
              type="button"
              onClick={() => {
                onTranscriptSyncAction(activeWordAction, 'split_at_end');
                setActiveWordAction(null);
              }}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
            >
              Split at End
            </button>
            <button
              type="button"
              onClick={() => {
                onTranscriptSyncAction(activeWordAction, 'cut_word');
                setActiveWordAction(null);
              }}
              className="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white font-semibold cursor-pointer shadow-xs"
            >
              Excise / Cut Word
            </button>
            <button
              type="button"
              onClick={() => setActiveWordAction(null)}
              className="text-slate-400 hover:text-white px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
