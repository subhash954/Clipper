'use client';

import React from 'react';
import { VisualLayoutSettings } from '@/lib/types';
import { SplitSquareVertical, Clock, Shield, Sparkles, AlertTriangle } from 'lucide-react';

interface VisualLayoutTabProps {
  settings: VisualLayoutSettings;
  onChange: (settings: VisualLayoutSettings) => void;
}

export const VisualLayoutTab: React.FC<VisualLayoutTabProps> = ({ settings, onChange }) => {
  const handleUpdate = (updates: Partial<VisualLayoutSettings>) => {
    onChange({ ...settings, ...updates });
  };

  const satisfyingGames = [
    { id: 'subway', name: 'Subway Surfers Loop', tag: 'High Virality' },
    { id: 'minecraft', name: 'Minecraft Parkour', tag: 'Max Watchtime' },
    { id: 'gta', name: 'GTA 5 Ramp Stunts', tag: 'Fast Paced' },
    { id: 'none', name: 'Disable Bottom Video', tag: 'Full Video' },
  ] as const;

  const barColors = ['#A855F7', '#EF4444', '#10B981', '#38BDF8', '#F59E0B'];

  return (
    <div className="space-y-5">
      
      {/* Feature 18: Split-Screen Satisfying Video Layouter */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <SplitSquareVertical className="w-4 h-4 text-indigo-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                18. Satisfying Split-Screen
              </h3>
              <p className="text-[10px] text-slate-400">Speaker on Top (50%) + Satisfying Clip on Bottom (50%)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ splitScreenEnabled: !settings.splitScreenEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.splitScreenEnabled ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.splitScreenEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Satisfying Clip Options */}
        <div className="space-y-1.5 pt-1">
          {satisfyingGames.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => handleUpdate({ satisfyingVideoType: game.id, splitScreenEnabled: game.id !== 'none' })}
              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                settings.splitScreenEnabled && settings.satisfyingVideoType === game.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-white/5 bg-slate-800/40 hover:bg-slate-800/80'
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-white">{game.name}</p>
                <p className="text-[10px] text-slate-400">{game.tag}</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                TikTok Viral Metagame
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Feature 19: Dynamic Progress Bar / Countdown Timer */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              19. Dynamic Progress Bar
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showProgressBar: !settings.showProgressBar })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.showProgressBar ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.showProgressBar ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Bar Color Pickers */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
            Progress Line Color
          </label>
          <div className="flex items-center gap-2">
            {barColors.map((color) => (
              <button
                key={color}
                onClick={() => handleUpdate({ progressBarColor: color, showProgressBar: true })}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  settings.progressBarColor === color
                    ? 'scale-110 border-white shadow-md'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Feature 20: Custom Watermark / Logo / Handle */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              20. Custom Watermark & Handle
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showCustomLogo: !settings.showCustomLogo })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.showCustomLogo ? 'bg-amber-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.showCustomLogo ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <input
          type="text"
          value={settings.customLogoText}
          onChange={(e) => handleUpdate({ customLogoText: e.target.value })}
          placeholder="@yourchannel / brand logo"
          className="w-full p-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />

        <div className="grid grid-cols-3 gap-2">
          {(['top-right', 'top-left', 'bottom-right'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => handleUpdate({ logoPosition: pos, showCustomLogo: true })}
              className={`py-1.5 text-[11px] font-semibold rounded-lg uppercase border transition-colors ${
                settings.logoPosition === pos
                  ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                  : 'border-white/10 bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Feature 22: Intro Hook Banner Template */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              22. Intro Hook Sticker
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showIntroHook: !settings.showIntroHook })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.showIntroHook ? 'bg-rose-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.showIntroHook ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <input
          type="text"
          value={settings.introHookText}
          onChange={(e) => handleUpdate({ introHookText: e.target.value })}
          placeholder="WAIT TILL THE END 😱"
          className="w-full p-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
        />
      </div>

      {/* Feature 21: Background Blur */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <div>
            <p className="text-xs font-semibold text-white">21. Studio Background Blur</p>
            <p className="text-[10px] text-slate-400">Cinematic depth-of-field effect on creator background</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleUpdate({ backgroundBlur: !settings.backgroundBlur })}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            settings.backgroundBlur ? 'bg-purple-600' : 'bg-slate-700'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
              settings.backgroundBlur ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

    </div>
  );
};
