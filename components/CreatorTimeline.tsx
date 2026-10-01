'use client';

import React, { useRef, useState } from 'react';
import { ViralClip, WordTimestamp, EditOperation } from '@/lib/types';
import { Film, Type, Scissors, Video, Music2, Play, Pause, RotateCcw } from 'lucide-react';

interface CreatorTimelineProps {
  clip: ViralClip | null;
  currentTime: number; // in seconds (relative to clip start or absolute)
  onSeek: (time: number) => void;
  cuts?: EditOperation[];
  words?: WordTimestamp[];
}

export const CreatorTimeline: React.FC<CreatorTimelineProps> = ({
  clip,
  currentTime,
  onSeek,
  cuts = [],
  words = [],
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

  const activeCuts = cuts.filter((c) => c.enabled);

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 select-none">
      {/* Timeline Header & Timecode Display */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-red-600" />
          <span className="text-xs font-extrabold text-slate-900 tracking-wider uppercase">
            Clipper Multi-Track Timeline
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
            {duration.toFixed(1)}s Duration
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-900 font-extrabold">
            {relativeCurrent.toFixed(1)}s
          </span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500 font-medium">
            {duration.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Scrubbable Multi-Track Canvas Area */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-full bg-slate-900 rounded-xl overflow-hidden cursor-ew-resize pt-4 pb-2 px-1 space-y-1.5 touch-none"
      >
        {/* Playhead Vertical Line */}
        <div
          className="absolute top-0 bottom-0 z-30 pointer-events-none transition-transform"
          style={{ left: `${playheadPercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-3 h-3 bg-red-600 rounded-full shadow-md shadow-red-600/50 -mt-1 mx-auto" />
          <div className="w-0.5 h-full bg-red-500 mx-auto shadow-sm" />
        </div>

        {/* TRACK 1: Video Footage Track */}
        <div className="relative h-6 w-full rounded-md bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300">
            <Video className="w-3 h-3 text-red-400" />
            <span>VIDEO • 1080x1920 (9:16 Vertical Crop)</span>
          </div>
          {/* Active Video Region */}
          <div className="absolute inset-0 bg-red-600/15 border-l-2 border-r-2 border-red-500 pointer-events-none" />
        </div>

        {/* TRACK 2: Captions Track (Dynamic word intervals) */}
        <div className="relative h-6 w-full rounded-md bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-300 shrink-0 mr-2 z-10">
            <Type className="w-3 h-3 text-amber-400" />
            <span>CAPTIONS</span>
          </div>
          {/* Word Segments */}
          <div className="relative w-full h-4">
            {words.slice(0, 40).map((w, i) => {
              const relStart = Math.max(0, w.start - clipStart);
              const relEnd = Math.max(0, w.end - clipStart);
              const leftPct = Math.min(100, Math.max(0, (relStart / duration) * 100));
              const widthPct = Math.min(100 - leftPct, Math.max(1.5, ((relEnd - relStart) / duration) * 100));
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 bg-amber-400/40 border border-amber-300/60 rounded-xs"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={w.word}
                />
              );
            })}
          </div>
        </div>

        {/* TRACK 3: Cuts / EDL Track (Filler words & Silence cuts) */}
        <div className="relative h-6 w-full rounded-md bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-300 shrink-0 mr-2 z-10">
            <Scissors className="w-3 h-3 text-rose-400" />
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
                  className="absolute top-0 bottom-0 bg-red-600/80 border border-red-400 rounded-xs flex items-center justify-center text-[7px] font-bold text-white uppercase"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${cut.reason}: ${cut.start.toFixed(1)}s - ${cut.end.toFixed(1)}s`}
                >
                  CUT
                </div>
              );
            })}
          </div>
        </div>

        {/* TRACK 4: Audio Track (Voice waveform representation) */}
        <div className="relative h-5 w-full rounded-md bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 shrink-0 mr-2 z-10">
            <Music2 className="w-3 h-3 text-emerald-400" />
            <span>AUDIO</span>
          </div>
          {/* Stylized Audio Waveform Bars */}
          <div className="flex items-center justify-between w-full h-3 opacity-60">
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
