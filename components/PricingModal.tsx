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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-slate-900 animate-in fade-in zoom-in-95">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 max-w-lg mx-auto">
          <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200 shadow-xs">
            Simple, Transparent Pricing
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Scale Your Content &amp; 10x Your Reach
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Choose the plan that fits your growth. Cancel anytime with 1-click.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          
          {/* 1. Free Starter */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Free Starter</h3>
                <p className="text-xs text-slate-500 mt-1">For creators testing the waters</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">$0</span>
                <span className="text-xs text-slate-500 font-medium">/ forever</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>3 Free Exports per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Basic Subtitle Styles</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Standard 720p Resolution</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <span className="line-through">Watermark Removal</span>
                </li>
              </ul>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              Current Free Plan
            </button>
          </div>

          {/* 2. Pro Creator (Most Popular) */}
          <div className="relative p-6 rounded-2xl bg-red-50/20 border-2 border-red-500 flex flex-col justify-between space-y-6 shadow-xl shadow-red-500/10">
            {/* Best Value Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md">
              Most Popular
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500" /> Pro Creator
                </h3>
                <p className="text-xs text-red-600 font-medium mt-1">For daily YouTubers &amp; TikTokers</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">$19</span>
                <span className="text-xs text-slate-500 font-medium">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-800 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900">NO Watermark (100% Clean)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Unlimited 9:16 Exports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Signature Studio Typography Presets</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>AI Viral Hook Score Ranking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Full HD 1080p 60FPS</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                onToggleProStatus();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{isProUser ? 'Switch to Free Mode' : 'Unlock Pro Access ($19/mo)'}</span>
            </button>
          </div>

          {/* 3. Agency Studio */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Agency Studio</h3>
                <p className="text-xs text-slate-500 mt-1">For video agencies &amp; teams</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">$49</span>
                <span className="text-xs text-slate-500 font-medium">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>5 Team Member Seats</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Custom Fonts &amp; Brand Presets</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Priority GPU Cloud Rendering</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Webhook &amp; API Access</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                onToggleProStatus();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              Get Agency Plan
            </button>
          </div>

        </div>

        {/* Global Payment Notice */}
        <div className="text-center pt-2 text-xs text-slate-500 flex items-center justify-center gap-4">
          <span>🔒 256-Bit SSL Encryption</span>
          <span>💳 Supports Cards, Apple Pay, PayPal &amp; UPI</span>
          <span>⚡ Instant Activation</span>
        </div>

      </div>
    </div>
  );
};
