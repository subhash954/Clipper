'use client';

import React, { useState } from 'react';
import { AudioStudioSettings, SubtitleLanguage } from '@/lib/types';
import { Mic2, Music, Volume2, Sparkles, Wand2, Sliders } from 'lucide-react';

interface AudioStudioTabProps {
  settings: AudioStudioSettings;
  onChange: (settings: AudioStudioSettings) => void;
}

export const AudioStudioTab: React.FC<AudioStudioTabProps> = ({ settings, onChange }) => {
  const [ttsScript, setTtsScript] = useState("Hey everyone, stop waiting for perfection and build value today!");
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

  const handleUpdate = (updates: Partial<AudioStudioSettings>) => {
    onChange({ ...settings, ...updates });
  };

  const musicTracks = [
    { id: 'lofi', name: 'Chill Lo-Fi Beat', genre: 'Relaxed / Focus' },
    { id: 'phonk', name: 'Drift Phonk Viral', genre: 'High Energy / Workout' },
    { id: 'cinematic', name: 'Hans Cinematic', genre: 'Dramatic Storytelling' },
    { id: 'synthwave', name: 'Retro 80s Synth', genre: 'Tech / Futuristic' },
  ] as const;

  const handleGenerateTTS = () => {
    setIsGeneratingVoice(true);
    setTimeout(() => {
      setIsGeneratingVoice(false);
    }, 1200);
  };

  return (
    <div className="space-y-5">
      
      {/* Feature 13: AI Studio Sound & Noise Cleaner */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                13. AI Studio Sound Cleaner
              </h3>
              <p className="text-[10px] text-slate-400">Removes background noise, fan hum & room echo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ studioSoundEnabled: !settings.studioSoundEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.studioSoundEnabled ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.studioSoundEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {settings.studioSoundEnabled && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Voice enhanced with 24-bit studio mic clarity. Background noise attenuated by -28dB.</span>
          </div>
        )}
      </div>

      {/* Feature 14: Trending Royalty-Free Background Music & Auto-Ducking */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              14. Trending Music & Auto-Duck
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ backgroundMusicEnabled: !settings.backgroundMusicEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.backgroundMusicEnabled ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.backgroundMusicEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Track selection */}
        <div className="space-y-1.5">
          {musicTracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => handleUpdate({ musicTrack: track.id, backgroundMusicEnabled: true })}
              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                settings.backgroundMusicEnabled && settings.musicTrack === track.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/5 bg-slate-800/40 hover:bg-slate-800/80'
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-white">{track.name}</p>
                <p className="text-[10px] text-slate-400">{track.genre}</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                100% Royalty Free
              </span>
            </button>
          ))}
        </div>

        {/* Auto Ducking Toggle */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-semibold text-white">Smart Auto-Ducking</p>
            <p className="text-[10px] text-slate-400">Lowers music by 75% automatically when speaker talks</p>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ autoDucking: !settings.autoDucking })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.autoDucking ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.autoDucking ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Feature 15: AI Voice Dubbing in Original Voice */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              15. AI Voice Clone Dubbing
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ dubbingEnabled: !settings.dubbingEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.dubbingEnabled ? 'bg-amber-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.dubbingEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Clones the creator&apos;s exact voice tone and pitch into international languages.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {(['hi', 'es', 'fr', 'de'] as SubtitleLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleUpdate({ dubbingLanguage: lang, dubbingEnabled: true })}
              className={`py-2 text-xs font-semibold rounded-lg uppercase border transition-colors ${
                settings.dubbingEnabled && settings.dubbingLanguage === lang
                  ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                  : 'border-white/10 bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {lang === 'hi' ? '🇮🇳 Hindi' : lang === 'es' ? '🇪🇸 Spanish' : lang === 'fr' ? '🇫🇷 French' : '🇩🇪 German'}
            </button>
          ))}
        </div>
      </div>

      {/* Feature 16: AI Voiceover (Text-To-Speech) */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Volume2 className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            16. Text-to-Speech AI Narration
          </h3>
        </div>

        <textarea
          rows={2}
          value={ttsScript}
          onChange={(e) => setTtsScript(e.target.value)}
          placeholder="Type narration script..."
          className="w-full p-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />

        <button
          type="button"
          onClick={handleGenerateTTS}
          disabled={isGeneratingVoice}
          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-bold border border-purple-500/30 flex items-center justify-center gap-2 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>{isGeneratingVoice ? 'Synthesizing Ultra-Realistic Voice...' : 'Generate AI Voice Track'}</span>
        </button>
      </div>

      {/* Feature 17: TikTok LUFS Volume Normalization */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-xs font-semibold text-white">17. TikTok/Shorts LUFS Normalizer</p>
            <p className="text-[10px] text-slate-400">Locks master audio to optimal -14 LUFS volume standard</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleUpdate({ volumeNormalization: !settings.volumeNormalization })}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            settings.volumeNormalization ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
              settings.volumeNormalization ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

    </div>
  );
};
