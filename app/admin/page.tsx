'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { 
  ShieldCheck, 
  DollarSign, 
  TrendingUp, 
  Server, 
  Users, 
  Activity, 
  Database, 
  Sparkles, 
  CheckCircle2, 
  Search,
  Key,
  Clock,
  AlertCircle
} from 'lucide-react';

interface TelemetrySummary {
  totalProjects: number;
  totalRenderJobs: number;
  activeRenderingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalActualCostUSD: number;
  totalEstimatedCostUSD: number;
}

export default function AdminPage() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'financials' | 'jobs' | 'workers' | 'database'>('financials');
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/admin/telemetry');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.warn('Could not fetch live telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const summary: TelemetrySummary = telemetry?.summary || {
    totalProjects: 0,
    totalRenderJobs: 0,
    activeRenderingJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    totalActualCostUSD: 0,
    totalEstimatedCostUSD: 0,
  };

  const renderJobs: any[] = telemetry?.renderJobs || [];
  const projects: any[] = telemetry?.projects || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex font-sans">
      
      {/* 1. Left Sidebar Navigation */}
      <Sidebar onOpenApiModal={() => setIsApiModalOpen(true)} />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight">Clipper SuperAdmin</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  Live Database Telemetry
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>Configure AI Keys</span>
            </button>

            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
            >
              Customer View →
            </Link>
          </div>
        </header>

        {/* Workspace */}
        <main className="p-8 max-w-6xl w-full mx-auto space-y-6">
          
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('financials')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'financials'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Financials &amp; Cost Telemetry</span>
            </button>

            <button
              onClick={() => setActiveTab('jobs')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'jobs'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Render Jobs ({renderJobs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('workers')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'workers'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Worker Fleet Status</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'database'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Database Tables</span>
            </button>
          </div>

          {/* TAB 1: FINANCIALS */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="clean-card p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Total Projects Created</span>
                    <Database className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 font-mono">
                    {loading ? '...' : summary.totalProjects}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Live recorded in database
                  </span>
                </div>

                <div className="clean-card p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Actual Recorded AI Cost</span>
                    <Server className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-extrabold text-amber-600 font-mono">
                    ${summary.totalActualCostUSD} USD
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Direct provider token &amp; audio telemetry
                  </span>
                </div>

                <div className="clean-card p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Active Video Render Jobs</span>
                    <Activity className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-2xl font-extrabold text-red-600 font-mono">
                    {summary.activeRenderingJobs} Jobs Running
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Real-time FFmpeg worker processes
                  </span>
                </div>

                <div className="clean-card p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Completed Render Exports</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-700 font-mono">
                    {summary.completedJobs} / {summary.totalRenderJobs}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {summary.failedJobs > 0 ? `${summary.failedJobs} failed` : 'Zero render failures'}
                  </span>
                </div>

              </div>

              {/* Real Project Registry */}
              <div className="clean-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Recent Database Projects ({projects.length})
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Source: PostgreSQL / Local Storage
                  </span>
                </div>

                {projects.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No live data available yet. Ingest a YouTube video to populate database records.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {projects.slice(0, 8).map((p: any) => (
                      <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{p.title}</p>
                          <p className="text-[10px] text-slate-500">
                            {p.channelName || 'Creator'} • {p.clipsCount || p.clips?.length || 0} Shorts • Status: {p.status}
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-100 text-slate-700 shrink-0">
                          {p.id}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: LIVE RENDER JOBS */}
          {activeTab === 'jobs' && (
            <div className="clean-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    FFmpeg Render Job Queue ({renderJobs.length})
                  </h3>
                  <p className="text-xs text-slate-500">Real-time asynchronous 9:16 rendering jobs.</p>
                </div>
                <button
                  onClick={fetchTelemetry}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Refresh Live
                </button>
              </div>

              {renderJobs.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                  <Activity className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-semibold">No live data available</p>
                  <p className="text-[11px] text-slate-400">Trigger an export in Studio to watch the FFmpeg worker execute in real-time.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {renderJobs.map((job) => (
                    <div key={job.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{job.id}</span>
                          <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                            job.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : job.status === 'failed'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {job.status} ({job.progress}%)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{job.currentStage}</p>
                      </div>

                      {job.outputUrl && (
                        <a
                          href={job.outputUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs hover:bg-emerald-100 transition-colors shrink-0"
                        >
                          View MP4 →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WORKERS */}
          {activeTab === 'workers' && (
            <div className="clean-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Video Render Workers</h3>
                  <p className="text-xs text-slate-500">Node child_process FFmpeg worker thread status.</p>
                </div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> FFmpeg Engine Ready
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500">Active Jobs in Memory</span>
                  <p className="text-xl font-bold text-slate-900 font-mono">{summary.activeRenderingJobs} Jobs</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500">FFmpeg Composition</span>
                  <p className="text-xl font-bold text-red-600 font-mono">1080x1920 @ 30FPS</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500">Audio Codec</span>
                  <p className="text-xl font-bold text-emerald-700 font-mono">AAC 192kbps</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE SCHEMA */}
          {activeTab === 'database' && (
            <div className="clean-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Supabase Postgres Tables</h3>
                  <p className="text-xs text-slate-500">Audited schema defined in <code>supabase/schema.sql</code>.</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  RLS Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <p className="font-bold text-emerald-700 font-mono">public.profiles</p>
                  <p className="text-slate-600 text-[11px]">Stores user tiers, credits, minutes processed, and cost tallies.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <p className="font-bold text-red-600 font-mono">public.projects</p>
                  <p className="text-slate-600 text-[11px]">Stores YouTube video pipelines, uploaded media, and status.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <p className="font-bold text-purple-700 font-mono">public.render_jobs</p>
                  <p className="text-slate-600 text-[11px]">Tracks async FFmpeg 9:16 video generation jobs and progress.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <p className="font-bold text-amber-700 font-mono">public.clips</p>
                  <p className="text-slate-600 text-[11px]">Stores extracted vertical clips with real word-level timestamps.</p>
                </div>
              </div>
            </div>
          )}

        </main>

      </div>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
      />

    </div>
  );
}
