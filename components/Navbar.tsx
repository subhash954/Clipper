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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-md shadow-red-600/20 group-hover:scale-105 transition-transform">
            <Scissors className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">Clipper</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                AI
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium hidden sm:block">AI Video Intelligence Workspace</p>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-600">
          <Link href="/dashboard" className="hover:text-red-600 transition-colors">
            Workspace
          </Link>
          <Link href="/studio" className="hover:text-red-600 transition-colors flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-red-600" />
            Studio
          </Link>
          <Link href="/admin" className="hover:text-red-600 transition-colors flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
            Telemetry
          </Link>
          <button 
            type="button"
            onClick={onOpenPricing}
            className="hover:text-red-600 transition-colors cursor-pointer"
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
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <span>Connect AI Keys</span>
            </button>
          )}

          {/* Credits Counter */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold shadow-2xs">
            <Zap className="w-3.5 h-3.5 text-red-600 fill-red-600" />
            <span>{freeCredits} Free Credits</span>
          </div>

          {/* Launch App Button */}
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-red-600/20 hover:scale-[1.02] transition-all"
          >
            Open Workspace →
          </Link>

        </div>

      </div>
    </header>
  );
};
