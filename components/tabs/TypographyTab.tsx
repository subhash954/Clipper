'use client';

import React from 'react';
import { SubtitleStyle, SubtitlePreset, SubtitleLanguage } from '@/lib/types';
import { PRESET_STYLES } from '@/lib/sampleData';
import { Palette, Type, AlignVerticalJustifyCenter, Smile, Volume2, Globe, Sparkles, Upload } from 'lucide-react';

interface TypographyTabProps {
  currentStyle: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
}

export const TypographyTab: React.FC<TypographyTabProps> = ({ currentStyle, onChange }) => {
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
    <div className="space-y-5">
      
      {/* 1. Viral Creator Presets */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Creator Presets & Styles
            </h3>
          </div>
          <span className="text-[10px] text-purple-300 font-semibold">Live Preview</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
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
              <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-400/20 text-yellow-300">#1 Pop</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Bold Impact • Yellow Pop • Emojis</p>
          </button>

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
              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/20 text-emerald-300">Punchy</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Punchy Sans • Green Flash • Bounce</p>
          </button>

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
              <span className="text-[9px] px-1 py-0.5 rounded bg-sky-400/20 text-sky-300">Modern</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Inter Font • Cyan Glow • Subtle</p>
          </button>

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
              <span className="text-[9px] px-1 py-0.5 rounded bg-pink-500/20 text-pink-300">Vibrant</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Pink & Cyan • High Energy</p>
          </button>
        </div>
      </div>

      {/* Feature 10 & 11: Multi-Language & Dual-Language Subtitles */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              10 & 11. Multi & Dual-Language
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold">
            Global Reach
          </span>
        </div>

        {/* Language Selection */}
        <div className="grid grid-cols-5 gap-1.5">
          {(['en', 'hi', 'es', 'fr', 'de'] as SubtitleLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleUpdate({ language: lang })}
              className={`py-1.5 text-xs font-semibold rounded-lg uppercase border transition-colors ${
                currentStyle.language === lang
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200'
                  : 'border-white/10 bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {lang === 'hi' ? '🇮🇳 HI' : lang === 'es' ? '🇪🇸 ES' : lang === 'fr' ? '🇫🇷 FR' : lang === 'de' ? '🇩🇪 DE' : '🇺🇸 EN'}
            </button>
          ))}
        </div>

        {/* Dual Language Stacked Toggle */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-semibold text-white">Dual-Language Subtitles</p>
            <p className="text-[10px] text-slate-400">Stack original English on top + translated language below</p>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showDualLanguage: !currentStyle.showDualLanguage })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              currentStyle.showDualLanguage ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                currentStyle.showDualLanguage ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Feature 8 & 9: Karaoke Glow, Sound Effects, and Auto Emojis */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Animation & Sound FX
          </h3>
        </div>

        {/* Feature 9: SFX Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-white">Keyword Pop Sound Effects</p>
              <p className="text-[10px] text-slate-400">Plays cash register chime 💰 & whoosh on punchlines</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ enableSFX: !currentStyle.enableSFX })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              currentStyle.enableSFX ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                currentStyle.enableSFX ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Feature 12: Auto Emojis */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-white">Dynamic Animated Emojis</p>
              <p className="text-[10px] text-slate-400">Auto-detects high-impact words (🚀, 💰, ⚡)</p>
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

        {/* Feature 8: Animation Style */}
        <div className="pt-2">
          <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
            Highlight Animation Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['pop', 'bounce', 'glow'] as const).map((anim) => (
              <button
                key={anim}
                type="button"
                onClick={() => handleUpdate({ animation: anim })}
                className={`py-1.5 text-xs font-semibold rounded-lg uppercase border transition-colors ${
                  currentStyle.animation === anim
                    ? 'border-purple-500 bg-purple-500/20 text-white'
                    : 'border-white/10 bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                {anim}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature 7: Custom Font & Color Customizer */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              7. Custom Font & Brand Kit
            </h3>
          </div>
          <label className="text-[10px] text-purple-300 font-semibold cursor-pointer hover:underline flex items-center gap-1">
            <Upload className="w-3 h-3" /> Upload .TTF
            <input type="file" accept=".ttf,.otf,.woff2" className="hidden" />
          </label>
        </div>

        {/* Color swatches */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
            Highlight Color
          </label>
          <div className="flex items-center gap-2">
            {colorSwatches.map((color) => (
              <button
                key={color.hex}
                onClick={() => handleUpdate({ highlightColor: color.hex })}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  currentStyle.highlightColor.toLowerCase() === color.hex.toLowerCase()
                    ? 'scale-110 border-white shadow-md'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Font Size</span>
            <span className="font-mono text-purple-300">{currentStyle.fontSize}px</span>
          </div>
          <input
            type="range"
            min="32"
            max="68"
            step="2"
            value={currentStyle.fontSize}
            onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Position */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
            <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-purple-400" />
            <span>Position</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['top', 'middle', 'bottom'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => handleUpdate({ position: pos })}
                className={`py-1.5 text-xs font-medium rounded-lg capitalize border transition-colors ${
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
      </div>

    </div>
  );
};
