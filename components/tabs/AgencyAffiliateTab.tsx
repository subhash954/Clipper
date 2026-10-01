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
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);

  const handleUpdate = (updates: Partial<AgencySettings>) => {
    onChange({ ...settings, ...updates });
  };

  const affiliateUrl = `https://clipper.ai?ref=${settings.referralCode}`;

  const copyAffiliateLink = () => {
    navigator.clipboard.writeText(affiliateUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  };

  return (
    <div className="space-y-4">
      
      {/* Feature 29: 30% Recurring Affiliate Program */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              29. 30% Recurring Affiliate Engine
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-200">
            30% Monthly Lifetime
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-medium">Total Active Referrals</span>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5">{settings.referralCount || 0} Creators</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-medium">Monthly Commission (MRR)</span>
            <p className="text-lg font-extrabold text-emerald-600 mt-0.5">${settings.affiliateEarnings || 0}/mo</p>
          </div>
        </div>

        {/* Affiliate Link Input */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
            Your Viral Referral Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={affiliateUrl}
              className="flex-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-red-600 font-mono font-bold focus:outline-none"
            />
            <button
              onClick={copyAffiliateLink}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature 27: Multi-Client Agency Workspaces */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              27. Multi-Client Agency Workspace
            </h3>
          </div>
          <button
            onClick={onOpenPricing}
            className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-extrabold border border-amber-200 cursor-pointer"
          >
            Agency Tier ($49/mo)
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">Active Workspace</label>
            <input
              type="text"
              value={settings.workspaceName}
              onChange={(e) => handleUpdate({ workspaceName: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">Client Account Name</label>
            <input
              type="text"
              value={settings.clientName}
              onChange={(e) => handleUpdate({ clientName: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Feature 28: White-Label Client Portal */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              28. White-Label Client Review Link
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleUpdate({ whiteLabelEnabled: !settings.whiteLabelEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.whiteLabelEnabled ? 'bg-red-600' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-sm ${
                settings.whiteLabelEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Sends clients a clean review link branded with your agency logo instead of Clipper.
        </p>

        {settings.whiteLabelEnabled && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-red-600 font-bold">
            <span className="font-mono text-[11px]">https://review.youragency.com/clip-889</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Feature 30: Webhook & Zapier Automation */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Webhook className="w-4 h-4 text-red-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            30. Webhook &amp; Zapier Automation
          </h3>
        </div>

        <p className="text-xs text-slate-500">
          Auto-trigger short generation whenever a new video is published on your YouTube channel.
        </p>

        <div className="space-y-2">
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/..."
            className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono"
          />
          <button
            type="button"
            onClick={() => {
              setWebhookSaved(true);
              setTimeout(() => setWebhookSaved(false), 2000);
            }}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {webhookSaved ? <Check className="w-3.5 h-3.5 text-white" /> : <Webhook className="w-3.5 h-3.5" />}
            <span>{webhookSaved ? 'Webhook Connected!' : 'Save Zapier Webhook'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
