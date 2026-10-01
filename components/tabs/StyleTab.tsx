'use client';

import React, { useState } from 'react';
import { SubtitleStyle, SubtitlePreset, SubtitleLanguage } from '@/lib/types';
import { PRESET_STYLES } from '@/lib/sampleData';
import {
  Palette,
  Sliders,
  Sparkles,
  Zap,
  Check,
  Smile,
  Volume2,
  Type,
  ChevronDown,
  X,
  Layers,
} from 'lucide-react';

interface StyleTabProps {
  currentStyle: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
}

type StyleCategory = 'All' | 'New' | 'Animated' | 'Trend' | 'Premium' | 'Speakers' | 'Emoji';

interface PresetTileConfig {
  id: SubtitlePreset;
  name: string;
  category: StyleCategory[];
  isNew?: boolean;
  isPopular?: boolean;
  renderPreview: (selected: boolean) => React.ReactNode;
}

export const StyleTab: React.FC<StyleTabProps> = ({ currentStyle, onChange }) => {
  const [activeCategory, setActiveCategory] = useState<StyleCategory>('All');
  const [isCustomizing, setIsCustomizing] = useState(false);

  const categories: StyleCategory[] = [
    'All',
    'New',
    'Animated',
    'Trend',
    'Premium',
    'Speakers',
    'Emoji',
  ];

  const handleSelectPreset = (presetId: SubtitlePreset) => {
    if (PRESET_STYLES[presetId]) {
      onChange({ ...PRESET_STYLES[presetId] });
    }
  };

  const handleUpdate = (updates: Partial<SubtitleStyle>) => {
    onChange({ ...currentStyle, ...updates });
  };

  // Visual presets matching modern AI video SaaS
  const presetTiles: PresetTileConfig[] = [
    {
      id: 'kendrick',
      name: 'Kendrick',
      category: ['All', 'Trend', 'Premium', 'Speakers'],
      isPopular: true,
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="px-3 py-1 rounded-sm bg-[#22C55E] text-black font-black text-xs tracking-wider uppercase shadow-xs">
            Kendrick
          </span>
        </div>
      ),
    },
    {
      id: 'adrian',
      name: 'Adrian',
      category: ['All', 'New', 'Trend'],
      isNew: true,
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="px-3 py-1 rounded-sm bg-[#FDFBF7] text-[#0F172A] font-extrabold text-xs tracking-wide">
            Adrian
          </span>
        </div>
      ),
    },
    {
      id: 'nora',
      name: 'Nora',
      category: ['All', 'New', 'Speakers'],
      isNew: true,
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="text-[#E2E8F0] font-serif text-sm italic tracking-normal drop-shadow-sm">
            Nora
          </span>
        </div>
      ),
    },
    {
      id: 'benie',
      name: 'Benie',
      category: ['All', 'New', 'Trend'],
      isNew: true,
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="text-[#EF4444] font-black text-sm uppercase tracking-wide drop-shadow-sm">
            Benie
          </span>
        </div>
      ),
    },
    {
      id: 'hormozi',
      name: 'Hormozi 5',
      category: ['All', 'Animated', 'Trend', 'Speakers'],
      isPopular: true,
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="text-[#FACC15] font-black text-sm uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Hormozi 5
          </span>
        </div>
      ),
    },
    {
      id: 'dan',
      name: 'Dan 2',
      category: ['All', 'Animated', 'Trend'],
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="px-3 py-0.5 rounded-xs bg-[#FACC15] text-black font-black text-xs uppercase tracking-tight">
            DAN 2
          </span>
        </div>
      ),
    },
    {
      id: 'ella',
      name: 'ELLA',
      category: ['All', 'Speakers'],
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="text-white font-extrabold text-xs uppercase tracking-widest drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
            ELLA
          </span>
        </div>
      ),
    },
    {
      id: 'beast',
      name: 'BEAST',
      category: ['All', 'Animated', 'Trend'],
      isPopular: true,
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="text-[#F97316] font-black text-sm uppercase italic tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            BEAST
          </span>
        </div>
      ),
    },
    {
      id: 'signal',
      name: 'Signal',
      category: ['All', 'Premium', 'Trend'],
      isPopular: true,
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-xs tracking-wider uppercase">
            Signal
          </span>
        </div>
      ),
    },
    {
      id: 'punch',
      name: 'Punch',
      category: ['All', 'Animated', 'Emoji'],
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="text-[#FACC15] font-black text-sm uppercase tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            PUNCH ⚡
          </span>
        </div>
      ),
    },
    {
      id: 'minimal',
      name: 'Minimal',
      category: ['All', 'Speakers'],
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="text-slate-300 font-medium text-xs tracking-wide">
            minimal clean
          </span>
        </div>
      ),
    },
    {
      id: 'neon',
      name: 'Neon Pop',
      category: ['All', 'Animated', 'Trend'],
      renderPreview: () => (
        <div className="flex items-center justify-center">
          <span className="text-[#38BDF8] font-black text-xs uppercase tracking-wider drop-shadow-[0_0_10px_#06B6D4]">
            NEON POP
          </span>
        </div>
      ),
    },
  ];

  const filteredTiles = presetTiles.filter(
    (tile) => activeCategory === 'All' || tile.category.includes(activeCategory)
  );

  const activePresetName =
    presetTiles.find((p) => p.id === currentStyle.preset)?.name || currentStyle.preset;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] space-y-4 text-slate-900">
      {/* Header with Title & Customize Action */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Palette className="w-4 h-4 text-red-600" />
            Caption Style
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Select high-retention creator subtitle preset
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCustomizing(!isCustomizing)}
          className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-red-50 text-xs font-bold text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-red-600" />
          <span>Customize {activePresetName}</span>
        </button>
      </div>

      {/* Filter Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Fine-Tuning Drawer / Panel (when Customize is clicked) */}
      {isCustomizing && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in duration-200 text-slate-800">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-red-600 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Fine-Tune Typography &amp; Badges
            </span>
            <button
              type="button"
              onClick={() => setIsCustomizing(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Font Size */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                <span>Font Size</span>
                <span className="font-mono text-red-600 font-bold">{currentStyle.fontSize}px</span>
              </div>
              <input
                type="range"
                min="32"
                max="72"
                step="2"
                value={currentStyle.fontSize}
                onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>

            {/* Stroke Width */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                <span>Outline Stroke</span>
                <span className="font-mono text-red-600 font-bold">{currentStyle.strokeWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={currentStyle.strokeWidth}
                onChange={(e) => handleUpdate({ strokeWidth: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>
          </div>

          {/* Color Pickers Row */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                Highlight Pop
              </label>
              <input
                type="color"
                value={currentStyle.highlightColor}
                onChange={(e) => handleUpdate({ highlightColor: e.target.value })}
                className="w-full h-8 rounded-lg bg-white border border-slate-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                Primary Text
              </label>
              <input
                type="color"
                value={currentStyle.primaryColor}
                onChange={(e) => handleUpdate({ primaryColor: e.target.value })}
                className="w-full h-8 rounded-lg bg-white border border-slate-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                Background Badge
              </label>
              <input
                type="color"
                value={currentStyle.badgeColor || '#22C55E'}
                onChange={(e) => handleUpdate({ badgeColor: e.target.value })}
                className="w-full h-8 rounded-lg bg-white border border-slate-300 cursor-pointer"
              />
            </div>
          </div>

          {/* Position Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-bold text-slate-600 block">
              Vertical Screen Position
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['top', 'middle', 'bottom'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => handleUpdate({ position: pos })}
                  className={`py-1.5 rounded-lg border text-xs font-bold capitalize transition-colors cursor-pointer ${
                    currentStyle.position === pos
                      ? 'bg-red-600 text-white border-red-500 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={currentStyle.uppercase}
                onChange={(e) => handleUpdate({ uppercase: e.target.checked })}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>UPPERCASE</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={currentStyle.showEmojis}
                onChange={(e) => handleUpdate({ showEmojis: e.target.checked })}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>Auto Emojis</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={currentStyle.enableSFX}
                onChange={(e) => handleUpdate({ enableSFX: e.target.checked })}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>Pop Sound FX</span>
            </label>
          </div>
        </div>
      )}

      {/* Visual Preset Tiles Grid */}
      <div className="grid grid-cols-3 gap-3">
        {filteredTiles.map((tile) => {
          const isSelected = currentStyle.preset === tile.id;

          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleSelectPreset(tile.id)}
              className={`relative h-24 rounded-2xl border transition-all flex flex-col items-center justify-center p-2.5 overflow-hidden group cursor-pointer ${
                isSelected
                  ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/40 shadow-xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
              }`}
            >
              {/* Badges on Tile (New / Premium) */}
              {tile.isNew && (
                <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  New
                </span>
              )}
              {tile.isPopular && (
                <span className="absolute top-2 left-2 text-[10px] text-amber-500">
                  <Zap className="w-3 h-3 fill-amber-500" />
                </span>
              )}

              {/* Center Styled Word Preview */}
              <div className="scale-90 group-hover:scale-100 transition-transform">
                {tile.renderPreview(isSelected)}
              </div>

              {/* Preset Label */}
              <span className="absolute bottom-1.5 text-[10px] text-slate-500 group-hover:text-slate-900 transition-colors font-semibold">
                {tile.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
