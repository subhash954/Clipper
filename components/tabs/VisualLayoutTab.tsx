'use client';

import React, { useState } from 'react';
import { VisualLayoutSettings, EditOperation } from '@/lib/types';
import { AspectRatio, TrackingMode, ManualReframeSettings } from '@/lib/reframe/types';
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
  ShieldCheck,
  Lock,
  Unlock,
  Sliders,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface VisualLayoutTabProps {
  settings: VisualLayoutSettings;
  onChange: (settings: VisualLayoutSettings) => void;
  bRollKeywords?: string[];
  onInsertBroll?: (broll: EditOperation) => void;
  onTriggerReframe?: (mode: TrackingMode, ratio: AspectRatio) => void;
  isReframeLoading?: boolean;
  reframeStatus?: string;
}

export const VisualLayoutTab: React.FC<VisualLayoutTabProps> = ({
  settings,
  onChange,
  bRollKeywords = ['business', 'creator', 'technology', 'focus'],
  onInsertBroll,
  onTriggerReframe,
  isReframeLoading = false,
  reframeStatus = '',
}) => {
  const selectedRatio: AspectRatio = settings.aspectRatio || '9:16';
  const framingMode: TrackingMode = settings.trackingMode || 'center';
  const manualPos: ManualReframeSettings = settings.manualPosition || { x: 0.5, y: 0.5, zoom: 1.0 };
  const isLocked = Boolean(settings.lockFraming);

  const [insertedBrolls, setInsertedBrolls] = useState<string[]>([]);

  const handleUpdate = (updates: Partial<VisualLayoutSettings>) => {
    onChange({ ...settings, ...updates });
  };

  const handleRatioSelect = (ratio: AspectRatio) => {
    handleUpdate({ aspectRatio: ratio });
    onTriggerReframe?.(framingMode, ratio);
  };

  const handleModeSelect = (mode: TrackingMode) => {
    handleUpdate({ trackingMode: mode });
    onTriggerReframe?.(mode, selectedRatio);
  };

  const handleManualChange = (partial: Partial<ManualReframeSettings>) => {
    const updated = { ...manualPos, ...partial };
    handleUpdate({
      trackingMode: 'manual',
      manualPosition: updated,
    });
  };

  const handleToggleLock = () => {
    const nextLocked = !isLocked;
    handleUpdate({ lockFraming: nextLocked });
    onTriggerReframe?.('smart', selectedRatio);
  };

  const handleInsertBrollClick = (keyword: string, index: number) => {
    if (!insertedBrolls.includes(keyword)) {
      setInsertedBrolls([...insertedBrolls, keyword]);
      
      const brollOp: EditOperation = {
        id: `broll-${Date.now()}-${index}`,
        type: 'BROLL',
        start: 4 + index * 5,
        end: 7 + index * 5,
        reason: 'manual_cut',
        enabled: true,
        word: keyword,
      };
      
      onInsertBroll?.(brollOp);
    }
  };

  const keyframeCount = settings.reframeTrack?.keyframes?.length || 0;

  return (
    <div className="space-y-5 text-[#F8FAFC]">
      {/* 1. AUTO REFRAME TOOL */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3.5">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-2.5">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Auto Reframe &amp; Composition
            </h3>
          </div>
          <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800/60">
            {selectedRatio} Active
          </span>
        </div>

        {/* Aspect Ratios Grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: '9:16', label: '9:16', desc: 'Shorts / Reels', icon: Smartphone },
            { id: '1:1', label: '1:1', desc: 'Square Feed', icon: Square },
            { id: '16:9', label: '16:9', desc: 'Landscape', icon: Tv },
            { id: '4:5', label: '4:5', desc: 'Social Post', icon: Maximize2 },
          ].map((aspect) => {
            const isSelected = selectedRatio === aspect.id;
            const Icon = aspect.icon;

            return (
              <button
                key={aspect.id}
                type="button"
                onClick={() => handleRatioSelect(aspect.id as AspectRatio)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 shadow-sm ring-1 ring-cyan-400'
                    : 'border-[#283344] bg-[#0E1524] text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon
                  className={`w-4 h-4 mx-auto mb-1 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}
                />
                <p className="text-xs font-bold leading-none">{aspect.label}</p>
                <p className="text-[9px] text-slate-500 mt-1">{aspect.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Framing & Subject Tracking Modes */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-400 block">
              Subject Tracking Mode
            </label>
            {isReframeLoading && (
              <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-mono">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {reframeStatus || 'Tracking subject...'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'center', label: 'Center Crop', desc: 'Balanced static crop' },
              { id: 'smart', label: 'Smart Centering', desc: 'AI subject tracking' },
              { id: 'manual', label: 'Manual Framing', desc: 'Custom pan & zoom' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleModeSelect(mode.id as TrackingMode)}
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

          {/* Mode 2 Controls: Smart Centering Info & Lock Framing */}
          {framingMode === 'smart' && (
            <div className="p-3 rounded-lg bg-[#0E1524] border border-[#283344] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Subject Tracking Active</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLock}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    isLocked
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-3 h-3 text-amber-400" />
                      Locked Focal Point
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3 h-3 text-slate-400" />
                      Lock Framing
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                {keyframeCount > 0
                  ? `Temporal smoothing active across ${keyframeCount} keyframes with headroom anchoring.`
                  : 'Analyzes face & torso centroid to smoothly re-center without jitter.'}
              </p>
            </div>
          )}

          {/* Mode 3 Controls: Manual Sliders */}
          {framingMode === 'manual' && (
            <div className="p-3.5 rounded-lg bg-[#0E1524] border border-[#283344] space-y-3 text-xs">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold border-b border-[#1F2937] pb-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>Manual Viewport Controls</span>
              </div>

              {/* Position X */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Horizontal Pan (X)</span>
                  <span className="font-mono text-cyan-400">{Math.round(manualPos.x * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={manualPos.x}
                  onChange={(e) => handleManualChange({ x: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Position Y */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Vertical Pan (Y)</span>
                  <span className="font-mono text-cyan-400">{Math.round(manualPos.y * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={manualPos.y}
                  onChange={(e) => handleManualChange({ y: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Zoom */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Crop Zoom</span>
                  <span className="font-mono text-cyan-400">{(manualPos.zoom || 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.05"
                  value={manualPos.zoom || 1.0}
                  onChange={(e) => handleManualChange({ zoom: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              Preview and export use the identical FFmpeg crop math: lossless aspect framing with zero distortion.
            </span>
          </p>
        </div>
      </div>

      {/* 2. CONTEXTUAL B-ROLL OVERLAYS */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Contextual B-Roll Suggestions
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Verified Stock</span>
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
                    <p className="text-[10px] text-slate-500">Commercial Safe · High Confidence</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleInsertBrollClick(keyword, i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isInserted
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm'
                  }`}
                >
                  {isInserted ? (
                    <>
                      <Check className="w-3 h-3" /> Inserted to Timeline
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

      {/* 3. VISUAL OVERLAYS & RETENTION ENHANCEMENTS */}
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
