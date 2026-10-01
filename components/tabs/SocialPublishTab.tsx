'use client';

import React, { useState } from 'react';
import { SocialPublishSettings } from '@/lib/types';
import { Share2, Clock, Hash, Check, Copy, ExternalLink, AlertCircle } from 'lucide-react';

interface SocialPublishTabProps {
  settings: SocialPublishSettings;
  onChange: (settings: SocialPublishSettings) => void;
  onJumpToTime: (time: number) => void;
}

export const SocialPublishTab: React.FC<SocialPublishTabProps> = ({
  settings,
  onChange,
}) => {
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  const handleCopyHashtags = () => {
    if (settings.hashtags && settings.hashtags.length > 0) {
      navigator.clipboard.writeText(settings.hashtags.join(' '));
      setCopiedTags(true);
      setTimeout(() => setCopiedTags(false), 1500);
    }
  };

  const handleCopyDescription = () => {
    navigator.clipboard.writeText(settings.viralDescription || '');
    setCopiedDesc(true);
    setTimeout(() => setCopiedDesc(false), 1500);
  };

  return (
    <div className="space-y-4">
      {/* 1. Direct Social Publishing Connections */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Connected Platforms
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
            OAuth 2.0
          </span>
        </div>

        {/* Platform Connection Cards */}
        <div className="space-y-2">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">YouTube Shorts</p>
              <p className="text-[10px] text-slate-500">Auto-publish directly to your YouTube channel</p>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Connect</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">TikTok</p>
              <p className="text-[10px] text-slate-500">Direct Content Posting API</p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-md bg-slate-200/70 text-slate-600 font-bold">
              Coming Soon
            </span>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">Instagram Reels</p>
              <p className="text-[10px] text-slate-500">Meta Graph API for Creators</p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-md bg-slate-200/70 text-slate-600 font-bold">
              Coming Soon
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Direct publishing is currently in sandbox verification. You can export your rendered MP4s directly and upload them to YouTube, TikTok, or Instagram.
          </span>
        </div>
      </div>

      {/* 2. SEO Copy & Viral Hashtags */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Social Metadata &amp; Hashtags
            </h3>
          </div>
        </div>

        {/* Video Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Video Description</span>
            <button
              type="button"
              onClick={handleCopyDescription}
              className="text-[11px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              {copiedDesc ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copiedDesc ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <textarea
            value={settings.viralDescription}
            onChange={(e) => onChange({ ...settings, viralDescription: e.target.value })}
            rows={3}
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-red-500 font-sans"
          />
        </div>

        {/* Hashtags list */}
        {settings.hashtags && settings.hashtags.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Recommended Hashtags</span>
              <button
                type="button"
                onClick={handleCopyHashtags}
                className="text-[11px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                {copiedTags ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedTags ? 'Copied All' : 'Copy All'}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {settings.hashtags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-medium border border-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
