'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { VideoUploader } from '@/components/VideoUploader';
import { VideoPreviewPlayer, VideoPreviewPlayerRef } from '@/components/VideoPreviewPlayer';
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
  AgencySettings 
} from '@/lib/types';
import { SAMPLE_VIDEO_URL, SAMPLE_WORDS, SAMPLE_VIRAL_CLIPS, PRESET_STYLES, AI_SOCIAL_METADATA } from '@/lib/sampleData';
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
  ShieldCheck,
  Scissors
} from 'lucide-react';

export default function StudioPage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(SAMPLE_VIDEO_URL);
  const [fileName, setFileName] = useState<string>("Entrepreneur_Mindset_Hook.mp4");
  const [words, setWords] = useState<WordTimestamp[]>(SAMPLE_WORDS);
  const [clips, setClips] = useState<ViralClip[]>(SAMPLE_VIRAL_CLIPS);
  const [activeClipId, setActiveClipId] = useState<string | null>("clip-1");
  
  // Active Navigation Tab for Left & Right Panels
  const [activeTab, setActiveTab] = useState<'intelligence' | 'typography' | 'audio' | 'layout' | 'social' | 'agency'>('intelligence');

  // Load project from localStorage if coming from Dashboard YouTube Slicer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('clipper_active_project');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.videoTitle) {
            setFileName(`${parsed.videoTitle.slice(0, 36)}.mp4`);
          }
          if (parsed.activeClip?.videoUrl) {
            setVideoUrl(parsed.activeClip.videoUrl);
          } else if (parsed.videoUrl) {
            setVideoUrl(parsed.videoUrl);
          }
          if (parsed.activeClip) {
            if (parsed.activeClip.words && parsed.activeClip.words.length > 0) {
              setWords(parsed.activeClip.words);
            }
            if (parsed.activeClip.title) {
              setSocialSettings(prev => ({
                ...prev,
                viralTitle: parsed.activeClip.title,
                viralDescription: parsed.activeClip.hookSummary || prev.viralDescription,
              }));
            }
          }
          if (parsed.clips && parsed.clips.length > 0) {
            const mappedClips: ViralClip[] = parsed.clips.map((c: any, i: number) => ({
              id: c.id || `clip-${i + 1}`,
              title: c.title,
              hookSummary: c.hookSummary || '',
              start: c.start || 0,
              end: c.end || 45,
              viralScore: c.viralScore || 90,
              tags: c.bRollKeywords || ['viral', 'business'],
              hookStrength: Math.round((c.viralScore || 90) * 0.95),
              retentionEstimate: c.viralScore || 92,
              energyLevel: 'High' as const,
            }));
            setClips(mappedClips);
            if (parsed.activeClip?.id) {
              setActiveClipId(parsed.activeClip.id);
            }
          }
        }
      } catch (err) {
        console.warn('Error reading saved project:', err);
      }
    }
  }, []);

  // Category 2: Typography & Subtitle settings
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(PRESET_STYLES.hormozi);

  // Category 4: Visual Layout settings
  const [visualSettings, setVisualSettings] = useState<VisualLayoutSettings>({
    splitScreenEnabled: false,
    satisfyingVideoType: 'subway',
    showProgressBar: true,
    progressBarColor: '#FF0000',
    progressBarHeight: 8,
    showCustomLogo: true,
    customLogoText: '@CreatorLife',
    logoPosition: 'top-right',
    showIntroHook: true,
    introHookText: 'WAIT TILL THE END 😱',
    backgroundBlur: false
  });

  // Category 3: Audio Studio settings
  const [audioSettings, setAudioSettings] = useState<AudioStudioSettings>({
    studioSoundEnabled: true,
    backgroundMusicEnabled: true,
    musicTrack: 'lofi',
    musicVolume: 0.35,
    autoDucking: true,
    dubbingEnabled: false,
    dubbingLanguage: 'hi',
    volumeNormalization: true
  });

  // Category 5: Social Publishing settings
  const [socialSettings, setSocialSettings] = useState<SocialPublishSettings>({
    accounts: {
      tiktok: true,
      youtubeShorts: true,
      instagramReels: true
    },
    scheduledTime: "18:30",
    viralTitle: AI_SOCIAL_METADATA.viralTitles[0],
    viralDescription: AI_SOCIAL_METADATA.viralDescription,
    hashtags: AI_SOCIAL_METADATA.hashtags
  });

  // Category 6: Agency & Affiliate settings
  const [agencySettings, setAgencySettings] = useState<AgencySettings>({
    workspaceName: "Viral Agency Alpha",
    clientName: "Podcast King",
    whiteLabelEnabled: false,
    affiliateEarnings: 840,
    referralCode: "CREATOR88",
    referralCount: 44
  });

  // User monetization state
  const [isProUser, setIsProUser] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  const playerRef = useRef<VideoPreviewPlayerRef>(null);

  const handleVideoSelected = (url: string, name: string, isSample: boolean = false) => {
    setVideoUrl(url);
    setFileName(name);
    if (!isSample) {
      setWords(SAMPLE_WORDS);
      setClips(SAMPLE_VIRAL_CLIPS);
      setActiveClipId("clip-1");
    }
  };

  const handleSelectClip = (clip: ViralClip) => {
    setActiveClipId(clip.id);
    if (playerRef.current) {
      playerRef.current.seekTo(clip.start);
    }
  };

  const handleJumpToTime = (time: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex font-sans">
      
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        onOpenApiModal={() => setIsApiModalOpen(true)}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">{fileName}</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
              Clipper Studio
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors shadow-2xs"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>AI Keys</span>
            </button>

            <button
              onClick={() => setVideoUrl(null)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change Video</span>
            </button>

            <button
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all hover:scale-[1.02]"
            >
              <Download className="w-4 h-4" />
              <span>Export 9:16 Video</span>
            </button>
          </div>
        </header>

        {/* Studio Workspace */}
        <main className="p-8 max-w-6xl w-full mx-auto space-y-6">
          {!videoUrl ? (
            /* Upload State */
            <div className="clean-card-feature p-10 max-w-xl mx-auto text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
                <Scissors className="w-6 h-6 -rotate-45" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">Import Video into Clipper Studio</h2>
                <p className="text-xs text-slate-500">
                  Upload any horizontal or vertical video. Clipper frames it to 9:16 and applies dynamic Hormozi captions.
                </p>
              </div>
              <VideoUploader onVideoSelected={handleVideoSelected} />
            </div>
          ) : (
            /* Active 2-Column Workstation */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Phone Mockup Preview Column (5 cols) */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center order-1 lg:order-2">
                <VideoPreviewPlayer
                  ref={playerRef}
                  videoUrl={videoUrl}
                  words={words}
                  subtitleStyle={subtitleStyle}
                  visualSettings={visualSettings}
                  audioSettings={audioSettings}
                  isProUser={isProUser}
                />
              </div>

              {/* Controls Column (7 cols) */}
              <div className="lg:col-span-7 space-y-4 order-2 lg:order-1">
                
                {/* Category Navigation Tabs */}
                <div className="p-1 rounded-xl bg-white border border-slate-200 grid grid-cols-3 sm:grid-cols-6 gap-1 shadow-2xs">
                  
                  <button
                    type="button"
                    onClick={() => setActiveTab('intelligence')}
                    className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 ${
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
                    className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 ${
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
                    className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 ${
                      activeTab === 'audio'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Mic2 className="w-4 h-4" />
                    <span className="text-[10px] font-bold">Audio FX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('layout')}
                    className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 ${
                      activeTab === 'layout'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <SplitSquareVertical className="w-4 h-4" />
                    <span className="text-[10px] font-bold">Layouts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('social')}
                    className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 ${
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
                    className={`py-2 px-1 text-center rounded-lg transition-all flex flex-col items-center gap-1 ${
                      activeTab === 'agency'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="text-[10px] font-bold">Agency</span>
                  </button>

                </div>

                {/* Tab Content Display */}
                <div>
                  {activeTab === 'intelligence' && (
                    <IntelligenceTab
                      clips={clips}
                      activeClipId={activeClipId}
                      onSelectClip={handleSelectClip}
                      onJumpToTime={handleJumpToTime}
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

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        isProUser={isProUser}
        onOpenPricing={() => setIsPricingOpen(true)}
        videoElement={playerRef.current?.getVideoElement() || null}
        canvasElement={playerRef.current?.getCanvasElement() || null}
      />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        isProUser={isProUser}
        onToggleProStatus={() => setIsProUser(prev => !prev)}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
      />

    </div>
  );
}
