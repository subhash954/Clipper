'use client';

import React, { useState } from 'react';
import { AgencySettings } from '@/lib/types';
import { Building2, Link2, DollarSign, Webhook, Check, Copy, Users, ExternalLink } from 'lucide-react';

interface AgencyAffiliateTabProps {
  settings: AgencySettings;
  onChange: (settings: AgencySettings) => void;
  onOpenPricing: () => void;
}

export const AgencyAffiliateTab: React.FC<AgencyAffiliateTabProps> = ({
  settings,
  onChange,
  onOpenPricing
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://hooks.zapier.com/hooks/catch/12345/repurpose-video");
  const [webhookSaved, setWebhookSaved] = useState(false);

  const handleUpdate = (updates: Partial<AgencySettings>) => {
    onChange({ ...settings, ...updates });
  };

  const affiliateUrl = `https://clipstudio.ai?ref=${settings.referralCode}`;

  const copyAffiliateLink = () => {
    navigator.clipboard.writeText(affiliateUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  };

  return (
    <div className="space-y-5">
      
      {/* Feature 29: 30% Recurring Affiliate Program */}
      <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              29. 30% Recurring Affiliate Engine
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold">
            30% Monthly Lifetime
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5">
            <span className="text-[10px] text-slate-400">Total Referrals</span>
            <p className="text-lg font-extrabold text-white mt-0.5">{settings.referralCount} Creators</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5">
            <span className="text-[10px] text-slate-400">Monthly Payout (MRR)</span>
            <p className="text-lg font-extrabold text-emerald-400 mt-0.5">${settings.affiliateEarnings}/mo</p>
          </div>
        </div>

        {/* Affiliate Link Input */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
            Your Viral Referral Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={affiliateUrl}
              className="flex-1 p-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-purple-300 font-mono focus:outline-none"
            />
            <button
              onClick={copyAffiliateLink}
              className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors flex items-center gap-1"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature 27: Multi-Client Agency Workspaces */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              27. Multi-Client Agency Workspace
            </h3>
          </div>
          <button
            onClick={onOpenPricing}
            className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold"
          >
            Agency Tier ($49/mo)
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Active Workspace</label>
            <input
              type="text"
              value={settings.workspaceName}
              onChange={(e) => handleUpdate({ workspaceName: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Client Account Name</label>
            <input
              type="text"
              value={settings.clientName}
              onChange={(e) => handleUpdate({ clientName: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white"
            />
          </div>
        </div>
      </div>

      {/* Feature 28: White-Label Client Portal */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              28. White-Label Client Review Link
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ whiteLabelEnabled: !settings.whiteLabelEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.whiteLabelEnabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                settings.whiteLabelEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Sends clients a clean review link branded with your agency logo instead of ClipStudio.
        </p>

        {settings.whiteLabelEnabled && (
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between text-xs text-cyan-300">
            <span className="font-mono text-[11px]">https://review.youragency.com/clip-889</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Feature 30: Webhook & Zapier Automation */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Webhook className="w-4 h-4 text-orange-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            30. Webhook & Zapier Automation
          </h3>
        </div>

        <p className="text-xs text-slate-400">
          Auto-trigger short generation whenever a new video is published on your YouTube channel.
        </p>

        <div className="space-y-2">
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/..."
            className="w-full p-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white font-mono"
          />
          <button
            type="button"
            onClick={() => {
              setWebhookSaved(true);
              setTimeout(() => setWebhookSaved(false), 2000);
            }}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-400 text-xs font-bold border border-orange-500/30 transition-colors flex items-center justify-center gap-1.5"
          >
            {webhookSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Webhook className="w-3.5 h-3.5" />}
            <span>{webhookSaved ? 'Webhook Connected!' : 'Save Zapier Webhook'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
