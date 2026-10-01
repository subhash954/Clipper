'use client';

import React, { useState, useMemo } from 'react';
import { ViralClip, WordTimestamp, EditOperation } from '@/lib/types';
import { detectFillerWords, detectSilences, calculateVoiceEnergy } from '@/lib/edl/editDecisionList';
import { 
  Sparkles, 
  Scissors, 
  Activity, 
  Copy, 
  Check, 
  Quote, 
  Target, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  VolumeX,
  Play,
  ArrowRight,
  Sliders,
  CheckCheck
} from 'lucide-react';

interface IntelligenceTabProps {
  clips: ViralClip[];
  activeClipId: string | null;
  onSelectClip: (clip: ViralClip) => void;
  onJumpToTime: (time: number) => void;
  words?: WordTimestamp[];
  onApplyCuts?: (cuts: EditOperation[]) => void;
}

export const IntelligenceTab: React.FC<IntelligenceTabProps> = ({
  clips,
  activeClipId,
  onSelectClip,
  onJumpToTime,
  words = [],
  onApplyCuts,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState<number>(0.5);
  const [activeCutsState, setActiveCutsState] = useState<Record<string, boolean>>({});

  const activeClip = useMemo(() => {
    return clips.find((c) => c.id === activeClipId) || clips[0] || null;
  }, [clips, activeClipId]);

  const clipWords = useMemo(() => {
    if (activeClip && activeClip.words && activeClip.words.length > 0) {
      return activeClip.words;
    }
    return words;
  }, [activeClip, words]);

  // Authentic Filler Word Detection from real transcript words
  const detectedFillers = useMemo(() => {
    return detectFillerWords(clipWords);
  }, [clipWords]);

  // Authentic Silence Detection from real word boundaries
  const detectedSilences = useMemo(() => {
    return detectSilences(clipWords, silenceThreshold);
  }, [clipWords, silenceThreshold]);

  // Authentic Voice Energy Cadence Analysis
  const voiceEnergy = useMemo(() => {
    return calculateVoiceEnergy(clipWords);
  }, [clipWords]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const toggleCut = (cutId: string) => {
    const nextState = {
      ...activeCutsState,
      [cutId]: !activeCutsState[cutId],
    };
    setActiveCutsState(nextState);

    // Propagate all enabled cuts to parent
    if (onApplyCuts) {
      const allCuts = [...detectedFillers, ...detectedSilences].map((c) => ({
        ...c,
        enabled: Boolean(nextState[c.id]),
      }));
      onApplyCuts(allCuts.filter((c) => c.enabled));
    }
  };

  const removeAllFillers = () => {
    const nextState = { ...activeCutsState };
    detectedFillers.forEach((f) => {
      nextState[f.id] = true;
    });
    setActiveCutsState(nextState);

    if (onApplyCuts) {
      const allCuts = [...detectedFillers, ...detectedSilences].map((c) => ({
        ...c,
        enabled: Boolean(nextState[c.id]),
      }));
      onApplyCuts(allCuts.filter((c) => c.enabled));
    }
  };

  return (
    <div className="space-y-6 text-[#F8FAFC]">
      
      {/* 1. MOMENT DISCOVERY & CLIP POTENTIAL (Section 12 & 13) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              AI Moment Discovery
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 font-bold border border-cyan-800/60">
            {clips.length} Discovered Moments
          </span>
        </div>

        {/* Clip Cards List */}
        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {clips.map((clip, idx) => {
            const isSelected = activeClip?.id === clip.id;
            const clipRank = clip.rank || idx + 1;
            const isVerified = clip.alignmentStatus === 'verified';

            return (
              <div
                key={clip.id}
                onClick={() => onSelectClip(clip)}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                  isSelected
                    ? 'border-cyan-500 bg-[#162238] shadow-cyan-sm'
                    : 'border-[#283344] bg-[#111827] hover:border-slate-600 hover:bg-[#161F30]'
                }`}
              >
                {/* Header: Rank + Type + Potential */}
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[9px]">
                      MOMENT {clipRank.toString().padStart(2, '0')}
                    </span>
                    {clip.keyMomentType && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium text-[9px] border border-slate-700">
                        {clip.keyMomentType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0E1524] text-cyan-300 text-[10px] font-bold border border-cyan-800/40">
                    <Target className="w-3 h-3 text-cyan-400" />
                    <span>Potential: {clip.viralScore}/100</span>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-xs font-bold text-white leading-snug">{clip.title}</h4>

                {/* Tracked Spoken Quote */}
                {clip.importantLine && (
                  <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#1F2937] text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] font-bold text-cyan-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Quote className="w-3 h-3" /> Tracked Spoken Anchor
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(clip.importantLine, idx);
                        }}
                        className="text-slate-500 hover:text-white transition-colors"
                        title="Copy quote"
                      >
                        {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="font-medium italic text-slate-200 line-clamp-2">
                      &ldquo;{clip.importantLine}&rdquo;
                    </p>
                    {clip.whyThisLineIsImportant && (
                      <p className="text-[10px] text-slate-400 border-t border-[#1F2937] pt-1.5 mt-1 leading-relaxed">
                        <strong className="text-slate-300">AI Rationale:</strong> {clip.whyThisLineIsImportant}
                      </p>
                    )}
                  </div>
                )}

                {/* Content Signal Breakdown Bars (Section 13) */}
                {clip.scoreBreakdown && (
                  <div className="pt-2 border-t border-[#1F2937] space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Clip Potential Signals</span>
                      <span className="text-cyan-400 font-mono text-[9px]">Confidence: High</span>
                    </div>

                    <div className="space-y-1.5 text-[10px]">
                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span>Hook strength</span>
                          <span className="font-mono text-white font-bold">{clip.scoreBreakdown.hook}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-400 h-full" style={{ width: `${clip.scoreBreakdown.hook}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span>Clarity & Narrative</span>
                          <span className="font-mono text-white font-bold">{clip.scoreBreakdown.curiosity}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full" style={{ width: `${clip.scoreBreakdown.curiosity}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span>Emotional conviction</span>
                          <span className="font-mono text-white font-bold">{clip.scoreBreakdown.emotion}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full" style={{ width: `${clip.scoreBreakdown.emotion}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span>Standalone context</span>
                          <span className="font-mono text-white font-bold">{clip.scoreBreakdown.standalone}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full" style={{ width: `${clip.scoreBreakdown.standalone}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Duration + Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1F2937] text-[10px]">
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatTime(clip.start)} - {formatTime(clip.end)}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-cyan-400 font-bold">{Math.round(clip.duration)}s</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip);
                      onJumpToTime(clip.start);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-sm transition-all"
                  >
                    <span>Use this moment</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* 2. SMART FILLER WORD REMOVAL (Section 17) */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Smart Filler Removal
            </h4>
          </div>
          {detectedFillers.length > 0 && (
            <button
              type="button"
              onClick={removeAllFillers}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3 h-3" /> Remove All High-Confidence
            </button>
          )}
        </div>

        {detectedFillers.length === 0 ? (
          <div className="p-4 rounded-lg bg-[#0B0F17] border border-[#1F2937] text-center text-xs text-slate-500">
            No filler words detected in this clip window.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {detectedFillers.map((filler) => {
              const isCut = Boolean(activeCutsState[filler.id]);

              return (
                <div
                  key={filler.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                    isCut
                      ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                      : 'bg-[#0B0F17] border-[#1F2937] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-500">{formatTime(filler.start)}</span>
                    <span className="font-bold text-white">&ldquo;{filler.word}&rdquo;</span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      {Math.round((filler.confidence || 0.95) * 100)}% conf
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCut(filler.id)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                      isCut
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {isCut ? 'Removed' : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. SMART SILENCE REMOVAL (Section 18) */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Smart Silence Removal
            </h4>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {detectedSilences.length} Pauses Found
          </span>
        </div>

        {/* Silence Threshold Selector */}
        <div className="flex items-center justify-between bg-[#0B0F17] p-2 rounded-lg border border-[#1F2937] text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Cut Threshold:</span>
          <div className="flex items-center gap-1.5">
            {[
              { label: 'Aggressive (0.3s)', val: 0.3 },
              { label: 'Balanced (0.5s)', val: 0.5 },
              { label: 'Natural (0.8s)', val: 0.8 },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => setSilenceThreshold(preset.val)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                  silenceThreshold === preset.val
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Silence List */}
        {detectedSilences.length === 0 ? (
          <div className="p-4 rounded-lg bg-[#0B0F17] border border-[#1F2937] text-center text-xs text-slate-500">
            No awkward pauses exceeding {silenceThreshold}s detected.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {detectedSilences.map((silence) => {
              const isCut = Boolean(activeCutsState[silence.id]);
              const duration = (silence.end - silence.start).toFixed(1);

              return (
                <div
                  key={silence.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                    isCut
                      ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                      : 'bg-[#0B0F17] border-[#1F2937] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-500">
                      {formatTime(silence.start)} → {formatTime(silence.end)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-200">
                      {duration}s pause
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCut(silence.id)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                      isCut
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {isCut ? 'Trimmed' : 'Trim'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. REAL VOICE ENERGY CADENCE (Section 10) */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#283344] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Speech Energy Cadence
            </h4>
          </div>
          {voiceEnergy && (
            <span className="text-[10px] text-cyan-400 font-mono font-bold">
              {voiceEnergy.wordsPerSecond.toFixed(1)} words/sec ({voiceEnergy.level})
            </span>
          )}
        </div>

        {voiceEnergy ? (
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {voiceEnergy.explanation} Peak window:{' '}
            <strong className="text-white font-mono">{voiceEnergy.start}s - {voiceEnergy.end}s</strong>.
          </p>
        ) : (
          <p className="text-[10px] text-slate-500">
            Cadence analysis active. Requires at least 6 aligned transcript words.
          </p>
        )}
      </div>

    </div>
  );
};
