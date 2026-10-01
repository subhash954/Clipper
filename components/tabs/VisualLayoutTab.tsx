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

  const barColors = ['#FF0000', '#EF4444', '#10B981', '#38BDF8', '#F59E0B'];

  return (
    <div className="space-y-4">
      
      {/* Feature 18: Split-Screen Satisfying Video Layouter */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <SplitSquareVertical className="w-4 h-4 text-red-600" />
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                18. Satisfying Split-Screen
              </h3>
              <p className="text-[10px] text-slate-500">Speaker on Top (50%) + Satisfying Clip on Bottom (50%)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ splitScreenEnabled: !settings.splitScreenEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.splitScreenEnabled ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                settings.splitScreenEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Satisfying Clip Options */}
        <div className="space-y-2 pt-1">
          {satisfyingGames.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => handleUpdate({ satisfyingVideoType: game.id, splitScreenEnabled: game.id !== 'none' })}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                settings.splitScreenEnabled && settings.satisfyingVideoType === game.id
                  ? 'border-red-500 bg-red-50/60 shadow-2xs ring-1 ring-red-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>
                <p className="text-xs font-bold text-slate-900">{game.name}</p>
                <p className="text-[10px] text-slate-500">{game.tag}</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                Viral Metagame
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Feature 19: Dynamic Progress Bar / Countdown Timer */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              19. Dynamic Progress Bar
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showProgressBar: !settings.showProgressBar })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.showProgressBar ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                settings.showProgressBar ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Bar Color Pickers */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
            Progress Line Color
          </label>
          <div className="flex items-center gap-2.5">
            {barColors.map((color) => (
              <button
                key={color}
                onClick={() => handleUpdate({ progressBarColor: color, showProgressBar: true })}
                className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                  settings.progressBarColor === color
                    ? 'scale-115 border-slate-900 shadow-sm'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Feature 20: Custom Watermark / Logo / Handle */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              20. Custom Watermark &amp; Handle
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showCustomLogo: !settings.showCustomLogo })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.showCustomLogo ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
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
          className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-100"
        />

        <div className="grid grid-cols-3 gap-2">
          {(['top-right', 'top-left', 'bottom-right'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => handleUpdate({ logoPosition: pos, showCustomLogo: true })}
              className={`py-2 text-[11px] font-bold rounded-xl uppercase border transition-colors cursor-pointer ${
                settings.logoPosition === pos
                  ? 'border-red-500 bg-red-50 text-red-700 shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Feature 22: Intro Hook Banner Template */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              22. Intro Hook Sticker
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showIntroHook: !settings.showIntroHook })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.showIntroHook ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
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
          className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-100"
        />
      </div>

      {/* Feature 21: Background Blur */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-red-600" />
          <div>
            <p className="text-xs font-bold text-slate-900">21. Studio Background Blur</p>
            <p className="text-[10px] text-slate-500">Cinematic depth-of-field effect on creator background</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleUpdate({ backgroundBlur: !settings.backgroundBlur })}
          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
            settings.backgroundBlur ? 'bg-red-600' : 'bg-slate-200'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
              settings.backgroundBlur ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

    </div>
  );
};
