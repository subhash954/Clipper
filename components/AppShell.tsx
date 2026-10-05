'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Scissors, 
  Home, 
  PlusCircle, 
  Film, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  HardDrive,
  Key,
  Sparkles,
  Calendar,
  Building2,
  TrendingUp,
  Share2,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { ApiKeyModal } from './ApiKeyModal';

interface AppShellProps {
  children: React.ReactNode;
  onOpenCreateProject?: () => void;
  activeProjectName?: string;
  isSaving?: boolean;
  activeWorkflowTab?: string;
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Grouped into clean, modern semantic sections (Title-case, no noisy OS badges)
  const navSections = [
    {
      title: 'Creator Studio',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: Home, matchPrefix: '/dashboard' },
        { label: 'Studio Builder', href: '/studio', icon: Film, matchPrefix: '/studio' },
        { label: 'Content Factory', href: '/factory', icon: Sparkles, matchPrefix: '/factory' },
      ]
    },
    {
      title: 'Automations & Channels',
      items: [
        { label: 'Publishing & Connect', href: '/publishing', icon: Share2, matchPrefix: '/publishing' },
        { label: 'Content Calendar', href: '/calendar', icon: Calendar, matchPrefix: '/calendar' },
      ]
    },
    {
      title: 'Intelligence & Growth',
      items: [
        { label: 'Growth & Analytics', href: '/analytics', icon: TrendingUp, matchPrefix: '/analytics' },
        { label: 'Agency & Team', href: '/agency', icon: Building2, matchPrefix: '/agency' },
        { label: 'Workspace Telemetry', href: '/admin', icon: ShieldCheck, matchPrefix: '/admin' },
      ]
    }
  ];

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[#F8FAFC] text-slate-900 flex font-sans selection:bg-red-500/20 selection:text-red-900">
      
      {/* PERSISTENT MODERN APPLICATION SIDEBAR */}
      <aside 
        className={`bg-white border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 z-40 transition-all duration-200 select-none shadow-xs ${
          isCollapsed ? 'w-18' : 'w-64'
        }`}
      >
        {/* Top: Brand Identity + Collapse Toggle */}
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
          <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <Link href="/dashboard" className="flex items-center gap-3 group overflow-hidden">
              <div className="w-9 h-9 min-w-9 rounded-xl bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-sm shadow-red-500/20 group-hover:scale-105 transition-transform duration-200">
                <Scissors className="w-4 h-4 -rotate-45" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm tracking-tight text-slate-900 truncate">Clipper Studio</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200/60">
                      Pro
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium leading-none mt-0.5 truncate">Video Intelligence</span>
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Create Action */}
          <div className="p-3 shrink-0">
            <button
              type="button"
              onClick={onOpenCreateProject}
              className={`w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm shadow-red-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer ${
                isCollapsed ? 'px-0' : ''
              }`}
              title="Create new project"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>New Project</span>}
            </button>
          </div>

          {/* Grouped Navigation Links */}
          <nav className="p-3 space-y-5">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {!isCollapsed && (
                  <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {section.title}
                  </p>
                )}

                {section.items.map((item) => {
                  const isActive = pathname === item.href || (item.matchPrefix !== '/dashboard' && pathname.startsWith(item.matchPrefix));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-red-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                      
                      {/* Active indicator dot */}
                      {isActive && !isCollapsed && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                      )}

                      {/* Tooltip on Collapsed Mode */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Section: Resource Indicators & Account */}
        <div className="p-3 border-t border-slate-100 space-y-2.5 bg-slate-50/50 shrink-0">
          
          {/* Credits & Cloud Status */}
          {!isCollapsed ? (
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-1">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-red-500" /> AI Credits
                  </span>
                  <span className="text-slate-900 font-mono font-semibold text-[11px]">720 / 1000</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-red-600 to-rose-500 h-full w-[72%]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-1">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Database Sync
                  </span>
                  <span className="text-emerald-600 font-mono font-semibold text-[11px]">Connected</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-full" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1" title="AI Credits: 720 / 1000 | Database: Connected">
              <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200/80 text-red-600 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* AI Keys Modal Trigger */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
              title="Configure AI Keys"
            >
              <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {!isCollapsed && <span>AI Service Keys</span>}
            </button>
          </div>

          {/* User Account Card */}
          <div className={`pt-1 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white font-semibold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                C
              </div>
              {!isCollapsed && (
                <div className="min-w-0 truncate">
                  <p className="text-xs font-semibold text-slate-900 truncate">Creator Studio Pro</p>
                  <p className="text-[11px] text-slate-400 truncate">Standard Plan</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <Link href="/" className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors shrink-0" title="Public Website">
                <Globe className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

        </div>

      </aside>

      {/* MAIN WORKSPACE WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>

      {/* AI Key & Provider Config Modal */}
      {isMounted && <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />}

    </div>
  );
};
