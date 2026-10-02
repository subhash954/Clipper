'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Share2, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ExternalLink, 
  Filter,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { ContentCalendarItem, SupportedPlatform } from '@/lib/factory/types';

export default function ContentCalendarPage() {
  const [items, setItems] = useState<ContentCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState<SupportedPlatform>('youtube_shorts');
  const [newDate, setNewDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [newCampaign, setNewCampaign] = useState('Product Launch 2026');
  const [newPillar, setNewPillar] = useState('Education');

  const loadCalendar = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/content/calendar?projectId=default-project');
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.warn('Could not load calendar items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, []);

  const handleScheduleItem = async () => {
    try {
      const res = await fetch('/api/content/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: `asset-sched-${Date.now()}`,
          projectId: 'default-project',
          platform: newPlatform,
          scheduledAt: new Date(newDate).toISOString(),
          campaign: newCampaign,
          pillar: newPillar,
        }),
      });
      const data = await res.json();
      if (data.item) {
        setItems((prev) => [data.item, ...prev]);
        setIsScheduleModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to schedule item:', err);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  return (
    <AppShell activeWorkflowTab="calendar">
      <div className="p-8 max-w-7xl mx-auto space-y-8 select-none">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-500/20">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Content Calendar</h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                Phase 28
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Plan, queue, and schedule cross-platform video publications with campaigns and pillar tracking.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-500/25 transition-all hover:scale-102 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule New Post</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Filter Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <option value="all">All Items</option>
              <option value="scheduled">Scheduled</option>
              <option value="ready">Ready</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            {filteredItems.length} publications in schedule
          </span>
        </div>

        {/* Calendar Timeline List */}
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 space-y-3">
            <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No Scheduled Posts Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Schedule your first content asset from the Content Factory or add an item manually.
            </p>
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
            >
              Schedule First Post
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition-shadow flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex flex-col items-center justify-center text-red-600 shrink-0">
                    <span className="text-[10px] font-black uppercase">
                      {new Date(item.scheduledAt).toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-base font-black leading-none">
                      {new Date(item.scheduledAt).getDate()}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                        {item.platform.replace('_', ' ')}
                      </span>
                      {item.pillar && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-600">
                          {item.pillar}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-1">
                      Campaign: {item.campaign || 'Default Campaign'}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      item.status === 'scheduled'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : item.status === 'published'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {item.status}
                  </span>

                  <Link
                    href="/factory"
                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Schedule Modal */}
        {isScheduleModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-red-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Schedule Content Asset</h3>
                </div>
                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Platform</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value as SupportedPlatform)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  >
                    <option value="youtube_shorts">YouTube Shorts</option>
                    <option value="instagram_reels">Instagram Reels</option>
                    <option value="tiktok">TikTok</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="x">X (Twitter)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Scheduled Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Campaign Tag</label>
                  <input
                    type="text"
                    value={newCampaign}
                    onChange={(e) => setNewCampaign(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Content Pillar</label>
                  <select
                    value={newPillar}
                    onChange={(e) => setNewPillar(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  >
                    <option value="Education">Education</option>
                    <option value="Contrarian">Contrarian</option>
                    <option value="Case Studies">Case Studies</option>
                    <option value="Tutorial">Tutorial</option>
                    <option value="Storytelling">Storytelling</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleItem}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  Confirm Schedule
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
