'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Scissors, 
  Youtube, 
  Film, 
  Sparkles, 
  FileText, 
  Calendar, 
  ShieldCheck, 
  Globe, 
  Key, 
  Zap, 
  ChevronRight,
  SlidersHorizontal,
  Home
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

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: Home, isPage: true },
    { label: 'Content Factory', href: '/factory', icon: Sparkles, isPage: true },
    { label: 'Creator Studio', href: '/studio', icon: Scissors, isPage: true },
    { label: 'Content Calendar', href: '/calendar', icon: Calendar, isPage: true },
    { label: 'Admin Telemetry', href: '/admin', icon: ShieldCheck, isPage: true },
  ];

  const workflowItems = [
    { id: 'youtube_to_shorts', label: '1-Hour to Shorts', icon: Youtube, color: 'text-red-600' },
    { id: 'one_finger_reel', label: '1-Finger Viral Reel', icon: Sparkles, color: 'text-amber-500' },
    { id: 'documentary', label: '20-Min Documentary', icon: FileText, color: 'text-blue-600' },
    { id: 'calendar', label: 'Social Scheduler', icon: Calendar, color: 'text-emerald-600' },
  ] as const;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-screen sticky top-0 shadow-sm z-30 select-none">
      
      {/* Top Brand Logo */}
      <div>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform">
              <Scissors className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">Clipper</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-red-50 text-red-600 border border-red-200">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">YouTube Video Studio</p>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="p-3 space-y-6">
          
          {/* Main App Navigation */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Workspace
            </p>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-red-50 text-red-600 border border-red-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                </Link>
              );
            })}
          </div>

          {/* Core Pipelines (Dashboard Workflows) */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              AI Pipelines
            </p>
            {workflowItems.map((wf) => {
              const isSelected = activeWorkflowTab === wf.id;
              const Icon = wf.icon;

              return (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => {
                    if (onSelectWorkflowTab) {
                      onSelectWorkflowTab(wf.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${wf.color}`} />
                    <span>{wf.label}</span>
                  </div>
                  {isSelected && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              );
            })}
          </div>

          {/* Quick API Key Setup Button */}
          <div className="px-3 pt-2">
            <button
              type="button"
              onClick={onOpenApiModal}
              className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-between transition-colors shadow-2xs group"
            >
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
                <span>AI API Keys</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                Ready
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* Bottom User Profile & Status */}
      <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
        
        {/* Credits Remaining Box */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-red-600 fill-red-600" /> Pro Credits
            </span>
            <span className="font-bold text-slate-900 font-mono">140 / 200</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-red-600 h-full w-[70%]" />
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center text-xs border border-red-200">
              C
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-tight">Creator Pro</p>
              <p className="text-[10px] text-slate-400">Monthly Plan</p>
            </div>
          </div>
          <Link href="/" className="text-slate-400 hover:text-slate-600" title="Public Website">
            <Globe className="w-4 h-4" />
          </Link>
        </div>

      </div>

    </aside>
  );
};
