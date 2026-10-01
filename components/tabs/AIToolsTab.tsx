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
    <div className="space-y-6 text-slate-900">
      {/* SECTION 1: AI Boost */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 px-1">
          <Sparkles className="w-3.5 h-3.5 text-red-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            AI Boost
          </h3>
        </div>

        <div className="space-y-3">
          {/* Tool 1: AI Captions */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">AI Captions</p>
                <p className="text-[10px] text-slate-500">
                  Auto-generate word-synchronized styled subtitles
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTab?.('style')}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-red-50 text-[10px] font-bold text-slate-700 hover:text-red-700 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
              >
                Style
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('captions')}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-red-50 text-[10px] font-bold text-slate-700 hover:text-red-700 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
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
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 shadow-2xs" />
              </label>
            </div>
          </div>

          {/* Tool 2: Remove Silences */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-xs">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Remove Silences</p>
                <p className="text-[10px] text-slate-500">
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
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 shadow-2xs" />
            </label>
          </div>

          {/* Tool 3: AI Auto Zooms */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                <ZoomIn className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">AI Auto Zooms</p>
                <p className="text-[10px] text-slate-500">
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
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 shadow-2xs" />
            </label>
          </div>

          {/* Tool 4: AI Auto B-rolls */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-xs">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-900">AI Auto B-rolls</p>
                  <span className="text-[9px] px-1.5 rounded-sm bg-red-50 text-red-700 border border-red-200 font-mono font-bold">
                    97%
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Swap spoken themes with relevant licensed stock footage
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTab?.('brolls')}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-red-50 text-[10px] font-bold text-slate-700 hover:text-red-700 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
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
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 shadow-2xs" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: AI Tools Suite */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-1.5 px-1">
          <Settings className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            AI Audio &amp; Performance
          </h3>
        </div>

        <div className="space-y-3">
          {/* Tool 5: AI Hook Title */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">AI Hook Title</p>
                <p className="text-[10px] text-slate-500">
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
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 shadow-2xs" />
            </label>
          </div>

          {/* Tool 6: Clean Audio / Studio Sound */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
                <Mic2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Clean Audio</p>
                <p className="text-[10px] text-slate-500">
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
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 shadow-2xs" />
            </label>
          </div>

          {/* Tool 7: Remove Bad Takes */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shadow-xs">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Remove Bad Takes</p>
                <p className="text-[10px] text-slate-500">
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
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 shadow-2xs" />
            </label>
          </div>

          {/* Tool 8: Correct Eye Contact */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-xs">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Correct Eye Contact</p>
                <p className="text-[10px] text-slate-500">
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
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 shadow-2xs" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
