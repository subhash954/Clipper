'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Scissors, 
  Home, 
  FolderKanban, 
  PlusCircle, 
  Film, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  HardDrive,
  Key
} from 'lucide-react';
import { ApiKeyModal } from './ApiKeyModal';

interface AppShellProps {
  children: React.ReactNode;
  onOpenCreateProject?: () => void;
  activeProjectName?: string;
  isSaving?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({ 
  children,
  onOpenCreateProject,
  activeProjectName,
  isSaving = false
}) => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  const navItems = [
    { label: 'Home', href: '/dashboard', icon: Home, matchPrefix: '/dashboard' },
    { label: 'Projects', href: '/dashboard#projects', icon: FolderKanban, matchPrefix: '/dashboard#projects' },
    { label: 'Editor', href: '/studio', icon: Film, matchPrefix: '/studio' },
    { label: 'Analytics', href: '/admin', icon: BarChart3, matchPrefix: '/admin' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F8FAFC] flex font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* PERSISTENT APPLICATION SIDEBAR */}
      <aside 
        className={`bg-[#111827] border-r border-[#1F2937] flex flex-col justify-between h-screen sticky top-0 z-40 transition-all duration-200 select-none ${
          isCollapsed ? 'w-20' : 'w-60'
        }`}
      >
        {/* Top: Brand Logo + Collapse Toggle */}
        <div>
          <div className="h-16 px-4 border-b border-[#1F2937] flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5 group overflow-hidden">
              <div className="w-10 h-10 min-w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Scissors className="w-5 h-5 -rotate-45" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-base tracking-tight text-white">Clipper</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                      AI
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Video Intelligence</span>
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Create Action */}
          <div className="p-3">
            <button
              type="button"
              onClick={onOpenCreateProject}
              className={`w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ${
                isCollapsed ? 'px-0' : ''
              }`}
              title="Create new project"
            >
              <PlusCircle className="w-4 h-4 text-slate-950" />
              {!isCollapsed && <span>New Project</span>}
            </button>
          </div>

          {/* Primary Navigation */}
          <nav className="px-3 space-y-1 mt-2">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Workspace
              </p>
            )}

            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.matchPrefix !== '/dashboard' && pathname.startsWith(item.matchPrefix));
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  {!isCollapsed && <span>{item.label}</span>}
                  
                  {/* Subtle Accent Pill for Active Item */}
                  {isActive && !isCollapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                  )}

                  {/* Tooltip on Collapsed Mode */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white text-[11px] rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Subtle Usage + Settings + Account */}
        <div className="p-3 border-t border-[#1F2937] space-y-3 bg-[#0F172A]/50">
          
          {/* Subtle Usage Indicator (Section 5) */}
          {!isCollapsed ? (
            <div className="p-3 rounded-xl bg-[#111827] border border-[#1F2937] space-y-2.5">
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium mb-1">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" /> AI Credits
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">720 / 1000</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-full w-[72%]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium mb-1">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Storage
                  </span>
                  <span className="text-slate-300 font-mono font-bold">62%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-slate-400 h-full w-[62%]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1" title="AI Credits: 720 / 1000 | Storage: 62%">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Quick Settings & Keys */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
              title="Provider API Keys"
            >
              <Key className="w-4 h-4 text-amber-400" />
              {!isCollapsed && <span>AI Service Keys</span>}
            </button>
          </div>

          {/* User Account Card */}
          <div className={`pt-1 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-500/40 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center text-xs">
                C
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-200 truncate">Creator Pro</p>
                  <p className="text-[10px] text-cyan-400/80 font-medium">Standard Plan</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </aside>

      {/* MAIN WORKSPACE WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>

      {/* AI Key & Provider Config Modal */}
      <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />

    </div>
  );
};
