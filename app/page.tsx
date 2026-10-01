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
  Zap
} from 'lucide-react';

export default function LandingPage() {
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F8FAFC] flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Navigation */}
      <Navbar 
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenApiKeyModal={() => setIsApiModalOpen(true)}
      />

      {/* Hero Section */}
      <section className="relative pt-24 pb-28 px-4 sm:px-6 lg:px-8 border-b border-[#1F2937] overflow-hidden">
        
        {/* Subtle background cyan glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-xs font-bold animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Video Intelligence Workspace</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            Turn long videos into content <br />
            <span className="cyan-gradient-text">people want to watch.</span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed font-normal">
            Upload a video or paste a link. <strong className="text-white">Clipper</strong> analyzes speech, pacing, and narrative shifts to discover high-retention moments and render vertical shorts with dynamic captions.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-extrabold text-sm sm:text-base shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Scissors className="w-5 h-5 -rotate-45" />
              <span>Launch Clipper Workspace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/admin"
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-[#111827] hover:bg-slate-800 text-slate-300 font-bold text-sm sm:text-base border border-[#283344] transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Live Telemetry</span>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <span className="font-bold text-white">4.9/5 Rating</span>
            </div>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> Real Deepgram &amp; Gemini Sync
            </span>
            <span>•</span>
            <span>1080x1920 9:16 FFmpeg Export</span>
          </div>

        </div>

      </section>

      {/* The 3 Core Workflows Showcase (Section 7) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0E1524]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Creator Workflows
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              One Workspace. Endless Content.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Clean, visual, and built for speed without bloated timelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Workflow 1 */}
            <div className="clipper-card-feature p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 flex items-center justify-center font-bold">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Find the Best Moments</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Analyze long videos and discover the strongest short-form moments automatically with transparent Clip Potential metrics.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-md border border-cyan-800/40 w-fit">
                AI Discovery Mode
              </div>
            </div>

            {/* Workflow 2 */}
            <div className="clipper-card-feature p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 flex items-center justify-center font-bold">
                <Type className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Create Captioned Clips</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Turn your raw video into polished content with intelligent kinetic typography, presets, and exact word-level timing.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-md border border-cyan-800/40 w-fit">
                Kinetic Presets
              </div>
            </div>

            {/* Workflow 3 */}
            <div className="clipper-card-feature p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 flex items-center justify-center font-bold">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Open the Editor</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Take full control over exact timing, 9:16 re-framing, dynamic captions, audio ducks, and B-roll visual layers.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-md border border-cyan-800/40 w-fit">
                Multi-Track Timeline
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Financial & Telemetry Section */}
      <section className="py-16 px-4 bg-[#0B0F17] border-t border-[#1F2937]">
        <div className="max-w-4xl mx-auto clipper-card p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              Live Provider Telemetry
            </span>
            <h3 className="text-xl font-bold text-white">Track Unit Economics To The Exact Cent</h3>
            <p className="text-xs text-slate-400">
              Clipper monitors real API usage across Deepgram STT, Gemini Flash, Pixabay B-roll, and FFmpeg renders with complete transparency.
            </p>
          </div>

          <Link
            href="/admin"
            className="px-6 py-3 rounded-xl bg-[#161F30] hover:bg-slate-800 text-white font-bold text-xs border border-[#283344] shadow-md flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Open Telemetry</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#1F2937] bg-[#0E1524] py-10 px-4 text-center text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-2 font-bold text-slate-300">
          <Scissors className="w-4 h-4 text-cyan-400 -rotate-45" />
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
