'use client';

import React from 'react';
import { SubtitleStyle, SubtitlePreset, SubtitleLanguage } from '@/lib/types';
import { PRESET_STYLES } from '@/lib/sampleData';
import { Palette, Type, AlignVerticalJustifyCenter, Smile, Volume2, Globe, Sparkles } from 'lucide-react';

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
    { name: 'Electric Gold', hex: '#FACC15' },
    { name: 'Emerald Pulse', hex: '#22C55E' },
    { name: 'Cyan Highlight', hex: '#38BDF8' },
    { name: 'Clipper Crimson', hex: '#E11D48' },
    { name: 'Bold Amber', hex: '#F97316' },
    { name: 'Clean White', hex: '#FFFFFF' }
  ];

  const presetsConfig: Array<{
    id: SubtitlePreset;
    title: string;
    tag: string;
    description: string;
    borderColor: string;
    activeBg: string;
  }> = [
    {
      id: 'impact',
      title: 'Impact',
      tag: 'Dynamic Pop',
      description: 'Bold Impact • Gold Pop • Heavy Outline',
      borderColor: 'border-amber-400',
      activeBg: 'bg-amber-50/70',
    },
    {
      id: 'pulse',
      title: 'Pulse',
      tag: 'High Energy',
      description: 'System Sans • Emerald Pulse • Bounce',
      borderColor: 'border-emerald-500',
      activeBg: 'bg-emerald-50/70',
    },
    {
      id: 'clean',
      title: 'Clean',
      tag: 'Modern',
      description: 'Inter Font • Cyan Karaoke • Readable',
      borderColor: 'border-sky-500',
      activeBg: 'bg-sky-50/70',
    },
    {
      id: 'studio',
      title: 'Studio',
      tag: 'Creator-First',
      description: 'Montserrat • Crimson Accents • Crisp',
      borderColor: 'border-red-500',
      activeBg: 'bg-red-50/70',
    },
    {
      id: 'bold',
      title: 'Bold',
      tag: 'Punchy',
      description: 'Trebuchet MS • Amber Fire • Fast Pacing',
      borderColor: 'border-orange-500',
      activeBg: 'bg-orange-50/70',
    },
    {
      id: 'minimal',
      title: 'Minimal',
      tag: 'Understated',
      description: 'Light Sans • Subtle Shadow • Cinematic',
      borderColor: 'border-slate-400',
      activeBg: 'bg-slate-100',
    },
    {
      id: 'neon',
      title: 'Neon',
      tag: 'Vibrant',
      description: 'Rose & Cyan • Cyber Glow • Standout',
      borderColor: 'border-pink-500',
      activeBg: 'bg-pink-50/70',
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Original Clipper Creator Presets */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Original Creator Caption Presets
            </h3>
          </div>
          <span className="text-[10px] text-red-600 font-extrabold bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            Live Preview
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {presetsConfig.map((p) => {
            const isSelected = currentStyle.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetSelect(p.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? `${p.borderColor} ${p.activeBg} shadow-sm ring-1 ${p.borderColor}`
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{p.title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white text-slate-700 font-extrabold border border-slate-200">
                    {p.tag}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature 10 & 11: Multi-Language & Dual-Language Subtitles */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Caption Language
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
              {lang}
            </button>
          ))}
        </div>

        {/* Dual Language Toggle */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <div>
            <p className="text-xs font-bold text-slate-800">Dual-Language Subtitles</p>
            <p className="text-[10px] text-slate-500">Show primary + translated captions simultaneously</p>
          </div>
          <input
            type="checkbox"
            checked={currentStyle.showDualLanguage}
            onChange={(e) => handleUpdate({ showDualLanguage: e.target.checked })}
            className="w-4 h-4 accent-red-600 cursor-pointer"
          />
        </div>
      </div>

      {/* 2. Color & Highlights */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Type className="w-4 h-4 text-red-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Color &amp; Word Highlights
          </h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
              Highlight Word Accent Color
            </label>
            <div className="flex items-center gap-2">
              {colorSwatches.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => handleUpdate({ highlightColor: color.hex })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                    currentStyle.highlightColor.toLowerCase() === color.hex.toLowerCase()
                      ? 'border-slate-900 scale-110 shadow-sm'
                      : 'border-slate-300 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
              <input
                type="color"
                value={currentStyle.highlightColor}
                onChange={(e) => handleUpdate({ highlightColor: e.target.value })}
                className="w-7 h-7 rounded-full overflow-hidden border border-slate-300 p-0 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
              Primary Caption Text Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentStyle.primaryColor}
                onChange={(e) => handleUpdate({ primaryColor: e.target.value })}
                className="w-7 h-7 rounded-full overflow-hidden border border-slate-300 p-0 cursor-pointer"
              />
              <span className="text-xs font-mono text-slate-700 font-bold">{currentStyle.primaryColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Typography Adjustments */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <AlignVerticalJustifyCenter className="w-4 h-4 text-red-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Layout &amp; Placement
          </h3>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600 font-medium">Font Size</span>
            <span className="text-slate-900 font-bold font-mono">{currentStyle.fontSize}px</span>
          </div>
          <input
            type="range"
            min={28}
            max={72}
            value={currentStyle.fontSize}
            onChange={(e) => handleUpdate({ fontSize: Number(e.target.value) })}
            className="w-full accent-red-600 cursor-pointer"
          />
        </div>

        {/* Stroke / Border Width */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600 font-medium">Outline Stroke</span>
            <span className="text-slate-900 font-bold font-mono">{currentStyle.strokeWidth}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            value={currentStyle.strokeWidth}
            onChange={(e) => handleUpdate({ strokeWidth: Number(e.target.value) })}
            className="w-full accent-red-600 cursor-pointer"
          />
        </div>

        {/* Position on Screen */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-600 block">Vertical Position</span>
          <div className="grid grid-cols-3 gap-2">
            {(['top', 'middle', 'bottom'] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => handleUpdate({ position: pos })}
                className={`py-2 text-xs font-bold rounded-xl capitalize border transition-colors cursor-pointer ${
                  currentStyle.position === pos
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Animation & Visual Toggles */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-slate-800">ALL CAPS</span>
            </div>
            <input
              type="checkbox"
              checked={currentStyle.uppercase}
              onChange={(e) => handleUpdate({ uppercase: e.target.checked })}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-slate-800">Automatic Emoji Accents</span>
            </div>
            <input
              type="checkbox"
              checked={currentStyle.showEmojis}
              onChange={(e) => handleUpdate({ showEmojis: e.target.checked })}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-bold text-slate-800">Subtle Sound Effects (SFX)</span>
            </div>
            <input
              type="checkbox"
              checked={currentStyle.enableSFX}
              onChange={(e) => handleUpdate({ enableSFX: e.target.checked })}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
