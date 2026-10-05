'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Check, ShieldCheck, AlertCircle, ExternalLink, Server } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/config/providers')
        .then((res) => res.json())
        .then((data) => {
          if (data.providers) {
            setProviderStatus(data.providers);
          }
        })
        .catch((err) => console.warn('Provider check error:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div suppressHydrationWarning className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">AI Services &amp; Provider Security</h3>
            <p className="text-xs text-slate-500">Production-grade server-side credential isolation</p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Zero Client-Side Exposure</p>
            <p className="text-[11px] text-emerald-800">
              API credentials are never stored in browser localStorage or transmitted in request headers. All keys are encrypted and managed strictly server-side in <code>.env.local</code>.
            </p>
          </div>
        </div>

        {/* Live Provider Status List */}
        <div className="space-y-2.5 text-xs">
          {loading ? (
            <div className="p-6 text-center text-slate-500">Checking provider statuses...</div>
          ) : (
            <>
              {/* 1. Gemini */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">Google Gemini 2.5 Flash</span>
                    <span className="text-[10px] text-slate-500 font-mono">(Hook Mining)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Analyzes real transcripts and aligns viral moments</p>
                </div>
                {providerStatus?.gemini?.isConfigured ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Not Set
                  </span>
                )}
              </div>

              {/* 2. Deepgram */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">Deepgram Nova-2</span>
                    <span className="text-[10px] text-slate-500 font-mono">(Word-Level STT)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Speech-to-text with exact millisecond timestamps</p>
                </div>
                {providerStatus?.deepgram?.isConfigured ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Not Set
                  </span>
                )}
              </div>

              {/* 3. Pexels */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">Pexels Video API</span>
                    <span className="text-[10px] text-slate-500 font-mono">(9:16 B-Roll Primary)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Vertical HD stock footage with commercial metadata</p>
                </div>
                {providerStatus?.pexels?.isConfigured ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Not Set
                  </span>
                )}
              </div>

              {/* 4. Pixabay */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">Pixabay API</span>
                    <span className="text-[10px] text-slate-500 font-mono">(B-Roll &amp; SFX Fallback)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Secondary stock assets and audio effects</p>
                </div>
                {providerStatus?.pixabay?.isConfigured ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Not Set
                  </span>
                )}
              </div>

              {/* 5. Supabase */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">Supabase PostgreSQL</span>
                    <span className="text-[10px] text-slate-500 font-mono">(Database &amp; RLS)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Persistent storage for projects, clips, and render jobs</p>
                </div>
                {providerStatus?.supabase?.isConfigured ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium text-[10px] border border-slate-200">
                    Local Storage (Dev Mode)
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
        >
          Done
        </button>

      </div>
    </div>
  );
};
