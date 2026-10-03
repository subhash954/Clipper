'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  SplitSquareVertical,
  Crosshair,
  Sparkles,
  Music2,
  Image as ImageIcon,
  Maximize2,
  Eye,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { WordTimestamp, SubtitleStyle, VisualLayoutSettings, AudioStudioSettings, EditOperation } from '@/lib/types';
import { AspectRatio, ReframeTrack, ReframeKeyframe, ASPECT_RATIO_CONFIGS } from '@/lib/reframe/types';
import { renderSubtitlesOnCanvas } from '@/lib/subtitleRenderer';
import { SATISFYING_VIDEO_URLS } from '@/lib/sampleData';
import { soundFX } from '@/lib/audioEffects';

interface VideoPreviewPlayerProps {
  videoUrl: string;
  words: WordTimestamp[];
  subtitleStyle: SubtitleStyle;
  visualSettings: VisualLayoutSettings;
  audioSettings: AudioStudioSettings;
  isProUser: boolean;
  clipStartTime?: number;
  onTimeUpdate?: (time: number) => void;
  reframeTrack?: ReframeTrack;
  aspectRatio?: AspectRatio;
  cuts?: EditOperation[];
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  onNavigateToTab?: (tab: string) => void;
}

export interface VideoPreviewPlayerRef {
  getVideoElement: () => HTMLVideoElement | null;
  getCanvasElement: () => HTMLCanvasElement | null;
  seekTo: (time: number) => void;
  togglePlay: () => void;
  stepFrames: (frames: number) => void;
}

/**
 * Linearly interpolates focal point and zoom from reframe keyframes
 */
function getInterpolatedKeyframe(
  keyframes: ReframeKeyframe[] | undefined,
  time: number
): { x: number; y: number; scale: number } {
  if (!keyframes || keyframes.length === 0) {
    return { x: 0.5, y: 0.5, scale: 1.0 };
  }
  if (keyframes.length === 1 || time <= keyframes[0].time) {
    return {
      x: keyframes[0].x,
      y: keyframes[0].y,
      scale: keyframes[0].scale || 1.0,
    };
  }
  if (time >= keyframes[keyframes.length - 1].time) {
    const last = keyframes[keyframes.length - 1];
    return {
      x: last.x,
      y: last.y,
      scale: last.scale || 1.0,
    };
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];
    if (time >= k1.time && time <= k2.time) {
      const dt = Math.max(0.001, k2.time - k1.time);
      const t = (time - k1.time) / dt;
      return {
        x: k1.x + (k2.x - k1.x) * t,
        y: k1.y + (k2.y - k1.y) * t,
        scale: (k1.scale || 1.0) + ((k2.scale || 1.0) - (k1.scale || 1.0)) * t,
      };
    }
  }

  return { x: 0.5, y: 0.5, scale: 1.0 };
}

export const VideoPreviewPlayer = forwardRef<VideoPreviewPlayerRef, VideoPreviewPlayerProps>(
  (
    {
      videoUrl,
      words,
      subtitleStyle,
      visualSettings,
      audioSettings,
      isProUser,
      clipStartTime = 0,
      onTimeUpdate,
      reframeTrack: propReframeTrack,
      aspectRatio: propAspectRatio,
      cuts = [],
      onAspectRatioChange,
      onNavigateToTab,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const secondaryVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [previewModeOnly, setPreviewModeOnly] = useState(true);
    const [showSafeArea, setShowSafeArea] = useState(true);
    const [isAspectMenuOpen, setIsAspectMenuOpen] = useState(false);
    const lastActiveWordRef = useRef<string | null>(null);

    // Active aspect ratio & reframe track
    const activeAspectRatio: AspectRatio =
      propAspectRatio || visualSettings.aspectRatio || propReframeTrack?.aspectRatio || '9:16';
    const activeReframeTrack = propReframeTrack || visualSettings.reframeTrack;
    const aspectConfig = ASPECT_RATIO_CONFIGS[activeAspectRatio] || ASPECT_RATIO_CONFIGS['9:16'];

    const stepFrames = (frames: number) => {
      if (videoRef.current) {
        const frameTime = 1 / 30; // 30 fps
        const newTime = Math.max(0, Math.min(duration || 30, videoRef.current.currentTime + frames * frameTime));
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        onTimeUpdate?.(newTime);
      }
    };

    useImperativeHandle(ref, () => ({
      getVideoElement: () => videoRef.current,
      getCanvasElement: () => canvasRef.current,
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
        }
        if (secondaryVideoRef.current) {
          secondaryVideoRef.current.currentTime = time;
        }
      },
      togglePlay: () => togglePlay(),
      stepFrames: (frames: number) => stepFrames(frames),
    }));

    // Keyboard navigation (Phase 4 & Phase 33): Space, J/K/L, ArrowLeft/ArrowRight
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }

        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        } else if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          if (videoRef.current) {
            const nextT = Math.max(0, videoRef.current.currentTime - 2.0);
            videoRef.current.currentTime = nextT;
            setCurrentTime(nextT);
            onTimeUpdate?.(nextT);
          }
        } else if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          if (videoRef.current) {
            const nextT = Math.min(duration || 30, videoRef.current.currentTime + 2.0);
            videoRef.current.currentTime = nextT;
            setCurrentTime(nextT);
            onTimeUpdate?.(nextT);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stepFrames(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          stepFrames(1);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, duration, onTimeUpdate]);

    // Dynamic subject position calculation for Auto Reframe
    const relativeTime = Math.max(0, currentTime - clipStartTime);
    const currentFrame = useMemo(() => {
      return getInterpolatedKeyframe(activeReframeTrack?.keyframes, relativeTime);
    }, [activeReframeTrack?.keyframes, relativeTime]);

    // Check if auto-zoom is active at this timestamp
    const isAutoZoomActive = useMemo(() => {
      if (!visualSettings.autoZoomsEnabled) return false;
      return cuts.some((c) => c.type === 'ZOOM' && currentTime >= c.start && currentTime <= c.end && c.enabled);
    }, [visualSettings.autoZoomsEnabled, cuts, currentTime]);

    // Calculate exact CSS object-position to match FFmpeg crop filter
    const videoStyle = useMemo(() => {
      const videoEl = videoRef.current;
      const sourceW = videoEl?.videoWidth || 1920;
      const sourceH = videoEl?.videoHeight || 1080;
      const targetRatio = aspectConfig.ratio;
      const sourceRatio = sourceW / sourceH;

      let cropW: number;
      let cropH: number;

      if (sourceRatio > targetRatio) {
        cropH = sourceH;
        cropW = sourceH * targetRatio;
      } else {
        cropW = sourceW;
        cropH = sourceW / targetRatio;
      }

      let zoom = Math.max(1.0, currentFrame.scale || 1.0);
      if (isAutoZoomActive) {
        zoom *= 1.15; // Dynamic punch-in for auto zooms
      }

      const zoomedW = cropW / zoom;
      const zoomedH = cropH / zoom;

      const maxTravelX = sourceW - zoomedW;
      const maxTravelY = sourceH - zoomedH;

      const desiredLeft = Math.max(0, Math.min(maxTravelX, currentFrame.x * sourceW - zoomedW / 2));
      const desiredTop = Math.max(0, Math.min(maxTravelY, currentFrame.y * sourceH - zoomedH / 2));

      const objPosX = maxTravelX > 0 ? (desiredLeft / maxTravelX) * 100 : 50;
      const objPosY = maxTravelY > 0 ? (desiredTop / maxTravelY) * 100 : 50;

      return {
        objectPosition: `${objPosX.toFixed(2)}% ${objPosY.toFixed(2)}%`,
        transform: zoom > 1.01 ? `scale(${zoom.toFixed(2)})` : undefined,
        transformOrigin: `${objPosX.toFixed(2)}% ${objPosY.toFixed(2)}%`,
      };
    }, [aspectConfig.ratio, currentFrame, isAutoZoomActive]);

    // Synchronize canvas rendering loop and sound effects
    useEffect(() => {
      let animationFrameId: number;

      const renderLoop = () => {
        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            renderSubtitlesOnCanvas(
              ctx,
              video.currentTime,
              duration || 14.5,
              words,
              subtitleStyle,
              visualSettings,
              canvas.width,
              canvas.height,
              !isProUser,
              clipStartTime
            );
          }

          // Trigger Sound FX when high-impact keywords appear
          if (subtitleStyle.enableSFX && isPlaying) {
            const active = words.find((w) => video.currentTime >= w.start && video.currentTime <= w.end);
            if (active && active.word !== lastActiveWordRef.current) {
              lastActiveWordRef.current = active.word;
              const cleanWord = active.word.replace(/[^a-zA-Z]/g, '').toUpperCase();
              if (['DOLLAR', 'BUSINESS', 'THOUSAND', 'रुपए'].includes(cleanWord)) {
                soundFX.playCashDing();
              } else if (['STOP', 'SPEED', 'WINS', 'START'].includes(cleanWord)) {
                soundFX.playPop();
              }
            }
          }
        }
        animationFrameId = requestAnimationFrame(renderLoop);
      };

      animationFrameId = requestAnimationFrame(renderLoop);

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }, [words, subtitleStyle, visualSettings, isProUser, duration, isPlaying, clipStartTime]);

    // Handle primary time update
    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;

        // Skip enabled cuts non-destructively
        if (cuts && cuts.length > 0) {
          const activeCut = cuts.find((c) => c.enabled && time >= c.start && time < c.end);
          if (activeCut) {
            videoRef.current.currentTime = activeCut.end;
            setCurrentTime(activeCut.end);
            onTimeUpdate?.(activeCut.end);
            return;
          }
        }

        setCurrentTime(time);
        onTimeUpdate?.(time);

        // Keep secondary split-screen video in sync
        if (secondaryVideoRef.current && Math.abs(secondaryVideoRef.current.currentTime - time) > 0.3) {
          secondaryVideoRef.current.currentTime = time;
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
      }
    };

    const togglePlay = () => {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
        secondaryVideoRef.current?.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        secondaryVideoRef.current?.play();
        setIsPlaying(true);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
      if (secondaryVideoRef.current) {
        secondaryVideoRef.current.currentTime = time;
      }
    };

    const toggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    const toggleFullscreen = () => {
      if (containerRef.current) {
        if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 100);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // YouTube Video ID Detection
    const extractYouTubeId = (url: string) => {
      if (!url) return null;
      const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
      return match && match[2].length === 11 ? match[2] : null;
    };
    const youtubeId = extractYouTubeId(videoUrl);
    const [useYouTubeEmbed, setUseYouTubeEmbed] = useState<boolean>(Boolean(youtubeId));

    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (useYouTubeEmbed && isPlaying) {
        interval = setInterval(() => {
          setCurrentTime((prev) => {
            const next = prev + 0.1;
            const maxD = duration || 30;
            if (next >= maxD) {
              return 0;
            }
            onTimeUpdate?.(next);
            return next;
          });
        }, 100);
      }
      return () => clearInterval(interval);
    }, [useYouTubeEmbed, isPlaying, duration, onTimeUpdate]);

    const secondarySrc =
      visualSettings.splitScreenEnabled && visualSettings.satisfyingVideoType !== 'none'
        ? SATISFYING_VIDEO_URLS[visualSettings.satisfyingVideoType]
        : null;

    // Aspect ratio container styles
    const containerAspectClass =
      activeAspectRatio === '9:16'
        ? 'w-[280px] sm:w-[320px] aspect-[9/16]'
        : activeAspectRatio === '1:1'
        ? 'w-[300px] sm:w-[340px] aspect-square'
        : activeAspectRatio === '16:9'
        ? 'w-[360px] sm:w-[480px] aspect-video'
        : 'w-[290px] sm:w-[330px] aspect-[4/5]';

    return (
      <div className="flex flex-col items-center w-full max-w-lg mx-auto">
        {/* Header Bar Above Preview: Clean White Badges with Red Accents */}
        <div className="flex items-center justify-between w-full px-1 mb-2.5">
          <div className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/90 p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => onNavigateToTab?.('ai-tools')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200/80 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-red-600" />
              <span>AI Tools</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToTab?.('audio')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Music2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Audio</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToTab?.('moments')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Thumbnail</span>
            </button>
          </div>

          {/* Aspect Ratio Badge & Selector + Safe Area Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSafeArea(!showSafeArea)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
                showSafeArea
                  ? 'bg-cyan-50 border-cyan-200 text-cyan-700'
                  : 'bg-white border-slate-200/90 text-slate-500 hover:bg-slate-50'
              }`}
              title="Toggle Safe Area Overlay for YouTube Shorts, Reels, TikTok (Phase 13)"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-600" />
              <span className="hidden sm:inline">Safe Area</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAspectMenuOpen(!isAspectMenuOpen)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-bold text-red-600 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Smartphone className="w-3.5 h-3.5 text-red-600" />
                <span>{activeAspectRatio}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

            {isAspectMenuOpen && (
              <div className="absolute right-0 mt-1 w-36 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 animate-in fade-in">
                {(['9:16', '1:1', '16:9', '4:5'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => {
                      onAspectRatioChange?.(ratio);
                      setIsAspectMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      activeAspectRatio === ratio ? 'text-red-600 bg-red-50 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <span>{ratio}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {ASPECT_RATIO_CONFIGS[ratio].width}x{ASPECT_RATIO_CONFIGS[ratio].height}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Viewport Container with Dynamic Aspect Ratio */}
        <div
          ref={containerRef}
          className={`relative ${containerAspectClass} rounded-[32px] p-2 bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-2xl border-4 border-slate-700/60 overflow-hidden transition-all duration-300`}
        >
          {/* Inner Display Viewport */}
          <div className="relative w-full h-full rounded-[24px] overflow-hidden bg-black flex flex-col items-center justify-center">
            {/* Low Res Preview Badge (Matching Submagic) */}
            <div className="absolute top-3 right-3 z-30 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-slate-400 backdrop-blur-xs border border-white/10 select-none pointer-events-none">
              Low res preview
            </div>

            {/* If YouTube URL and embed enabled */}
            {youtubeId && useYouTubeEmbed ? (
              <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-auto">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=${
                    isPlaying ? 1 : 0
                  }&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&rel=0&modestbranding=1`}
                  className="w-full h-full object-cover scale-[1.35] pointer-events-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            ) : visualSettings.splitScreenEnabled && secondarySrc ? (
              /* Split-Screen Viewport */
              <div className="w-full h-full flex flex-col">
                <div className="relative w-full h-1/2 overflow-hidden border-b-2 border-red-500/40">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    crossOrigin="anonymous"
                    playsInline
                    loop
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    style={videoStyle}
                    className="w-full h-full object-cover cursor-pointer transition-all duration-100 ease-out"
                    onClick={togglePlay}
                  />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                    Speaker
                  </div>
                </div>

                <div className="relative w-full h-1/2 overflow-hidden">
                  <video
                    ref={secondaryVideoRef}
                    src={secondarySrc}
                    crossOrigin="anonymous"
                    playsInline
                    loop
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-emerald-400 uppercase tracking-wider backdrop-blur-sm">
                    Satisfying {visualSettings.satisfyingVideoType.toUpperCase()}
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Full-Frame Auto Reframe Video */
              <video
                ref={videoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                playsInline
                loop
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                style={videoStyle}
                className={`absolute inset-0 w-full h-full object-cover cursor-pointer transition-all duration-100 ease-out ${
                  visualSettings.backgroundBlur ? 'blur-[1px]' : ''
                }`}
                onClick={togglePlay}
              />
            )}

            {/* Canvas Overlay for Dynamic Subtitles, Progress Bar, Watermark, & Stickers */}
            <canvas
              ref={canvasRef}
              width={aspectConfig.width}
              height={aspectConfig.height}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />

            {/* Caption Safe Areas Overlay (Phase 13) */}
            {showSafeArea && activeAspectRatio === '9:16' && (
              <div className="absolute inset-0 pointer-events-none z-15 border-2 border-cyan-400/40 select-none">
                {/* Top safe zone */}
                <div className="absolute top-0 left-0 right-0 h-[14%] border-b border-dashed border-cyan-400/60 bg-cyan-500/10 flex items-start justify-center p-1">
                  <span className="text-[8px] font-mono text-cyan-300 font-bold bg-black/70 px-1.5 py-0.5 rounded">
                    TOP SAFE ZONE (Platform Headers)
                  </span>
                </div>
                {/* Bottom safe zone */}
                <div className="absolute bottom-0 left-0 right-0 h-[22%] border-t border-dashed border-cyan-400/60 bg-cyan-500/10 flex items-end justify-center p-1">
                  <span className="text-[8px] font-mono text-cyan-300 font-bold bg-black/70 px-1.5 py-0.5 rounded">
                    BOTTOM SAFE ZONE (Captions / Sound Title)
                  </span>
                </div>
                {/* Right sidebar action safe zone */}
                <div className="absolute top-[14%] bottom-[22%] right-0 w-[18%] border-l border-dashed border-cyan-400/60 bg-cyan-500/10 flex items-center justify-center p-1">
                  <span className="text-[7px] font-mono text-cyan-300 font-bold bg-black/70 px-1 py-0.5 rounded rotate-90">
                    ACTIONS
                  </span>
                </div>
              </div>
            )}

            {/* Center Tap Play Button */}
            {!isPlaying && (!youtubeId || !useYouTubeEmbed) && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 backdrop-blur-[2px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-xl shadow-red-600/40 hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 fill-white ml-1" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Custom Playback Controls Bar: Clean White Box with Red Accents */}
        <div className="w-full mt-3 p-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-2.5">
          {/* Scrub Slider */}
          <div className="flex items-center gap-2.5">
            <input
              type="range"
              min="0"
              max={duration || 30}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
          </div>

          {/* Controls Bottom Row */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs transition-all cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-white" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPreviewModeOnly(!previewModeOnly)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                  previewModeOnly
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                Preview Mode
              </button>

              {/* Timecode 00:02.80 / 01:00.00 */}
              <span className="text-[11px] font-mono text-slate-700 font-bold ml-1">
                {formatTime(currentTime)} / {formatTime(duration || 60)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPreviewPlayer.displayName = 'VideoPreviewPlayer';
