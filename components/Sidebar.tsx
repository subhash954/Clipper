'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Scissors, 
  Sparkles, 
  FileText, 
  Calendar, 
  ShieldCheck, 
  Globe, 
  Key, 
  Zap, 
  Home,
  TrendingUp,
  Share2,
  Building2,
  SlidersHorizontal,
  Bot,
  Layers,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  onOpenApiModal?: () => void;
  activeWorkflowTab?: string;
  onSelectWorkflowTab?: (tab: 'youtube_to_shorts' | 'one_finger_reel' | 'documentary' | 'calendar') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  onOpenApiModal,
  activeWorkflowTab,
  onSelectWorkflowTab 
}) => {
  const pathname = usePathname();

  // Navigation organized into clean, modern semantic sections
  const navigationSections = [
    {
      title: 'Creator Studio',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: Home },
        { label: 'Studio Builder', href: '/studio', icon: Scissors },
        { label: 'Content Factory', href: '/factory', icon: Sparkles },
      ]
    },
    {
      title: 'Automations & Channels',
      items: [
        { label: 'Automations', href: '/factory', icon: Zap },
        { label: 'Social Publishing', href: '/publishing', icon: Share2 },
        { label: 'Content Calendar', href: '/calendar', icon: Calendar },
      ]
    },
    {
      title: 'Intelligence & Growth',
      items: [
        { label: 'Growth & Analytics', href: '/analytics', icon: TrendingUp },
        { label: 'Agency & Clients', href: '/agency', icon: Building2 },
        { label: 'Workspace Settings', href: '/admin', icon: ShieldCheck },
      ]
    }
  ];

  const workflowPipelines = [
    { id: 'youtube_to_shorts', label: '1-Hour to Shorts', icon: Layers, color: 'text-red-500' },
    { id: 'one_finger_reel', label: '1-Finger Viral Reel', icon: Sparkles, color: 'text-amber-500' },
    { id: 'documentary', label: '20-Min Documentary', icon: FileText, color: 'text-blue-500' },
  ] as const;

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 shadow-xs z-30 select-none font-sans">
      
      {/* Top Header & Brand Identity */}
      <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-sm shadow-red-500/20 group-hover:scale-105 transition-transform duration-200">
              <Scissors className="w-4 h-4 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900">Clipper Studio</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200/60">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">Video Intelligence</p>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="p-3 space-y-5">
          {navigationSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {section.title}
              </p>
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-red-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {/* Sleek active dot indicator */}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Quick AI Pipelines */}
          {onSelectWorkflowTab && (
            <div className="space-y-1 pt-1 border-t border-slate-100">
              <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Quick Pipelines
              </p>
              {workflowPipelines.map((wf) => {
                const isSelected = activeWorkflowTab === wf.id;
                const Icon = wf.icon;

                return (
                  <button
                    key={wf.id}
                    type="button"
                    onClick={() => onSelectWorkflowTab(wf.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${wf.color}`} />
                      <span className="truncate">{wf.label}</span>
                    </div>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Connect API Keys */}
          {onOpenApiModal && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenApiModal}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-slate-700 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform duration-200" />
                  <span>AI API Keys</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200/60">
                  Ready
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Profile & Usage */}
      <div className="p-3 border-t border-slate-100 space-y-2.5 bg-slate-50/50 shrink-0">
        
        {/* Credits Status */}
        <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-red-500" /> Credits
            </span>
            <span className="font-semibold text-slate-900 font-mono text-[11px]">140 / 200</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-rose-500 h-full w-[70%]" />
          </div>
        </div>

        {/* User Account */}
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white font-semibold flex items-center justify-center text-xs shrink-0 shadow-2xs">
              C
            </div>
            <div className="min-w-0 truncate">
              <p className="font-semibold text-xs text-slate-900 leading-tight truncate">Creator Studio Pro</p>
              <p className="text-[11px] text-slate-400 truncate">team@clipper.ai</p>
            </div>
          </div>
          <Link href="/" className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors shrink-0" title="Public Website">
            <Globe className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

    </aside>
  );
};
