'use client';

import React from 'react';
import { ViralClip } from '@/lib/types';
import { Flame, Clock, Sparkles, CheckCircle2 } from 'lucide-react';

interface ViralClipSelectorProps {
  clips: ViralClip[];
  activeClipId: string | null;
  onSelectClip: (clip: ViralClip) => void;
}

export const ViralClipSelector: React.FC<ViralClipSelectorProps> = ({
  clips,
  activeClipId,
  onSelectClip
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-rose-500 fill-rose-500/30" />
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              AI Viral Hook Finder
            </h3>
            <p className="text-[11px] text-slate-400">
              Ranked by psychological hook retention score
            </p>
          </div>
        </div>

        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {clips.length} Viral Cuts
        </span>
      </div>

      {/* Clip Cards List */}
      <div className="space-y-2.5">
        {clips.map((clip) => {
          const isSelected = activeClipId === clip.id;

          return (
            <div
              key={clip.id}
              onClick={() => onSelectClip(clip)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10 scale-[1.01]'
                  : 'border-white/10 bg-slate-800/40 hover:border-white/20 hover:bg-slate-800/70'
              }`}
            >
              {/* Top Row: Title + Viral Score */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    {clip.title}
                  </h4>
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  )}
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold whitespace-nowrap">
                  <span>{clip.viralScore}% VIRAL</span>
                </div>
              </div>

              {/* Hook explanation */}
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {clip.hookSummary}
              </p>

              {/* Bottom Metadata: Duration & Tags */}
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5 text-[10px] text-slate-400">
                <div className="flex items-center gap-1 font-mono text-purple-300">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(clip.start)} – {formatTime(clip.end)}</span>
                  <span className="text-slate-500">({Math.round(clip.end - clip.start)}s)</span>
                </div>

                <div className="flex items-center gap-1">
                  {clip.tags?.slice(0, 2).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 text-[9px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
