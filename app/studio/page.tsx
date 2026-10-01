'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { VideoUploader } from '@/components/VideoUploader';
import { VideoPreviewPlayer, VideoPreviewPlayerRef } from '@/components/VideoPreviewPlayer';
import { CreatorTimeline } from '@/components/CreatorTimeline';
import { StyleTab } from '@/components/tabs/StyleTab';
import { CaptionsTab } from '@/components/tabs/CaptionsTab';
import { AIToolsTab } from '@/components/tabs/AIToolsTab';
import { BrollStoryboardTab } from '@/components/tabs/BrollStoryboardTab';
import { IntelligenceTab } from '@/components/tabs/IntelligenceTab';
import { TypographyTab } from '@/components/tabs/TypographyTab';
import { AudioStudioTab } from '@/components/tabs/AudioStudioTab';
import { VisualLayoutTab } from '@/components/tabs/VisualLayoutTab';
import { SocialPublishTab } from '@/components/tabs/SocialPublishTab';
import { AgencyAffiliateTab } from '@/components/tabs/AgencyAffiliateTab';
import { ExportModal } from '@/components/ExportModal';
import { PricingModal } from '@/components/PricingModal';
import { TimelineVersionModal } from '@/components/TimelineVersionModal';
import { CanonicalRenderSpec, EditorCommand } from '@/lib/editor/types';
import { createDefaultRenderSpec, splitClipAt, deleteClip, trimClip } from '@/lib/editor/timelineEngine';
import { EditorCommandManager, createEditorCommand } from '@/lib/editor/commandHistory';
import { parseAIEditCommand } from '@/lib/editor/aiEditCommands';
import { 
  SubtitleStyle, 
  ViralClip, 
  WordTimestamp, 
  VisualLayoutSettings, 
  AudioStudioSettings, 
  SocialPublishSettings, 
  AgencySettings,
  EditOperation,
  Project,
  AspectRatio,
  TrackingMode,
  ReframeTrack,
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
  Palette,
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
  Eye,
  Database,
  Save,
  Check,
  Loader2,
  History,
  X
} from 'lucide-react';

export default function StudioPage() {
  const [projectId, setProjectId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('projectId') || params.get('id') || `proj-${Date.now()}`;
    }
    return `proj-${Date.now()}`;
  });
  const [dbSyncStatus, setDbSyncStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date>(new Date());

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
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isAICommandModalOpen, setIsAICommandModalOpen] = useState(false);
  const [aiCommandInput, setAICommandInput] = useState('');
  const [isAICommandRunning, setIsAICommandRunning] = useState(false);
  const [canonicalSpec, setCanonicalSpec] = useState<CanonicalRenderSpec | null>(null);
  const commandManagerRef = useRef<EditorCommandManager | null>(null);

  // Active Tool for Editor (Workflow inspired by modern AI Video SaaS)
  const [activeTool, setActiveTool] = useState<
    'style' | 'captions' | 'ai-tools' | 'brolls' | 'reframe' | 'moments' | 'audio' | 'publish'
  >('style');

  // Subtitle styling using original Clipper preset 'signal'
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(PRESET_STYLES.signal || PRESET_STYLES.impact);

  // Auto Reframe State
  const [reframeTrack, setReframeTrack] = useState<ReframeTrack | null>(null);
  const [isReframeLoading, setIsReframeLoading] = useState(false);
  const [reframeStatus, setReframeStatus] = useState('');

  // Visual layout settings
  const [visualSettings, setVisualSettings] = useState<VisualLayoutSettings>({
    splitScreenEnabled: false,
    satisfyingVideoType: 'none',
    showProgressBar: true,
    progressBarColor: '#DC2626',
    progressBarHeight: 8,
    showCustomLogo: false,
    customLogoText: '@ClipperCreator',
    logoPosition: 'top-right',
    showIntroHook: true,
    introHookText: 'WAIT FOR THE DROP ⚡',
    backgroundBlur: false,
    aspectRatio: '9:16',
    trackingMode: 'center',
    manualPosition: { x: 0.5, y: 0.5, zoom: 1.0 },
    lockFraming: false,
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

  // Load project: Query DB first if query id present, fallback to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get('projectId') || params.get('id');

      if (queryId) {
        setProjectId(queryId);
        setDbSyncStatus('saving');
        fetch(`/api/projects?id=${queryId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.project) {
              const p = data.project;
              if (p.title) setProjectName(p.title);
              if (p.sourceUrl) setVideoUrl(p.sourceUrl);
              if (p.clips && p.clips.length > 0) {
                setClips(p.clips);
                setActiveClipId(p.clips[0].id);
                if (p.clips[0].words && p.clips[0].words.length > 0) {
                  setWords(p.clips[0].words);
                }
              }
              if (p.transcript?.words && p.transcript.words.length > 0 && (!p.clips || p.clips.length === 0)) {
                setWords(p.transcript.words);
              }
              if (typeof p.isMediaAvailable === 'boolean') {
                setIsMediaAvailable(p.isMediaAvailable);
              }
              setDbSyncStatus('saved');
            }
          })
          .catch((err) => {
            console.warn('Could not load project from database:', err);
            setDbSyncStatus('error');
          });
      } else {
        // Fallback to localStorage active project
        try {
          const saved = localStorage.getItem('clipper_active_project');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.id) setProjectId(parsed.id);
            if (parsed.videoTitle) setProjectName(parsed.videoTitle.slice(0, 48));
            if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
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
          console.warn('Error reading saved project from localStorage:', err);
        }
      }
    }
  }, []);

  // Save project directly to persistent database (/api/projects)
  const handleSaveToDatabase = async () => {
    setDbSyncStatus('saving');
    try {
      const projectPayload = {
        id: projectId,
        title: projectName,
        sourceUrl: videoUrl,
        clips: clips.map((c) => (c.id === activeClipId ? { ...c, words } : c)),
        words: words,
        status: 'completed',
        isMediaAvailable: isMediaAvailable,
        costs: {
          deepgramSTTCost: 0.19,
          geminiFlashLLMCost: 0.002,
          stockBRollCost: 0.0,
          totalCostUSD: 0.35,
          totalCostINR: 30,
        },
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectPayload),
      });

      if (res.ok) {
        setDbSyncStatus('saved');
        setLastSavedAt(new Date());
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'clipper_active_project',
            JSON.stringify({
              id: projectId,
              videoTitle: projectName,
              videoUrl: videoUrl,
              activeClip: activeClip,
              clips: clips,
              isMediaAvailable: isMediaAvailable,
            })
          );
        }
      } else {
        setDbSyncStatus('error');
      }
    } catch (err) {
      console.error('Failed to sync to database:', err);
      setDbSyncStatus('error');
    }
  };

  // Debounced Auto-Save to Database whenever project state updates
  useEffect(() => {
    if (!videoUrl && clips.length === 0) return;
    const timer = setTimeout(() => {
      handleSaveToDatabase();
    }, 2500);
    return () => clearTimeout(timer);
  }, [projectName, words, clips, activeCuts, visualSettings, subtitleStyle]);

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
    if (clip.words && clip.words.length > 0) {
      setWords(clip.words);
    }
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

  const handleTriggerReframe = async (mode: TrackingMode, ratio: AspectRatio) => {
    setIsReframeLoading(true);
    setReframeStatus(mode === 'smart' ? 'Analyzing frames & tracking subjects...' : 'Updating crop...');
    try {
      const res = await fetch('/api/reframe/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          startTime: activeClip?.start || 0,
          duration: activeClip?.duration || 30,
          aspectRatio: ratio,
          trackingMode: mode,
          manualSettings: visualSettings.manualPosition,
          locked: visualSettings.lockFraming,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.track) {
          setReframeTrack(data.track);
          setVisualSettings((prev) => ({
            ...prev,
            reframeTrack: data.track,
            aspectRatio: ratio,
            trackingMode: mode,
          }));
        }
      }
    } catch (err) {
      console.warn('Could not compute reframe track:', err);
    } finally {
      setIsReframeLoading(false);
      setReframeStatus('');
    }
  };

  const handleInsertBroll = (brollOp: EditOperation) => {
    setActiveCuts((prev) => [...prev.filter((c) => c.id !== brollOp.id), brollOp]);
  };

  // Initialize CanonicalRenderSpec whenever videoUrl and metadata are ready (Phase 1 & 2)
  useEffect(() => {
    if (videoUrl && !canonicalSpec) {
      const spec = createDefaultRenderSpec({
        projectId,
        sourceUrl: videoUrl,
        durationSeconds: activeClip?.duration || 30,
        words,
        defaultStyle: subtitleStyle,
      });
      setCanonicalSpec(spec);
      commandManagerRef.current = new EditorCommandManager(spec);
    }
  }, [videoUrl, projectId]);

  // Execute an EditorCommand via Command Manager (Phase 6)
  const executeCommand = (cmd: EditorCommand) => {
    if (!commandManagerRef.current && canonicalSpec) {
      commandManagerRef.current = new EditorCommandManager(canonicalSpec);
    }
    if (commandManagerRef.current) {
      const nextSpec = commandManagerRef.current.executeCommand(cmd);
      setCanonicalSpec(nextSpec);
      setLastSavedAt(new Date());

      // Propagate changes to active studio UI state
      if (nextSpec.cuts) {
        setActiveCuts(
          nextSpec.cuts.map((c) => ({
            id: c.id,
            type: 'CUT' as const,
            start: c.start,
            end: c.end,
            label: c.reason || c.type,
            enabled: true,
            reason: c.type === 'manual' ? 'manual_cut' : c.type,
          }))
        );
      }
      if (nextSpec.captions?.style) {
        setSubtitleStyle(nextSpec.captions.style);
      }
      if (nextSpec.canvas?.aspectRatio) {
        setVisualSettings((prev) => ({ ...prev, aspectRatio: nextSpec.canvas.aspectRatio }));
      }
    }
  };

  const handleUndo = () => {
    if (commandManagerRef.current?.canUndo()) {
      const prevSpec = commandManagerRef.current.undo();
      if (prevSpec) {
        setCanonicalSpec(prevSpec);
        if (prevSpec.cuts) {
          setActiveCuts(
            prevSpec.cuts.map((c) => ({
              id: c.id,
              type: 'CUT' as const,
              start: c.start,
              end: c.end,
              label: c.reason || c.type,
              enabled: true,
              reason: c.type === 'manual' ? 'manual_cut' : c.type,
            }))
          );
        }
      }
    }
  };

  const handleRedo = () => {
    if (commandManagerRef.current?.canRedo()) {
      const nextSpec = commandManagerRef.current.redo();
      if (nextSpec) {
        setCanonicalSpec(nextSpec);
        if (nextSpec.cuts) {
          setActiveCuts(
            nextSpec.cuts.map((c) => ({
              id: c.id,
              type: 'CUT' as const,
              start: c.start,
              end: c.end,
              label: c.reason || c.type,
              enabled: true,
              reason: c.type === 'manual' ? 'manual_cut' : c.type,
            }))
          );
        }
      }
    }
  };

  const handleSplit = (splitTime: number) => {
    if (!canonicalSpec) return;
    const current = canonicalSpec;
    const videoTrack = current.tracks.find((t) => t.type === 'VIDEO');
    const targetClip = videoTrack?.clips[0];
    if (!targetClip) return;

    const cmd = createEditorCommand({
      type: 'SPLIT_CLIP',
      description: `Split clip at ${splitTime.toFixed(1)}s`,
      execute: (spec) => splitClipAt(spec, targetClip.id, splitTime),
      undo: () => current,
    });
    executeCommand(cmd);
  };

  const handleDeleteSelectedClip = (clipId: string) => {
    if (!canonicalSpec) return;
    const current = canonicalSpec;
    const cmd = createEditorCommand({
      type: 'DELETE_CLIP',
      description: `Delete clip ${clipId}`,
      execute: (spec) => deleteClip(spec, clipId),
      undo: () => current,
    });
    executeCommand(cmd);
  };

  const handleRunAICommand = (instruction: string) => {
    if (!canonicalSpec || !instruction.trim()) return;
    setIsAICommandRunning(true);
    try {
      const plan = parseAIEditCommand(instruction, canonicalSpec);
      const current = canonicalSpec;
      const cmd = createEditorCommand({
        type: 'DYNAMIC_CAPTIONS',
        description: plan.summary,
        execute: (spec) => plan.apply(spec),
        undo: () => current,
      });
      executeCommand(cmd);
      setIsAICommandModalOpen(false);
      setAICommandInput('');
    } finally {
      setIsAICommandRunning(false);
    }
  };

  // Studio-wide keyboard shortcuts (Phase 33): Cmd+Z (undo), Cmd+Shift+Z (redo), Cmd+S (versions), S (split)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setIsVersionModalOpen(true);
      } else if (!isCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSplit(currentTime);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canonicalSpec, currentTime, activeClip]);

  const aiToolsList = [
    { id: 'style', label: 'Style', icon: Palette, desc: 'Preset Badges & Fonts' },
    { id: 'captions', label: 'Captions', icon: Type, desc: 'Words & Highlight Star' },
    { id: 'ai-tools', label: 'AI Tools', icon: Sparkles, desc: 'Auto Zooms & B-rolls' },
    { id: 'brolls', label: 'B-rolls', icon: Layers, desc: 'Scene Storyboard' },
    { id: 'reframe', label: 'Auto Reframe', icon: Crop, desc: 'Smart 9:16 Subject Track' },
    { id: 'moments', label: 'AI Moments', icon: Bot, desc: 'Virality & Retention' },
    { id: 'audio', label: 'Audio & Music', icon: Mic2, desc: 'Voice Clean & SFX' },
    { id: 'publish', label: 'Distribution', icon: Share2, desc: 'Viral Titles & Export' },
  ] as const;

  return (
    <AppShell onOpenCreateProject={() => setIsCreateModalOpen(true)}>
      
      {/* 1. TOP CONTEXT BAR: Clean White Box with Red Accents */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30 select-none shadow-xs">
        
        {/* Left: Project Name + Saved Status + DB Sync */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200/70 focus:bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden transition-all truncate max-w-xs sm:max-w-md shadow-xs"
            title="Click to rename project"
          />

          {/* Database Sync Status Badge */}
          {dbSyncStatus === 'saving' ? (
            <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1.5 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full animate-pulse shadow-xs">
              <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
              <span>Syncing to DB...</span>
            </span>
          ) : dbSyncStatus === 'error' ? (
            <span className="text-[10px] text-rose-700 font-semibold flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full shadow-xs">
              <AlertCircle className="w-3 h-3 text-rose-600" />
              <span>Sync Error</span>
            </span>
          ) : (
            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-400" />
              <span>Saved to Database</span>
            </span>
          )}

          {/* Manual Save Button */}
          <button
            type="button"
            onClick={handleSaveToDatabase}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
            title="Save Project to Database"
          >
            <Database className="w-3 h-3 text-red-600" />
            <span>Save</span>
          </button>

          {isDemoMode && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              DEMO
            </span>
          )}
        </div>

        {/* Center: Undo / Redo / AI Assistant */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl shadow-xs">
          <button
            type="button"
            onClick={handleUndo}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
            title="Undo (⌘Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
            title="Redo (⇧⌘Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsVersionModalOpen(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
            title="Timeline Versions & Checkpoints (⌘S)"
          >
            <History className="w-3.5 h-3.5 text-slate-600" />
          </button>
          <div className="w-px h-3.5 bg-slate-300 mx-1" />
          <button
            type="button"
            onClick={() => setIsAICommandModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/70 text-xs font-bold transition-colors cursor-pointer"
            title="Run AI Edit Commands"
          >
            <Bot className="w-3.5 h-3.5 text-red-600" />
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
              className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Change Video</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-600/20 hover:scale-[1.02] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Export 9:16 Video</span>
          </button>
        </div>

      </header>

      {/* 2. EDITOR MAIN WORKSPACE */}
      <main className="p-6 max-w-[1600px] w-full mx-auto space-y-6">
        
        {!videoUrl ? (
          /* Empty State for New Project: White Cards with Soft Shadow on Light Grey */
          <div className="max-w-2xl mx-auto space-y-8 pt-8">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto shadow-sm">
                <Scissors className="w-6 h-6 -rotate-45" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Import Your Video to Begin
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Upload raw footage or paste a YouTube URL to automatically detect high-retention moments and sync word captions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: File Upload */}
              <div className="clipper-card bg-white border border-slate-200/90 p-6 space-y-3 shadow-sm rounded-2xl">
                <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                  <Upload className="w-4 h-4" />
                  <span>Upload Local File</span>
                </div>
                <p className="text-xs text-slate-500">
                  Directly process MP4, MOV, or WebM videos.
                </p>
                <VideoUploader onVideoSelected={handleVideoSelected} />
              </div>

              {/* Option 2: YouTube Import */}
              <div className="clipper-card bg-white border border-slate-200/90 p-6 flex flex-col justify-between space-y-3 shadow-sm rounded-2xl">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                    <Youtube className="w-4 h-4 text-red-600" />
                    <span>Paste YouTube URL</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Extract top 5 moments from official caption cues.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open URL Importer</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Option 3: Explicit Demo Mode */}
            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-sm text-center space-y-2">
              <p className="text-xs text-slate-500">
                Want to test Clipper Studio immediately without uploading your own media?
              </p>
              <button
                type="button"
                onClick={handleLoadDemo}
                className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-red-50 text-red-700 text-xs font-bold border border-red-200 shadow-xs transition-colors cursor-pointer"
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
              <div className="lg:col-span-2 space-y-1 bg-white border border-slate-200/90 shadow-sm p-2.5 rounded-2xl">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                          ? 'bg-red-50/80 border border-red-200 text-red-700 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold leading-tight">{tool.label}</p>
                        <p className={`text-[10px] truncate ${isActive ? 'text-red-500' : 'text-slate-400'}`}>{tool.desc}</p>
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
                  onTimeUpdate={(t) => setCurrentTime(t)}
                  reframeTrack={reframeTrack || visualSettings.reframeTrack}
                  aspectRatio={visualSettings.aspectRatio}
                  cuts={activeCuts}
                  onAspectRatioChange={(newRatio) => {
                    setVisualSettings((prev) => ({ ...prev, aspectRatio: newRatio }));
                    handleTriggerReframe(visualSettings.trackingMode || 'center', newRatio);
                  }}
                  onNavigateToTab={(tab) => {
                    if (
                      tab === 'ai-tools' ||
                      tab === 'audio' ||
                      tab === 'captions' ||
                      tab === 'style' ||
                      tab === 'brolls' ||
                      tab === 'reframe' ||
                      tab === 'moments' ||
                      tab === 'publish'
                    ) {
                      setActiveTool(tab as any);
                    }
                  }}
                />
              </div>

              {/* COLUMN 3: Properties & Active Tool Panel (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {activeTool === 'style' && (
                  <StyleTab
                    currentStyle={subtitleStyle}
                    onChange={(st) => setSubtitleStyle(st)}
                  />
                )}

                {activeTool === 'captions' && (
                  <CaptionsTab
                    words={words}
                    onWordsChange={(updatedWords) => setWords(updatedWords)}
                    onJumpToTime={handleJumpToTime}
                    currentTime={currentTime}
                    subtitleStyle={subtitleStyle}
                    onStyleChange={(st) => setSubtitleStyle(st)}
                  />
                )}

                {activeTool === 'ai-tools' && (
                  <AIToolsTab
                    visualSettings={visualSettings}
                    audioSettings={audioSettings}
                    onVisualChange={(vs) => setVisualSettings(vs)}
                    onAudioChange={(as) => setAudioSettings(as)}
                    onNavigateToTab={(tab) => setActiveTool(tab as any)}
                    words={words}
                    onApplyAutoZooms={() => {
                      const zoomCuts: EditOperation[] = [];
                      const step = 5.0;
                      const clipStart = activeClip?.start || 0;
                      const clipEnd = activeClip?.end || (clipStart + 30);
                      for (let t = clipStart + 2; t < clipEnd - 2; t += step) {
                        zoomCuts.push({
                          id: `auto-zoom-${t.toFixed(1)}`,
                          type: 'ZOOM',
                          start: t,
                          end: Math.min(t + 2.5, clipEnd),
                          label: 'AI Auto-Zoom (1.15x)',
                          enabled: true,
                        });
                      }
                      setActiveCuts((prev) => [...prev.filter((c) => c.type !== 'ZOOM'), ...zoomCuts]);
                      setVisualSettings((prev) => ({ ...prev, autoZoomsEnabled: true }));
                    }}
                    onApplySilences={() => {
                      setVisualSettings((prev) => ({ ...prev, removeSilencesEnabled: true }));
                    }}
                  />
                )}

                {activeTool === 'brolls' && (
                  <BrollStoryboardTab
                    words={words}
                    cuts={activeCuts}
                    onCutsChange={(newCuts) => setActiveCuts(newCuts)}
                    onJumpToTime={handleJumpToTime}
                    currentTime={currentTime}
                  />
                )}

                {activeTool === 'reframe' && (
                  <VisualLayoutTab
                    settings={visualSettings}
                    onChange={(vs) => setVisualSettings(vs)}
                    bRollKeywords={activeClip?.bRollKeywords || ['business', 'creator', 'podcast']}
                    onTriggerReframe={handleTriggerReframe}
                    onInsertBroll={handleInsertBroll}
                    isReframeLoading={isReframeLoading}
                    reframeStatus={reframeStatus}
                  />
                )}

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

            {/* BOTTOM SECTION: Full Width AI-First Timeline */}
            <div className="bg-white border border-slate-200/90 shadow-sm p-4 rounded-2xl">
              <CreatorTimeline
                clip={activeClip}
                currentTime={currentTime}
                onSeek={handleJumpToTime}
                cuts={activeCuts}
                words={words}
                reframeTrack={reframeTrack || visualSettings.reframeTrack}
                onSplit={handleSplit}
                onDeleteClip={handleDeleteSelectedClip}
                selectedClipId={activeClipId}
                onSelectClip={(id) => setActiveClipId(id)}
              />
            </div>

          </div>
        )}

      </main>

      {/* Timeline Version Control Modal (Phase 7) */}
      {canonicalSpec && (
        <TimelineVersionModal
          isOpen={isVersionModalOpen}
          onClose={() => setIsVersionModalOpen(false)}
          projectId={projectId}
          currentSpec={canonicalSpec}
          onRestoreVersion={(restoredSpec) => {
            setCanonicalSpec(restoredSpec);
            if (restoredSpec.cuts) {
              setActiveCuts(
                restoredSpec.cuts.map((c) => ({
                  id: c.id,
                  type: 'CUT' as const,
                  start: c.start,
                  end: c.end,
                  label: c.reason || c.type,
                  enabled: true,
                  reason: c.type === 'manual' ? 'manual_cut' : c.type,
                }))
              );
            }
            if (restoredSpec.captions?.style) {
              setSubtitleStyle(restoredSpec.captions.style);
            }
          }}
        />
      )}

      {/* AI Edit Command Dialog (Phase 25 & 26) */}
      {isAICommandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">AI Studio Assistant</h3>
                  <p className="text-[11px] text-slate-500">Natural language structured editing operations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAICommandModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Transform your timeline with natural language. Every action produces an undoable operation:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {[
                'Remove dead air',
                'Remove fillers',
                'Focus speaker',
                'Add B-roll',
                'Dynamic captions',
                '30 sec short',
                'Enable ducking',
              ].map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => handleRunAICommand(cmd)}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-semibold border border-slate-200/90 transition-colors cursor-pointer shadow-2xs"
                >
                  {cmd}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunAICommand(aiCommandInput);
              }}
              className="flex gap-2 pt-2"
            >
              <input
                type="text"
                placeholder="e.g. Cut dead air and highlight keyword captions"
                value={aiCommandInput}
                onChange={(e) => setAICommandInput(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-hidden"
              />
              <button
                type="submit"
                disabled={isAICommandRunning || !aiCommandInput.trim()}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isAICommandRunning ? 'Applying...' : 'Apply'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal with Real FFmpeg Render Pipeline */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeClip={activeClip}
        videoUrl={videoUrl}
        subtitleStyle={subtitleStyle}
        visualSettings={visualSettings}
        isProUser={false}
        reframeTrack={reframeTrack || visualSettings.reframeTrack}
        aspectRatio={visualSettings.aspectRatio}
        cuts={activeCuts}
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
