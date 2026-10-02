'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  AlertCircle,
  Film,
  Send,
  Calendar,
  BarChart3,
  ChevronRight,
  Shield,
  ThumbsUp,
  RotateCcw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function ClientPortalPage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'calendar' | 'performance'>('review');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentTimestamp, setNewCommentTimestamp] = useState<number>(0);
  const [approving, setApproving] = useState(false);

  // Mock initial assets awaiting review if API list is empty
  const [assets, setAssets] = useState<any[]>([
    {
      id: 'asset-demo-1',
      title: '3 Mistakes Every Founder Makes (9:16 Shorts)',
      platform: 'youtube_shorts',
      status: 'CLIENT_REVIEW',
      durationSeconds: 42,
      hookCategory: 'Mistake',
      hookText: 'Stop making this 1 deadly founder mistake right now...',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    },
    {
      id: 'asset-demo-2',
      title: 'How We Scaled from $0 to $100k MRR (LinkedIn Clip)',
      platform: 'linkedin',
      status: 'IN_REVIEW',
      durationSeconds: 58,
      hookCategory: 'Outcome',
      hookText: 'Most SaaS founders overcomplicate growth. Here is our 3-step playbook...',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    }
  ]);

  const loadComments = async (assetId: string) => {
    try {
      const res = await fetch(`/api/agency/approvals?assetId=${assetId}`);
      const data = await res.json();
      if (data.success && data.comments) {
        setComments(data.comments);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      setSelectedAsset(assets[0]);
      loadComments(assets[0].id);
    }
  }, [assets]);

  const handleSelectAsset = (asset: any) => {
    setSelectedAsset(asset);
    loadComments(asset.id);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedAsset) return;

    try {
      const res = await fetch('/api/agency/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          assetId: selectedAsset.id,
          text: newCommentText,
          videoTimestampSeconds: newCommentTimestamp || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComments([...comments, data.comment]);
        setNewCommentText('');
        setNewCommentTimestamp(0);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApprove = async () => {
    if (!selectedAsset) return;
    setApproving(true);
    try {
      const res = await fetch('/api/agency/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transition',
          assetId: selectedAsset.id,
          currentStatus: selectedAsset.status,
          targetStatus: 'APPROVED',
          notes: 'Approved by Client via Client Review Portal',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedAsset({ ...selectedAsset, status: 'APPROVED' });
        setAssets(assets.map(a => a.id === selectedAsset.id ? { ...a, status: 'APPROVED' } : a));
      } else {
        alert(data.error || 'Failed to approve');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedAsset) return;
    const notes = prompt('Please specify changes requested:');
    if (!notes) return;

    try {
      const res = await fetch('/api/agency/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transition',
          assetId: selectedAsset.id,
          currentStatus: selectedAsset.status,
          targetStatus: 'CHANGES_REQUESTED',
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedAsset({ ...selectedAsset, status: 'CHANGES_REQUESTED' });
        setAssets(assets.map(a => a.id === selectedAsset.id ? { ...a, status: 'CHANGES_REQUESTED' } : a));
      } else {
        alert(data.error || 'Failed to request changes');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* PORTAL TOP NAVIGATION */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Acme Corp Content Portal</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                CLIENT VERIFIED
              </span>
            </div>
            <p className="text-xs text-slate-400">Review, timestamp, and approve upcoming video content</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/agency"
            className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Agency View
          </Link>
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: ASSET QUEUE */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center justify-between">
            <span>Content for Review</span>
            <span className="text-xs font-mono text-indigo-400">{assets.length} items</span>
          </h2>

          <div className="space-y-3">
            {assets.map(asset => {
              const isSelected = selectedAsset?.id === asset.id;
              return (
                <button
                  key={asset.id}
                  onClick={() => handleSelectAsset(asset)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold">
                      {asset.platform.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      asset.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      asset.status === 'CHANGES_REQUESTED' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                      'bg-indigo-950 text-indigo-400 border border-indigo-800'
                    }`}>
                      {asset.status}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white line-clamp-2">{asset.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 italic line-clamp-1">"{asset.hookText}"</p>
                  <p className="text-[10px] text-slate-500 mt-2 font-mono">{asset.durationSeconds}s duration</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER & RIGHT COLUMN: VIDEO PLAYER & COMMENTS */}
        {selectedAsset ? (
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{selectedAsset.title}</h2>
                  <p className="text-xs text-slate-400">Hook: {selectedAsset.hookCategory} &bull; {selectedAsset.durationSeconds}s</p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedAsset.status !== 'APPROVED' ? (
                    <>
                      <button
                        onClick={handleRequestChanges}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Request Changes
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Approve for Publishing
                      </button>
                    </>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Approved
                    </span>
                  )}
                </div>
              </div>

              {/* Video Player Box */}
              <div className="aspect-video bg-black rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center">
                <video
                  src={selectedAsset.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e: any) => setNewCommentTimestamp(Math.floor(e.target.currentTime))}
                />
              </div>

              {/* Comments & Timestamp Notes */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  Feedback & Timestamp Comments
                </h3>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {comments.map(c => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">{c.authorName}</span>
                        {c.videoTimestampSeconds !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono text-[10px]">
                            {Math.floor(c.videoTimestampSeconds / 60)}:{String(c.videoTimestampSeconds % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300">{c.text}</p>
                    </div>
                  ))}

                  {comments.length === 0 && (
                    <p className="text-xs text-slate-500 py-2">No comments yet. Add a note or timestamp suggestion below.</p>
                  )}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 text-xs font-mono text-indigo-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{Math.floor(newCommentTimestamp / 60)}:{String(newCommentTimestamp % 60).padStart(2, '0')}</span>
                  </div>
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    placeholder="e.g. Move caption higher at this moment..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" /> Post
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center p-12 text-slate-500 text-xs">
            Select an asset from the queue to review
          </div>
        )}
      </div>
    </div>
  );
}
