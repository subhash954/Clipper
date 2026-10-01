'use client';

import React from 'react';
import { SubtitleStyle, SubtitlePreset } from '@/lib/types';
import { PRESET_STYLES } from '@/lib/sampleData';
import { Palette, Type, AlignVerticalJustifyCenter, Smile, Sparkles } from 'lucide-react';

interface SubtitleStylerProps {
  currentStyle: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
}

export const SubtitleStyler: React.FC<SubtitleStylerProps> = ({ currentStyle, onChange }) => {
  const handlePresetSelect = (preset: SubtitlePreset) => {
    if (PRESET_STYLES[preset]) {
      onChange({ ...PRESET_STYLES[preset] });
    }
  };

  const handleUpdate = (updates: Partial<SubtitleStyle>) => {
    onChange({ ...currentStyle, ...updates });
  };

  const colorSwatches = [
    { name: 'Hormozi Gold', hex: '#FACC15' },
    { name: 'Beast Green', hex: '#22C55E' },
    { name: 'Electric Cyan', hex: '#06B6D4' },
    { name: 'Hot Pink', hex: '#F43F5E' },
    { name: 'Flame Orange', hex: '#FB923C' },
    { name: 'Clean White', hex: '#FFFFFF' }
  ];

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Caption Styling Studio
          </h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
          Live Sync
        </span>
      </div>

      {/* 1. Viral Creator Presets */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2.5 block">
          Viral Creator Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          
          {/* Hormozi Preset */}
          <button
            type="button"
            onClick={() => handlePresetSelect('hormozi')}
            className={`p-3 rounded-xl border text-left transition-all ${
              currentStyle.preset === 'hormozi'
                ? 'border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-500/10'
                : 'border-white/10 bg-slate-800/60 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-yellow-400">Alex Hormozi</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-300">#1 Pop</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Bold Impact • Yellow Pop • Emojis</p>
          </button>

          {/* MrBeast Preset */}
          <button
            type="button"
            onClick={() => handlePresetSelect('beast')}
            className={`p-3 rounded-xl border text-left transition-all ${
              currentStyle.preset === 'beast'
                ? 'border-emerald-400 bg-emerald-400/10 shadow-lg shadow-emerald-500/10'
                : 'border-white/10 bg-slate-800/60 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">MrBeast</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300">Punchy</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Punchy Sans • Green Flash • Bounce</p>
          </button>

          {/* Minimalist Preset */}
          <button
            type="button"
            onClick={() => handlePresetSelect('minimal')}
            className={`p-3 rounded-xl border text-left transition-all ${
              currentStyle.preset === 'minimal'
                ? 'border-sky-400 bg-sky-400/10 shadow-lg shadow-sky-500/10'
                : 'border-white/10 bg-slate-800/60 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400">Clean Minimal</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300">Modern</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Inter Font • Cyan Glow • Subtle</p>
          </button>

          {/* Cyberpunk Preset */}
          <button
            type="button"
            onClick={() => handlePresetSelect('neon')}
            className={`p-3 rounded-xl border text-left transition-all ${
              currentStyle.preset === 'neon'
                ? 'border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/10'
                : 'border-white/10 bg-slate-800/60 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-pink-400">Neon Cyber</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300">Vibrant</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Pink & Cyan • High Energy</p>
          </button>

        </div>
      </div>

      {/* 2. Highlight Color Swatches */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2 block">
          Spoken Word Highlight Color
        </label>
        <div className="flex items-center gap-2">
          {colorSwatches.map((color) => (
            <button
              key={color.hex}
              onClick={() => handleUpdate({ highlightColor: color.hex })}
              title={color.name}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                currentStyle.highlightColor.toLowerCase() === color.hex.toLowerCase()
                  ? 'scale-110 border-white shadow-md'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>

      {/* 3. Position on Screen */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
          <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-purple-400" />
          <span>Screen Position</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['top', 'middle', 'bottom'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => handleUpdate({ position: pos })}
              className={`py-2 text-xs font-medium rounded-lg capitalize border transition-colors ${
                currentStyle.position === pos
                  ? 'border-purple-500 bg-purple-500/20 text-white font-semibold'
                  : 'border-white/10 bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Font Size Slider */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
          <span className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-purple-400" />
            Font Size
          </span>
          <span className="text-purple-300 font-mono">{currentStyle.fontSize}px</span>
        </div>
        <input
          type="range"
          min="32"
          max="72"
          step="2"
          value={currentStyle.fontSize}
          onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
      </div>

      {/* 5. Toggles: Emojis & Uppercase */}
      <div className="space-y-3 pt-1 border-t border-white/10">
        
        {/* Auto Emojis Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-white">Viral Auto-Emojis</p>
              <p className="text-[10px] text-slate-400">Trigger 💰, 🚀, ⚡ on high-value words</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showEmojis: !currentStyle.showEmojis })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              currentStyle.showEmojis ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                currentStyle.showEmojis ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* ALL CAPS Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <div>
              <p className="text-xs font-semibold text-white">ALL CAPS Styling</p>
              <p className="text-[10px] text-slate-400">Standard for high-retention TikTok shorts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ uppercase: !currentStyle.uppercase })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              currentStyle.uppercase ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                currentStyle.uppercase ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

      </div>

    </div>
  );
};
