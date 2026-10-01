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

  const [ttsFeedback, setTtsFeedback] = useState<string | null>(null);

  const handleGenerateTTS = async () => {
    if (!ttsScript.trim()) return;

    setIsGeneratingVoice(true);
    setTtsFeedback(null);

    try {
      const res = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsScript.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTtsFeedback(data.details || data.error || 'Voice generation provider not configured.');
      } else {
        setTtsFeedback(`Voice generated successfully via ${data.provider}! Ready for timeline.`);
      }
    } catch (err: any) {
      setTtsFeedback('Voice generation provider not configured.');
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Feature 13: AI Studio Sound & Noise Cleaner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Mic2 className="w-4 h-4 text-emerald-600" />
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                13. AI Studio Sound Cleaner
              </h3>
              <p className="text-[10px] text-slate-500">Removes background noise, fan hum &amp; room echo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ studioSoundEnabled: !settings.studioSoundEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.studioSoundEnabled ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                settings.studioSoundEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {settings.studioSoundEnabled && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>Voice enhanced with 24-bit studio mic clarity. Background noise attenuated by -28dB.</span>
          </div>
        )}
      </div>

      {/* Feature 14: Trending Royalty-Free Background Music & Auto-Ducking */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              14. Trending Music &amp; Auto-Duck
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ backgroundMusicEnabled: !settings.backgroundMusicEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.backgroundMusicEnabled ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                settings.backgroundMusicEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Track selection */}
        <div className="space-y-2">
          {musicTracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => handleUpdate({ musicTrack: track.id, backgroundMusicEnabled: true })}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                settings.backgroundMusicEnabled && settings.musicTrack === track.id
                  ? 'border-red-500 bg-red-50/60 shadow-2xs ring-1 ring-red-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>
                <p className="text-xs font-bold text-slate-900">{track.name}</p>
                <p className="text-[10px] text-slate-500">{track.genre}</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                100% Royalty Free
              </span>
            </button>
          ))}
        </div>

        {/* Auto Ducking Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            <p className="text-xs font-bold text-slate-900">Smart Auto-Ducking</p>
            <p className="text-[10px] text-slate-500">Lowers music by 75% automatically when speaker talks</p>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ autoDucking: !settings.autoDucking })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.autoDucking ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                settings.autoDucking ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Feature 15: AI Voice Dubbing in Original Voice */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              15. AI Voice Clone Dubbing
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ dubbingEnabled: !settings.dubbingEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.dubbingEnabled ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                settings.dubbingEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Clones the creator&apos;s exact voice tone and pitch into international languages.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {(['hi', 'es', 'fr', 'de'] as SubtitleLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleUpdate({ dubbingLanguage: lang, dubbingEnabled: true })}
              className={`py-2 text-xs font-bold rounded-xl uppercase border transition-colors cursor-pointer ${
                settings.dubbingEnabled && settings.dubbingLanguage === lang
                  ? 'border-red-500 bg-red-50 text-red-700 shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {lang === 'hi' ? '🇮🇳 Hindi' : lang === 'es' ? '🇪🇸 Spanish' : lang === 'fr' ? '🇫🇷 French' : '🇩🇪 German'}
            </button>
          ))}
        </div>
      </div>

      {/* Feature 16: AI Voiceover (Text-To-Speech) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Volume2 className="w-4 h-4 text-red-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            16. Text-to-Speech AI Narration
          </h3>
        </div>

        <textarea
          rows={2}
          value={ttsScript}
          onChange={(e) => setTtsScript(e.target.value)}
          placeholder="Type narration script..."
          className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-100"
        />

        <button
          type="button"
          onClick={handleGenerateTTS}
          disabled={isGeneratingVoice}
          className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isGeneratingVoice ? 'Calling ElevenLabs Voice API...' : 'Generate AI Voice Track'}</span>
        </button>

        {ttsFeedback && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 leading-relaxed font-medium">
            {ttsFeedback}
          </div>
        )}
      </div>

      {/* Feature 17: TikTok LUFS Volume Normalization */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-600" />
          <div>
            <p className="text-xs font-bold text-slate-900">17. TikTok/Shorts LUFS Normalizer</p>
            <p className="text-[10px] text-slate-500">Locks master audio to optimal -14 LUFS volume standard</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleUpdate({ volumeNormalization: !settings.volumeNormalization })}
          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
            settings.volumeNormalization ? 'bg-red-600' : 'bg-slate-200'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
              settings.volumeNormalization ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

    </div>
  );
};
