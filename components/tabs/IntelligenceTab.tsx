'use client';

import React, { useState, useMemo } from 'react';
import { ViralClip, WordTimestamp, EditOperation } from '@/lib/types';
import { detectFillerWords, detectSilences, calculateVoiceEnergy } from '@/lib/edl/editDecisionList';
import { 
  Flame, 
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
  VolumeX
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

  const toggleAllFillers = () => {
    const allFillersEnabled = detectedFillers.every((f) => activeCutsState[f.id]);
    const nextState = { ...activeCutsState };
    detectedFillers.forEach((f) => {
      nextState[f.id] = !allFillersEnabled;
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
    <div className="space-y-4">
      {/* 1. Transparent AI Editorial Scoring & Viral Moments */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              1. AI Editorial Moments
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-extrabold border border-red-200">
            {clips.length} Ranked Clips
          </span>
        </div>

        {/* Clip Cards List */}
        <div className="space-y-2.5 pt-1 max-h-[420px] overflow-y-auto pr-1">
          {clips.map((clip, idx) => {
            const isSelected = activeClip?.id === clip.id;
            const clipRank = clip.rank || idx + 1;
            const isVerified = clip.alignmentStatus === 'verified';
            const isNeedsReview = clip.alignmentStatus === 'needs_review';

            return (
              <div
                key={clip.id}
                onClick={() => onSelectClip(clip)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                  isSelected
                    ? 'border-red-500 bg-red-50/40 shadow-sm ring-1 ring-red-400'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[9px]">
                      #{clipRank} {isVerified ? 'VERIFIED' : 'CLIP'}
                    </span>
                    {clip.keyMomentType && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[9px] border border-slate-200">
                        {clip.keyMomentType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 text-[10px] font-extrabold whitespace-nowrap border border-slate-200">
                    {clip.viralScore} AI Score
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-snug">{clip.title}</h4>

                {/* Tracked Spoken Quote */}
                {clip.importantLine && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-extrabold text-red-600 uppercase tracking-wider">
                      <Quote className="w-2.5 h-2.5" /> Tracked Spoken Line
                    </div>
                    <p className="font-semibold italic text-slate-900 line-clamp-2">
                      &ldquo;{clip.importantLine}&rdquo;
                    </p>
                    {clip.whyThisLineIsImportant && (
                      <p className="text-[10px] text-slate-600 border-t border-slate-200/80 pt-1 mt-1">
                        <strong className="text-slate-800">Retention Reason:</strong> {clip.whyThisLineIsImportant}
                      </p>
                    )}
                  </div>
                )}

                {/* Transparent 5-Metric Breakdown */}
                {clip.scoreBreakdown && (
                  <div className="pt-1 border-t border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                      <span>Editorial Breakdown</span>
                      <span className="text-slate-400 font-normal">Algorithm v2.1</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-center">
                      <div className="p-1 rounded bg-slate-100/80">
                        <span className="text-[8px] text-slate-500 block">Hook</span>
                        <span className="text-[10px] font-mono font-bold text-slate-900">{clip.scoreBreakdown.hook}</span>
                      </div>
                      <div className="p-1 rounded bg-slate-100/80">
                        <span className="text-[8px] text-slate-500 block">Curiosity</span>
                        <span className="text-[10px] font-mono font-bold text-slate-900">{clip.scoreBreakdown.curiosity}</span>
                      </div>
                      <div className="p-1 rounded bg-slate-100/80">
                        <span className="text-[8px] text-slate-500 block">Value</span>
                        <span className="text-[10px] font-mono font-bold text-slate-900">{clip.scoreBreakdown.value}</span>
                      </div>
                      <div className="p-1 rounded bg-slate-100/80">
                        <span className="text-[8px] text-slate-500 block">Emotion</span>
                        <span className="text-[10px] font-mono font-bold text-slate-900">{clip.scoreBreakdown.emotion}</span>
                      </div>
                      <div className="p-1 rounded bg-slate-100/80">
                        <span className="text-[8px] text-slate-500 block">Context</span>
                        <span className="text-[10px] font-mono font-bold text-slate-900">{clip.scoreBreakdown.standalone}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Duration & Timestamp Details */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <div className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatTime(clip.start)} - {formatTime(clip.end)}</span>
                    <span className="text-slate-400">({clip.duration.toFixed(1)}s)</span>
                  </div>
                  {isNeedsReview ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600">
                      <AlertCircle className="w-2.5 h-2.5" /> Needs Review
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Verified Alignment
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Real Filler Word Cutter (Edit Decision List) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              2. Authentic Filler Word Cuts
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
            {detectedFillers.length} Detected
          </span>
        </div>

        {detectedFillers.length > 0 ? (
          <div className="space-y-2">
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {detectedFillers.map((cut) => {
                const isEnabled = Boolean(activeCutsState[cut.id]);
                return (
                  <div
                    key={cut.id}
                    onClick={() => toggleCut(cut.id)}
                    className={`p-2 rounded-lg flex items-center justify-between text-xs transition-colors border cursor-pointer ${
                      isEnabled
                        ? 'bg-red-50 text-red-700 border-red-300 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 accent-red-600"
                      />
                      <span>&ldquo;{cut.word}&rdquo; at {cut.start.toFixed(1)}s</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 font-bold">
                      {cut.reason} ({(cut.end - cut.start).toFixed(2)}s)
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={toggleAllFillers}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>
                {detectedFillers.every((f) => activeCutsState[f.id])
                  ? 'Restore All Filler Words'
                  : `Apply All ${detectedFillers.length} Filler Cuts`}
              </span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic p-2">
            No conversational filler words detected in this active clip.
          </p>
        )}
      </div>

      {/* 3. Real Silence & Pause Threshold Cutter */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              3. Silence &amp; Pause Detection
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
            {detectedSilences.length} Gaps
          </span>
        </div>

        {/* Silence Threshold Selector */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span className="font-medium">Silence Threshold</span>
            <span className="font-mono font-bold text-slate-900">{silenceThreshold}s</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[0.3, 0.5, 0.8, 1.0].map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => setSilenceThreshold(th)}
                className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                  silenceThreshold === th
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {th}s
              </button>
            ))}
          </div>
        </div>

        {detectedSilences.length > 0 && (
          <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
            {detectedSilences.map((silence) => {
              const isEnabled = Boolean(activeCutsState[silence.id]);
              return (
                <div
                  key={silence.id}
                  onClick={() => toggleCut(silence.id)}
                  className={`p-2 rounded-lg flex items-center justify-between text-xs border cursor-pointer ${
                    isEnabled
                      ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 accent-red-600"
                    />
                    <span>Pause: {silence.start.toFixed(1)}s - {silence.end.toFixed(1)}s</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 font-bold">
                    +{(silence.end - silence.start).toFixed(2)}s
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Authentic Voice Energy & Cadence Measurement */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              4. Voice Energy Cadence
            </h3>
          </div>
          {voiceEnergy && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              voiceEnergy.level === 'High'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {voiceEnergy.level} Cadence
            </span>
          )}
        </div>
        {voiceEnergy ? (
          <p className="text-[11px] text-slate-600">
            {voiceEnergy.explanation}
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            Insufficient word density to calculate rolling speech cadence for this segment.
          </p>
        )}
      </div>

      {/* 5. Clickable Titles & Social Copy */}
      {activeClip && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              5. Clickable Titles &amp; Hooks
            </h3>
          </div>

          <div className="space-y-2">
            {[
              activeClip.title,
              `Why ${activeClip.title.replace(/[^a-zA-Z0-9 ]/g, '')} is changing everything 💡`,
              `The harsh truth about ${activeClip.keyMomentType || 'this secret'} 🤫 #shorts`,
            ].map((title, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
              >
                <span className="text-xs text-slate-800 line-clamp-1 font-medium">{title}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(title, idx)}
                  className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                  title="Copy Title"
                >
                  {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
