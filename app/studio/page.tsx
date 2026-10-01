'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { VideoUploader } from '@/components/VideoUploader';
import { VideoPreviewPlayer, VideoPreviewPlayerRef } from '@/components/VideoPreviewPlayer';
import { CreatorTimeline } from '@/components/CreatorTimeline';
import { IntelligenceTab } from '@/components/tabs/IntelligenceTab';
import { TypographyTab } from '@/components/tabs/TypographyTab';
import { AudioStudioTab } from '@/components/tabs/AudioStudioTab';
import { VisualLayoutTab } from '@/components/tabs/VisualLayoutTab';
import { SocialPublishTab } from '@/components/tabs/SocialPublishTab';
import { AgencyAffiliateTab } from '@/components/tabs/AgencyAffiliateTab';
import { ExportModal } from '@/components/ExportModal';
import { PricingModal } from '@/components/PricingModal';
import { 
  SubtitleStyle, 
  ViralClip, 
  WordTimestamp, 
  VisualLayoutSettings, 
  AudioStudioSettings, 
  SocialPublishSettings, 
  AgencySettings,
  EditOperation,
  Project
} from '@/lib/types';
import { 
  DEMO_VIDEO_URL, 
  DEMO_WORDS, 
  DEMO_VIRAL_CLIPS, 
  PRESET_STYLES, 
  AI_SOCIAL_METADATA 
} from '@/lib/sampleData';
import { 
  Download, 
  RefreshCw, 
  Flame, 
  Type, 
  Mic2, 
  SplitSquareVertical, 
  Share2, 
  Building2,
  Key,
  Scissors,
  Upload,
  Youtube,
  Play,
  AlertCircle,
  FileVideo
} from 'lucide-react';

export default function StudioPage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("Untitled_Project.mp4");
  const [words, setWords] = useState<WordTimestamp[]>([]);
  const [clips, setClips] = useState<ViralClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isMediaAvailable, setIsMediaAvailable] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeCuts, setActiveCuts] = useState<EditOperation[]>([]);

  // Active Navigation Tab for Panels
  const [activeTab, setActiveTab] = useState<'intelligence' | 'typography' | 'audio' | 'layout' | 'social' | 'agency'>('intelligence');

  // Quick YouTube Ingest State inside Studio
  const [quickYoutubeUrl, setQuickYoutubeUrl] = useState('');
  const [isIngestingYoutube, setIsIngestingYoutube] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Subtitle styling using original Clipper preset 'impact'
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(PRESET_STYLES.impact);

  // Visual layout settings
  const [visualSettings, setVisualSettings] = useState<VisualLayoutSettings>({
    splitScreenEnabled: false,
    satisfyingVideoType: 'subway',
    showProgressBar: true,
    progressBarColor: '#E11D48',
    progressBarHeight: 8,
    showCustomLogo: false,
    customLogoText: '@ClipperCreator',
    logoPosition: 'top-right',
    showIntroHook: true,
    introHookText: 'WAIT FOR THE DROP ⚡',
    backgroundBlur: false,
  });

  // Audio settings
  const [audioSettings, setAudioSettings] = useState<AudioStudioSettings>({
    studioSoundEnabled: true,
    backgroundMusicEnabled: false,
    musicTrack: 'lofi',
    musicVolume: 0.30,
    autoDucking: true,
    dubbingEnabled: false,
    dubbingLanguage: 'hi',
    volumeNormalization: true,
  });

  // Social publishing settings
  const [socialSettings, setSocialSettings] = useState<SocialPublishSettings>({
    accounts: {
      tiktok: false,
      youtubeShorts: false,
      instagramReels: false,
    },
    scheduledTime: "18:30",
    viralTitle: AI_SOCIAL_METADATA.viralTitles[0],
    viralDescription: AI_SOCIAL_METADATA.viralDescription,
    hashtags: AI_SOCIAL_METADATA.hashtags,
  });

  // Agency & Affiliate settings
  const [agencySettings, setAgencySettings] = useState<AgencySettings>({
    workspaceName: "My Creator Workspace",
    clientName: "Podcast Studio",
    whiteLabelEnabled: false,
    affiliateEarnings: 0,
    referralCode: "CLIPPER",
    referralCount: 0,
  });

  const [isProUser, setIsProUser] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  const playerRef = useRef<VideoPreviewPlayerRef>(null);

  // Load project from localStorage or URL parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('clipper_active_project');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.videoTitle) {
            setFileName(`${parsed.videoTitle.slice(0, 36)}.mp4`);
          }
          if (parsed.videoUrl) {
            setVideoUrl(parsed.videoUrl);
          }
          if (parsed.activeClip?.words && parsed.activeClip.words.length > 0) {
            setWords(parsed.activeClip.words);
          } else if (parsed.transcript?.words && parsed.transcript.words.length > 0) {
            setWords(parsed.transcript.words);
          }
          if (parsed.clips && parsed.clips.length > 0) {
            setClips(parsed.clips);
            setActiveClipId(parsed.activeClip?.id || parsed.clips[0].id);
          }
          if (typeof parsed.isMediaAvailable === 'boolean') {
            setIsMediaAvailable(parsed.isMediaAvailable);
          }
        }
      } catch (err) {
        console.warn('Error reading saved project:', err);
      }
    }
  }, []);

  // Explicit Demo Loader (Isolates demo data from real production flow)
  const handleLoadDemo = () => {
    setIsDemoMode(true);
    setVideoUrl(DEMO_VIDEO_URL);
    setFileName("Demo_Entrepreneur_Mindset.mp4");
    setWords(DEMO_WORDS);
    setClips(DEMO_VIRAL_CLIPS);
    setActiveClipId(DEMO_VIRAL_CLIPS[0].id);
    setIsMediaAvailable(true);
  };

  // Video Selected via File Upload
  const handleVideoSelected = (url: string, name: string) => {
    setIsDemoMode(false);
    setVideoUrl(url);
    setFileName(name);
    setIsMediaAvailable(true);
    // In a full file upload, transcription is performed; provide empty initial clips until transcribed
    if (clips.length === 0) {
      setWords([]);
      setClips([]);
      setActiveClipId(null);
    }
  };

  // Quick Ingest from YouTube URL
  const handleIngestYouTube = async () => {
    if (!quickYoutubeUrl.trim()) return;
    setIsIngestingYoutube(true);
    setIngestError(null);

    try {
      const res = await fetch('/api/youtube/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: quickYoutubeUrl, clipCount: 5 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to ingest YouTube video.');
      }

      setIsDemoMode(false);
      setFileName(`${data.videoTitle?.slice(0, 36) || 'YouTube_Clip'}.mp4`);
      setVideoUrl(data.sourceUrl);
      setIsMediaAvailable(false); // YouTube captions ready, video upload required to render
      if (data.transcript?.words) {
        setWords(data.transcript.words);
      }
      if (data.clips && data.clips.length > 0) {
        setClips(data.clips);
        setActiveClipId(data.clips[0].id);
      }
      // Save canonical project to localStorage
      localStorage.setItem('clipper_active_project', JSON.stringify(data));
    } catch (err: any) {
      setIngestError(err.message || 'YouTube processing failed.');
    } finally {
      setIsIngestingYoutube(false);
    }
  };

  const activeClip = useMemo(() => {
    return clips.find((c) => c.id === activeClipId) || clips[0] || null;
  }, [clips, activeClipId]);

  const handleSelectClip = (clip: ViralClip) => {
    setActiveClipId(clip.id);
    if (playerRef.current) {
      playerRef.current.seekTo(clip.start);
      setCurrentTime(clip.start);
    }
  };

  const handleJumpToTime = (time: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time);
      setCurrentTime(time);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar onOpenApiModal={() => setIsApiModalOpen(true)} />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate max-w-xs sm:max-w-md">
              {fileName}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 uppercase tracking-wider">
              Studio
            </span>
            {isDemoMode && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                DEMO PROJECT (Sample Mode)
              </span>
            )}
            {!isMediaAvailable && videoUrl && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Captions Sliced • Upload Video for Export
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors shadow-2xs cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>AI Keys</span>
            </button>

            {videoUrl && (
              <button
                type="button"
                onClick={() => {
                  setVideoUrl(null);
                  setIsDemoMode(false);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Change Video</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export 9:16 Video</span>
            </button>
          </div>
        </header>

        {/* Studio Workspace */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {!videoUrl ? (
            /* Section 2: Explicit Empty State for New Users */
            <div className="max-w-3xl mx-auto space-y-8 pt-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
                  <Scissors className="w-6 h-6 -rotate-45" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Import Your First Video
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Upload a video file or paste a YouTube URL to automatically detect viral hooks, generate synced captions, and render vertical shorts.
                </p>
              </div>

              {/* 3 Import Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: File Upload */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-red-600" />
                    <h3 className="text-sm font-bold text-slate-900">Upload Video File</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Supports MP4, MOV, WebM. Ideal for podcasts, talking-head videos, and reels.
                  </p>
                  <VideoUploader onVideoSelected={handleVideoSelected} />
                </div>

                {/* Option 2: Paste YouTube URL */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-600" />
                      <h3 className="text-sm font-bold text-slate-900">Paste YouTube URL</h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      Slices long YouTube videos into top 5 viral shorts using authentic caption cues.
                    </p>
                    <div className="space-y-2 pt-2">
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={quickYoutubeUrl}
                        onChange={(e) => setQuickYoutubeUrl(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-red-500 font-mono"
                      />
                      {ingestError && (
                        <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>{ingestError}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleIngestYouTube}
                    disabled={isIngestingYoutube || !quickYoutubeUrl.trim()}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isIngestingYoutube ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting Captions &amp; Slicing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Ingest &amp; Extract Hooks</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Option 3: Explicit Try Demo Option */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-600 font-medium">
                  Want to explore Clipper Studio first without uploading your own media?
                </p>
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                >
                  ⚡ Try Demo — Explore with Sample Project
                </button>
              </div>
            </div>
          ) : (
            /* Active Studio Workstation */
            <div className="space-y-6">
              {/* Media Notice Banner if Video File Needed */}
              {!isMediaAvailable && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileVideo className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>YouTube Captions Ready:</strong> You can edit captions, hooks, and cuts. To render an authentic 1080x1920 MP4 file via FFmpeg, please provide an uploaded video file.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/mp4,video/quicktime,video/webm';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const localUrl = URL.createObjectURL(file);
                          setVideoUrl(localUrl);
                          setIsMediaAvailable(true);
                        }
                      };
                      input.click();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-2xs"
                  >
                    Upload Video File
                  </button>
                </div>
              )}

              {/* 2-Column Workstation: Center Preview (5 cols) + Controls/Intelligence (7 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Center Preview Column */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4">
                  <VideoPreviewPlayer
                    ref={playerRef}
                    videoUrl={videoUrl}
                    words={words}
                    subtitleStyle={subtitleStyle}
                    visualSettings={visualSettings}
                    audioSettings={audioSettings}
                    isProUser={isProUser}
                    clipStartTime={activeClip?.start || 0}
                  />

                  {/* Multi-Track Creator Timeline */}
                  <CreatorTimeline
                    clip={activeClip}
                    currentTime={currentTime}
                    onSeek={handleJumpToTime}
                    cuts={activeCuts}
                    words={words}
                  />
                </div>

                {/* Right Controls & AI Intelligence Column */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Category Navigation Tabs */}
                  <div className="p-1 rounded-xl bg-white border border-slate-200 grid grid-cols-3 sm:grid-cols-6 gap-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('intelligence')}
                      className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        activeTab === 'intelligence'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Flame className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Hooks &amp; AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('typography')}
                      className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        activeTab === 'typography'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Type className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Captions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('audio')}
                      className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        activeTab === 'audio'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Mic2 className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Audio</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('layout')}
                      className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        activeTab === 'layout'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <SplitSquareVertical className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Layout</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('social')}
                      className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        activeTab === 'social'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Publish</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('agency')}
                      className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        activeTab === 'agency'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Agency</span>
                    </button>
                  </div>

                  {/* Tab Panes */}
                  {activeTab === 'intelligence' && (
                    <IntelligenceTab
                      clips={clips}
                      activeClipId={activeClipId}
                      onSelectClip={handleSelectClip}
                      onJumpToTime={handleJumpToTime}
                      words={words}
                      onApplyCuts={(cuts) => setActiveCuts(cuts)}
                    />
                  )}

                  {activeTab === 'typography' && (
                    <TypographyTab
                      currentStyle={subtitleStyle}
                      onChange={setSubtitleStyle}
                    />
                  )}

                  {activeTab === 'audio' && (
                    <AudioStudioTab
                      settings={audioSettings}
                      onChange={setAudioSettings}
                    />
                  )}

                  {activeTab === 'layout' && (
                    <VisualLayoutTab
                      settings={visualSettings}
                      onChange={setVisualSettings}
                    />
                  )}

                  {activeTab === 'social' && (
                    <SocialPublishTab
                      settings={socialSettings}
                      onChange={setSocialSettings}
                      onJumpToTime={handleJumpToTime}
                    />
                  )}

                  {activeTab === 'agency' && (
                    <AgencyAffiliateTab
                      settings={agencySettings}
                      onChange={setAgencySettings}
                      onOpenPricing={() => setIsPricingOpen(true)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        isProUser={isProUser}
        onToggleProStatus={() => setIsProUser((prev) => !prev)}
      />
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeClip={activeClip}
        sourceUrl={videoUrl || ''}
        subtitleStyle={subtitleStyle}
        visualSettings={visualSettings}
        isProUser={isProUser}
      />
    </div>
  );
}
