'use client';

import React, { useState } from 'react';
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
  Key
} from 'lucide-react';

interface MockUser {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'starter' | 'pro' | 'documentary_agency';
  credits: number;
  minutesProcessed: number;
  costIncurred: number;
  joined: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<MockUser[]>([
    {
      id: "usr-1",
      email: "marcus.creator@gmail.com",
      name: "Marcus Vance",
      plan: "pro",
      credits: 140,
      minutesProcessed: 320,
      costIncurred: 8.45,
      joined: "Sep 12, 2026"
    },
    {
      id: "usr-2",
      email: "sarah.agency@mediaflow.io",
      name: "Sarah Jenkins",
      plan: "documentary_agency",
      credits: 480,
      minutesProcessed: 950,
      costIncurred: 24.80,
      joined: "Sep 18, 2026"
    },
    {
      id: "usr-3",
      email: "david.shorts@podcraft.com",
      name: "David Chen",
      plan: "starter",
      credits: 45,
      minutesProcessed: 120,
      costIncurred: 3.10,
      joined: "Sep 24, 2026"
    },
    {
      id: "usr-4",
      email: "newcreator@youtube.com",
      name: "Alex Rivera",
      plan: "free",
      credits: 2,
      minutesProcessed: 15,
      costIncurred: 0.38,
      joined: "Today"
    }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'financials' | 'users' | 'workers' | 'database'>('financials');
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  // Overall Financial Telemetry Metrics
  const monthlyRevenue = 18450;
  const infrastructureCost = 2180.40;
  const netProfit = monthlyRevenue - infrastructureCost;
  const grossMargin = ((netProfit / monthlyRevenue) * 100).toFixed(1);

  const handleAddCredits = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, credits: u.credits + 20 } : u));
  };

  const handleUpgradeUser = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: 'pro', credits: 150 } : u));
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex font-sans">
      
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        onOpenApiModal={() => setIsApiModalOpen(true)}
      />

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
                  Live Cost &amp; Profit Telemetry
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
              <span>Financial P&amp;L Telemetry</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Accounts ({users.length})</span>
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
              <span>Render Workers</span>
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
              <span>Database Schema</span>
            </button>
          </div>

          {/* TAB 1: FINANCIALS */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="clean-card p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Monthly Subscription MRR</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 font-mono">${monthlyRevenue.toLocaleString()}</p>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> +28% month-over-month
                  </span>
                </div>

                <div className="clean-card p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Total Infrastructure Cost</span>
                    <Server className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-extrabold text-amber-600 font-mono">${infrastructureCost.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-400">
                    Deepgram + Gemini + Cloudflare R2
                  </span>
                </div>

                <div className="clean-card-feature p-5 bg-gradient-to-br from-emerald-50 via-white to-white border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
                    <span>Monthly Net Profit</span>
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-700 font-mono">${netProfit.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-500">
                    Approx ₹{(netProfit * 84).toLocaleString()} net income/mo
                  </span>
                </div>

                <div className="clean-card p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Gross Profit Margin</span>
                    <Activity className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-2xl font-extrabold text-red-600 font-mono">{grossMargin}%</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    Highly Profitable SaaS Structure
                  </span>
                </div>

              </div>

              {/* Service Breakdown */}
              <div className="clean-card p-6 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Live API Service Expenses Breakdown
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Speech-to-Text (Deepgram)</span>
                      <span className="font-mono text-emerald-700 font-bold">$385.20</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full w-[18%]" />
                    </div>
                    <p className="text-[11px] text-slate-500">89,580 audio minutes transcribed ($0.0043/min)</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Hook AI (Gemini 1.5 Flash)</span>
                      <span className="font-mono text-red-600 font-bold">$18.40</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-red-600 h-full w-[2%]" />
                    </div>
                    <p className="text-[11px] text-slate-500">8.2 Million tokens processed ($0.075/M tokens)</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">AI Images (Flux.1)</span>
                      <span className="font-mono text-amber-600 font-bold">$142.10</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full w-[7%]" />
                    </div>
                    <p className="text-[11px] text-slate-500">47,360 AI images generated ($0.003/image)</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Cloudflare R2 Storage</span>
                      <span className="font-mono text-blue-700 font-bold">$34.50</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full w-[3%]" />
                    </div>
                    <p className="text-[11px] text-slate-500">2.3 TB stored • Zero egress fees for video streaming</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">GPU Rendering (Modal/Hetzner)</span>
                      <span className="font-mono text-purple-700 font-bold">$1,600.20</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-purple-600 h-full w-[70%]" />
                    </div>
                    <p className="text-[11px] text-slate-500">42,000 clips rendered with burned-in 60FPS subtitles</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Stock B-Roll (Pexels)</span>
                      <span className="font-mono text-emerald-700 font-bold">$0.00</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full w-full" />
                    </div>
                    <p className="text-[11px] text-slate-500">100% Free Commercial API integration</p>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: USERS */}
          {activeTab === 'users' && (
            <div className="clean-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Registered Creators</h3>
                  <p className="text-xs text-slate-500">Manage user quotas, manually boost credits, or upgrade plans.</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search creators..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Creator</th>
                      <th className="py-3 px-4">Plan Tier</th>
                      <th className="py-3 px-4">Credits</th>
                      <th className="py-3 px-4">Minutes</th>
                      <th className="py-3 px-4">Cost Incurred</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{user.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{user.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            user.plan === 'documentary_agency'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : user.plan === 'pro'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : user.plan === 'starter'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {user.plan.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{user.credits}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{user.minutesProcessed} min</td>
                        <td className="py-3 px-4 font-mono text-amber-700">${user.costIncurred.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleAddCredits(user.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] border border-slate-200 transition-colors"
                          >
                            +20 Credits
                          </button>
                          {user.plan === 'free' && (
                            <button
                              onClick={() => handleUpgradeUser(user.id)}
                              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] transition-colors"
                            >
                              Grant Pro
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: WORKERS */}
          {activeTab === 'workers' && (
            <div className="clean-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Video Render Workers</h3>
                  <p className="text-xs text-slate-500">Real-time status of async FFmpeg and AI transcription workers.</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> All Workers Operational
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500">Active Rendering Jobs</span>
                  <p className="text-xl font-bold text-slate-900 font-mono">14 Jobs Running</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500">Average Processing Time</span>
                  <p className="text-xl font-bold text-red-600 font-mono">18.4s / short</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500">Failed Job Rate (Last 24h)</span>
                  <p className="text-xl font-bold text-emerald-700 font-mono">0.02% (2 in 10,000)</p>
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
                  <p className="text-xs text-slate-500">Database schema defined in <code>supabase/schema.sql</code>.</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-bold border border-red-200">
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
                  <p className="text-slate-600 text-[11px]">Stores YouTube video pipelines, 1-finger reels, and documentary suites.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <p className="font-bold text-amber-700 font-mono">public.clips</p>
                  <p className="text-slate-600 text-[11px]">Stores generated 9:16 vertical shorts, viral hook scores, and B-roll keywords.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <p className="font-bold text-blue-700 font-mono">public.scheduled_posts</p>
                  <p className="text-slate-600 text-[11px]">YouTube Data API v3 auto-publishing calendar queue.</p>
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
