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
    { name: 'Clipper Cyan', hex: '#06B6D4' },
    { name: 'Aqua Focus', hex: '#22D3EE' },
    { name: 'Electric Gold', hex: '#FACC15' },
    { name: 'Emerald Pulse', hex: '#22C55E' },
    { name: 'Bold Amber', hex: '#F97316' },
    { name: 'Clean White', hex: '#FFFFFF' }
  ];

  // Section 16: Clipper Presets (Signal, Punch, Minimal, Focus, Studio, Kinetic, Mono, Highlight)
  const presetsConfig: Array<{
    id: SubtitlePreset;
    title: string;
    tag: string;
    description: string;
    accentColor: string;
  }> = [
    {
      id: 'signal',
      title: 'Signal',
      tag: 'Clipper Signature',
      description: 'Inter • Electric Cyan Pop • Punchy Karaoke',
      accentColor: 'border-cyan-500 text-cyan-400 bg-cyan-950/40',
    },
    {
      id: 'punch',
      title: 'Punch',
      tag: 'High Energy',
      description: 'Impact Font • Gold Pop • Heavy Outline',
      accentColor: 'border-amber-500 text-amber-400 bg-amber-950/40',
    },
    {
      id: 'minimal',
      title: 'Minimal',
      tag: 'Understated',
      description: 'Light Sans • Subtle Shadow • Clean Modern',
      accentColor: 'border-slate-500 text-slate-300 bg-slate-900',
    },
    {
      id: 'focus',
      title: 'Focus',
      tag: 'Clean Read',
      description: 'Montserrat • Aqua Highlight • High Legibility',
      accentColor: 'border-cyan-400 text-cyan-300 bg-cyan-950/30',
    },
    {
      id: 'studio',
      title: 'Studio',
      tag: 'Creator Pro',
      description: 'Montserrat • Rose Accents • Crisp Broadcast',
      accentColor: 'border-rose-500 text-rose-400 bg-rose-950/40',
    },
    {
      id: 'kinetic',
      title: 'Kinetic',
      tag: 'Fast Pace',
      description: 'Trebuchet MS • Amber Fire • Rapid Sync',
      accentColor: 'border-orange-500 text-orange-400 bg-orange-950/40',
    },
    {
      id: 'mono',
      title: 'Mono',
      tag: 'Tech & Code',
      description: 'Courier Monospace • Cyber Glow • Standout',
      accentColor: 'border-teal-500 text-teal-300 bg-teal-950/40',
    },
    {
      id: 'highlight',
      title: 'Highlight',
      tag: 'Vibrant',
      description: 'System Sans • Emerald Glow • Karaoke Pop',
      accentColor: 'border-emerald-500 text-emerald-400 bg-emerald-950/40',
    },
  ];

  return (
    <div className="space-y-5 text-[#F8FAFC]">
      
      {/* 1. Original Clipper Creator Presets */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-2.5">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Signature Typography Presets
            </h3>
          </div>
          <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800/60">
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
                    ? `${p.accentColor} shadow-cyan-sm ring-1 ring-cyan-400`
                    : 'border-[#283344] bg-[#0E1524] hover:border-slate-600 hover:bg-[#161F30]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{p.title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium border border-slate-700">
                    {p.tag}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Color & Highlights */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center gap-2 border-b border-[#1F2937] pb-2.5">
          <Type className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Color &amp; Word Highlights
          </h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
              Active Highlight Pop Color
            </label>
            <div className="flex items-center gap-2">
              {colorSwatches.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => handleUpdate({ highlightColor: color.hex })}
                  style={{ backgroundColor: color.hex }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                    currentStyle.highlightColor.toLowerCase() === color.hex.toLowerCase()
                      ? 'border-white scale-110 shadow-md ring-2 ring-cyan-400'
                      : 'border-transparent hover:scale-105'
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Font Size & Position Slider */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Font Size: <span className="font-mono text-cyan-400">{currentStyle.fontSize}px</span>
              </label>
              <input
                type="range"
                min="28"
                max="68"
                value={currentStyle.fontSize}
                onChange={(e) => handleUpdate({ fontSize: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Vertical Placement
              </label>
              <div className="flex rounded-lg bg-[#0E1524] border border-[#283344] p-0.5">
                {(['bottom', 'middle', 'top'] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handleUpdate({ position: pos })}
                    className={`flex-1 py-1 text-[10px] font-bold rounded capitalize transition-colors ${
                      currentStyle.position === pos
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t border-[#1F2937] space-y-2">
            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>All Caps (High-Retention Format)</span>
              <input
                type="checkbox"
                checked={currentStyle.uppercase}
                onChange={(e) => handleUpdate({ uppercase: e.target.checked })}
                className="w-4 h-4 accent-cyan-400"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Auto-Insert Emphasized Emojis 🚀🔥</span>
              <input
                type="checkbox"
                checked={currentStyle.showEmojis}
                onChange={(e) => handleUpdate({ showEmojis: e.target.checked })}
                className="w-4 h-4 accent-cyan-400"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Pop Transition Audio Cues (SFX)</span>
              <input
                type="checkbox"
                checked={currentStyle.enableSFX}
                onChange={(e) => handleUpdate({ enableSFX: e.target.checked })}
                className="w-4 h-4 accent-cyan-400"
              />
            </label>
          </div>

        </div>
      </div>

      {/* 3. Global Reach & Languages */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-2.5">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Caption Language
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
            Multi-Language
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {(['en', 'hi', 'es', 'fr', 'de'] as SubtitleLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleUpdate({ language: lang })}
              className={`py-1.5 text-xs font-bold rounded-lg uppercase border transition-colors cursor-pointer ${
                currentStyle.language === lang
                  ? 'border-cyan-500 bg-cyan-950 text-cyan-300 shadow-cyan-sm'
                  : 'border-[#283344] bg-[#0E1524] text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-[#1F2937]">
          <div>
            <p className="text-xs font-bold text-slate-200">Dual-Language Subtitles</p>
            <p className="text-[10px] text-slate-400">Show primary speech + translated captions simultaneously</p>
          </div>
          <input
            type="checkbox"
            checked={currentStyle.showDualLanguage}
            onChange={(e) => handleUpdate({ showDualLanguage: e.target.checked })}
            className="w-4 h-4 accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

    </div>
  );
};
