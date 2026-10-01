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
    <div className="space-y-4">
      
      {/* Feature 23: 1-Click Auto Post to Socials */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              23. 1-Click Auto Post to Socials
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
            Direct API
          </span>
        </div>

        {/* Platform Selection */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleToggleAccount('tiktok')}
            className={`p-3 rounded-xl border text-center transition-colors cursor-pointer ${
              settings.accounts.tiktok
                ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <p className="text-xs font-bold">TikTok</p>
            <span className={`text-[9px] ${settings.accounts.tiktok ? 'text-slate-300' : 'text-emerald-600 font-bold'}`}>Connected</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleAccount('youtubeShorts')}
            className={`p-3 rounded-xl border text-center transition-colors cursor-pointer ${
              settings.accounts.youtubeShorts
                ? 'border-red-600 bg-red-600 text-white font-bold shadow-md shadow-red-600/20'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <p className="text-xs font-bold">YT Shorts</p>
            <span className={`text-[9px] ${settings.accounts.youtubeShorts ? 'text-red-100' : 'text-red-600 font-bold'}`}>Connected</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleAccount('instagramReels')}
            className={`p-3 rounded-xl border text-center transition-colors cursor-pointer ${
              settings.accounts.instagramReels
                ? 'border-pink-600 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <p className="text-xs font-bold">IG Reels</p>
            <span className={`text-[9px] ${settings.accounts.instagramReels ? 'text-pink-100' : 'text-pink-600 font-bold'}`}>Connected</span>
          </button>
        </div>

        {/* Feature 24: AI Best Time to Post Scheduler */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-800">
            <span className="flex items-center gap-1.5 text-red-600 font-bold">
              <Clock className="w-3.5 h-3.5" /> 24. AI Peak Viral Window
            </span>
            <span className="font-mono text-[11px] text-slate-900 font-bold">Today @ 6:30 PM EST</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Based on millions of viral short impressions, US audience engagement peaks in 2 hours.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTriggerAutoPost}
          disabled={isPublishing}
          className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {publishSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Queued for Peak Viral Hour!</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Pushing to TikTok &amp; Shorts...' : 'Schedule to All 3 Channels'}</span>
            </>
          )}
        </button>
      </div>

      {/* Feature 25: Viral Hashtags & Copy */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              25. Auto Hashtags &amp; Description
            </h3>
          </div>
          <button
            onClick={handleCopyHashtags}
            className="text-[10px] text-red-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            {copiedTags ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copiedTags ? 'Copied!' : 'Copy All'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {AI_SOCIAL_METADATA.hashtags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 font-mono text-[10px] border border-slate-200 font-semibold"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 line-clamp-3 leading-relaxed">
          {AI_SOCIAL_METADATA.viralDescription}
        </p>
      </div>

      {/* Feature 26: AI Thumbnail / Best Frame Grabber */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            26. AI Best Frame Grabber
          </h3>
        </div>

        <p className="text-[11px] text-slate-500">
          Ranked by facial expressiveness &amp; visual curiosity for TikTok &amp; Shorts cover frames:
        </p>

        <div className="space-y-1.5">
          {AI_THUMBNAILS.map((thumb, idx) => (
            <div
              key={idx}
              onClick={() => onJumpToTime(thumb.time)}
              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center">
                  #{idx + 1}
                </span>
                <span className="text-xs font-bold text-slate-900">{thumb.label}</span>
              </div>
              <span className="text-[10px] font-mono text-red-600 font-bold">Jump to {thumb.time}s</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
