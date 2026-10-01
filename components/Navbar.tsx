'use client';

import React from 'react';
import Link from 'next/link';
import { Scissors, Sparkles, Key, Zap, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  onOpenPricing?: () => void;
  onOpenApiKeyModal?: () => void;
  freeCredits?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenPricing, 
  onOpenApiKeyModal,
  freeCredits = 3 
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1F2937] bg-[#0B0F17]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Scissors className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-white">Clipper</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                AI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">AI Video Intelligence Workspace</p>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">
            Workspace
          </Link>
          <Link href="/studio" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Studio
          </Link>
          <Link href="/admin" className="text-slate-300 hover:text-cyan-400 transition-colors flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Telemetry
          </Link>
          <button 
            type="button"
            onClick={onOpenPricing}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Pricing
          </button>
        </nav>

        {/* Right CTA Area */}
        <div className="flex items-center gap-3">
          
          {/* API Key Connect Button */}
          {onOpenApiKeyModal && (
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111827] hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-[#283344] transition-colors shadow-2xs cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Connect AI Keys</span>
            </button>
          )}

          {/* Credits Counter */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
            <span>{freeCredits} Free Credits</span>
          </div>

          {/* Launch App Button */}
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all"
          >
            Open Workspace →
          </Link>

        </div>

      </div>
    </header>
  );
};
