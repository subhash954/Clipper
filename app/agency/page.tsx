'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  HardDrive,
  Film,
  Zap,
  Key,
  Globe,
  Shield,
  CreditCard,
  Plus,
  RefreshCw,
  ExternalLink,
  Lock,
  ChevronRight,
  TrendingUp,
  FileText,
  Copy,
  Check,
  Eye,
  Trash2,
  Send
} from 'lucide-react';
import Link from 'next/link';

export default function AgencyPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'approvals' | 'usage' | 'billing' | 'security' | 'branding' | 'audit'>('clients');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agency Data State
  const [clients, setClients] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [branding, setBranding] = useState<any>({
    brandName: 'Clipper Agency',
    portalName: 'Client Review Portal',
    primaryColorHex: '#6366f1',
    accentColorHex: '#8b5cf6',
    supportEmail: 'agency@clipper.ai',
    removePlatformAttribution: false,
  });
  const [domainConfig, setDomainConfig] = useState<any>(null);

  // New Client Form
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    company: '',
    contactEmail: '',
    monthlyRetainerUSD: 2500,
    allocatedCredits: 500,
  });

  // New API Key
  const [newKeyName, setNewKeyName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // New Domain Form
  const [hostnameInput, setHostnameInput] = useState('');

  const orgId = '00000000-0000-0000-0000-000000000001';
  const wsId = '00000000-0000-0000-0000-000000000002';

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Clients
      const clientsRes = await fetch(`/api/agency/clients?workspaceId=${wsId}`);
      const clientsData = await clientsRes.json();
      if (clientsData.success) setClients(clientsData.clients);

      // 2. Tasks
      const tasksRes = await fetch(`/api/agency/tasks?workspaceId=${wsId}`);
      const tasksData = await tasksRes.json();
      if (tasksData.success) setTasks(tasksData.tasks);

      // 3. Usage
      const usageRes = await fetch(`/api/agency/usage?workspaceId=${wsId}`);
      const usageData = await usageRes.json();
      if (usageData.success) setUsage(usageData.usage);

      // 4. Billing
      const billingRes = await fetch(`/api/agency/billing?organizationId=${orgId}`);
      const billingData = await billingRes.json();
      if (billingData.success) setSubscription(billingData.subscription);

      // 5. API Keys
      const keysRes = await fetch(`/api/agency/apikeys?organizationId=${orgId}`);
      const keysData = await keysRes.json();
      if (keysData.success) setApiKeys(keysData.apiKeys);

      // 6. Audit Logs
      const auditRes = await fetch(`/api/agency/audit?organizationId=${orgId}&limit=20`);
      const auditData = await auditRes.json();
      if (auditData.success) setAuditLogs(auditData.logs);

      // 7. Branding
      const brandRes = await fetch(`/api/agency/branding?workspaceId=${wsId}`);
      const brandData = await brandRes.json();
      if (brandData.success) {
        if (brandData.branding) setBranding(brandData.branding);
        if (brandData.domain) setDomainConfig(brandData.domain);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load agency operating data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/agency/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...clientForm,
          workspaceId: wsId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewClientModal(false);
        setClientForm({ name: '', company: '', contactEmail: '', monthlyRetainerUSD: 2500, allocatedCredits: 500 });
        loadAllData();
      } else {
        alert(data.error || 'Failed to create client');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await fetch('/api/agency/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          organizationId: orgId,
          workspaceId: wsId,
          name: newKeyName,
          permissions: ['project.read', 'project.create', 'asset.read', 'asset.render', 'publish.create'],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedSecret(data.rawSecret);
        setNewKeyName('');
        loadAllData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to permanently revoke this API key?')) return;
    try {
      const res = await fetch('/api/agency/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          organizationId: orgId,
          keyId,
        }),
      });
      const data = await res.json();
      if (data.success) loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveBranding = async () => {
    try {
      const res = await fetch('/api/agency/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_branding',
          workspaceId: wsId,
          branding,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Branding updated successfully!');
        loadAllData();
      } else {
        alert(data.error || 'Failed to save branding');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfigureDomain = async () => {
    if (!hostnameInput.trim()) return;
    try {
      const res = await fetch('/api/agency/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configure_domain',
          workspaceId: wsId,
          hostname: hostnameInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setHostnameInput('');
        loadAllData();
      } else {
        alert(data.error || 'Failed to configure custom domain');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    try {
      const res = await fetch('/api/agency/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_domain',
          workspaceId: wsId,
          domainId,
        }),
      });
      const data = await res.json();
      if (data.success) loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <AppShell>
      <div className="flex-1 bg-slate-900 text-slate-100 min-h-screen">
        {/* HEADER */}
        <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-white">Agency Operations OS</h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800">
                    MULTI-TENANT v8.0
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Manage isolated client workspaces, approval queues, usage quotas, and white-label client portals.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/portal"
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                Launch Client Portal
              </Link>
              <button
                onClick={loadAllData}
                disabled={loading}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="Refresh State"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* TAB BAR */}
          <div className="max-w-7xl mx-auto mt-4 flex items-center gap-1 border-b border-slate-800">
            {[
              { id: 'clients', label: 'Client Workspaces', icon: Users, badge: clients.length },
              { id: 'approvals', label: 'Approval Pipeline & Tasks', icon: CheckCircle2, badge: tasks.length },
              { id: 'usage', label: 'Usage Meters & Quotas', icon: HardDrive },
              { id: 'billing', label: 'Billing & Subscriptions', icon: CreditCard },
              { id: 'security', label: 'API Keys & Security', icon: Key, badge: apiKeys.length },
              { id: 'branding', label: 'White-Label & Domains', icon: Globe },
              { id: 'audit', label: 'Audit Trail', icon: Shield, badge: auditLogs.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
                    isActive
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <main className="max-w-7xl mx-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. CLIENT WORKSPACES TAB */}
          {activeTab === 'clients' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Active Agency Clients</h2>
                  <p className="text-xs text-slate-400">
                    Each client operates in an isolated workspace with strict permission boundaries and separate assets.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewClientModal(true)}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Onboard New Client
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map(client => (
                  <div
                    key={client.id}
                    className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {client.status.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          ${client.monthlyRetainerUSD?.toLocaleString()}/mo
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{client.company}</h3>
                      <p className="text-xs text-slate-400">{client.name} &bull; {client.contactEmail}</p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Credits: <strong className="text-indigo-400">{client.allocatedCredits}</strong>
                      </span>
                      <Link
                        href={`/portal?clientId=${client.id}`}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        Client Portal <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}

                {clients.length === 0 && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No agency clients onboarded yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. APPROVAL PIPELINE & TASKS TAB */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Content Approval & Tasks Engine</h2>
                  <p className="text-xs text-slate-400">
                    State progression: DRAFT &rarr; IN_REVIEW &rarr; CLIENT_REVIEW &rarr; APPROVED &rarr; SCHEDULED &rarr; PUBLISHED.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].map(colStatus => {
                  const colTasks = tasks.filter(t => t.status === colStatus);
                  return (
                    <div key={colStatus} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-slate-300">{colStatus}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                          {colTasks.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {colTasks.map(t => (
                          <div key={t.id} className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white truncate">{t.title}</span>
                              <span className={`text-[9px] font-mono px-1 rounded ${
                                t.priority === 'HIGH' || t.priority === 'URGENT' ? 'bg-red-950 text-red-400' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {t.priority}
                              </span>
                            </div>
                            {t.description && <p className="text-[11px] text-slate-400 line-clamp-2">{t.description}</p>}
                            {t.assigneeName && <p className="text-[10px] text-indigo-400">Assignee: {t.assigneeName}</p>}
                          </div>
                        ))}

                        {colTasks.length === 0 && (
                          <p className="text-[11px] text-slate-500 text-center py-4">No tasks</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. USAGE METERS & QUOTAS TAB */}
          {activeTab === 'usage' && usage && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-white">Resource Consumption & Hard Quotas</h2>
                <p className="text-xs text-slate-400">
                  Every render second, storage byte, and AI token is tracked in the immutable usage ledger. Operations exceeding limits fail closed (QUOTA_EXCEEDED).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Render Minutes */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Film className="w-4 h-4 text-rose-400" /> Render Minutes
                    </span>
                    <span className="font-mono text-white">
                      {usage.totals.renderMinutes} / {usage.quotas.maxRenderMinutesPerMonth}m
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${usage.percentages.renderMinutes > 90 ? 'bg-red-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, usage.percentages.renderMinutes)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">{usage.percentages.renderMinutes.toFixed(1)}% of monthly capacity</p>
                </div>

                {/* Storage */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-indigo-400" /> Storage Used
                    </span>
                    <span className="font-mono text-white">
                      {(usage.totals.storageBytes / (1024 * 1024 * 1024)).toFixed(1)} / {(usage.quotas.maxStorageBytes / (1024 * 1024 * 1024)).toFixed(0)} GB
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${Math.min(100, usage.percentages.storage)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">{usage.percentages.storage.toFixed(1)}% of storage limit</p>
                </div>

                {/* AI Tokens */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" /> AI Tokens
                    </span>
                    <span className="font-mono text-white">
                      {usage.totals.aiTokens.toLocaleString()} / {usage.quotas.maxAiTokensPerMonth.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${Math.min(100, usage.percentages.aiTokens)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">{usage.percentages.aiTokens.toFixed(1)}% of AI quota</p>
                </div>

                {/* Published Posts */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-emerald-400" /> Published Posts
                    </span>
                    <span className="font-mono text-white">
                      {usage.totals.publishedPosts} / {usage.quotas.maxPublishedPostsPerMonth}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(100, usage.percentages.posts)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">{usage.percentages.posts.toFixed(1)}% of posting quota</p>
                </div>
              </div>
            </div>
          )}

          {/* 4. BILLING & SUBSCRIPTIONS TAB */}
          {activeTab === 'billing' && subscription && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-800/50 flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-900 text-indigo-300 border border-indigo-700">
                    CURRENT PLAN
                  </span>
                  <h2 className="text-xl font-extrabold text-white mt-1 capitalize">{subscription.planId} Tier</h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Status: <strong className="text-emerald-400">{subscription.status.toUpperCase()}</strong> &bull; Period renewal: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => alert('Initiating Stripe customer portal session')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
                  >
                    Upgrade / Manage Plan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. API KEYS & SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Agency API Keys & Credential Vault</h2>
                  <p className="text-xs text-slate-400">
                    Raw keys are displayed only once upon generation. All stored secrets are hashed using SHA-256.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Key description (e.g. CI/CD Pipeline)"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleCreateApiKey}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Generate Key
                  </button>
                </div>
              </div>

              {createdSecret && (
                <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-800 text-xs text-amber-200 space-y-2">
                  <p className="font-bold">Save this secret immediately! You will not be able to view it again:</p>
                  <div className="flex items-center gap-2 font-mono bg-slate-900 p-2.5 rounded-lg border border-amber-900/60 select-all">
                    <span className="flex-1 truncate">{createdSecret}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdSecret);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="px-2 py-1 rounded bg-slate-800 text-slate-200 hover:text-white flex items-center gap-1"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {apiKeys.map(k => (
                  <div
                    key={k.id}
                    className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{k.name}</span>
                        <span className="font-mono text-slate-400 text-[10px]">{k.keyPrefix}...</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Permissions: {k.permissions.join(', ')} &bull; Created: {new Date(k.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRevokeApiKey(k.id)}
                      className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. WHITE-LABEL & DOMAINS TAB */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-white">White-Label Branding & Custom Domain</h2>
                <p className="text-xs text-slate-400">
                  Present a custom brand identity to your clients. Custom domains require DNS verification.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Branding Config */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4 text-xs">
                  <h3 className="font-bold text-white text-sm">Brand Customization</h3>
                  <div>
                    <label className="block text-slate-400 mb-1">Agency Name</label>
                    <input
                      type="text"
                      value={branding.brandName}
                      onChange={e => setBranding({ ...branding, brandName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Client Portal Header Title</label>
                    <input
                      type="text"
                      value={branding.portalName}
                      onChange={e => setBranding({ ...branding, portalName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Support Email</label>
                    <input
                      type="email"
                      value={branding.supportEmail}
                      onChange={e => setBranding({ ...branding, supportEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    onClick={handleSaveBranding}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-600/30"
                  >
                    Save Branding Settings
                  </button>
                </div>

                {/* Custom Domain */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4 text-xs">
                  <h3 className="font-bold text-white text-sm">Custom Domain Configuration</h3>
                  {domainConfig ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-white text-sm">{domainConfig.hostname}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          domainConfig.status === 'verified' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {domainConfig.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        DNS TXT verification token: <code className="text-indigo-400 select-all">{domainConfig.verificationToken}</code>
                      </p>
                      {domainConfig.status !== 'verified' && (
                        <button
                          onClick={() => handleVerifyDomain(domainConfig.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                        >
                          Verify DNS TXT Record
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-slate-400">Enter your custom domain (e.g. portal.youragency.com):</p>
                      <input
                        type="text"
                        value={hostnameInput}
                        onChange={e => setHostnameInput(e.target.value)}
                        placeholder="portal.youragency.com"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleConfigureDomain}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all"
                      >
                        Add Custom Domain
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 7. AUDIT TRAIL TAB */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-white">Immutable Organization Audit Trail</h2>
                <p className="text-xs text-slate-400">
                  Logs all security events, membership changes, asset approvals, and publish actions.
                </p>
              </div>

              <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-800 border-b border-slate-700 text-slate-400 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Actor</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Resource</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-white font-medium">{log.actorEmail}</td>
                        <td className="py-2.5 px-4 font-mono text-indigo-400">{log.action}</td>
                        <td className="py-2.5 px-4 text-slate-300 font-mono text-[11px]">{log.resourceType}:{log.resourceId.substring(0, 8)}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          No audit events recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ONBOARD NEW CLIENT MODAL */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 text-xs text-slate-200">
            <h3 className="text-base font-bold text-white">Onboard Agency Client</h3>
            <form onSubmit={handleCreateClient} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Company / Brand Name</label>
                <input
                  type="text"
                  required
                  value={clientForm.company}
                  onChange={e => setClientForm({ ...clientForm, company: e.target.value })}
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Primary Contact Name</label>
                <input
                  type="text"
                  required
                  value={clientForm.name}
                  onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="Sarah Connor"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={clientForm.contactEmail}
                  onChange={e => setClientForm({ ...clientForm, contactEmail: e.target.value })}
                  placeholder="sarah@acme.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Monthly Retainer ($)</label>
                  <input
                    type="number"
                    value={clientForm.monthlyRetainerUSD}
                    onChange={e => setClientForm({ ...clientForm, monthlyRetainerUSD: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Allocated Credits</label>
                  <input
                    type="number"
                    value={clientForm.allocatedCredits}
                    onChange={e => setClientForm({ ...clientForm, allocatedCredits: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
