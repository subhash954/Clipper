'use client';

import React, { useState, useMemo } from 'react';
import { WordTimestamp, EditOperation } from '@/lib/types';
import { soundFX } from '@/lib/audioEffects';
import {
  Film,
  ZoomIn,
  Volume2,
  Plus,
  RefreshCw,
  Sparkles,
  Flame,
  Scissors,
  Layers,
  ArrowRight,
  Check,
  Search,
  X,
  Shuffle,
} from 'lucide-react';

interface BrollStoryboardTabProps {
  words: WordTimestamp[];
  cuts: EditOperation[];
  onCutsChange: (cuts: EditOperation[]) => void;
  onJumpToTime: (time: number) => void;
  currentTime: number;
}

interface SceneBlock {
  id: string;
  start: number;
  end: number;
  text: string;
  hasBroll: boolean;
  brollKeyword?: string;
  hasZoom: boolean;
  hasSound: boolean;
  soundType?: string;
  transitionType?: 'cut' | 'whip' | 'glitch' | 'dissolve';
}

const STOCK_THUMBNAILS: Record<string, string> = {
  money: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=120&auto=format&fit=crop&q=60',
  business: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=120&auto=format&fit=crop&q=60',
  car: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=120&auto=format&fit=crop&q=60',
  growth: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=120&auto=format&fit=crop&q=60',
  tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=120&auto=format&fit=crop&q=60',
};

export const BrollStoryboardTab: React.FC<BrollStoryboardTabProps> = ({
  words,
  cuts,
  onCutsChange,
  onJumpToTime,
  currentTime,
}) => {
  const [brollModalBlockId, setBrollModalBlockId] = useState<string | null>(null);
  const [brollSearchKeyword, setBrollSearchKeyword] = useState('');
  const [transitionState, setTransitionState] = useState<Record<number, string>>({});

  // Group transcript words into natural 6-8 second scene storyboard blocks
  const sceneBlocks: SceneBlock[] = useMemo(() => {
    if (!words || words.length === 0) return [];

    const blocks: SceneBlock[] = [];
    const chunkSize = 6;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const blockStart = chunk[0].start;
      const blockEnd = chunk[chunk.length - 1].end;
      const blockText = chunk.map((w) => w.word).join(' ');
      const blockId = `scene-${i}`;

      // Check if cuts contain active B-roll or Zoom for this range
      const brollCut = cuts.find(
        (c) => c.type === 'BROLL' && c.start >= blockStart && c.start < blockEnd && c.enabled
      );
      const zoomCut = cuts.find(
        (c) => c.type === 'ZOOM' && c.start >= blockStart && c.start < blockEnd && c.enabled
      );

      blocks.push({
        id: blockId,
        start: blockStart,
        end: blockEnd,
        text: blockText,
        hasBroll: Boolean(brollCut),
        brollKeyword: brollCut?.word || (i % 2 === 1 ? 'business' : undefined),
        hasZoom: Boolean(zoomCut) || i === 0,
        hasSound: i % 2 === 1,
        soundType: i % 2 === 1 ? 'Ding Pop' : undefined,
      });
    }

    return blocks;
  }, [words, cuts]);

  // Quick Action 1: Auto B-Rolls
  const handleAutoBrolls = () => {
    const newBrolls: EditOperation[] = sceneBlocks
      .filter((_, idx) => idx % 2 === 1)
      .map((b, idx) => ({
        id: `auto-broll-${b.start}`,
        type: 'BROLL',
        start: b.start,
        end: Math.min(b.end, b.start + 3.5),
        reason: 'manual_cut',
        enabled: true,
        word: idx === 0 ? 'money' : idx === 1 ? 'growth' : 'business',
      }));

    onCutsChange([...cuts.filter((c) => c.type !== 'BROLL'), ...newBrolls]);
  };

  // Quick Action 2: Auto Zooms (Dynamic 1.15x jump cuts)
  const handleAutoZooms = () => {
    const newZooms: EditOperation[] = sceneBlocks
      .filter((_, idx) => idx % 2 === 0)
      .map((b) => ({
        id: `auto-zoom-${b.start}`,
        type: 'ZOOM',
        start: b.start,
        end: Math.min(b.end, b.start + 4.0),
        reason: 'manual_cut',
        enabled: true,
      }));

    onCutsChange([...cuts.filter((c) => c.type !== 'ZOOM'), ...newZooms]);
  };

  const handleToggleZoomOnBlock = (block: SceneBlock) => {
    const existing = cuts.find((c) => c.type === 'ZOOM' && c.start === block.start);
    if (existing) {
      onCutsChange(cuts.filter((c) => c.id !== existing.id));
    } else {
      const zoomOp: EditOperation = {
        id: `zoom-${block.start}`,
        type: 'ZOOM',
        start: block.start,
        end: block.end,
        reason: 'manual_cut',
        enabled: true,
      };
      onCutsChange([...cuts, zoomOp]);
    }
  };

  const handleAttachBrollKeyword = (blockId: string, keyword: string) => {
    const block = sceneBlocks.find((b) => b.id === blockId);
    if (!block) return;

    const brollOp: EditOperation = {
      id: `broll-${block.start}`,
      type: 'BROLL',
      start: block.start,
      end: Math.min(block.end, block.start + 3.5),
      reason: 'manual_cut',
      enabled: true,
      word: keyword,
    };

    onCutsChange([...cuts.filter((c) => !(c.type === 'BROLL' && c.start === block.start)), brollOp]);
    setBrollModalBlockId(null);
  };

  const handlePlaySound = (soundType?: string) => {
    if (soundType?.includes('Ding')) {
      soundFX.playCashDing();
    } else {
      soundFX.playPop();
    }
  };

  const toggleTransition = (index: number) => {
    const current = transitionState[index] || 'cut';
    const transitions = ['cut', 'whip', 'glitch', 'dissolve'];
    const nextIdx = (transitions.indexOf(current) + 1) % transitions.length;
    setTransitionState({ ...transitionState, [index]: transitions[nextIdx] });
  };

  return (
    <div className="space-y-4 text-slate-900">
      {/* Top Action Pills Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoBrolls}
            className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 fill-red-600 text-red-600" />
            <span>Auto B-rolls</span>
          </button>

          <button
            type="button"
            onClick={handleAutoZooms}
            className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
            <span>Auto Zooms</span>
          </button>

          <button
            type="button"
            className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            <span>Hook Title</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleAutoBrolls}
          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition-colors cursor-pointer shadow-xs"
          title="Refresh Scene Analysis"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Storyboard Scene Blocks */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {sceneBlocks.map((block, idx) => {
          const isCurrentlyActive =
            currentTime >= block.start && currentTime <= block.end;
          const transition = transitionState[idx] || 'cut';

          return (
            <React.Fragment key={block.id}>
              {/* Scene Block Card */}
              <div
                onClick={() => onJumpToTime(block.start)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isCurrentlyActive
                    ? 'bg-red-50/70 border-red-300 shadow-md ring-1 ring-red-400/40'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]'
                }`}
              >
                {/* Time Interval Header */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1.5">
                  <span className="font-bold text-slate-600">
                    {block.start.toFixed(2)} - {block.end.toFixed(2)}s
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Scene #{idx + 1}
                  </span>
                </div>

                {/* Spoken Line */}
                <p className="text-xs font-medium text-slate-800 leading-relaxed mb-3">
                  {block.text}
                </p>

                {/* Multi-Track Layer Chips Row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  {/* Chip 1: A-Roll (Speaker) */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    <span>A-roll</span>
                  </div>

                  {/* Chip 2: B-Roll Overlay (with Thumbnail) */}
                  {block.hasBroll ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setBrollModalBlockId(block.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-red-50 border border-red-200 text-[11px] font-bold text-red-700 hover:bg-red-100 transition-colors shadow-2xs cursor-pointer"
                      title="Click to change or replace B-roll footage"
                    >
                      <img
                        src={STOCK_THUMBNAILS[block.brollKeyword || 'business'] || STOCK_THUMBNAILS.business}
                        alt="B-roll"
                        className="w-5 h-5 rounded-md object-cover"
                      />
                      <span>B-roll: {block.brollKeyword || 'Stock'}</span>
                    </div>
                  ) : null}

                  {/* Chip 3: Sound FX */}
                  {block.hasSound && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySound(block.soundType);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
                      title="Audition Sound FX"
                    >
                      <Volume2 className="w-3 h-3 text-emerald-600" />
                      <span>{block.soundType || 'Pop SFX'}</span>
                    </button>
                  )}

                  {/* Chip 4: Zoom */}
                  {block.hasZoom ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleZoomOnBlock(block);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer"
                    >
                      <ZoomIn className="w-3 h-3 text-amber-600" />
                      <span>Zoom 1.15x</span>
                    </button>
                  ) : null}

                  {/* Chip 5: Add Layer Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBrollModalBlockId(block.id);
                    }}
                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                    title="Add B-Roll or Overlay to this scene"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inter-Scene Transition Pill */}
              {idx < sceneBlocks.length - 1 && (
                <div className="flex items-center justify-center my-0.5">
                  <button
                    type="button"
                    onClick={() => toggleTransition(idx)}
                    className="px-2.5 py-0.5 rounded-full bg-white hover:bg-red-50 border border-slate-200 text-[10px] font-bold text-slate-500 hover:text-red-600 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                    title={`Transition: ${transition.toUpperCase()} (Click to cycle)`}
                  >
                    <span className="text-xs text-red-600">⋈</span>
                    <span className="uppercase">{transition}</span>
                  </button>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stock B-Roll Selection Modal / Drawer */}
      {brollModalBlockId && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-red-600" />
              <span>Select Contextual B-Roll Overlay</span>
            </span>
            <button
              type="button"
              onClick={() => setBrollModalBlockId(null)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {[
              { keyword: 'money', label: 'Cash & Finance', thumb: STOCK_THUMBNAILS.money },
              { keyword: 'business', label: 'Office & Desk', thumb: STOCK_THUMBNAILS.business },
              { keyword: 'growth', label: 'Growth Chart', thumb: STOCK_THUMBNAILS.growth },
              { keyword: 'car', label: 'Luxury Drive', thumb: STOCK_THUMBNAILS.car },
              { keyword: 'tech', label: 'Code & Screen', thumb: STOCK_THUMBNAILS.tech },
            ].map((stock) => (
              <button
                key={stock.keyword}
                type="button"
                onClick={() => handleAttachBrollKeyword(brollModalBlockId, stock.keyword)}
                className="group relative h-20 rounded-xl overflow-hidden border border-slate-200 hover:border-red-500 hover:ring-2 hover:ring-red-400/30 transition-all text-left cursor-pointer shadow-xs"
              >
                <img
                  src={stock.thumb}
                  alt={stock.label}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 flex flex-col justify-end">
                  <p className="text-[10px] font-bold text-white leading-tight">
                    {stock.label}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
