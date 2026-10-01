'use client';

import React, { useState } from 'react';
import { SocialPublishSettings } from '@/lib/types';
import { AI_SOCIAL_METADATA, AI_THUMBNAILS } from '@/lib/sampleData';
import { Share2, Clock, Hash, Image as ImageIcon, Check, Copy, Send, Sparkles } from 'lucide-react';

interface SocialPublishTabProps {
  settings: SocialPublishSettings;
  onChange: (settings: SocialPublishSettings) => void;
  onJumpToTime: (time: number) => void;
}

export const SocialPublishTab: React.FC<SocialPublishTabProps> = ({
  settings,
  onChange,
  onJumpToTime
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);

  const handleUpdate = (updates: Partial<SocialPublishSettings>) => {
    onChange({ ...settings, ...updates });
  };

  const handleToggleAccount = (platform: 'tiktok' | 'youtubeShorts' | 'instagramReels') => {
    handleUpdate({
      accounts: {
        ...settings.accounts,
        [platform]: !settings.accounts[platform]
      }
    });
  };

  const handleTriggerAutoPost = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    }, 1500);
  };

  const handleCopyHashtags = () => {
    navigator.clipboard.writeText(AI_SOCIAL_METADATA.hashtags.join(' '));
    setCopiedTags(true);
    setTimeout(() => setCopiedTags(false), 1500);
  };

  return (
    <div className="space-y-5">
      
      {/* Feature 23: 1-Click Auto Post to Socials */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              23. 1-Click Auto Post to Socials
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
            Direct API
          </span>
        </div>

        {/* Platform Selection */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleToggleAccount('tiktok')}
            className={`p-2.5 rounded-xl border text-center transition-colors ${
              settings.accounts.tiktok
                ? 'border-purple-500 bg-purple-500/20 text-white font-bold'
                : 'border-white/10 bg-slate-800/60 text-slate-400'
            }`}
          >
            <p className="text-xs">TikTok</p>
            <span className="text-[9px] text-purple-300">Connected</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleAccount('youtubeShorts')}
            className={`p-2.5 rounded-xl border text-center transition-colors ${
              settings.accounts.youtubeShorts
                ? 'border-rose-500 bg-rose-500/20 text-white font-bold'
                : 'border-white/10 bg-slate-800/60 text-slate-400'
            }`}
          >
            <p className="text-xs">YT Shorts</p>
            <span className="text-[9px] text-rose-300">Connected</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleAccount('instagramReels')}
            className={`p-2.5 rounded-xl border text-center transition-colors ${
              settings.accounts.instagramReels
                ? 'border-pink-500 bg-pink-500/20 text-white font-bold'
                : 'border-white/10 bg-slate-800/60 text-slate-400'
            }`}
          >
            <p className="text-xs">IG Reels</p>
            <span className="text-[9px] text-pink-300">Connected</span>
          </button>
        </div>

        {/* Feature 24: AI Best Time to Post Scheduler */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Clock className="w-3.5 h-3.5" /> 24. AI Peak Viral Window
            </span>
            <span className="font-mono text-[11px] text-purple-300">Today @ 6:30 PM EST</span>
          </div>
          <p className="text-[10px] text-slate-400">
            Based on millions of viral short impressions, US audience engagement peaks in 2 hours.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTriggerAutoPost}
          disabled={isPublishing}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 transition-all"
        >
          {publishSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Queued for Peak Viral Hour!</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Pushing to TikTok & Shorts...' : 'Schedule to All 3 Channels'}</span>
            </>
          )}
        </button>
      </div>

      {/* Feature 25: Viral Hashtags & Copy */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              25. Auto Hashtags & Description
            </h3>
          </div>
          <button
            onClick={handleCopyHashtags}
            className="text-[10px] text-cyan-300 hover:underline flex items-center gap-1"
          >
            {copiedTags ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedTags ? 'Copied!' : 'Copy All'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {AI_SOCIAL_METADATA.hashtags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 font-mono text-[10px] border border-cyan-500/20"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="text-[11px] text-slate-300 bg-slate-800/60 p-2.5 rounded-xl border border-white/5 line-clamp-3">
          {AI_SOCIAL_METADATA.viralDescription}
        </p>
      </div>

      {/* Feature 26: AI Thumbnail / Best Frame Grabber */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            26. AI Best Frame Grabber
          </h3>
        </div>

        <p className="text-[11px] text-slate-400">
          Ranked by facial expressiveness & visual curiosity for TikTok cover frames:
        </p>

        <div className="space-y-1.5">
          {AI_THUMBNAILS.map((thumb, idx) => (
            <div
              key={idx}
              onClick={() => onJumpToTime(thumb.time)}
              className="p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/90 border border-white/5 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center justify-center">
                  #{idx + 1}
                </span>
                <span className="text-xs text-white">{thumb.label}</span>
              </div>
              <span className="text-[10px] font-mono text-purple-400">Jump to {thumb.time}s</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
