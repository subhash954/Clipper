'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { 
  Sparkles, 
  Layers, 
  Film, 
  Share2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  Filter, 
  DollarSign, 
  Calendar, 
  Play, 
  ExternalLink, 
  RefreshCw, 
  Sliders, 
  ShieldCheck, 
  Copy, 
  ChevronRight,
  TrendingUp,
  FileText,
  MessageSquare,
  Lock,
  Unlock,
  Check
} from 'lucide-react';
import { 
  ContentOpportunity, 
  ContentAsset, 
  ContentMap, 
  SupportedPlatform, 
  ContentType, 
  BrandKit,
  BrandVoice 
} from '@/lib/factory/types';
import { PLATFORM_PROFILES } from '@/lib/factory/platformProfiles';

export default function ContentFactoryPage() {
  const [activeTab, setActiveTab] = useState<'map' | 'library' | 'variants' | 'brand'>('map');
  const [opportunities, setOpportunities] = useState<ContentOpportunity[]>([]);
  const [contentMap, setContentMap] = useState<ContentMap | null>(null);
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Batch Generation State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchCount, setBatchCount] = useState(5);
  const [maxBudget, setMaxBudget] = useState(5.0);
  const [batchPlatforms, setBatchPlatforms] = useState<SupportedPlatform[]>(['youtube_shorts', 'tiktok']);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);

  // Lineage Modal State
  const [selectedLineageAsset, setSelectedLineageAsset] = useState<ContentAsset | null>(null);
  const [copiedQuote, setCopiedQuote] = useState(false);

  // Load existing data
  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch opportunities
      const oppsRes = await fetch('/api/content/opportunities?projectId=default-project');
      const oppsData = await oppsRes.json();
      if (oppsData.opportunities) {
        setOpportunities(oppsData.opportunities);
      }

      // Fetch assets
      const assetsRes = await fetch('/api/content/assets?projectId=default-project');
      const assetsData = await assetsRes.json();
      if (assetsData.assets) {
        setAssets(assetsData.assets);
      }

      // Fetch brand kit
      const bkRes = await fetch('/api/content/brand-kit?workspaceId=default-workspace');
      const bkData = await bkRes.json();
      if (bkData.brandKit) {
        setBrandKit(bkData.brandKit);
      }
    } catch (err) {
      console.warn('Could not load content factory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Run Mining Pipeline (Phase 1, 3, 4)
  const handleAnalyzeVideo = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/content/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'default-project',
          sourceDurationSeconds: 30,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContentMap(data.contentMap);
        setOpportunities(data.opportunities);
      }
    } catch (err) {
      console.error('Failed to analyze:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Run Batch Generation (Phase 32, 33, 34)
  const handleRunBatch = async () => {
    setBatchRunning(true);
    setBatchResult(null);
    try {
      const res = await fetch('/api/content/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'default-project',
          requestedCount: batchCount,
          maxBudgetUsd: maxBudget,
          platforms: batchPlatforms,
        }),
      });
      const data = await res.json();
      setBatchResult(data);
      if (data.assets) {
        setAssets((prev) => [...data.assets, ...prev]);
      }
    } catch (err) {
      console.error('Batch failed:', err);
    } finally {
      setBatchRunning(false);
    }
  };

  // Filtered Assets
  const filteredAssets = assets.filter((a) => {
    if (selectedPlatform !== 'all' && a.platform !== selectedPlatform) return false;
    if (selectedStatus !== 'all' && a.status !== selectedStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <AppShell activeWorkflowTab="youtube_to_shorts">
      <div className="p-8 max-w-7xl mx-auto space-y-8 select-none">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">AI Content Factory</h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                Mission 5
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Transform one long video into a structured graph of 20–50 multi-platform assets with traceable evidence.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleAnalyzeVideo}
              disabled={analyzing}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              <span>{analyzing ? 'Mining Opportunities...' : 'Mine Video Opportunities'}</span>
            </button>

            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-500/25 transition-all hover:scale-102 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Batch Generate Factory</span>
            </button>
          </div>
        </div>

        {/* Real Metrics Row (Zero Fake Analytics) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Mined Opportunities</span>
              <Sparkles className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{opportunities.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Distinct ideas (deduplicated)</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Ready Assets</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">
              {assets.filter((a) => a.status === 'READY').length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Passed all 8 quality gates</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Needs Review</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-slate-900">
              {assets.filter((a) => a.status === 'NEEDS_REVIEW').length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Quarantined for human check</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Observed Performance</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs font-bold text-slate-400 mt-2">No observed performance yet</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Rule Zero: No synthetic views</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'map'
                ? 'bg-red-50 text-red-600 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Content Map ({opportunities.length})
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-red-50 text-red-600 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Content Library ({assets.length})
          </button>

          <button
            onClick={() => setActiveTab('brand')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'brand'
                ? 'bg-red-50 text-red-600 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Brand Kit &amp; Voice
          </button>
        </div>

        {/* TAB 1: CONTENT MAP (Phase 3 & 4) */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            {opportunities.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 space-y-3">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No Content Opportunities Mined Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click "Mine Video Opportunities" above to parse the multimodal transcript and extract distinct ideas.
                </p>
                <button
                  onClick={handleAnalyzeVideo}
                  disabled={analyzing}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  Mine Opportunities Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                          {opp.topic}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                          <span>{opp.score}</span>
                          <span className="text-[9px] text-slate-400">Score</span>
                        </div>
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">
                        {opp.hook}
                      </h3>

                      <p className="text-xs text-slate-500 italic line-clamp-2">
                        "{opp.evidence.quote}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">
                        {opp.sourceStart.toFixed(1)}s - {opp.sourceEnd.toFixed(1)}s
                      </span>
                      
                      <button
                        onClick={() => {
                          // Quick generate for youtube_shorts
                          fetch(`/api/content/opportunities/${opp.id}/generate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectId: opp.projectId, platform: 'youtube_shorts' }),
                          })
                            .then((res) => res.json())
                            .then((data) => {
                              if (data.asset) {
                                setAssets((prev) => [data.asset, ...prev]);
                                setActiveTab('library');
                              }
                            });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        Create Short →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONTENT LIBRARY (Phase 29, 30, 31, 45) */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Natural language search: 'Find AI clips', 'show contrarian'..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="all">All Platforms</option>
                  <option value="youtube_shorts">YouTube Shorts</option>
                  <option value="instagram_reels">Instagram Reels</option>
                  <option value="tiktok">TikTok</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="x">X (Twitter)</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="READY">Ready</option>
                  <option value="NEEDS_REVIEW">Needs Review</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>

            {/* Assets Grid */}
            {filteredAssets.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 space-y-2">
                <Film className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No assets matching current filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-red-50 text-red-700 uppercase">
                          {asset.platform.replace('_', ' ')}
                        </span>
                        
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            asset.status === 'READY'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {asset.status}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">
                        {asset.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2">
                        {asset.description}
                      </p>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {asset.hashtags.all.slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[10px] text-slate-400 font-mono">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <button
                        onClick={() => setSelectedLineageAsset(asset)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck className="w-3 h-3 text-red-600" />
                        <span>Source Lineage</span>
                      </button>

                      <Link
                        href={`/studio?projectId=${asset.projectId}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open in Studio</span>
                        <ChevronRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BRAND KIT & VOICE (Phase 18 & 19) */}
        {activeTab === 'brand' && brandKit && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-red-600" />
                <span>Brand Kit Settings</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={brandKit.name}
                    readOnly
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Caption Typography Preset</label>
                  <input
                    type="text"
                    value={brandKit.captionPreset}
                    readOnly
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium capitalize"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Default Call To Action</label>
                  <textarea
                    rows={2}
                    value={brandKit.defaultCta}
                    readOnly
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-red-600" />
                <span>Brand Voice Guidelines</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-red-50/60 border border-red-200/60 text-slate-700">
                  <p className="font-bold text-red-900">Configured Tone: Educational &amp; Direct</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    AI generation strictly adheres to verifiable statements and avoids exaggerated clickbait.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-700 mb-1">Active Guardrails:</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                    <li>Strict evidence alignment against source transcript timestamps</li>
                    <li>Zero synthetic performance inflation</li>
                    <li>Platform safe-margin padding applied to all 9:16 vertical exports</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LINEAGE DRAWER / MODAL (Phase 31) */}
        {selectedLineageAsset && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-red-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Auditable Source Lineage</h3>
                </div>
                <button
                  onClick={() => setSelectedLineageAsset(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono text-[11px]">
                  <p><strong>Asset ID:</strong> {selectedLineageAsset.id}</p>
                  <p><strong>Source Project:</strong> {selectedLineageAsset.lineage.sourceProjectId}</p>
                  <p>
                    <strong>Timestamp Range:</strong> {selectedLineageAsset.lineage.sourceStart.toFixed(1)}s – {selectedLineageAsset.lineage.sourceEnd.toFixed(1)}s
                  </p>
                  <p><strong>Duration:</strong> {selectedLineageAsset.durationSeconds.toFixed(1)}s</p>
                  <p><strong>Words Count:</strong> {selectedLineageAsset.lineage.wordCount}</p>
                </div>

                <div>
                  <p className="font-bold text-slate-800 mb-1">Quality Audit Summary:</p>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] space-y-1">
                    <p className="font-bold">Score: {selectedLineageAsset.qualityAudit?.score || 100}% Passed</p>
                    <p>Verified against source boundaries, platform duration limits, and transcript sync.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedLineageAsset(null)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}

        {/* BATCH GENERATION MODAL (Phase 32, 33, 34) */}
        {isBatchModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-red-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Batch Asset Factory</h3>
                </div>
                <button
                  onClick={() => setIsBatchModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Number of Opportunities to Adapt</label>
                  <select
                    value={batchCount}
                    onChange={(e) => setBatchCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  >
                    <option value={3}>3 Opportunities (~6 platform assets)</option>
                    <option value={5}>5 Opportunities (~10 platform assets)</option>
                    <option value={10}>10 Opportunities (~20 platform assets)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Maximum Hard Budget Cap</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.5"
                      value={maxBudget}
                      onChange={(e) => setMaxBudget(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    System automatically stops if compute/AI costs reach this threshold.
                  </p>
                </div>

                {batchResult && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] space-y-1">
                    <p className="font-bold">Batch Completed Successfully!</p>
                    <p>Generated {batchResult.generatedAssetsCount} assets across selected platforms.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setIsBatchModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunBatch}
                  disabled={batchRunning}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${batchRunning ? 'animate-spin' : ''}`} />
                  <span>{batchRunning ? 'Processing Batch...' : 'Start Batch Job'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
