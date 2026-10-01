'use client';

import React from 'react';
import { X, Check, Zap, Crown, Sparkles } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  isProUser: boolean;
  onToggleProStatus: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  isProUser,
  onToggleProStatus
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl rounded-3xl bg-slate-900 border border-white/15 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 max-w-lg mx-auto">
          <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30">
            Simple, Transparent Pricing
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Scale Your Content & 10x Your Reach
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Choose the plan that fits your growth. Cancel anytime with 1-click.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          
          {/* 1. Free Starter */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-white/10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Free Starter</h3>
                <p className="text-xs text-slate-400 mt-1">For creators testing the waters</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">$0</span>
                <span className="text-xs text-slate-400">/ forever</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>3 Free Exports per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Basic Subtitle Styles</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Standard 720p Resolution</span>
                </li>
                <li className="flex items-center gap-2 text-slate-500">
                  <span className="line-through">Watermark Removal</span>
                </li>
              </ul>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-white/10 transition-colors"
            >
              Current Free Plan
            </button>
          </div>

          {/* 2. Pro Creator (Most Popular) */}
          <div className="relative p-6 rounded-2xl bg-gradient-to-b from-purple-950/40 via-slate-900 to-slate-900 border-2 border-purple-500 flex flex-col justify-between space-y-6 shadow-xl shadow-purple-500/10">
            {/* Best Value Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md">
              Most Popular
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" /> Pro Creator
                </h3>
                <p className="text-xs text-purple-300 mt-1">For daily YouTubers & TikTokers</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">$19</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">NO Watermark (100% Clean)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Unlimited 9:16 Exports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Signature Studio Typography Presets</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>AI Viral Hook Score Ranking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Full HD 1080p 60FPS</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                onToggleProStatus();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{isProUser ? 'Switch to Free Mode' : 'Unlock Pro Access ($19/mo)'}</span>
            </button>
          </div>

          {/* 3. Agency Studio */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-white/10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Agency Studio</h3>
                <p className="text-xs text-slate-400 mt-1">For video agencies & teams</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">$49</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>5 Team Member Seats</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Custom Fonts & Brand Presets</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Priority GPU Cloud Rendering</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Webhook & API Access</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                onToggleProStatus();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-white/10 transition-colors"
            >
              Get Agency Plan
            </button>
          </div>

        </div>

        {/* Global Payment Notice */}
        <div className="text-center pt-2 text-xs text-slate-500 flex items-center justify-center gap-4">
          <span>🔒 256-Bit SSL Encryption</span>
          <span>💳 Supports Credit Cards, Apple Pay, PayPal & UPI</span>
          <span>⚡ Instant Activation</span>
        </div>

      </div>
    </div>
  );
};
