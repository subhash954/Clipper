'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import {
  Zap,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  Play,
  Trash2,
  Bell,
  Sliders,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Layers,
  Calendar,
  Share2,
  Cpu
} from 'lucide-react';
import {
  SocialConnection,
  PublishJob,
  AutomationRule,
  InAppNotification,
  PublishingChecklist,
  PublishingLog,
} from '@/lib/publishing/types';
import { SupportedPlatform } from '@/lib/factory/types';

export default function PublishingPage() {
  const [activeTab, setActiveTab] = useState<'queue' | 'accounts' | 'bulk' | 'automations' | 'failures'>('queue');
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [logs, setLogs] = useState<PublishingLog[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Modals & Inspection State
  const [inspectChecklistJob, setInspectChecklistJob] = useState<{ job: PublishJob; checklist: PublishingChecklist } | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [newAccountPlatform, setNewAccountPlatform] = useState<SupportedPlatform>('youtube_shorts');
  const [newAccountHandle, setNewAccountHandle] = useState('');
  const [newAccountToken, setNewAccountToken] = useState('');

  // Bulk schedule form state
  const [bulkPlatform, setBulkPlatform] = useState<SupportedPlatform>('youtube_shorts');
  const [bulkGapHours, setBulkGapHours] = useState(24);
  const [bulkFrequency, setBulkFrequency] = useState<'daily' | 'weekdays' | 'custom_gap'>('daily');
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);

  // Fetch live publishing data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [connRes, jobsRes, rulesRes, notifRes] = await Promise.all([
        fetch('/api/publishing/connections'),
        fetch('/api/publishing/jobs?includeLogs=true'),
        fetch('/api/publishing/automations'),
        fetch('/api/publishing/notifications'),
      ]);

      if (connRes.ok) {
        const d = await connRes.json();
        setConnections(d.connections || []);
      }
      if (jobsRes.ok) {
        const d = await jobsRes.json();
        setJobs(d.jobs || []);
        setLogs(d.logs || []);
      }
      if (rulesRes.ok) {
        const d = await rulesRes.json();
        setRules(d.rules || []);
      }
      if (notifRes.ok) {
        const d = await notifRes.json();
        setNotifications(d.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load publishing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Trigger Immediate Publish
  const handlePublishNow = async (jobId: string) => {
    try {
      setActionInProgress(jobId);
      const res = await fetch(`/api/publishing/jobs/${jobId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Publishing failed: ${data.error || 'Unknown error'}`);
      }
      await fetchData();
    } catch (err: any) {
      alert(`Error publishing: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // Cancel Job
  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Cancel this queued publication?')) return;
    try {
      const res = await fetch(`/api/publishing/jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  // Inspect Checklist
  const handleInspectChecklist = async (job: PublishJob) => {
    try {
      const res = await fetch(`/api/publishing/jobs/${job.id}`);
      if (res.ok) {
        const data = await res.json();
        setInspectChecklistJob({ job: data.job, checklist: data.checklist });
      }
    } catch (err) {
      console.error('Failed to inspect checklist:', err);
    }
  };

  // Connect Account
  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountHandle || !newAccountToken) {
      alert('Please fill out account handle and access token.');
      return;
    }

    try {
      const res = await fetch('/api/publishing/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: newAccountPlatform,
          accountId: `acc_${newAccountHandle.replace(/[^a-zA-Z0-9]/g, '_')}`,
          accountName: newAccountHandle,
          accountHandle: newAccountHandle,
          rawAccessToken: newAccountToken,
          scopes: ['upload', 'publish', 'read'],
        }),
      });

      if (res.ok) {
        setIsConnectModalOpen(false);
        setNewAccountHandle('');
        setNewAccountToken('');
        await fetchData();
      } else {
        const d = await res.json();
        alert(`Error: ${d.error}`);
      }
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    }
  };

  // Disconnect Account
  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this social channel? Scheduled posts on this channel may fail.')) return;
    try {
      const res = await fetch(`/api/publishing/connections?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  // Toggle Automation Rule
  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      await fetch('/api/publishing/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, enabled: !currentEnabled }),
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  // Mark Notification Read
  const handleMarkNotifRead = async (id: string) => {
    try {
      await fetch('/api/publishing/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'youtube_shorts': return 'YouTube Shorts';
      case 'tiktok': return 'TikTok';
      case 'instagram_reels': return 'Instagram Reels';
      case 'linkedin': return 'LinkedIn Video';
      case 'x': return 'X (Twitter)';
      default: return platform;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 className="w-3 h-3" /> Published</span>;
      case 'QUEUED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><Clock className="w-3 h-3" /> Queued</span>;
      case 'PUBLISHING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /> Publishing</span>;
      case 'FAILED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300"><XCircle className="w-3 h-3" /> Failed</span>;
      case 'RETRYING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300"><RefreshCw className="w-3 h-3" /> Retrying</span>;
      case 'REAUTH_REQUIRED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300"><AlertTriangle className="w-3 h-3" /> Reauth Needed</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  const failedJobs = jobs.filter((j) => j.status === 'FAILED' || j.status === 'REAUTH_REQUIRED');

  return (
    <AppShell activeWorkflowTab="Publishing">
      <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen">
        
        {/* Top Header Banner */}
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 shadow-xs">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Social Publishing & Automation</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Real multi-platform distribution engine with cryptographic credentials and external verification.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Connect Channel
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="max-w-7xl mx-auto flex items-center gap-6 mt-6 border-b border-slate-200/60">
            <button
              onClick={() => setActiveTab('queue')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'queue'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              Publishing Queue ({jobs.length})
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'accounts'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="w-4 h-4" />
              Connected Channels ({connections.length})
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'bulk'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Bulk Scheduler
            </button>
            <button
              onClick={() => setActiveTab('automations')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'automations'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Automation Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab('failures')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'failures'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Failure Center & Alerts ({failedJobs.length + notifications.filter(n => !n.read).length})
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="max-w-7xl mx-auto px-8 py-8">
          
          {/* TAB 1: PUBLISHING QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-6">
              {jobs.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Publishing Queue is Empty</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                    No videos currently scheduled or publishing. Generate clips from the Content Factory or schedule directly.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                        <tr>
                          <th className="px-6 py-3.5">Asset / Title</th>
                          <th className="px-6 py-3.5">Platform</th>
                          <th className="px-6 py-3.5">Scheduled Slot</th>
                          <th className="px-6 py-3.5">Status</th>
                          <th className="px-6 py-3.5">Verified URL</th>
                          <th className="px-6 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {jobs.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900 line-clamp-1">{job.metadata.title}</div>
                              <div className="text-xs text-slate-400 mt-0.5">Asset ID: {job.assetId.slice(0, 12)}...</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-medium text-slate-700">{getPlatformLabel(job.platform)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-slate-900">{new Date(job.scheduledAt).toLocaleString()}</div>
                              <div className="text-xs text-slate-400">{job.scheduledTimezone}</div>
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(job.status)}
                            </td>
                            <td className="px-6 py-4">
                              {job.externalUrl ? (
                                <a
                                  href={job.externalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 underline"
                                >
                                  View Live <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => handleInspectChecklist(job)}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition"
                                  title="Inspect 10-point checklist"
                                >
                                  Checklist
                                </button>
                                {job.status !== 'PUBLISHED' && (
                                  <button
                                    onClick={() => handlePublishNow(job.id)}
                                    disabled={actionInProgress === job.id}
                                    className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Play className="w-3 h-3" /> Publish
                                  </button>
                                )}
                                {job.status !== 'PUBLISHED' && (
                                  <button
                                    onClick={() => handleCancelJob(job.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                                    title="Cancel job"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONNECTED CHANNELS */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { platform: 'youtube_shorts' as const, name: 'YouTube Shorts', desc: 'Resumable upload via YouTube Data API v3' },
                  { platform: 'tiktok' as const, name: 'TikTok', desc: 'Direct video posting via TikTok API v2' },
                  { platform: 'instagram_reels' as const, name: 'Instagram Reels', desc: 'Container upload via Meta Graph API' },
                  { platform: 'linkedin' as const, name: 'LinkedIn Video', desc: 'UGC post video publishing via LinkedIn API' },
                  { platform: 'x' as const, name: 'X (Twitter)', desc: 'Chunked video media upload via X API v2' },
                ].map((plat) => {
                  const conn = connections.find((c) => c.platform === plat.platform);
                  const isConnected = conn && conn.status === 'CONNECTED';
                  const isExpired = conn && conn.status === 'EXPIRED';

                  return (
                    <div
                      key={plat.platform}
                      className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-slate-900">{plat.name}</h3>
                          {isConnected ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Connected
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                              Token Expired
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                              Not Configured
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mb-4">{plat.desc}</p>

                        {conn ? (
                          <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Handle:</span>
                              <span className="font-medium text-slate-800">@{conn.accountHandle}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Vault Reference:</span>
                              <span className="font-mono text-slate-600">{conn.tokenReference.slice(0, 14)}...</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Expires At:</span>
                              <span className="text-slate-600">{new Date(conn.tokenExpiresAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Scopes:</span>
                              <span className="text-slate-600">{conn.scopes.join(', ')}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-400">
                            Zero stored credentials. Connect via OAuth bearer token to enable publishing.
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        {conn ? (
                          <>
                            <button
                              onClick={() => {
                                setNewAccountPlatform(plat.platform);
                                setNewAccountHandle(conn.accountHandle);
                                setIsConnectModalOpen(true);
                              }}
                              className="text-xs font-medium text-slate-600 hover:text-slate-900"
                            >
                              Refresh Token
                            </button>
                            <button
                              onClick={() => handleDisconnect(conn.id)}
                              className="text-xs font-medium text-red-600 hover:text-red-700"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setNewAccountPlatform(plat.platform);
                              setNewAccountHandle('');
                              setIsConnectModalOpen(true);
                            }}
                            className="w-full py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
                          >
                            Connect Channel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: BULK SCHEDULER */}
          {activeTab === 'bulk' && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs max-w-3xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Bulk Distribution & Scheduling</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Queue multi-asset campaigns across platforms with strict minimum gap intervals and timezone awareness.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Target Platform</label>
                  <select
                    value={bulkPlatform}
                    onChange={(e) => setBulkPlatform(e.target.value as SupportedPlatform)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="youtube_shorts">YouTube Shorts</option>
                    <option value="tiktok">TikTok</option>
                    <option value="instagram_reels">Instagram Reels</option>
                    <option value="linkedin">LinkedIn Video</option>
                    <option value="x">X (Twitter)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Cadence / Frequency</label>
                  <select
                    value={bulkFrequency}
                    onChange={(e) => setBulkFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays Only (Mon-Fri)</option>
                    <option value="custom_gap">Custom Hourly Gap</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Minimum Gap (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={bulkGapHours}
                    onChange={(e) => setBulkGapHours(parseInt(e.target.value) || 24)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Timezone</label>
                  <input
                    type="text"
                    disabled
                    value={Intl.DateTimeFormat().resolvedOptions().timeZone}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => alert('Bulk scheduler ready. Select assets from Factory or Content Store to queue.')}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition"
                >
                  Generate Queue Slots
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: AUTOMATION RULES */}
          {activeTab === 'automations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Event Automation Engine</h3>
                  <p className="text-xs text-slate-500">
                    Automate notifications and workflows based on rendering and publishing events.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-xs divide-y divide-slate-100 overflow-hidden">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-slate-900">{rule.name}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                          {rule.triggerEvent}
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">
                          {rule.actionType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Rule ID: {rule.id}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggleRule(rule.id, rule.enabled)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: FAILURE CENTER */}
          {activeTab === 'failures' && (
            <div className="space-y-8">
              {/* Notifications Inbox */}
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-red-600" /> In-App Notification Center
                </h3>
                {notifications.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                    No active notifications.
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-xs divide-y divide-slate-100 overflow-hidden">
                    {notifications.map((notif) => (
                      <div key={notif.id} className={`p-4 flex items-start justify-between ${notif.read ? 'bg-white opacity-60' : 'bg-red-50/20'}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">{notif.title}</span>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">{notif.message}</p>
                          <span className="text-[10px] text-slate-400">{new Date(notif.createdAt).toLocaleTimeString()}</span>
                        </div>
                        {!notif.read && (
                          <button
                            onClick={() => handleMarkNotifRead(notif.id)}
                            className="text-xs text-slate-500 hover:text-slate-800"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Failures & Actionable Fixes */}
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" /> Failed Publication Diagnoser
                </h3>
                {failedJobs.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                    Zero failed publications! All published assets confirmed externally.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {failedJobs.map((job) => (
                      <div key={job.id} className="bg-white border border-red-200 rounded-xl p-6 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900">{job.metadata.title}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">
                              {job.lastError?.classification || 'ERROR'}
                            </span>
                          </div>
                          <button
                            onClick={() => handlePublishNow(job.id)}
                            className="px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition"
                          >
                            Retry Publication
                          </button>
                        </div>
                        <p className="text-xs text-red-800 font-mono bg-red-50 p-2.5 rounded border border-red-100">
                          {job.lastError?.message || 'Publication failed.'}
                        </p>
                        <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Actionable Fix:</span> {job.lastError?.actionableFix || 'Inspect credentials and retry.'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>

        {/* MODAL 1: CONNECT SOCIAL CHANNEL */}
        {isConnectModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Connect Social Channel</h3>
                <button
                  onClick={() => setIsConnectModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConnectAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Platform</label>
                  <select
                    value={newAccountPlatform}
                    onChange={(e) => setNewAccountPlatform(e.target.value as SupportedPlatform)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="youtube_shorts">YouTube Shorts</option>
                    <option value="tiktok">TikTok</option>
                    <option value="instagram_reels">Instagram Reels</option>
                    <option value="linkedin">LinkedIn Video</option>
                    <option value="x">X (Twitter)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Handle</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. clipper_official"
                    value={newAccountHandle}
                    onChange={(e) => setNewAccountHandle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    OAuth Bearer Token / Test Token
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="e.g. mock-verified-token or production bearer"
                    value={newAccountToken}
                    onChange={(e) => setNewAccountToken(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Encrypted with AES-256-GCM. Never stored in plaintext. (Use prefix "mock-verified-" for verification tests).
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsConnectModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs"
                  >
                    Save & Encrypt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: 10-POINT CHECKLIST AUDIT INSPECTION */}
        {inspectChecklistJob && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pre-flight Checklist Audit</h3>
                  <p className="text-xs text-slate-500">10-Point Verification Gate</p>
                </div>
                <button
                  onClick={() => setInspectChecklistJob(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5">
                {Object.entries(inspectChecklistJob.checklist.checks).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border text-xs"
                  >
                    <span className="font-mono text-slate-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    {val ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                        <XCircle className="w-3.5 h-3.5" /> Fail
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {inspectChecklistJob.checklist.isBlocked && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                  <div className="text-xs font-bold text-red-800">Blocking Issues:</div>
                  {inspectChecklistJob.checklist.blockers.map((b, i) => (
                    <div key={i} className="text-xs text-red-700">• {b}</div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setInspectChecklistJob(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
