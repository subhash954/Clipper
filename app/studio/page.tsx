'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { CreateProjectModal } from '@/components/CreateProjectModal';
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
  Sparkles, 
  Type, 
  Mic2, 
  Crop, 
  Share2, 
  Building2,
  Key,
  Scissors,
  Upload,
  Youtube,
  Play,
  AlertCircle,
  FileVideo,
  Undo2,
  Redo2,
  Bot,
  Sliders,
  Layers,
  ChevronRight,
  Eye
} from 'lucide-react';

export default function StudioPage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("My Podcast Short");
  const [words, setWords] = useState<WordTimestamp[]>([]);
  const [clips, setClips] = useState<ViralClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isMediaAvailable, setIsMediaAvailable] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeCuts, setActiveCuts] = useState<EditOperation[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Active Tool for Editor (Section 14)
  const [activeTool, setActiveTool] = useState<'moments' | 'captions' | 'reframe' | 'broll' | 'audio' | 'publish'>('moments');

  // Subtitle styling using original Clipper preset 'signal'
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(PRESET_STYLES.signal || PRESET_STYLES.impact);

  // Visual layout settings
  const [visualSettings, setVisualSettings] = useState<VisualLayoutSettings>({
    splitScreenEnabled: false,
    satisfyingVideoType: 'none',
    showProgressBar: true,
    progressBarColor: '#06B6D4',
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

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const playerRef = useRef<VideoPreviewPlayerRef>(null);

  // Load project from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('clipper_active_project');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.videoTitle) {
            setProjectName(parsed.videoTitle.slice(0, 48));
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

  // Explicit Demo Loader (Section 2)
  const handleLoadDemo = () => {
    setIsDemoMode(true);
    setVideoUrl(DEMO_VIDEO_URL);
    setProjectName("Demo Entrepreneur Mindset");
    setWords(DEMO_WORDS);
    setClips(DEMO_VIRAL_CLIPS);
    setActiveClipId(DEMO_VIRAL_CLIPS[0].id);
    setIsMediaAvailable(true);
  };

  const handleVideoSelected = (url: string, name: string) => {
    setIsDemoMode(false);
    setVideoUrl(url);
    setProjectName(name.replace(/\.[^/.]+$/, ""));
    setIsMediaAvailable(true);
    if (clips.length === 0) {
      setWords([]);
      setClips([]);
      setActiveClipId(null);
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

  const aiToolsList = [
    { id: 'moments', label: 'AI Moments', icon: Sparkles, desc: 'Signal & Retention' },
    { id: 'captions', label: 'Typography', icon: Type, desc: 'Presets & Word Sync' },
    { id: 'reframe', label: 'Reframe', icon: Crop, desc: '9:16 Auto Crop' },
    { id: 'broll', label: 'B-Roll', icon: Layers, desc: 'Visual Overlays' },
    { id: 'audio', label: 'Audio & Music', icon: Mic2, desc: 'SFX & Voice Ducking' },
    { id: 'publish', label: 'Distribution', icon: Share2, desc: 'Scheduling & Tags' },
  ] as const;

  return (
    <AppShell onOpenCreateProject={() => setIsCreateModalOpen(true)}>
      
      {/* 1. TOP CONTEXT BAR (Section 21) */}
      <header className="h-14 bg-[#111827] border-b border-[#1F2937] px-6 flex items-center justify-between sticky top-0 z-30 select-none">
        
        {/* Left: Project Name + Saved Status */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-xs font-bold text-white bg-transparent hover:bg-slate-800/40 focus:bg-[#0E1524] px-2 py-1 rounded-lg border border-transparent focus:border-cyan-500/50 outline-hidden transition-all truncate max-w-xs sm:max-w-md"
            title="Click to rename project"
          />
          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" /> Saved
          </span>
          {isDemoMode && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              DEMO PROJECT
            </span>
          )}
        </div>

        {/* Center: Undo / Redo / AI Assistant */}
        <div className="hidden md:flex items-center gap-1 bg-[#0E1524] border border-[#283344] p-1 rounded-xl">
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Undo (⌘Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Redo (⇧⌘Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={() => setActiveTool('moments')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Assistant</span>
          </button>
        </div>

        {/* Right: Change Video & Export Actions */}
        <div className="flex items-center gap-2.5">
          {videoUrl && (
            <button
              type="button"
              onClick={() => {
                setVideoUrl(null);
                setIsDemoMode(false);
              }}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change Video</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export 9:16 Video</span>
          </button>
        </div>

      </header>

      {/* 2. EDITOR MAIN WORKSPACE (Section 14: 3-column + bottom timeline) */}
      <main className="p-6 max-w-[1600px] w-full mx-auto space-y-6">
        
        {!videoUrl ? (
          /* Empty State for New Project */
          <div className="max-w-2xl mx-auto space-y-8 pt-8">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 flex items-center justify-center mx-auto">
                <Scissors className="w-6 h-6 -rotate-45" />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Import Your Video to Begin
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Upload raw footage or paste a YouTube URL to automatically detect high-retention moments and sync word captions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: File Upload */}
              <div className="clipper-card p-6 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <Upload className="w-4 h-4" />
                  <span>Upload Local File</span>
                </div>
                <p className="text-xs text-slate-400">
                  Directly process MP4, MOV, or WebM videos.
                </p>
                <VideoUploader onVideoSelected={handleVideoSelected} />
              </div>

              {/* Option 2: YouTube Import */}
              <div className="clipper-card p-6 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                    <Youtube className="w-4 h-4 text-red-500" />
                    <span>Paste YouTube URL</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Extract top 5 moments from official caption cues.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open URL Importer</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Option 3: Explicit Demo Mode */}
            <div className="p-4 rounded-xl bg-[#0E1524] border border-[#283344] text-center space-y-2">
              <p className="text-xs text-slate-400">
                Want to test Clipper Studio immediately without uploading your own media?
              </p>
              <button
                type="button"
                onClick={handleLoadDemo}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold border border-slate-700 shadow-sm transition-colors cursor-pointer"
              >
                ⚡ Explore Demo Project (Pre-Loaded Clip)
              </button>
            </div>
          </div>
        ) : (
          /* Active Workstation (3-Column Layout + Bottom Timeline) */
          <div className="space-y-6">
            
            {/* Notice if Media File is needed for rendering */}
            {!isMediaAvailable && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileVideo className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Captions &amp; Moments Sliced:</strong> You can edit captions, hooks, and cuts. Provide the source video file to compile the real 1080x1920 MP4 via FFmpeg.
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
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shrink-0 cursor-pointer shadow-sm"
                >
                  Attach Video File
                </button>
              </div>
            )}

            {/* 3-COLUMN WORKSPACE: LEFT TOOLS (2 cols) + CENTER PREVIEW (5 cols) + RIGHT PROPERTIES (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* COLUMN 1: AI Tools Menu (2 cols on large screen) */}
              <div className="lg:col-span-2 space-y-1 bg-[#111827] border border-[#283344] p-2 rounded-2xl">
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  AI Tools
                </p>
                {aiToolsList.map((tool) => {
                  const isActive = activeTool === tool.id;
                  const Icon = tool.icon;

                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveTool(tool.id)}
                      className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold leading-tight">{tool.label}</p>
                        <p className="text-[10px] text-slate-500 truncate">{tool.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* COLUMN 2: Video Preview Player (5 cols) */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4">
                <VideoPreviewPlayer
                  ref={playerRef}
                  videoUrl={videoUrl}
                  words={words}
                  subtitleStyle={subtitleStyle}
                  visualSettings={visualSettings}
                  audioSettings={audioSettings}
                  isProUser={false}
                  clipStartTime={activeClip?.start || 0}
                />
              </div>

              {/* COLUMN 3: Properties & Active Tool Panel (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {activeTool === 'moments' && (
                  <IntelligenceTab
                    clips={clips}
                    activeClipId={activeClipId}
                    onSelectClip={handleSelectClip}
                    onJumpToTime={handleJumpToTime}
                    words={words}
                    onApplyCuts={(cuts) => setActiveCuts(cuts)}
                  />
                )}

                {activeTool === 'captions' && (
                  <TypographyTab
                    currentStyle={subtitleStyle}
                    onChange={(st) => setSubtitleStyle(st)}
                  />
                )}

                {activeTool === 'reframe' && (
                  <VisualLayoutTab
                    settings={visualSettings}
                    onChange={(vs) => setVisualSettings(vs)}
                    bRollKeywords={activeClip?.bRollKeywords || ['business', 'creator', 'podcast']}
                  />
                )}

                {activeTool === 'broll' && (
                  <VisualLayoutTab
                    settings={visualSettings}
                    onChange={(vs) => setVisualSettings(vs)}
                    bRollKeywords={activeClip?.bRollKeywords || ['business', 'growth', 'marketing', 'tech']}
                  />
                )}

                {activeTool === 'audio' && (
                  <AudioStudioTab
                    settings={audioSettings}
                    onChange={(as) => setAudioSettings(as)}
                  />
                )}

                {activeTool === 'publish' && (
                  <SocialPublishTab
                    settings={socialSettings}
                    onChange={(ss) => setSocialSettings(ss)}
                    onJumpToTime={handleJumpToTime}
                  />
                )}
              </div>

            </div>

            {/* BOTTOM SECTION: Full Width AI-First Timeline (Section 15) */}
            <div className="pt-2">
              <CreatorTimeline
                clip={activeClip}
                currentTime={currentTime}
                onSeek={handleJumpToTime}
                cuts={activeCuts}
                words={words}
              />
            </div>

          </div>
        )}

      </main>

      {/* Export Modal with Real FFmpeg Render Pipeline */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeClip={activeClip}
        videoUrl={videoUrl}
        subtitleStyle={subtitleStyle}
        visualSettings={visualSettings}
        isProUser={false}
      />

      {/* Creation Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={(newProject) => {
          if (newProject.sourceUrl) setVideoUrl(newProject.sourceUrl);
          if (newProject.videoTitle) setProjectName(newProject.videoTitle);
          if (newProject.clips) {
            setClips(newProject.clips);
            setActiveClipId(newProject.clips[0]?.id || null);
          }
        }}
      />

    </AppShell>
  );
}
