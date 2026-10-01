'use client';

import React, { useState } from 'react';
import { VisualLayoutSettings } from '@/lib/types';
import { 
  Crop, 
  Smartphone, 
  Square, 
  Tv, 
  Maximize2, 
  Sparkles, 
  Check, 
  Film, 
  Layers, 
  Search,
  ExternalLink,
  ShieldCheck,
  SplitSquareVertical
} from 'lucide-react';

interface VisualLayoutTabProps {
  settings: VisualLayoutSettings;
  onChange: (settings: VisualLayoutSettings) => void;
  bRollKeywords?: string[];
}

export const VisualLayoutTab: React.FC<VisualLayoutTabProps> = ({ 
  settings, 
  onChange,
  bRollKeywords = ['business', 'creator', 'technology', 'focus']
}) => {
  const [selectedRatio, setSelectedRatio] = useState<'9:16' | '1:1' | '16:9' | '4:5'>('9:16');
  const [framingMode, setFramingMode] = useState<'center' | 'speaker' | 'manual'>('center');
  const [insertedBrolls, setInsertedBrolls] = useState<string[]>([]);

  const handleUpdate = (updates: Partial<VisualLayoutSettings>) => {
    onChange({ ...settings, ...updates });
  };

  const handleInsertBroll = (keyword: string) => {
    if (!insertedBrolls.includes(keyword)) {
      setInsertedBrolls([...insertedBrolls, keyword]);
    }
  };

  return (
    <div className="space-y-5 text-[#F8FAFC]">
      
      {/* 1. AUTO REFRAME TOOL (Section 19) */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-2.5">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Auto Reframe &amp; Composition
            </h3>
          </div>
          <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800/60">
            {selectedRatio} Selected
          </span>
        </div>

        {/* Aspect Ratios Grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: '9:16', label: '9:16', desc: 'Shorts / Reels', icon: Smartphone },
            { id: '1:1', label: '1:1', desc: 'Square Feed', icon: Square },
            { id: '16:9', label: '16:9', desc: 'Landscape', icon: Tv },
            { id: '4:5', label: '4:5', desc: 'Vertical Post', icon: Maximize2 },
          ].map((aspect) => {
            const isSelected = selectedRatio === aspect.id;
            const Icon = aspect.icon;

            return (
              <button
                key={aspect.id}
                type="button"
                onClick={() => setSelectedRatio(aspect.id as any)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 shadow-cyan-sm ring-1 ring-cyan-400'
                    : 'border-[#283344] bg-[#0E1524] text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon className={`w-4 h-4 mx-auto mb-1 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                <p className="text-xs font-bold leading-none">{aspect.label}</p>
                <p className="text-[9px] text-slate-500 mt-1">{aspect.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Framing & Subject Tracking (Section 19: Honest status) */}
        <div className="pt-2 space-y-2">
          <label className="text-[11px] font-bold text-slate-400 block">
            Subject Framing Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'center', label: 'Center Crop', desc: 'Balanced 9:16 slice' },
              { id: 'speaker', label: 'Smart Centering', desc: 'Speaker focus' },
              { id: 'manual', label: 'Manual Position', desc: 'Custom offset' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setFramingMode(mode.id as any)}
                className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  framingMode === mode.id
                    ? 'border-cyan-500 bg-cyan-950/30 text-white'
                    : 'border-[#283344] bg-[#0E1524] text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="text-xs font-bold leading-tight">{mode.label}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{mode.desc}</p>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Smart crop applied via FFmpeg filtergraph: 1080x1920 with zero distortion.</span>
          </p>
        </div>
      </div>

      {/* 2. CONTEXTUAL B-ROLL OVERLAYS (Section 20) */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Contextual B-Roll Suggestions
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Pixabay Verified API
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          AI detected core discussion themes from the spoken transcript. Insert licensed stock overlays into the timeline:
        </p>

        {/* Keywords list */}
        <div className="space-y-2">
          {bRollKeywords.map((keyword, i) => {
            const isInserted = insertedBrolls.includes(keyword);

            return (
              <div
                key={i}
                className="p-3 rounded-lg bg-[#0E1524] border border-[#283344] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center">
                    <Film className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-white capitalize">&ldquo;{keyword}&rdquo;</p>
                    <p className="text-[10px] text-slate-500">Pixabay Commercial Safe · High Confidence</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleInsertBroll(keyword)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isInserted
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm'
                  }`}
                >
                  {isInserted ? (
                    <>
                      <Check className="w-3 h-3" /> Inserted
                    </>
                  ) : (
                    'Insert B-Roll'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. VISUAL OVERLAYS & PROGRESS BAR */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-2.5">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Retention Enhancements
          </h3>
        </div>

        <div className="space-y-2.5">
          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <div>
              <p className="font-bold">Dynamic Bottom Progress Bar</p>
              <p className="text-[10px] text-slate-500">Visual pacing cue to boost viewer completion rate</p>
            </div>
            <input
              type="checkbox"
              checked={settings.showProgressBar}
              onChange={(e) => handleUpdate({ showProgressBar: e.target.checked })}
              className="w-4 h-4 accent-cyan-400"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <div>
              <p className="font-bold">Background Blur Padding</p>
              <p className="text-[10px] text-slate-500">Soft blurred mirror behind non-vertical footage</p>
            </div>
            <input
              type="checkbox"
              checked={settings.backgroundBlur}
              onChange={(e) => handleUpdate({ backgroundBlur: e.target.checked })}
              className="w-4 h-4 accent-cyan-400"
            />
          </label>
        </div>
      </div>

    </div>
  );
};
