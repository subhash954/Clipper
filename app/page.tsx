'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { PricingModal } from '@/components/PricingModal';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { 
  Scissors, 
  Youtube, 
  Sparkles, 
  Flame, 
  Film, 
  FileText, 
  Check, 
  ArrowRight, 
  Key, 
  Clock, 
  Star,
  ShieldCheck,
  TrendingUp,
  DollarSign
} from 'lucide-react';

export default function LandingPage() {
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar 
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenApiKeyModal={() => setIsApiModalOpen(true)}
      />

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200 bg-white">
        
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-red-500/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-500">
            <Youtube className="w-3.5 h-3.5 text-red-600" />
            <span>The YouTube-First AI Video Repurposing Suite</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            Turn 1-Hour YouTube Videos Into <br />
            <span className="text-red-600">15 Viral Shorts</span> In Seconds
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Paste any long video or podcast URL. <strong className="text-slate-900">Clipper</strong> automatically slices high-retention clips, applies Hormozi dynamic captions, adds stock B-roll, and auto-schedules to your channel.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-red-600/25 transition-all hover:scale-105 flex items-center justify-center gap-2 group"
            >
              <Scissors className="w-5 h-5 -rotate-45" />
              <span>Launch Clipper Dashboard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/admin"
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm sm:text-base border border-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Admin Telemetry</span>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-500" />
                ))}
              </div>
              <span className="font-bold text-slate-900">4.9/5 Rating</span>
            </div>
            <span>•</span>
            <span>⚡ Deepgram &amp; Gemini 1.5 Flash Powered</span>
            <span>•</span>
            <span>🚀 100% Free Commercial Stock B-Roll</span>
          </div>

        </div>

      </section>

      {/* The 3 Core Workflows Showcase */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">
              3 Powerful AI Workflows
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              One Software. Endless Content.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Clean, light, and built for speed without complicated timelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Workflow 1 */}
            <div className="clean-card-feature p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold">
                <Youtube className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">1-Hour to 15 Shorts</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Paste any YouTube link. AI transcribes, ranks the best hooks, adds B-roll, subtitles, sound effects, and queues daily uploads to your channel.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 w-fit">
                Cost: ~$0.65 for 15 Shorts
              </div>
            </div>

            {/* Workflow 2 */}
            <div className="clean-card-feature p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">1-Finger Viral Reel</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Drop any raw short clip. In 1 tap, AI removes awkward silence, adds big animated Hormozi captions, auto-emojis, and background music.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 w-fit">
                Export Ready in 5 Seconds
              </div>
            </div>

            {/* Workflow 3 */}
            <div className="clean-card-feature p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">20-Min Documentary</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Vox &amp; Dhruv Rathee style video essays. AI checks facts, attaches citations, animates motion graphic cards, and mixes cinematic scores.
              </p>
              <div className="pt-2 text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 w-fit">
                Agency Tier ($99/mo)
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Financial Transparency Section */}
      <section className="py-16 px-4 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto clean-card-feature p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Live Financial Telemetry
            </span>
            <h3 className="text-xl font-bold text-slate-900">Track Unit Economics To The Exact Cent</h3>
            <p className="text-xs text-slate-500">
              Our Admin Super-Panel monitors live API costs across Deepgram, Gemini 1.5 Flash, and Cloudflare R2 in real-time.
            </p>
          </div>

          <Link
            href="/admin"
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Open Admin Telemetry</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-10 px-4 text-center text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-2 font-bold text-slate-800">
          <Scissors className="w-4 h-4 text-red-600 -rotate-45" />
          <span>Clipper AI Video Studio</span>
        </div>
        <p>© 2026 Clipper. Clean, light, high-performance software for global YouTube creators.</p>
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
