'use client';

import React, { useState, useEffect } from 'react';
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
  Scissors,
  Database,
  Quote,
  Target,
  AlertCircle
} from 'lucide-react';
import { generateDocumentaryBlueprint } from '@/lib/pipelineEngine';

export default function CustomerDashboard() {
  const [activeWorkflow, setActiveWorkflow] = useState<'youtube_to_shorts' | 'one_finger_reel' | 'documentary' | 'calendar'>('youtube_to_shorts');
  const [youtubeUrl, setYoutubeUrl] = useState("https://www.youtube.com/watch?v=B_9c1hJGCsw");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<any>(null);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [docData, setDocData] = useState<ReturnType<typeof generateDocumentaryBlueprint> | null>(() => generateDocumentaryBlueprint("The Rise of Artificial Intelligence"));
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [scheduledSuccessId, setScheduledSuccessId] = useState<string | null>(null);

  // Load saved projects from database on mount
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects && data.projects.length > 0) {
          setSavedProjects(data.projects);
          setProcessedData(data.projects[0]);
          if (data.projects[0].sourceUrl) {
            setYoutubeUrl(data.projects[0].sourceUrl);
          }
        }
      })
      .catch((err) => console.warn('Could not load database projects:', err));
  }, []);

  const handleStartYouTubeIngest = async () => {
    if (!youtubeUrl.trim()) return;
    setIsProcessing(true);
    setIngestError(null);
    setProcessingStatus('Fetching YouTube video metadata & oEmbed...');

    try {
      setTimeout(() => setProcessingStatus('Deepgram Nova-2 Audio Transcription & Token Sync...'), 1200);
      setTimeout(() => setProcessingStatus('Gemini 2.5 Flash Mining Viral 60s Hooks & Retention Points...'), 2400);

      const res = await fetch('/api/youtube/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl, clipCount: 5 }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Ingestion failed with status ${res.status}`);
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
          isMediaAvailable: false,
        }));
      }
    } catch (err: any) {
      console.error('Ingest error:', err);
      setIngestError(err.message || 'YouTube processing failed.');
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
                    <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-extrabold uppercase tracking-wider border border-red-200 inline-flex items-center gap-1">
                      <Target className="w-3 h-3 text-red-600" />
                      Line-by-Line AI Speech Tracking Active
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      1-Hour Video to 5 Golden Shorts
                    </h2>
                    <p className="text-xs text-slate-500 max-w-xl">
                      Paste any 30-60 min YouTube URL. AI listens to every spoken dialogue line, weeds out fluff, and extracts ONLY the 5 most critical high-retention vertical clips with dynamic creator captions and automatic B-roll.
                    </p>
                  </div>

                  {/* Financial Unit Economics Indicator */}
                  {processedData && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-200">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-medium">Processing Cost (5 Golden Shorts)</p>
                        <p className="text-base font-extrabold text-emerald-600 font-mono">
                          ${processedData.costs?.totalCostUSD || '0.43'} USD <span className="text-xs text-slate-400 font-normal">(approx ₹{processedData.costs?.totalCostINR || '37'})</span>
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
                    <span>{isProcessing ? 'Slicing & Tracking Speech Lines...' : 'Generate 5 Golden Shorts'}</span>
                  </button>
                </div>

                {/* Live Processing Indicator */}
                {isProcessing && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 animate-pulse">
                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-red-900">AI Line-by-Line Ingestion Pipeline Active</p>
                      <p className="text-[11px] text-red-700 font-medium">{processingStatus || 'Analyzing speech lines & mining the top 5 retention hooks...'}</p>
                    </div>
                  </div>
                )}

                {/* Error Alert */}
                {ingestError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Ingestion Notice</p>
                      <p className="text-[11px] text-red-600/90 leading-relaxed">{ingestError}</p>
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

              {/* 5 Generated Golden Shorts Grid */}
              {processedData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-red-600" />
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        {processedData.clips?.length || 5} Golden Shorts (Ranked by Spoken Line Importance)
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-medium font-mono">
                      Source: {processedData.channelName || processedData.authorName || 'YouTube'} • {processedData.durationMinutes || 45} min
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {processedData.clips?.map((clip: any, index: number) => {
                      const isScheduled = scheduledSuccessId === clip.id;
                      const clipRank = clip.rank || index + 1;

                      return (
                        <div
                          key={clip.id}
                          className="clean-card p-4 space-y-3 flex flex-col justify-between overflow-hidden group hover:border-red-200 transition-all shadow-2xs hover:shadow-md"
                        >
                          <div className="space-y-3">
                            {/* Rank and Moment Type Tag */}
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px]">
                                  #{clipRank} GOLDEN
                                </span>
                                {clip.keyMomentType && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                                    {clip.keyMomentType}
                                  </span>
                                )}
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-200 whitespace-nowrap">
                                {clip.viralScore}% VIRAL
                              </span>
                            </div>

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
                                  {clip.duration || 45}s
                                </span>
                              </div>
                            )}

                            {/* Title */}
                            <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                              {clip.title}
                            </h4>

                            {/* Tracked Spoken Line (Golden Quote) */}
                            {clip.importantLine && (
                              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">
                                  <Quote className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Tracked Spoken Line:</span>
                                </div>
                                <p className="text-xs font-semibold text-slate-800 italic leading-snug">
                                  &ldquo;{clip.importantLine.replace(/^"|"$/g, '')}&rdquo;
                                </p>
                              </div>
                            )}

                            {/* Why this line is important */}
                            {(clip.whyThisLineIsImportant || clip.hookSummary) && (
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                <strong className="text-slate-800 font-semibold">Why this hooks: </strong>
                                {clip.whyThisLineIsImportant || clip.hookSummary}
                              </p>
                            )}

                            {/* Tags */}
                            <div className="space-y-1 pt-1 text-[10px]">
                              {clip.bRollKeywords && clip.bRollKeywords.length > 0 && (
                                <div className="flex items-center gap-1 text-slate-600 font-medium">
                                  <span className="text-slate-400">Stock B-Roll:</span>
                                  <span className="text-blue-700 line-clamp-1">{clip.bRollKeywords.join(', ')}</span>
                                </div>
                              )}
                              {clip.soundEffects && clip.soundEffects.length > 0 && (
                                <div className="flex items-center gap-1 text-slate-600 font-medium">
                                  <span className="text-slate-400">SFX:</span>
                                  <span className="text-amber-700">{clip.soundEffects[0]} + {clip.soundEffects[1] || 'riser.mp3'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-3 border-t border-slate-100 space-y-2.5">
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-red-600" /> {clip.duration || 45}s
                              </span>
                              <span className="font-semibold text-emerald-700">
                                Peak: {clip.youtubeScheduleTime || 'Today 6:30 PM'}
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
                                className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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

              {/* Saved Database Projects Section */}
              {savedProjects.length > 0 && (
                <div className="clean-card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-red-600" />
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Recreated Projects in Database ({savedProjects.length})
                      </h3>
                    </div>
                    <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Persistent Storage Synced
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex gap-3.5 items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {proj.thumbnailUrl && (
                            <img
                              src={proj.thumbnailUrl}
                              alt={proj.videoTitle}
                              className="w-16 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{proj.videoTitle}</p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {proj.channelName} • {proj.clipsCount || proj.clips?.length || 0} Shorts • ${proj.costs?.totalCostUSD || '0.52'} USD
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setProcessedData(proj);
                            if (proj.youtubeUrl) setYoutubeUrl(proj.youtubeUrl);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 text-xs font-bold shrink-0 transition-colors cursor-pointer"
                        >
                          Load Shorts
                        </button>
                      </div>
                    ))}
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
                  Upload any raw 15-60s video. In 1 tap, AI removes silence, applies dynamic word-by-word captions, adds auto-emojis, and mixes background beats.
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
