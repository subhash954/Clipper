'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import {
  BarChart3,
  TrendingUp,
  Award,
  Clock,
  Sparkles,
  RefreshCw,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Filter,
  Lightbulb,
  ExternalLink,
  Target
} from 'lucide-react';
import {
  PerformanceSnapshot,
  CreativeAttribution,
  DimensionLeaderboard,
  LearnedModelWeights,
} from '@/lib/analytics/types';
import { HookCategory, SupportedPlatform } from '@/lib/factory/types';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'attribution' | 'recommendations' | 'snapshots'>('leaderboard');
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [attributions, setAttributions] = useState<CreativeAttribution[]>([]);
  const [hookLeaderboard, setHookLeaderboard] = useState<DimensionLeaderboard<HookCategory | 'UNKNOWN'>[]>([]);
  const [durationLeaderboard, setDurationLeaderboard] = useState<DimensionLeaderboard<string>[]>([]);
  const [learnedWeights, setLearnedWeights] = useState<LearnedModelWeights | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingPublicationId, setSyncingPublicationId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [snapRes, attrRes, insightRes] = await Promise.all([
        fetch('/api/analytics/snapshots'),
        fetch('/api/analytics/attribution'),
        fetch('/api/analytics/insights'),
      ]);

      if (snapRes.ok) {
        const d = await snapRes.json();
        setSnapshots(d.snapshots || []);
      }
      if (attrRes.ok) {
        const d = await attrRes.json();
        setAttributions(d.attributions || []);
        setHookLeaderboard(d.hookLeaderboard || []);
        setDurationLeaderboard(d.durationLeaderboard || []);
      }
      if (insightRes.ok) {
        const d = await insightRes.json();
        setLearnedWeights(d.learnedWeights || null);
      }
    } catch (err) {
      console.error('Failed to load performance analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalViews = snapshots.reduce((acc, s) => acc + s.views, 0);
  const avgEngagementRate =
    snapshots.length > 0
      ? (snapshots.reduce((acc, s) => acc + (s.engagementRate || 0), 0) / snapshots.length) * 100
      : 0;
  const avgCompletionRate =
    snapshots.length > 0
      ? (snapshots.reduce((acc, s) => acc + (s.completionRate || 0), 0) / snapshots.length) * 100
      : 0;

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

  return (
    <AppShell activeWorkflowTab="Analytics">
      <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen">
        
        {/* Header Banner */}
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 shadow-xs">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Performance Intelligence & Learning</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Empirical creative attribution connecting actual video performance back to winning hooks and pacing.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Rule Zero: Observed Platform Metrics Only
              </span>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="max-w-7xl mx-auto flex items-center gap-6 mt-6 border-b border-slate-200/60">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'leaderboard'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Award className="w-4 h-4" />
              Creative Leaderboards
            </button>
            <button
              onClick={() => setActiveTab('attribution')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'attribution'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Attribution Graph ({attributions.length})
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'recommendations'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              AI Learned Weights & Insights ({learnedWeights?.recommendations.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('snapshots')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'snapshots'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Target className="w-4 h-4" />
              Observed Snapshots ({snapshots.length})
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
          
          {/* TOP KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Verified Views</span>
                <Eye className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{totalViews.toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-1">Across verified external posts</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg Engagement Rate</span>
                <Heart className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{avgEngagementRate.toFixed(1)}%</div>
              <div className="text-xs text-slate-400 mt-1">Weighted: Likes, comments, shares, saves</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg Completion Rate</span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{avgCompletionRate.toFixed(1)}%</div>
              <div className="text-xs text-slate-400 mt-1">Retention to video conclusion</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Publications Analyzed</span>
                <Target className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{snapshots.length}</div>
              <div className="text-xs text-slate-400 mt-1">Empirically audited assets</div>
            </div>
          </div>

          {/* TAB 1: CREATIVE LEADERBOARDS */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-8">
              {/* Hook Leaderboard */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" /> Hook Category Leaderboard
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Empirical ranking of hook types based on actual viewer engagement multipliers.
                    </p>
                  </div>
                </div>

                {hookLeaderboard.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    No publications analyzed yet. Connect social channels and publish clips to generate leaderboards.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Hook Category</th>
                          <th className="px-4 py-3">Sample Count</th>
                          <th className="px-4 py-3">Avg Views</th>
                          <th className="px-4 py-3">Engagement Rate</th>
                          <th className="px-4 py-3">Completion Rate</th>
                          <th className="px-4 py-3 text-right">Performance Multiplier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hookLeaderboard.map((row) => (
                          <tr key={row.dimension} className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-3.5 font-bold text-slate-900">
                              {row.dimension.replace('_', ' ')}
                            </td>
                            <td className="px-4 py-3.5">{row.sampleCount} clips</td>
                            <td className="px-4 py-3.5">{row.averageViews.toLocaleString()}</td>
                            <td className="px-4 py-3.5">{(row.averageEngagementRate * 100).toFixed(1)}%</td>
                            <td className="px-4 py-3.5">{(row.averageCompletionRate * 100).toFixed(1)}%</td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                  row.relativePerformanceMultiplier >= 1.2
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : row.relativePerformanceMultiplier >= 1.0
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {row.relativePerformanceMultiplier}x
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Duration Sweet Spot Leaderboard */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" /> Optimal Duration Sweet Spots
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Completion rate comparison across duration brackets.
                  </p>
                </div>

                {durationLeaderboard.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    Awaiting publication metrics.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {durationLeaderboard.map((dur) => (
                      <div
                        key={dur.dimension}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{dur.dimension}</span>
                          <span className="text-xs font-bold text-red-600">{dur.relativePerformanceMultiplier}x</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Completion Rate: <span className="font-semibold text-slate-800">{(dur.averageCompletionRate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Sample: <span className="font-medium text-slate-800">{dur.sampleCount} clips</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ATTRIBUTION GRAPH */}
          {activeTab === 'attribution' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900">Creative Attribution Lineage</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed creative breakdown for each published video connecting hook text, duration, and observed performance.
                </p>
              </div>

              {attributions.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400">
                  No attributed publications yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                      <tr>
                        <th className="px-6 py-3.5">Video / Hook</th>
                        <th className="px-6 py-3.5">Hook Category</th>
                        <th className="px-6 py-3.5">Platform</th>
                        <th className="px-6 py-3.5">Duration</th>
                        <th className="px-6 py-3.5">B-roll Cuts</th>
                        <th className="px-6 py-3.5 text-right">Composite Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attributions.map((attr, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900 line-clamp-1">{attr.hookText}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Topic: {attr.topic}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">
                              {attr.hookCategory}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-700">
                            {getPlatformLabel(attr.platform)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {attr.durationSeconds.toFixed(1)}s ({attr.aspectRatio})
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {attr.bRollCount} overlays
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              {attr.metrics.compositePerformanceScore} / 100
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI LEARNED WEIGHTS & RECOMMENDATIONS */}
          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-red-600" /> Continuous Learning Engine
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Empirical creative weights calculated from live platform analytics. Automatically injected back into Content Factory to prioritize winning patterns.
                    </p>
                  </div>
                  {learnedWeights && (
                    <span className="text-xs text-slate-400">
                      Last Updated: {learnedWeights.lastTrainedAt ? new Date(learnedWeights.lastTrainedAt).toISOString().slice(11, 19) + ' UTC' : 'N/A'}
                    </span>
                  )}
                </div>

                {learnedWeights ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-700 uppercase">Hook Category Weights</span>
                      <div className="space-y-1.5 text-xs">
                        {Object.entries(learnedWeights.hookCategoryWeights).map(([cat, weight]) => (
                          <div key={cat} className="flex justify-between">
                            <span className="text-slate-600 capitalize">{cat.replace('_', ' ').toLowerCase()}:</span>
                            <span className="font-mono font-bold text-slate-900">{weight.toFixed(2)}x</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-700 uppercase">Optimal Durations</span>
                      <div className="space-y-1.5 text-xs">
                        {Object.entries(learnedWeights.optimalDurations).map(([plat, range]) => (
                          <div key={plat} className="flex justify-between">
                            <span className="text-slate-600">{getPlatformLabel(plat)}:</span>
                            <span className="font-mono text-slate-800">{range[0]}s - {range[1]}s</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-700 uppercase">Visual Style Preference</span>
                      <div className="text-xs text-slate-600">
                        B-Roll Cut Preference: <span className="font-bold text-slate-900">{learnedWeights.bRollDensityPreference}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Higher visual pacing maintains retention past the crucial 10-second mark.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Actionable Recommendations List */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900">Actionable Creative Recommendations</h4>
                {learnedWeights?.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">
                          {rec.type.replace('_', ' ')}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{rec.title}</h4>
                      </div>
                      <p className="text-xs text-slate-600">{rec.description}</p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
                        <span>Confidence: <strong className="text-slate-700">{rec.confidence}%</strong></span>
                        <span>•</span>
                        <span>Sample Size: <strong className="text-slate-700">{rec.evidenceSampleCount} clips</strong></span>
                        <span>•</span>
                        <span>Expected Lift: <strong className="text-emerald-700">{rec.expectedLiftMultiplier}x</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: RAW OBSERVED SNAPSHOTS */}
          {activeTab === 'snapshots' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900">Observed Platform Snapshots</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Raw telemetry captured directly from external platform APIs. Zero interpolation or synthetic metrics.
                </p>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400">
                  No snapshots recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                      <tr>
                        <th className="px-6 py-3.5">Publication ID</th>
                        <th className="px-6 py-3.5">Platform</th>
                        <th className="px-6 py-3.5">Views</th>
                        <th className="px-6 py-3.5">Likes</th>
                        <th className="px-6 py-3.5">Comments</th>
                        <th className="px-6 py-3.5">Shares</th>
                        <th className="px-6 py-3.5">Captured At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {snapshots.map((snap) => (
                        <tr key={snap.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4 font-mono text-xs text-slate-700">
                            {snap.publicationId.slice(0, 16)}...
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-800">
                            {getPlatformLabel(snap.platform)}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900">
                            {snap.views.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-xs">{snap.likes.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs">{snap.comments.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs">{snap.shares.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {snap.capturedAt ? new Date(snap.capturedAt).toISOString().replace('T', ' ').slice(0, 19) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </AppShell>
  );
}
