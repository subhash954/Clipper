'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Check, ExternalLink, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [deepgramKey, setDeepgramKey] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');
  const [pixabayKey, setPixabayKey] = useState('');
  const [falKey, setFalKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGeminiKey(localStorage.getItem('CLIPPER_GEMINI_KEY') || '');
      setDeepgramKey(localStorage.getItem('CLIPPER_DEEPGRAM_KEY') || '');
      setPexelsKey(localStorage.getItem('CLIPPER_PEXELS_KEY') || '');
      setPixabayKey(localStorage.getItem('CLIPPER_PIXABAY_KEY') || '');
      setFalKey(localStorage.getItem('CLIPPER_FAL_KEY') || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveKeys = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('CLIPPER_GEMINI_KEY', geminiKey.trim());
      localStorage.setItem('CLIPPER_DEEPGRAM_KEY', deepgramKey.trim());
      localStorage.setItem('CLIPPER_PEXELS_KEY', pexelsKey.trim());
      localStorage.setItem('CLIPPER_PIXABAY_KEY', pixabayKey.trim());
      localStorage.setItem('CLIPPER_FAL_KEY', falKey.trim());
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Connect Real AI Services</h3>
            <p className="text-xs text-slate-500">Provide your API keys to enable live real-time AI processing.</p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>Keys are stored securely in your browser &amp; environment variables. Free tier keys work for all features.</span>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5 text-xs">
          
          {/* 1. Google Gemini API */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <span>1. Google Gemini API Key</span>
                <span className="text-[10px] text-red-600 font-bold">(Hook &amp; Script AI)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* 2. Deepgram / Groq Whisper API */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <span>2. Deepgram / Groq API Key</span>
                <span className="text-[10px] text-red-600 font-bold">(Word-level STT)</span>
              </label>
              <a
                href="https://console.deepgram.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>$200 Free Credit</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={deepgramKey}
              onChange={(e) => setDeepgramKey(e.target.value)}
              placeholder="gsk_... or deepgram token"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* 3. Pexels Stock B-Roll API */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <span>3. Pexels API Key</span>
                <span className="text-[10px] text-emerald-600 font-bold">(Recommended: 9:16 Vertical B-Roll)</span>
              </label>
              <a
                href="https://www.pexels.com/api/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>Free Pexels Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={pexelsKey}
              onChange={(e) => setPexelsKey(e.target.value)}
              placeholder="Pexels secret key..."
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* 4. Pixabay API (Secondary B-Roll & SFX) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <span>4. Pixabay API Key</span>
                <span className="text-[10px] text-blue-600 font-bold">(Alternative: B-Roll &amp; SFX Music)</span>
              </label>
              <a
                href="https://pixabay.com/api/docs/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>Free Pixabay Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={pixabayKey}
              onChange={(e) => setPixabayKey(e.target.value)}
              placeholder="Pixabay API key..."
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* 4. Fal.ai / Replicate (Flux AI Image) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <span>4. Fal.ai API Key</span>
                <span className="text-[10px] text-slate-400 font-normal">(Optional: Flux AI Images)</span>
              </label>
              <a
                href="https://fal.ai"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>Fal.ai Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={falKey}
              onChange={(e) => setFalKey(e.target.value)}
              placeholder="fal_key_..."
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:border-red-500"
            />
          </div>

        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSaveKeys}
          className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Keys Saved Successfully!</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Save &amp; Activate Real AI APIs</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
};
