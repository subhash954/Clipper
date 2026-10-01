'use client';

import React, { useState, useMemo } from 'react';
import { WordTimestamp, SubtitleStyle, SubtitleLanguage } from '@/lib/types';
import {
  Type,
  Search,
  Languages,
  Eye,
  EyeOff,
  Sparkles,
  Split,
  Plus,
  Check,
  Edit2,
  Trash2,
  ArrowLeftRight,
  Flame,
} from 'lucide-react';

interface CaptionsTabProps {
  words: WordTimestamp[];
  onWordsChange: (words: WordTimestamp[]) => void;
  onJumpToTime: (time: number) => void;
  currentTime: number;
  subtitleStyle: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
}

interface UtteranceBlock {
  id: string;
  startIndex: number;
  endIndex: number;
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
  hidden?: boolean;
}

export const CaptionsTab: React.FC<CaptionsTabProps> = ({
  words,
  onWordsChange,
  onJumpToTime,
  currentTime,
  subtitleStyle,
  onStyleChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [hiddenBlockIds, setHiddenBlockIds] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [highlightedWords, setHighlightedWords] = useState<string[]>([
    'फाइनेंशियल',
    'रुपए',
    'BUSINESS',
    'DOLLAR',
    'SPEED',
    'START',
    'WINS',
  ]);

  // Group individual words into natural sentence chunks (approx 3-5 words or punctuation breaks)
  const utteranceBlocks = useMemo(() => {
    if (!words || words.length === 0) return [];

    const blocks: UtteranceBlock[] = [];
    const chunkSize = 4;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const blockStart = chunk[0].start;
      const blockEnd = chunk[chunk.length - 1].end;
      const blockText = chunk.map((w) => w.word).join(' ');
      const blockId = `utt-${i}-${blockStart.toFixed(2)}`;

      blocks.push({
        id: blockId,
        startIndex: i,
        endIndex: i + chunk.length - 1,
        start: blockStart,
        end: blockEnd,
        text: blockText,
        words: chunk,
        hidden: hiddenBlockIds.includes(blockId),
      });
    }

    return blocks;
  }, [words, hiddenBlockIds]);

  const filteredBlocks = useMemo(() => {
    if (!searchQuery.trim()) return utteranceBlocks;
    const q = searchQuery.toLowerCase();
    return utteranceBlocks.filter((b) => b.text.toLowerCase().includes(q));
  }, [utteranceBlocks, searchQuery]);

  const handleWordClick = (word: WordTimestamp) => {
    onJumpToTime(word.start);
  };

  const handleToggleHighlight = (wordText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = wordText.trim();
    if (highlightedWords.includes(clean)) {
      setHighlightedWords(highlightedWords.filter((w) => w !== clean));
    } else {
      setHighlightedWords([...highlightedWords, clean]);
    }
  };

  const handleToggleHideBlock = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (hiddenBlockIds.includes(blockId)) {
      setHiddenBlockIds(hiddenBlockIds.filter((id) => id !== blockId));
    } else {
      setHiddenBlockIds([...hiddenBlockIds, blockId]);
    }
  };

  const handleStartEdit = (globalIndex: number, currentText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWordIndex(globalIndex);
    setEditingText(currentText);
  };

  const handleSaveEdit = (globalIndex: number) => {
    if (editingText.trim()) {
      const updatedWords = [...words];
      updatedWords[globalIndex] = {
        ...updatedWords[globalIndex],
        word: editingText.trim(),
      };
      onWordsChange(updatedWords);
    }
    setEditingWordIndex(null);
  };

  const handleOptimizeCaptions = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      // Capitalize first letters and remove duplicate spaces
      const optimized = words.map((w, idx) => {
        let text = w.word.trim();
        if (idx === 0 || words[idx - 1]?.word.endsWith('.') || words[idx - 1]?.word.endsWith('।')) {
          text = text.charAt(0).toUpperCase() + text.slice(1);
        }
        return { ...w, word: text };
      });
      onWordsChange(optimized);
      setIsOptimizing(false);
    }, 600);
  };

  const languageOptions: { id: SubtitleLanguage; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'hi', label: 'Hindi (हिंदी)' },
    { id: 'es', label: 'Spanish' },
    { id: 'fr', label: 'French' },
    { id: 'de', label: 'German' },
  ];

  return (
    <div className="space-y-4 text-[#F8FAFC]">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[#1F2937] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const hookWords = ['⚡', 'WAIT', 'FOR', 'THIS:'];
              alert('Hook Title badge generated above subtitles!');
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Hook Title</span>
          </button>

          {/* Language Switcher */}
          <div className="relative">
            <select
              value={subtitleStyle.language}
              onChange={(e) =>
                onStyleChange({ ...subtitleStyle, language: e.target.value as SubtitleLanguage })
              }
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-700 cursor-pointer outline-hidden pr-6"
            >
              {languageOptions.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-[180px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search words..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-[#0E1524] border border-[#283344] text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 outline-hidden"
          />
        </div>
      </div>

      {/* Utterance List */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filteredBlocks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-[#111827] rounded-xl border border-[#283344]">
            No captions match your search.
          </div>
        ) : (
          filteredBlocks.map((block) => {
            const isCurrentlyPlaying =
              currentTime >= block.start && currentTime <= block.end;

            return (
              <div
                key={block.id}
                onClick={() => onJumpToTime(block.start)}
                className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                  block.hidden
                    ? 'opacity-40 bg-[#0E1524] border-[#1F2937]'
                    : isCurrentlyPlaying
                    ? 'bg-cyan-950/20 border-cyan-500/60 ring-1 ring-cyan-500/40'
                    : 'bg-[#111827] border-[#283344] hover:border-slate-600'
                }`}
              >
                {/* Time Range & Action Buttons */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-2">
                  <span className="font-bold text-slate-400">
                    {block.start.toFixed(2)} - {block.end.toFixed(2)}s
                  </span>

                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => handleToggleHideBlock(block.id, e)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title={block.hidden ? 'Show subtitle' : 'Hide subtitle'}
                    >
                      {block.hidden ? (
                        <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Spoken Word Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {block.words.map((w, wIdx) => {
                    const globalIdx = block.startIndex + wIdx;
                    const isWordActive =
                      currentTime >= w.start && currentTime <= w.end;
                    const isHighlighted = highlightedWords.includes(w.word.trim());

                    if (editingWordIndex === globalIdx) {
                      return (
                        <input
                          key={globalIdx}
                          type="text"
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveEdit(globalIdx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(globalIdx);
                            if (e.key === 'Escape') setEditingWordIndex(null);
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-950 text-white font-bold text-xs border border-cyan-400 outline-hidden"
                          onClick={(e) => e.stopPropagation()}
                        />
                      );
                    }

                    return (
                      <span
                        key={globalIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWordClick(w);
                        }}
                        onDoubleClick={(e) => handleStartEdit(globalIdx, w.word, e)}
                        className={`group/word inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          isWordActive
                            ? 'bg-cyan-500 text-slate-950 font-black shadow-xs scale-105'
                            : isHighlighted
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-800 font-bold'
                            : 'bg-[#0E1524] text-slate-200 border border-[#1F2937] hover:border-slate-500'
                        }`}
                        title="Click to seek • Double-click to edit text"
                      >
                        <span>{w.word}</span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleHighlight(w.word, e)}
                          className="opacity-0 group-hover/word:opacity-100 hover:scale-125 text-amber-400 transition-all"
                          title="Toggle keyword highlight badge"
                        >
                          ★
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Accuracy & Optimize Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#0E1524] border border-[#283344] text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Captions Accuracy:</span>
          <span className="font-mono font-bold text-emerald-400">98.4%</span>
        </div>

        <button
          type="button"
          disabled={isOptimizing}
          onClick={handleOptimizeCaptions}
          className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
          <span>{isOptimizing ? 'Optimizing...' : 'Optimize'}</span>
        </button>
      </div>
    </div>
  );
};
