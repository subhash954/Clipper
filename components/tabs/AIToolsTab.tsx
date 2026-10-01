'use client';

import React, { useState } from 'react';
import { VisualLayoutSettings, AudioStudioSettings, EditOperation, WordTimestamp } from '@/lib/types';
import {
  Sparkles,
  Volume2,
  Scissors,
  ZoomIn,
  Film,
  Flame,
  Mic2,
  Trash2,
  Eye,
  Crop,
  Check,
  ChevronRight,
  Settings,
} from 'lucide-react';

interface AIToolsTabProps {
  visualSettings: VisualLayoutSettings;
  audioSettings: AudioStudioSettings;
  onVisualChange: (settings: VisualLayoutSettings) => void;
  onAudioChange: (settings: AudioStudioSettings) => void;
  onApplySilences?: () => void;
  onApplyAutoZooms?: () => void;
  onNavigateToTab?: (tab: 'style' | 'captions' | 'brolls' | 'reframe') => void;
  words?: WordTimestamp[];
}

export const AIToolsTab: React.FC<AIToolsTabProps> = ({
  visualSettings,
  audioSettings,
  onVisualChange,
  onAudioChange,
  onApplySilences,
  onApplyAutoZooms,
  onNavigateToTab,
}) => {
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [silencesEnabled, setSilencesEnabled] = useState(
    Boolean(visualSettings.removeSilencesEnabled)
  );
  const [zoomsEnabled, setZoomsEnabled] = useState(
    Boolean(visualSettings.autoZoomsEnabled)
  );
  const [brollEnabled, setBrollEnabled] = useState(
    Boolean(visualSettings.autoBrollEnabled)
  );
  const [hookTitleEnabled, setHookTitleEnabled] = useState(
    Boolean(visualSettings.showIntroHook)
  );
  const [cleanAudioEnabled, setCleanAudioEnabled] = useState(
    Boolean(audioSettings.studioSoundEnabled)
  );
  const [badTakesEnabled, setBadTakesEnabled] = useState(
    Boolean(visualSettings.removeBadTakesEnabled)
  );
  const [eyeContactEnabled, setEyeContactEnabled] = useState(
    Boolean(visualSettings.correctEyeContactEnabled)
  );

  const handleToggleSilences = (enabled: boolean) => {
    setSilencesEnabled(enabled);
    onVisualChange({ ...visualSettings, removeSilencesEnabled: enabled });
    if (enabled) {
      onApplySilences?.();
    }
  };

  const handleToggleZooms = (enabled: boolean) => {
    setZoomsEnabled(enabled);
    onVisualChange({ ...visualSettings, autoZoomsEnabled: enabled });
    if (enabled) {
      onApplyAutoZooms?.();
    }
  };

  const handleToggleCleanAudio = (enabled: boolean) => {
    setCleanAudioEnabled(enabled);
    onAudioChange({ ...audioSettings, studioSoundEnabled: enabled });
  };

  return (
    <div className="space-y-5 text-[#F8FAFC]">
      {/* SECTION 1: AI Boost */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 px-1">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            AI Boost
          </h3>
        </div>

        <div className="space-y-2">
          {/* Tool 1: AI Captions */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#283344] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">AI Captions</p>
                <p className="text-[10px] text-slate-400">
                  Auto-generate word-synchronized styled subtitles
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTab?.('style')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700 cursor-pointer"
              >
                Style
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('captions')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700 cursor-pointer"
              >
                Edit
              </button>
              <label className="relative inline-flex items-center cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={captionsEnabled}
                  onChange={(e) => setCaptionsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
              </label>
            </div>
          </div>

          {/* Tool 2: Remove Silences */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#283344] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-400 flex items-center justify-center">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Remove Silences</p>
                <p className="text-[10px] text-slate-400">
                  Cut pauses &gt; 0.4s to tighten retention and pacing
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={silencesEnabled}
                onChange={(e) => handleToggleSilences(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          {/* Tool 3: AI Auto Zooms */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#283344] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/40 text-amber-400 flex items-center justify-center">
                <ZoomIn className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">AI Auto Zooms</p>
                <p className="text-[10px] text-slate-400">
                  Dynamic 1.15x jump cuts on high-energy sentences
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={zoomsEnabled}
                onChange={(e) => handleToggleZooms(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          {/* Tool 4: AI Auto B-rolls */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#283344] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-400 flex items-center justify-center">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white">AI Auto B-rolls</p>
                  <span className="text-[9px] px-1.5 rounded-sm bg-cyan-950 text-cyan-300 font-mono font-bold">
                    97%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Swap spoken themes with relevant licensed stock footage
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTab?.('brolls')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700 cursor-pointer"
              >
                Storyboard
              </button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={brollEnabled}
                  onChange={(e) => {
                    setBrollEnabled(e.target.checked);
                    onVisualChange({ ...visualSettings, autoBrollEnabled: e.target.checked });
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: AI Tools Suite */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-1.5 px-1">
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            AI Tools
          </h3>
        </div>

        <div className="space-y-2">
          {/* Tool 5: AI Hook Title */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#283344] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/40 text-amber-400 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">AI Hook Title</p>
                <p className="text-[10px] text-slate-400">
                  Generate attention-grabbing opening banner badge
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hookTitleEnabled}
                onChange={(e) => {
                  setHookTitleEnabled(e.target.checked);
                  onVisualChange({ ...visualSettings, showIntroHook: e.target.checked });
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          {/* Tool 6: Clean Audio / Studio Sound */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#283344] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center">
                <Mic2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Clean Audio</p>
                <p className="text-[10px] text-slate-400">
                  Studio voice isolation &amp; room noise suppression
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={cleanAudioEnabled}
                onChange={(e) => handleToggleCleanAudio(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          {/* Tool 7: Remove Bad Takes */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#283344] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Remove Bad Takes</p>
                <p className="text-[10px] text-slate-400">
                  Detect and cut out repeated lines and false starts
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={badTakesEnabled}
                onChange={(e) => {
                  setBadTakesEnabled(e.target.checked);
                  onVisualChange({ ...visualSettings, removeBadTakesEnabled: e.target.checked });
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>

          {/* Tool 8: Correct Eye Contact */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#283344] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-950/60 border border-teal-800/40 text-teal-400 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Correct Eye Contact</p>
                <p className="text-[10px] text-slate-400">
                  Subtly re-orient speaker gaze towards the camera lens
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={eyeContactEnabled}
                onChange={(e) => {
                  setEyeContactEnabled(e.target.checked);
                  onVisualChange({ ...visualSettings, correctEyeContactEnabled: e.target.checked });
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
