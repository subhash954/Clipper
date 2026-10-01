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
    { name: 'YouTube Red', hex: '#FF0000' },
    { name: 'Hot Pink', hex: '#F43F5E' },
    { name: 'Clean White', hex: '#FFFFFF' }
  ];

  return (
    <div className="space-y-4">
      
      {/* 1. Viral Creator Presets */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Creator Presets &amp; Styles
            </h3>
          </div>
          <span className="text-[10px] text-red-600 font-extrabold bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            Live Preview
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handlePresetSelect('hormozi')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              currentStyle.preset === 'hormozi'
                ? 'border-amber-400 bg-amber-50/60 shadow-sm ring-1 ring-amber-400'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700">Alex Hormozi</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold">#1 Pop</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Bold Impact • Yellow Pop • Emojis</p>
          </button>

          <button
            type="button"
            onClick={() => handlePresetSelect('beast')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              currentStyle.preset === 'beast'
                ? 'border-emerald-500 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-500'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700">MrBeast</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">Punchy</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Punchy Sans • Green Flash • Bounce</p>
          </button>

          <button
            type="button"
            onClick={() => handlePresetSelect('minimal')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              currentStyle.preset === 'minimal'
                ? 'border-sky-500 bg-sky-50/60 shadow-sm ring-1 ring-sky-500'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-700">Clean Minimal</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-extrabold">Modern</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Inter Font • Cyan Glow • Subtle</p>
          </button>

          <button
            type="button"
            onClick={() => handlePresetSelect('neon')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              currentStyle.preset === 'neon'
                ? 'border-pink-500 bg-pink-50/60 shadow-sm ring-1 ring-pink-500'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-pink-700">Neon Cyber</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-800 font-extrabold">Vibrant</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Pink &amp; Cyan • High Energy</p>
          </button>
        </div>
      </div>

      {/* Feature 10 & 11: Multi-Language & Dual-Language Subtitles */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              10 &amp; 11. Multi &amp; Dual-Language
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
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
              className={`py-2 text-xs font-bold rounded-xl uppercase border transition-colors cursor-pointer ${
                currentStyle.language === lang
                  ? 'border-red-500 bg-red-50 text-red-700 shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {lang === 'hi' ? '🇮🇳 HI' : lang === 'es' ? '🇪🇸 ES' : lang === 'fr' ? '🇫🇷 FR' : lang === 'de' ? '🇩🇪 DE' : '🇺🇸 EN'}
            </button>
          ))}
        </div>

        {/* Dual Language Stacked Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            <p className="text-xs font-bold text-slate-900">Dual-Language Subtitles</p>
            <p className="text-[10px] text-slate-500">Stack original English on top + translated language below</p>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showDualLanguage: !currentStyle.showDualLanguage })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              currentStyle.showDualLanguage ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                currentStyle.showDualLanguage ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Feature 8 & 9: Karaoke Glow, Sound Effects, and Auto Emojis */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3.5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Sparkles className="w-4 h-4 text-red-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Animation &amp; Sound FX
          </h3>
        </div>

        {/* Feature 9: SFX Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-xs font-bold text-slate-900">Keyword Pop Sound Effects</p>
              <p className="text-[10px] text-slate-500">Plays cash register chime 💰 &amp; whoosh on punchlines</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ enableSFX: !currentStyle.enableSFX })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              currentStyle.enableSFX ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                currentStyle.enableSFX ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Feature 12: Auto Emojis */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-xs font-bold text-slate-900">Dynamic Animated Emojis</p>
              <p className="text-[10px] text-slate-500">Auto-detects high-impact words (🚀, 💰, ⚡)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ showEmojis: !currentStyle.showEmojis })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              currentStyle.showEmojis ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                currentStyle.showEmojis ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Feature 8: Animation Style */}
        <div className="pt-2">
          <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
            Highlight Animation Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['pop', 'bounce', 'glow'] as const).map((anim) => (
              <button
                key={anim}
                type="button"
                onClick={() => handleUpdate({ animation: anim })}
                className={`py-2 text-xs font-bold rounded-xl uppercase border transition-colors cursor-pointer ${
                  currentStyle.animation === anim
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {anim}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature 7: Custom Font & Color Customizer */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              7. Custom Font &amp; Brand Kit
            </h3>
          </div>
          <label className="text-[10px] text-red-600 font-bold cursor-pointer hover:underline flex items-center gap-1">
            <Upload className="w-3 h-3" /> Upload .TTF
            <input type="file" accept=".ttf,.otf,.woff2" className="hidden" />
          </label>
        </div>

        {/* Color swatches */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
            Highlight Color
          </label>
          <div className="flex items-center gap-2.5">
            {colorSwatches.map((color) => (
              <button
                key={color.hex}
                onClick={() => handleUpdate({ highlightColor: color.hex })}
                className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                  currentStyle.highlightColor.toLowerCase() === color.hex.toLowerCase()
                    ? 'scale-115 border-slate-900 shadow-sm'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div>
          <div className="flex justify-between text-xs text-slate-600 mb-1 font-semibold">
            <span>Font Size</span>
            <span className="font-mono text-red-600 font-bold">{currentStyle.fontSize}px</span>
          </div>
          <input
            type="range"
            min="32"
            max="68"
            step="2"
            value={currentStyle.fontSize}
            onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>

        {/* Position */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
            <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-red-600" />
            <span>Position</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['top', 'middle', 'bottom'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => handleUpdate({ position: pos })}
                className={`py-2 text-xs font-bold rounded-xl capitalize border transition-colors cursor-pointer ${
                  currentStyle.position === pos
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
