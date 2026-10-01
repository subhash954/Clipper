'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { PricingModal } from '@/components/PricingModal';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { 
  Scissors, 
  Sparkles, 
  Film, 
  Type, 
  Sliders, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Star, 
  BarChart3, 
  Layers,
  Zap,
  FolderOpen
} from 'lucide-react';

export default function LandingPage() {
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-slate-900 flex flex-col font-sans selection:bg-red-100 selection:text-red-900">
      
      {/* Top Navigation */}
      <Navbar 
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenApiKeyModal={() => setIsApiModalOpen(true)}
      />

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        
        {/* Subtle background red glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-red-100/60 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-red-600" />
            <span>AI Video Intelligence Workspace</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            Turn long videos into content <br />
            <span className="red-gradient-text">people want to watch.</span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Upload a video or paste a YouTube link. <strong className="text-slate-900 font-bold">Clipper</strong> analyzes speech, pacing, and narrative shifts to discover high-retention moments and render vertical shorts with dynamic captions.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-red-600/25 transition-all hover:scale-105 flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Scissors className="w-5 h-5 -rotate-45" />
              <span>Launch Clipper Workspace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/admin"
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm sm:text-base border border-slate-200 shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>Live Telemetry</span>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-500" />
                ))}
              </div>
              <span className="font-bold text-slate-800">4.9/5 Rating</span>
            </div>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-red-600" /> Real Deepgram &amp; Gemini Sync
            </span>
            <span>•</span>
            <span>1080x1920 9:16 FFmpeg Export</span>
          </div>

        </div>

      </section>

      {/* The 3 Core Workflows Showcase */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">
              Creator Workflows
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              One Workspace. Endless Content.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Clean, visual, and built for speed without bloated timelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Workflow 1 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-red-300 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Find the Best Moments</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Analyze long videos and discover the strongest short-form moments automatically with transparent Clip Potential metrics.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-md border border-red-200 w-fit">
                AI Discovery Mode
              </div>
            </div>

            {/* Workflow 2 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-red-300 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold shadow-xs">
                <Type className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Create Captioned Clips</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Turn your raw video into polished content with intelligent kinetic typography, presets, and exact word-level timing.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-md border border-red-200 w-fit">
                Kinetic Presets
              </div>
            </div>

            {/* Workflow 3 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-red-300 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold shadow-xs">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Open the Editor</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Take full control over exact timing, 9:16 re-framing, dynamic captions, audio ducks, and B-roll visual layers.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-md border border-red-200 w-fit">
                Multi-Track Timeline
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Financial & Telemetry Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-8 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 px-2.5 py-0.5 rounded border border-red-200">
              Live Provider Telemetry
            </span>
            <h3 className="text-xl font-bold text-slate-900">Track Unit Economics To The Exact Cent</h3>
            <p className="text-xs text-slate-600">
              Clipper monitors real API usage across Deepgram STT, Gemini Flash, Pixabay B-roll, and FFmpeg renders with complete transparency.
            </p>
          </div>

          <Link
            href="/admin"
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-red-500" />
            <span>Open Telemetry</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-10 px-4 text-center text-xs text-slate-500 space-y-1 shadow-2xs">
        <div className="flex items-center justify-center gap-2 font-bold text-slate-800">
          <Scissors className="w-4 h-4 text-red-600 -rotate-45" />
          <span>Clipper AI Video Intelligence Workspace</span>
        </div>
        <p>© 2026 Clipper. High-performance software for video creators.</p>
      </footer>

      {/* Modals */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        isProUser={false}
        onToggleProStatus={() => {}}
      />

      <ApiKeyModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
      />

    </div>
  );
}
