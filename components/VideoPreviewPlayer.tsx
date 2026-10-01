'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Smartphone, SplitSquareVertical, Crosshair } from 'lucide-react';
import { WordTimestamp, SubtitleStyle, VisualLayoutSettings, AudioStudioSettings } from '@/lib/types';
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
}

export interface VideoPreviewPlayerRef {
  getVideoElement: () => HTMLVideoElement | null;
  getCanvasElement: () => HTMLCanvasElement | null;
  seekTo: (time: number) => void;
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
    const lastActiveWordRef = useRef<string | null>(null);

    // Active aspect ratio & reframe track
    const activeAspectRatio: AspectRatio =
      propAspectRatio || visualSettings.aspectRatio || propReframeTrack?.aspectRatio || '9:16';
    const activeReframeTrack = propReframeTrack || visualSettings.reframeTrack;
    const aspectConfig = ASPECT_RATIO_CONFIGS[activeAspectRatio] || ASPECT_RATIO_CONFIGS['9:16'];

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
    }));

    // Dynamic subject position calculation for Auto Reframe
    const relativeTime = Math.max(0, currentTime - clipStartTime);
    const currentFrame = useMemo(() => {
      return getInterpolatedKeyframe(activeReframeTrack?.keyframes, relativeTime);
    }, [activeReframeTrack?.keyframes, relativeTime]);

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

      const zoom = Math.max(1.0, currentFrame.scale || 1.0);
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
    }, [aspectConfig.ratio, currentFrame]);

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
              if (['DOLLAR', 'BUSINESS', 'THOUSAND'].includes(cleanWord)) {
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

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 10);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}.${ms}`;
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
        {/* Device Frame Header with Aspect Ratio & Subject Tracking Indicator */}
        <div className="flex items-center justify-between w-full px-2 mb-2 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-slate-200">
              {aspectConfig.label} ({aspectConfig.width}x{aspectConfig.height})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {activeReframeTrack && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                <Crosshair className="w-3 h-3 text-cyan-400" />
                {activeReframeTrack.trackingMode === 'smart'
                  ? 'Smart Centering'
                  : activeReframeTrack.trackingMode === 'manual'
                  ? 'Manual Framing'
                  : 'Center Crop'}
              </span>
            )}

            {youtubeId && (
              <button
                onClick={() => setUseYouTubeEmbed(!useYouTubeEmbed)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition-colors ${
                  useYouTubeEmbed
                    ? 'bg-red-950 text-red-400 border-red-800 hover:bg-red-900'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {useYouTubeEmbed ? '▶ YT Stream' : '🎬 Native View'}
              </button>
            )}

            {visualSettings.splitScreenEnabled && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
                <SplitSquareVertical className="w-3 h-3" /> Split Screen
              </span>
            )}
          </div>
        </div>

        {/* Viewport Container with Dynamic Aspect Ratio */}
        <div
          ref={containerRef}
          className={`relative ${containerAspectClass} rounded-[32px] p-2.5 bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-2xl border-4 border-slate-700/60 overflow-hidden transition-all duration-300`}
        >
          {/* Top Notch for Phone Framing */}
          {activeAspectRatio === '9:16' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-24 h-4 rounded-full bg-black/90 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
            </div>
          )}

          {/* Inner Display Viewport */}
          <div className="relative w-full h-full rounded-[24px] overflow-hidden bg-black flex flex-col items-center justify-center">
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

            {/* Center Tap Play Button */}
            {!isPlaying && (!youtubeId || !useYouTubeEmbed) && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/50 hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 fill-slate-950 ml-1" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Custom Playback Controls Bar */}
        <div className="w-full mt-4 p-3.5 rounded-2xl bg-[#111827] border border-[#283344] shadow-sm space-y-2.5">
          {/* Scrub Slider */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-cyan-400 font-bold w-10">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 30}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
              {formatTime(duration || 30)}
            </span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  togglePlay();
                  setIsPlaying(!isPlaying);
                }}
                className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-sm shadow-cyan-500/20 transition-all cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-slate-950" />
                ) : (
                  <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                )}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                  }
                  setCurrentTime(0);
                }}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {audioSettings.studioSoundEnabled && (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800 font-extrabold">
                  Studio Sound ON
                </span>
              )}
              <button
                onClick={toggleMute}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPreviewPlayer.displayName = 'VideoPreviewPlayer';
