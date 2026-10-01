'use client';

import React, { useRef, useState, useMemo } from 'react';
import { ViralClip, WordTimestamp, EditOperation } from '@/lib/types';
import { 
  Film, 
  Type, 
  Scissors, 
  Video, 
  Music2, 
  Sparkles, 
  Zap, 
  Layers, 
  Pause, 
  VolumeX, 
  Clock 
} from 'lucide-react';

interface CreatorTimelineProps {
  clip: ViralClip | null;
  currentTime: number; // in seconds (absolute media time)
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

  // Section 15: AI Semantic Markers
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
    cuts.filter(c => c.reason === 'silence').forEach((c) => {
      markers.push({
        type: 'PAUSE',
        time: c.start,
        relativeTime: Math.max(0, c.start - clipStart),
        label: 'PAUSE',
        color: 'bg-rose-500 text-white border-rose-400',
      });
    });

    // [FILLER] from cuts
    cuts.filter(c => c.reason === 'filler').forEach((c) => {
      markers.push({
        type: 'FILLER',
        time: c.start,
        relativeTime: Math.max(0, c.start - clipStart),
        label: 'FILLER',
        color: 'bg-orange-500 text-white border-orange-400',
      });
    });

    // [B-ROLL] interval
    if (duration > 15) {
      const brollTime = clipStart + Math.min(duration * 0.7, 14);
      markers.push({
        type: 'B-ROLL',
        time: brollTime,
        relativeTime: brollTime - clipStart,
        label: 'B-ROLL',
        color: 'bg-indigo-500 text-white border-indigo-400',
      });
    }

    return markers;
  }, [clipStart, duration, cuts]);

  return (
    <div className="w-full bg-[#111827] rounded-2xl border border-[#283344] p-4 shadow-xl space-y-3 select-none text-[#F8FAFC]">
      
      {/* Timeline Header & Timecode Display */}
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-2.5">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white tracking-wider uppercase">
            AI-First Semantic Timeline
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 font-mono font-bold border border-cyan-800/40">
            {duration.toFixed(1)}s Duration
          </span>
        </div>

        {/* Timecode */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-cyan-400 font-bold">
            {relativeCurrent.toFixed(1)}s
          </span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 font-medium">
            {duration.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Semantic Marker Strip (Section 15) */}
      <div className="relative w-full h-6 bg-[#0B0F17] rounded-lg border border-[#1F2937] px-2 flex items-center overflow-hidden">
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
        className="relative w-full bg-[#0B0F17] rounded-xl overflow-hidden cursor-ew-resize pt-4 pb-2 px-1 space-y-1.5 touch-none border border-[#1F2937]"
      >
        {/* Playhead Vertical Line */}
        <div
          className="absolute top-0 bottom-0 z-30 pointer-events-none transition-transform"
          style={{ left: `${playheadPercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-3.5 h-3.5 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50 -mt-1 mx-auto" />
          <div className="w-0.5 h-full bg-cyan-400 mx-auto shadow-sm" />
        </div>

        {/* TRACK 1: Video Footage Track */}
        <div className="relative h-6 w-full rounded-md bg-[#161F30] border border-[#283344] overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300">
            <Video className="w-3 h-3 text-cyan-400" />
            <span>VIDEO • 1080x1920 (9:16 Vertical Short)</span>
          </div>
          <div className="absolute inset-0 bg-cyan-500/10 border-l-2 border-r-2 border-cyan-400 pointer-events-none" />
        </div>

        {/* TRACK 2: Dynamic Captions Track */}
        <div className="relative h-6 w-full rounded-md bg-[#161F30] border border-[#283344] overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-300 shrink-0 mr-2 z-10">
            <Type className="w-3 h-3 text-amber-400" />
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
                  className="absolute top-0 bottom-0 bg-amber-400/30 border border-amber-300/50 rounded-xs"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={w.word}
                />
              );
            })}
          </div>
        </div>

        {/* TRACK 3: Cuts / EDL Track (Filler words & Silence cuts) */}
        <div className="relative h-6 w-full rounded-md bg-[#161F30] border border-[#283344] overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-400 shrink-0 mr-2 z-10">
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
                  className="absolute top-0 bottom-0 bg-rose-600/80 border border-rose-400 rounded-xs flex items-center justify-center text-[7px] font-bold text-white uppercase"
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
        <div className="relative h-5 w-full rounded-md bg-[#161F30] border border-[#283344] overflow-hidden flex items-center px-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 shrink-0 mr-2 z-10">
            <Music2 className="w-3 h-3 text-emerald-400" />
            <span>AUDIO</span>
          </div>
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
