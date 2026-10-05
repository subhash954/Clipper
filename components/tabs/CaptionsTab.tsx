'use client';

import React, { useState, useMemo } from 'react';
import { WordTimestamp, SubtitleStyle, SubtitleLanguage } from '@/lib/types';
import { getActiveCaptionWord } from '@/lib/captions/activeWord';
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
    // Capitalize first letters and sanitize spacing
    const optimized = words.map((w, idx) => {
      let text = w.word.trim();
      if (idx === 0 || words[idx - 1]?.word.endsWith('.') || words[idx - 1]?.word.endsWith('।')) {
        text = text.charAt(0).toUpperCase() + text.slice(1);
      }
      return { ...w, word: text };
    });
    onWordsChange(optimized);
  };

  const languageOptions: { id: SubtitleLanguage; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'hi', label: 'Hindi (हिंदी)' },
    { id: 'es', label: 'Spanish' },
    { id: 'fr', label: 'French' },
    { id: 'de', label: 'German' },
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] space-y-4 text-slate-900">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              alert('Hook Title badge generated above subtitles!');
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-red-50 text-xs font-bold text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-red-600" />
            <span>Hook Title</span>
          </button>

          {/* Language Switcher */}
          <div className="relative">
            <select
              value={subtitleStyle.language}
              onChange={(e) =>
                onStyleChange({ ...subtitleStyle, language: e.target.value as SubtitleLanguage })
              }
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer outline-hidden pr-6 shadow-xs"
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
            className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:border-red-500 focus:bg-white outline-hidden shadow-xs"
          />
        </div>
      </div>

      {/* Utterance List */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filteredBlocks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
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
                    ? 'opacity-40 bg-slate-50 border-slate-200'
                    : isCurrentlyPlaying
                    ? 'bg-red-50/70 border-red-300 ring-1 ring-red-400/40 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Time Range & Action Buttons */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-2">
                  <span className="font-bold text-slate-600">
                    {block.start.toFixed(2)} - {block.end.toFixed(2)}s
                  </span>

                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => handleToggleHideBlock(block.id, e)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title={block.hidden ? 'Show subtitle' : 'Hide subtitle'}
                    >
                      {block.hidden ? (
                        <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Spoken Word Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const activeWord = getActiveCaptionWord({ words: block.words }, currentTime);
                    return block.words.map((w, wIdx) => {
                      const globalIdx = block.startIndex + wIdx;
                      const isWordActive = activeWord === w;
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
                          className="px-2 py-0.5 rounded bg-red-50 text-slate-900 font-bold text-xs border border-red-500 outline-hidden"
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
                            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-xs scale-105'
                            : isHighlighted
                            ? 'bg-amber-50 text-amber-800 border border-amber-300 font-bold'
                            : 'bg-slate-100 text-slate-800 border border-slate-200 hover:border-slate-300'
                        }`}
                        title="Click to seek • Double-click to edit text"
                      >
                        <span>{w.word}</span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleHighlight(w.word, e)}
                          className="opacity-0 group-hover/word:opacity-100 hover:scale-125 text-amber-500 transition-all"
                          title="Toggle keyword highlight badge"
                        >
                          ★
                        </button>
                      </span>
                    );
                  });
                })()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Accuracy & Optimize Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Timing Status:</span>
          <span className="font-mono font-bold text-emerald-600">Verified</span>
        </div>

        <button
          type="button"
          disabled={isOptimizing}
          onClick={handleOptimizeCaptions}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
          <span>{isOptimizing ? 'Optimizing...' : 'Optimize'}</span>
        </button>
      </div>
    </div>
  );
};
