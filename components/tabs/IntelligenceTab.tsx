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
    <div className="space-y-4">
      
      {/* Feature 1: Viral Hook Score & Retention Heatmap */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              1. AI Viral Hook Heatmap
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-extrabold border border-red-200">
            {clips.length} Ranked Hooks
          </span>
        </div>

        {/* Visual Retention Heatmap Waveform Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-red-600" /> Retention Curve</span>
            <span className="text-emerald-700 font-mono font-bold">Peak: 96% Retention</span>
          </div>
          <div className="h-3.5 w-full rounded-lg bg-slate-100 flex overflow-hidden p-0.5 gap-0.5 border border-slate-200">
            <div className="h-full w-[35%] bg-gradient-to-r from-red-600 to-amber-500 rounded-sm" title="Hook: 98% retention" />
            <div className="h-full w-[25%] bg-gradient-to-r from-amber-500 to-emerald-500 rounded-sm" title="Transition: 88% retention" />
            <div className="h-full w-[40%] bg-gradient-to-r from-emerald-500 to-red-600 rounded-sm" title="Climax: 95% retention" />
          </div>
        </div>

        {/* Clip Cards List */}
        <div className="space-y-2 pt-1 max-h-[380px] overflow-y-auto pr-1">
          {clips.map((clip) => {
            const isSelected = activeClipId === clip.id;
            return (
              <div
                key={clip.id}
                onClick={() => onSelectClip(clip)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-red-500 bg-red-50/50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{clip.title}</h4>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold whitespace-nowrap border border-emerald-200">
                    {clip.viralScore}% VIRAL
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {clip.hookSummary}
                </p>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1 text-red-600 font-bold">
                    <Clock className="w-3 h-3" />
                    {formatTime(clip.start)} – {formatTime(clip.end)}
                  </span>
                  <span className="text-emerald-700 font-semibold">Est. Retention: {clip.retentionEstimate}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature 4: Silence & Filler Word Cutter */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              4. Auto Silence &amp; Filler Remover
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
            {fillerCut ? 'Removed (2.5s cut)' : '3 Detected'}
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Cuts awkward pauses (&gt;0.5s) and verbal fillers (umm, uhh) to boost watch time pacing.
        </p>

        <div className="space-y-1.5">
          {DETECTED_FILLER_WORDS.map((filler, i) => (
            <div
              key={i}
              className={`p-2 rounded-lg flex items-center justify-between text-xs transition-colors border ${
                fillerCut 
                  ? 'bg-slate-50 text-slate-400 line-through border-slate-200' 
                  : 'bg-slate-50/80 text-slate-700 border-slate-200'
              }`}
            >
              <span>&ldquo;{filler.word}&rdquo; at {filler.timestamp}</span>
              <span className="font-mono text-[10px] text-red-600 font-bold">+{filler.duration}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFillerCut(prev => !prev)}
          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            fillerCut
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>{fillerCut ? 'Restore Original Pauses' : '1-Click Remove All Fillers (Pacing +30%)'}</span>
        </button>
      </div>

      {/* Feature 5: AI Viral Title & SEO Description */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            5. AI Clickable Titles &amp; SEO Copy
          </h3>
        </div>

        <div className="space-y-2">
          {AI_SOCIAL_METADATA.viralTitles.map((title, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
            >
              <span className="text-xs text-slate-800 line-clamp-1 font-medium">{title}</span>
              <button
                onClick={() => copyToClipboard(title, idx)}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                title="Copy Title"
              >
                {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Feature 6: Voice Emotion & Energy Spike Detector */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              6. Voice Emotion Spikes
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
            High Intensity Climax
          </span>
        </div>
        <p className="text-[11px] text-slate-600">
          Detected energy inflection at <strong className="text-red-600">0:07 - 0:11</strong>. Automatically highlighted as high-impact retention hook.
        </p>
      </div>

    </div>
  );
};
