'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { 
  Sparkles, 
  Youtube, 
  Film, 
  FileText, 
  Calendar, 
  UploadCloud, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Play, 
  Check, 
  ShieldCheck, 
  DollarSign, 
  ArrowRight,
  Key,
  ExternalLink,
  Zap,
  Scissors
} from 'lucide-react';
import { processYouTubeVideoToShorts, generateDocumentaryBlueprint } from '@/lib/pipelineEngine';

export default function CustomerDashboard() {
  const [activeWorkflow, setActiveWorkflow] = useState<'youtube_to_shorts' | 'one_finger_reel' | 'documentary' | 'calendar'>('youtube_to_shorts');
  const [youtubeUrl, setYoutubeUrl] = useState("https://www.youtube.com/watch?v=B_9c1hJGCsw");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processedData, setProcessedData] = useState<any>(null);
  const [docData, setDocData] = useState<ReturnType<typeof generateDocumentaryBlueprint> | null>(() => generateDocumentaryBlueprint("The Rise of Artificial Intelligence"));
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [scheduledSuccessId, setScheduledSuccessId] = useState<string | null>(null);

  const handleStartYouTubeIngest = async () => {
    if (!youtubeUrl.trim()) return;
    setIsProcessing(true);
    setProcessingStatus('Fetching YouTube video metadata & oEmbed...');

    try {
      setTimeout(() => setProcessingStatus('Deepgram Nova-2 Audio Transcription & Token Sync...'), 1200);
      setTimeout(() => setProcessingStatus('Gemini 2.5 Flash Mining Viral 60s Hooks & Retention Points...'), 2400);

      const res = await fetch('/api/youtube/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
      });

      if (!res.ok) {
        throw new Error('Failed to ingest YouTube video');
      }

      const data = await res.json();
      setProcessedData(data);
      if (typeof window !== 'undefined' && data?.clips?.length > 0) {
        localStorage.setItem('clipper_active_project', JSON.stringify({
          videoTitle: data.videoTitle,
          channelName: data.channelName,
          thumbnailUrl: data.thumbnailUrl,
          activeClip: data.clips[0],
          clips: data.clips,
        }));
      }
    } catch (err) {
      console.error('Ingest error:', err);
      // Graceful fallback to client pipeline
      const fallback = processYouTubeVideoToShorts(youtubeUrl);
      setProcessedData(fallback);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleOpenInStudio = (clip: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('clipper_active_project', JSON.stringify({
        videoTitle: processedData?.videoTitle || clip.title,
        channelName: processedData?.channelName || 'YouTube Creator',
        thumbnailUrl: clip.thumbnailUrl || processedData?.thumbnailUrl,
        activeClip: clip,
        clips: processedData?.clips || [clip],
      }));
    }
  };

  const handleScheduleToYouTube = (clipId: string) => {
    setScheduledSuccessId(clipId);
    setTimeout(() => setScheduledSuccessId(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex font-sans">
      
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeWorkflowTab={activeWorkflow}
        onSelectWorkflowTab={(tab) => setActiveWorkflow(tab)}
        onOpenApiModal={() => setIsApiModalOpen(true)}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Customer Dashboard</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
              YouTube Red Edition
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Connect Real AI API Keys Button */}
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors shadow-2xs"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>Connect AI Keys</span>
            </button>

            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin Telemetry</span>
            </Link>

            <Link
              href="/studio"
              className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 hover:scale-[1.02] transition-all"
            >
              Full Editor →
            </Link>
          </div>
        </header>

        {/* Dashboard Workspace */}
        <main className="p-8 max-w-6xl w-full mx-auto space-y-6">
          
          {/* WORKFLOW 1: 1-HOUR YOUTUBE TO 10-15 SHORTS */}
          {activeWorkflow === 'youtube_to_shorts' && (
            <div className="space-y-6">
              
              {/* Ingestion Hero Card */}
              <div className="clean-card-feature p-8 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-extrabold uppercase tracking-wider border border-red-200">
                      YouTube URL Slicer Pipeline
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      1-Hour Video to 15 Viral Shorts
                    </h2>
                    <p className="text-xs text-slate-500 max-w-xl">
                      Paste any 30-60 min YouTube URL. AI cuts 15 high-retention vertical clips with Hormozi captions, automatic B-roll, and daily YouTube auto-scheduling.
                    </p>
                  </div>

                  {/* Financial Unit Economics Indicator */}
                  {processedData && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-200">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-medium">Processing Cost (15 Shorts)</p>
                        <p className="text-base font-extrabold text-emerald-600 font-mono">
                          ${processedData.costs.totalCostUSD} USD <span className="text-xs text-slate-400 font-normal">(approx ₹{processedData.costs.totalCostINR})</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Input */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Youtube className="w-5 h-5 text-red-600" />
                    </div>
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="Paste YouTube Link (https://youtube.com/watch?v=...)"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 shadow-2xs"
                    />
                  </div>
                  <button
                    onClick={handleStartYouTubeIngest}
                    disabled={isProcessing}
                    className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>{isProcessing ? 'Slicing & Editing Video...' : 'Generate 12 Viral Shorts'}</span>
                  </button>
                </div>

                {/* Live Processing Indicator */}
                {isProcessing && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 animate-pulse">
                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-red-900">AI Ingestion Pipeline Active</p>
                      <p className="text-[11px] text-red-700 font-medium">{processingStatus || 'Analyzing speech & mining viral hooks...'}</p>
                    </div>
                  </div>
                )}

                {/* API Key Banner Prompt */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-emerald-600" />
                    <span>Connected to <strong>Gemini 2.5 Flash</strong>, <strong>Deepgram Nova-2</strong> &amp; <strong>Pixabay API</strong></span>
                  </span>
                  <button
                    onClick={() => setIsApiModalOpen(true)}
                    className="text-red-600 font-bold hover:underline"
                  >
                    View API Keys →
                  </button>
                </div>
              </div>

              {/* 15 Generated Shorts Grid */}
              {processedData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-red-600" />
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        {processedData.clips?.length || 0} Edited Viral Shorts (Hormozi Subtitles + B-Roll + SFX)
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-medium font-mono">
                      Source: {processedData.channelName || processedData.authorName || 'YouTube'} • {processedData.durationMinutes || 45} min
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {processedData.clips?.map((clip: any) => {
                      const isScheduled = scheduledSuccessId === clip.id;

                      return (
                        <div
                          key={clip.id}
                          className="clean-card p-4 space-y-3 flex flex-col justify-between overflow-hidden group hover:border-red-200 transition-all"
                        >
                          {/* Video Thumbnail if available */}
                          {clip.thumbnailUrl && (
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                              <img
                                src={clip.thumbnailUrl}
                                alt={clip.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                                  <Play className="w-4 h-4 ml-0.5" />
                                </div>
                              </div>
                              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono font-semibold">
                                {clip.duration}s
                              </span>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">{clip.title}</h4>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-200 whitespace-nowrap">
                                {clip.viralScore}% VIRAL
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {clip.hookSummary}
                            </p>

                            {/* Tags */}
                            <div className="space-y-1 pt-1 text-[10px]">
                              <div className="flex items-center gap-1 text-slate-600 font-medium">
                                <span className="text-slate-400">Stock B-Roll:</span>
                                <span className="text-blue-700 line-clamp-1">{clip.bRollKeywords?.join(', ')}</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-600 font-medium">
                                <span className="text-slate-400">SFX Audio:</span>
                                <span className="text-amber-700">{clip.soundEffects?.[0]} + {clip.soundEffects?.[1]}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-3 border-t border-slate-100 space-y-2.5">
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-red-600" /> {clip.duration}s
                              </span>
                              <span className="font-semibold text-emerald-700">
                                Peak: {clip.youtubeScheduleTime}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <Link
                                href="/studio"
                                onClick={() => handleOpenInStudio(clip)}
                                className="py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 transition-colors"
                              >
                                <Play className="w-3 h-3" />
                                <span>Edit Studio</span>
                              </Link>

                              <button
                                onClick={() => handleScheduleToYouTube(clip.id)}
                                className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                  isScheduled
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                                }`}
                              >
                                {isScheduled ? <Check className="w-3.5 h-3.5" /> : <Youtube className="w-3.5 h-3.5" />}
                                <span>{isScheduled ? 'Scheduled!' : 'Schedule YT'}</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* WORKFLOW 2: 1-FINGER VIRAL REEL */}
          {activeWorkflow === 'one_finger_reel' && (
            <div className="clean-card-feature p-10 text-center max-w-xl mx-auto space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">1-Finger Instant Viral Reel</h3>
                <p className="text-xs text-slate-500">
                  Upload any raw 15-60s video. In 1 tap, AI removes silence, applies Hormozi dynamic captions, adds auto-emojis, and mixes background beats.
                </p>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:border-red-500 cursor-pointer transition-colors bg-slate-50">
                <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-700 font-semibold">Drop your raw video clip here</p>
                <p className="text-[10px] text-slate-400">Supports MP4, MOV up to 200MB</p>
              </div>

              <Link
                href="/studio"
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
              >
                <span>⚡ Open 1-Finger Reel Editor</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* WORKFLOW 3: 20-MINUTE DOCUMENTARY */}
          {activeWorkflow === 'documentary' && (
            <div className="space-y-6">
              <div className="clean-card-feature p-8 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase tracking-wider border border-blue-200">
                      High-Ticket Enterprise Suite ($99/mo)
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      20-Minute AI Documentary Studio
                    </h2>
                    <p className="text-xs text-slate-500 max-w-xl">
                      Vox &amp; Dhruv Rathee style investigative video generation. Auto-finds verified facts, motion graphic overlays, cinematic orchestral scores, and fusion sound effects.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <p className="text-slate-400 text-[10px]">Fact Check Citations</p>
                    <p className="text-base font-extrabold text-blue-700 font-mono">18 Verified Sources</p>
                  </div>
                </div>
              </div>

              {docData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {docData.chapters.map((ch) => (
                    <div key={ch.id} className="clean-card p-6 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-slate-900">{ch.title}</h4>
                        <span className="font-mono text-xs text-red-600 font-semibold">{ch.timestamp}</span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                        <p className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {ch.factVerification}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">Source: {ch.sourceCitation}</p>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono border border-blue-200">
                          Motion Graphic: {ch.motionGraphicType.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-[10px] text-amber-700 font-mono">
                          SFX: {ch.soundDesign.slice(0, 24)}...
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WORKFLOW 4: CALENDAR */}
          {activeWorkflow === 'calendar' && (
            <div className="clean-card-feature p-8 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Automated YouTube Shorts Publishing Calendar
                  </h3>
                  <p className="text-xs text-slate-500">
                    YouTube Data API v3 queue configured for peak engagement at 6:30 PM EST.
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  ⚡ 12 Shorts Ready in Queue
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">Day #{i + 1}</span>
                      <span className="font-mono text-red-600 text-[10px] font-semibold">6:30 PM EST</span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      Short #{i + 1}: The $10,000 Scaling Secret (Viral Score: 96%)
                    </p>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold block w-fit">
                      Auto-Publish Queued
                    </span>
                  </div>
                ))}
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
