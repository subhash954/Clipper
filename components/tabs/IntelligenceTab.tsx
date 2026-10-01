'use client';

import React, { useState } from 'react';
import { ViralClip } from '@/lib/types';
import { DETECTED_FILLER_WORDS, AI_SOCIAL_METADATA } from '@/lib/sampleData';
import { Flame, Clock, Sparkles, Scissors, Activity, Copy, Check, Eye } from 'lucide-react';

interface IntelligenceTabProps {
  clips: ViralClip[];
  activeClipId: string | null;
  onSelectClip: (clip: ViralClip) => void;
  onJumpToTime: (time: number) => void;
}

export const IntelligenceTab: React.FC<IntelligenceTabProps> = ({
  clips,
  activeClipId,
  onSelectClip,
  onJumpToTime
}) => {
  const [fillerCut, setFillerCut] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="space-y-5">
      
      {/* Feature 1: Viral Hook Score & Retention Heatmap */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500 fill-rose-500/30" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              1. AI Viral Hook Heatmap
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
            {clips.length} Ranked Hooks
          </span>
        </div>

        {/* Visual Retention Heatmap Waveform Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-purple-400" /> Retention Curve</span>
            <span className="text-emerald-400 font-mono">Peak: 94% Retention</span>
          </div>
          <div className="h-4 w-full rounded-lg bg-slate-800 flex overflow-hidden p-0.5 gap-0.5">
            <div className="h-full w-[35%] bg-gradient-to-r from-emerald-500 to-teal-400 rounded-sm" title="Hook: 98% retention" />
            <div className="h-full w-[25%] bg-gradient-to-r from-teal-400 to-amber-500 rounded-sm" title="Transition: 86% retention" />
            <div className="h-full w-[40%] bg-gradient-to-r from-amber-500 to-emerald-400 rounded-sm" title="Climax: 92% retention" />
          </div>
        </div>

        {/* Clip Cards List */}
        <div className="space-y-2 pt-1">
          {clips.map((clip) => {
            const isSelected = activeClipId === clip.id;
            return (
              <div
                key={clip.id}
                onClick={() => onSelectClip(clip)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                    : 'border-white/10 bg-slate-800/40 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-bold text-white">{clip.title}</h4>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold whitespace-nowrap">
                    {clip.viralScore}% VIRAL
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {clip.hookSummary}
                </p>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1 text-purple-300">
                    <Clock className="w-3 h-3" />
                    {formatTime(clip.start)} – {formatTime(clip.end)}
                  </span>
                  <span className="text-emerald-400">Est. Retention: {clip.retentionEstimate}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature 4: Silence & Filler Word Cutter */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              4. Auto Silence & Filler Remover
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
            {fillerCut ? 'Removed (2.5s cut)' : '3 Detected'}
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Cuts awkward pauses (&gt;0.5s) and verbal fillers (umm, uhh) to boost pacing.
        </p>

        <div className="space-y-1.5">
          {DETECTED_FILLER_WORDS.map((filler, i) => (
            <div
              key={i}
              className={`p-2 rounded-lg flex items-center justify-between text-xs transition-colors ${
                fillerCut ? 'bg-slate-800/20 text-slate-500 line-through' : 'bg-slate-800/60 text-slate-300'
              }`}
            >
              <span>&ldquo;{filler.word}&rdquo; at {filler.timestamp}</span>
              <span className="font-mono text-[10px] text-purple-400">+{filler.duration}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFillerCut(prev => !prev)}
          className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            fillerCut
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 shadow-md shadow-purple-600/20'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>{fillerCut ? 'Restore Original Pauses' : '1-Click Remove All Fillers (Pacing +30%)'}</span>
        </button>
      </div>

      {/* Feature 5: AI Viral Title & SEO Description */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            5. AI Clickable Titles & SEO Copy
          </h3>
        </div>

        <div className="space-y-2">
          {AI_SOCIAL_METADATA.viralTitles.map((title, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-between gap-2"
            >
              <span className="text-xs text-slate-200 line-clamp-1">{title}</span>
              <button
                onClick={() => copyToClipboard(title, idx)}
                className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                title="Copy Title"
              >
                {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Feature 6: Voice Emotion & Energy Spike Detector */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              6. Voice Emotion Spikes
            </h3>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">High Intensity Detected</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Detected energy inflection at <strong className="text-purple-300">0:07 - 0:11</strong> (&ldquo;SPEED WINS THE GAME&rdquo;). Automatically highlighted as high-impact climax.
        </p>
      </div>

    </div>
  );
};
