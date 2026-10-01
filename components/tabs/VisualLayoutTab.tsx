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
    <div className="space-y-5 text-slate-900">
      {/* 1. AUTO REFRAME TOOL */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Auto Reframe &amp; Composition
            </h3>
          </div>
          <span className="text-[10px] text-red-700 font-bold bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 shadow-xs">
            {selectedRatio} Active
          </span>
        </div>

        {/* Aspect Ratios Grid */}
        <div className="grid grid-cols-4 gap-2.5">
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
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-red-500 bg-red-50/70 text-red-700 shadow-xs ring-1 ring-red-400/50'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 mx-auto mb-1.5 ${isSelected ? 'text-red-600' : 'text-slate-400'}`}
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
            <label className="text-[11px] font-bold text-slate-700 block">
              Subject Tracking Mode
            </label>
            {isReframeLoading && (
              <span className="text-[10px] text-red-600 flex items-center gap-1 font-mono font-medium">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {reframeStatus || 'Tracking subject...'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'center', label: 'Center Crop', desc: 'Balanced static crop' },
              { id: 'smart', label: 'Smart Centering', desc: 'AI subject tracking' },
              { id: 'manual', label: 'Manual Framing', desc: 'Custom pan & zoom' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleModeSelect(mode.id as TrackingMode)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  framingMode === mode.id
                    ? 'border-red-500 bg-red-50/80 text-slate-900 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300'
                }`}
              >
                <p className="text-xs font-bold leading-tight">{mode.label}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{mode.desc}</p>
              </button>
            ))}
          </div>

          {/* Mode 2 Controls: Smart Centering Info & Lock Framing */}
          {framingMode === 'smart' && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-red-600 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Subject Tracking Active</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLock}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    isLocked
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-3 h-3 text-amber-600" />
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
              <p className="text-[11px] text-slate-600 leading-normal">
                {keyframeCount > 0
                  ? `Temporal smoothing active across ${keyframeCount} keyframes with headroom anchoring.`
                  : 'Analyzes face & torso centroid to smoothly re-center without jitter.'}
              </p>
            </div>
          )}

          {/* Mode 3 Controls: Manual Sliders */}
          {framingMode === 'manual' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-800">
              <div className="flex items-center gap-1.5 text-red-600 font-bold border-b border-slate-200 pb-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>Manual Viewport Controls</span>
              </div>

              {/* Position X */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                  <span>Horizontal Pan (X)</span>
                  <span className="font-mono text-red-600 font-bold">{Math.round(manualPos.x * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={manualPos.x}
                  onChange={(e) => handleManualChange({ x: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
              </div>

              {/* Position Y */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                  <span>Vertical Pan (Y)</span>
                  <span className="font-mono text-red-600 font-bold">{Math.round(manualPos.y * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={manualPos.y}
                  onChange={(e) => handleManualChange({ y: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
              </div>

              {/* Zoom */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                  <span>Crop Zoom</span>
                  <span className="font-mono text-red-600 font-bold">{(manualPos.zoom || 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.05"
                  value={manualPos.zoom || 1.0}
                  onChange={(e) => handleManualChange({ zoom: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>
              Preview and export use the identical FFmpeg crop math: lossless aspect framing with zero distortion.
            </span>
          </p>
        </div>
      </div>

      {/* 2. CONTEXTUAL B-ROLL OVERLAYS */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Contextual B-Roll Suggestions
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono font-medium">Verified Stock</span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-normal">
          AI detected core discussion themes from the spoken transcript. Insert licensed stock overlays into the timeline:
        </p>

        {/* Keywords list */}
        <div className="space-y-2.5">
          {bRollKeywords.map((keyword, i) => {
            const isInserted = insertedBrolls.includes(keyword);

            return (
              <div
                key={i}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-xs">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 capitalize">&ldquo;{keyword}&rdquo;</p>
                    <p className="text-[10px] text-slate-500">Commercial Safe · High Confidence</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleInsertBrollClick(keyword, i)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isInserted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-xs'
                      : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-xs'
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
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Retention Enhancements
          </h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between text-xs text-slate-800 cursor-pointer">
            <div>
              <p className="font-bold text-slate-900">Dynamic Bottom Progress Bar</p>
              <p className="text-[10px] text-slate-500">Visual pacing cue to boost viewer completion rate</p>
            </div>
            <input
              type="checkbox"
              checked={settings.showProgressBar}
              onChange={(e) => handleUpdate({ showProgressBar: e.target.checked })}
              className="w-4 h-4 accent-red-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-800 cursor-pointer">
            <div>
              <p className="font-bold text-slate-900">Background Blur Padding</p>
              <p className="text-[10px] text-slate-500">Soft blurred mirror behind non-vertical footage</p>
            </div>
            <input
              type="checkbox"
              checked={settings.backgroundBlur}
              onChange={(e) => handleUpdate({ backgroundBlur: e.target.checked })}
              className="w-4 h-4 accent-red-600 rounded"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
