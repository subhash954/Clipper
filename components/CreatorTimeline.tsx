'use client';

import React, { useRef, useState, useMemo } from 'react';
import { ViralClip, WordTimestamp, EditOperation } from '@/lib/types';
import { ReframeTrack } from '@/lib/reframe/types';
import {
  Film,
  Type,
  Scissors,
  Video,
  Music2,
  Sparkles,
  Layers,
  Crosshair,
} from 'lucide-react';

interface CreatorTimelineProps {
  clip: ViralClip | null;
  currentTime: number; // in seconds (absolute media time)
  onSeek: (time: number) => void;
  cuts?: EditOperation[];
  words?: WordTimestamp[];
  reframeTrack?: ReframeTrack;
}

export const CreatorTimeline: React.FC<CreatorTimelineProps> = ({
  clip,
  currentTime,
  onSeek,
  cuts = [],
  words = [],
  reframeTrack,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  if (!clip) {
    return null;
  }

  const duration = clip.duration > 0 ? clip.duration : 30;
  const clipStart = clip.start || 0;
  const relativeCurrent = Math.max(0, Math.min(duration, currentTime - clipStart));
  const playheadPercent = Math.min(100, Math.max(0, (relativeCurrent / duration) * 100));

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
    const targetRelative = ratio * duration;
    onSeek(clipStart + targetRelative);
  };

  const activeCuts = cuts.filter((c) => c.enabled && c.type !== 'BROLL');
  const brollOperations = cuts.filter((c) => c.enabled && c.type === 'BROLL');

  // Semantic Markers
  const semanticMarkers = useMemo(() => {
    const markers: Array<{
      type: 'HOOK' | 'EMPHASIS' | 'PAUSE' | 'FILLER' | 'B-ROLL' | 'SCENE CHANGE';
      time: number; // absolute time
      relativeTime: number; // relative to clip
      label: string;
      color: string;
    }> = [];

    // [HOOK] at clip start
    markers.push({
      type: 'HOOK',
      time: clipStart,
      relativeTime: 0,
      label: 'HOOK',
      color: 'bg-cyan-500 text-slate-950 border-cyan-400',
    });

    // [EMPHASIS] around pivotal quote
    const emphasisTime = clipStart + Math.min(duration * 0.45, 8);
    markers.push({
      type: 'EMPHASIS',
      time: emphasisTime,
      relativeTime: emphasisTime - clipStart,
      label: 'EMPHASIS',
      color: 'bg-amber-400 text-slate-950 border-amber-300',
    });

    // [PAUSE] from cuts or silence
    cuts
      .filter((c) => c.reason === 'silence')
      .forEach((c) => {
        markers.push({
          type: 'PAUSE',
          time: c.start,
          relativeTime: Math.max(0, c.start - clipStart),
          label: 'PAUSE',
          color: 'bg-rose-500 text-white border-rose-400',
        });
      });

    // [FILLER] from cuts
    cuts
      .filter((c) => c.reason === 'filler')
      .forEach((c) => {
        markers.push({
          type: 'FILLER',
          time: c.start,
          relativeTime: Math.max(0, c.start - clipStart),
          label: 'FILLER',
          color: 'bg-orange-500 text-white border-orange-400',
        });
      });

    // [B-ROLL]
    brollOperations.forEach((b) => {
      markers.push({
        type: 'B-ROLL',
        time: b.start,
        relativeTime: Math.max(0, b.start - clipStart),
        label: b.word ? `B-ROLL: ${b.word.toUpperCase()}` : 'B-ROLL',
        color: 'bg-indigo-500 text-white border-indigo-400',
      });
    });

    return markers;
  }, [clipStart, duration, cuts, brollOperations]);

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm space-y-3 select-none text-slate-900">
      {/* Timeline Header & Timecode Display */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-red-600" />
          <span className="text-xs font-bold text-slate-900 tracking-wider uppercase">
            Semantic Multi-Track Timeline
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-mono font-bold border border-red-200/80">
            {duration.toFixed(1)}s
          </span>
          {reframeTrack && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono border border-slate-200">
              Reframe: {reframeTrack.trackingMode} ({reframeTrack.aspectRatio})
            </span>
          )}
        </div>

        {/* Timecode */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-red-600 font-bold">{relativeCurrent.toFixed(1)}s</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500 font-medium">{duration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Semantic Marker Strip */}
      <div className="relative w-full h-6 bg-slate-100/90 rounded-lg border border-slate-200/80 px-2 flex items-center overflow-hidden shadow-xs">
        {semanticMarkers.map((marker, idx) => {
          const markerPercent = Math.min(94, Math.max(1, (marker.relativeTime / duration) * 100));

          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSeek(marker.time);
              }}
              style={{ left: `${markerPercent}%` }}
              className={`absolute -translate-x-1/2 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border shadow-xs transition-transform hover:scale-110 cursor-pointer ${marker.color}`}
              title={`Click to jump to [${marker.label}] at ${marker.relativeTime.toFixed(1)}s`}
            >
              [{marker.label}]
            </button>
          );
        })}
      </div>

      {/* Scrubbable Multi-Track Canvas Area */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-full bg-slate-100/80 rounded-xl overflow-hidden cursor-ew-resize pt-4 pb-2 px-1 space-y-1.5 touch-none border border-slate-200"
      >
        {/* Playhead Vertical Line */}
        <div
          className="absolute top-0 bottom-0 z-30 pointer-events-none transition-transform"
          style={{ left: `${playheadPercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-3.5 h-3.5 bg-red-600 rounded-full shadow-md shadow-red-500/50 -mt-1 mx-auto" />
          <div className="w-0.5 h-full bg-red-600 mx-auto shadow-xs" />
        </div>

        {/* TRACK 1: Video Footage Track */}
        <div className="relative h-6 w-full rounded-md bg-white border border-slate-200/90 shadow-xs overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-800">
            <Video className="w-3 h-3 text-red-600" />
            <span>VIDEO • {reframeTrack ? `${reframeTrack.targetWidth}x${reframeTrack.targetHeight} (${reframeTrack.aspectRatio})` : '1080x1920 (9:16)'}</span>
          </div>
          <div className="absolute inset-0 bg-red-500/10 border-l-2 border-r-2 border-red-600 pointer-events-none" />
        </div>

        {/* TRACK 2: Reframe Subject Keyframes Track */}
        {reframeTrack && reframeTrack.keyframes && reframeTrack.keyframes.length > 0 && (
          <div className="relative h-6 w-full rounded-md bg-white border border-slate-200/90 shadow-xs overflow-hidden flex items-center px-2">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-red-700 shrink-0 mr-2 z-10">
              <Crosshair className="w-3 h-3 text-red-600" />
              <span>REFRAME</span>
            </div>
            <div className="relative w-full h-4">
              {reframeTrack.keyframes.map((kf, i) => {
                const kfPct = Math.min(100, Math.max(0, (kf.time / duration) * 100));
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(clipStart + kf.time);
                    }}
                    style={{ left: `${kfPct}%` }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-red-600 hover:scale-150 transition-transform cursor-pointer border border-white shadow-xs"
                    title={`Keyframe at ${kf.time.toFixed(1)}s (X: ${Math.round(kf.x * 100)}%, Y: ${Math.round(kf.y * 100)}%)`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* TRACK 3: B-Roll Overlays Track */}
        {brollOperations.length > 0 && (
          <div className="relative h-6 w-full rounded-md bg-white border border-slate-200/90 shadow-xs overflow-hidden flex items-center px-2">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-300 shrink-0 mr-2 z-10">
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>B-ROLL</span>
            </div>
            <div className="relative w-full h-4">
              {brollOperations.map((broll, idx) => {
                const relStart = Math.max(0, broll.start - clipStart);
                const relEnd = Math.max(0, broll.end - clipStart);
                const leftPct = Math.min(100, Math.max(0, (relStart / duration) * 100));
                const widthPct = Math.min(100 - leftPct, Math.max(2, ((relEnd - relStart) / duration) * 100));
                return (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 bg-indigo-600/80 border border-indigo-400 rounded-xs flex items-center justify-center text-[7px] font-bold text-white uppercase px-1 truncate"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`B-Roll: ${broll.word || 'Stock video'}`}
                  >
                    {broll.word ? broll.word.toUpperCase() : 'B-ROLL'}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TRACK 4: Dynamic Captions Track */}
        <div className="relative h-6 w-full rounded-md bg-white border border-slate-200/90 shadow-xs overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-700 shrink-0 mr-2 z-10">
            <Type className="w-3 h-3 text-amber-500" />
            <span>CAPTIONS</span>
          </div>
          <div className="relative w-full h-4">
            {words.slice(0, 40).map((w, i) => {
              const relStart = Math.max(0, w.start - clipStart);
              const relEnd = Math.max(0, w.end - clipStart);
              const leftPct = Math.min(100, Math.max(0, (relStart / duration) * 100));
              const widthPct = Math.min(100 - leftPct, Math.max(1.5, ((relEnd - relStart) / duration) * 100));
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 bg-amber-400/25 border border-amber-400/50 rounded-xs"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={w.word}
                />
              );
            })}
          </div>
        </div>

        {/* TRACK 5: Cuts / Silence / Filler Track */}
        <div className="relative h-6 w-full rounded-md bg-white border border-slate-200/90 shadow-xs overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-700 shrink-0 mr-2 z-10">
            <Scissors className="w-3 h-3 text-rose-500" />
            <span>CUTS</span>
          </div>
          <div className="relative w-full h-4">
            {activeCuts.map((cut, idx) => {
              const relStart = Math.max(0, cut.start - clipStart);
              const relEnd = Math.max(0, cut.end - clipStart);
              const leftPct = Math.min(100, Math.max(0, (relStart / duration) * 100));
              const widthPct = Math.min(100 - leftPct, Math.max(2, ((relEnd - relStart) / duration) * 100));
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 bg-rose-500/80 border border-rose-400 rounded-xs flex items-center justify-center text-[7px] font-bold text-white uppercase"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${cut.reason}: ${cut.start.toFixed(1)}s - ${cut.end.toFixed(1)}s`}
                >
                  CUT
                </div>
              );
            })}
          </div>
        </div>

        {/* TRACK 6: Audio Waveform Track */}
        <div className="relative h-5 w-full rounded-md bg-white border border-slate-200/90 shadow-xs overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 shrink-0 mr-2 z-10">
            <Music2 className="w-3 h-3 text-emerald-500" />
            <span>AUDIO</span>
          </div>
          <div className="flex items-center justify-between w-full h-3 opacity-70">
            {Array.from({ length: 48 }).map((_, barIdx) => {
              const height = 25 + Math.sin(barIdx * 0.4) * 45 + ((barIdx * 7) % 30);
              return (
                <div
                  key={barIdx}
                  className="w-1 bg-emerald-500 rounded-full"
                  style={{ height: `${Math.min(100, Math.max(15, height))}%` }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
