'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Smartphone, SplitSquareVertical } from 'lucide-react';
import { WordTimestamp, SubtitleStyle, VisualLayoutSettings, AudioStudioSettings } from '@/lib/types';
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
  onTimeUpdate?: (time: number) => void;
}

export interface VideoPreviewPlayerRef {
  getVideoElement: () => HTMLVideoElement | null;
  getCanvasElement: () => HTMLCanvasElement | null;
  seekTo: (time: number) => void;
}

export const VideoPreviewPlayer = forwardRef<VideoPreviewPlayerRef, VideoPreviewPlayerProps>(
  ({ videoUrl, words, subtitleStyle, visualSettings, audioSettings, isProUser, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const secondaryVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const lastActiveWordRef = useRef<string | null>(null);

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
      }
    }));

    // Synchronize canvas rendering loop and sound effects (Feature 9)
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
              !isProUser
            );
          }

          // Trigger Sound FX when high-impact keywords appear (Feature 9)
          if (subtitleStyle.enableSFX && isPlaying) {
            const active = words.find(w => video.currentTime >= w.start && video.currentTime <= w.end);
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
    }, [words, subtitleStyle, visualSettings, isProUser, duration, isPlaying]);

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

    // Detect YouTube Video ID
    const extractYouTubeId = (url: string) => {
      if (!url) return null;
      const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
      return match && match[2].length === 11 ? match[2] : null;
    };
    const youtubeId = extractYouTubeId(videoUrl);
    const [useYouTubeEmbed, setUseYouTubeEmbed] = useState<boolean>(Boolean(youtubeId));

    // Keep YouTube playback time ticker active for subtitle animation
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

    const secondarySrc = visualSettings.splitScreenEnabled && visualSettings.satisfyingVideoType !== 'none'
      ? SATISFYING_VIDEO_URLS[visualSettings.satisfyingVideoType]
      : null;

    return (
      <div className="flex flex-col items-center w-full max-w-sm mx-auto">
        
        {/* Device Frame Header with Split Screen & YouTube Stream Switcher */}
        <div className="flex items-center justify-between w-full px-2 mb-2 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-red-600" />
            <span className="font-bold text-slate-800">9:16 Shorts (1080x1920)</span>
          </div>

          <div className="flex items-center gap-1.5">
            {youtubeId && (
              <button
                onClick={() => setUseYouTubeEmbed(!useYouTubeEmbed)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition-colors ${
                  useYouTubeEmbed
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {useYouTubeEmbed ? '▶ YT Stream' : '🎬 Canvas View'}
              </button>
            )}

            {visualSettings.splitScreenEnabled && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                <SplitSquareVertical className="w-3 h-3" /> Split Screen
              </span>
            )}
          </div>
        </div>

        {/* 9:16 Vertical Phone Mockup Container */}
        <div 
          ref={containerRef}
          className="relative w-[280px] sm:w-[320px] aspect-[9/16] rounded-[38px] p-2.5 bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-2xl border-4 border-slate-700/60 overflow-hidden"
        >
          {/* Top Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-24 h-4 rounded-full bg-black/90 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700"></div>
          </div>

          {/* Inner Display */}
          <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-black flex flex-col items-center justify-center">
            
            {/* If YouTube URL and embed enabled: Stream live YouTube video */}
            {youtubeId && useYouTubeEmbed ? (
              <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-auto">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&rel=0&modestbranding=1`}
                  className="w-full h-full object-cover scale-[1.35] pointer-events-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            ) : visualSettings.splitScreenEnabled && secondarySrc ? (
              /* Feature 18: Split-Screen Viewport */
              <div className="w-full h-full flex flex-col">
                {/* Top Video: Speaker (50%) */}
                <div className="relative w-full h-1/2 overflow-hidden border-b-2 border-red-500/40">
                  <video
                    ref={videoRef}
                    src={youtubeId ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" : videoUrl}
                    crossOrigin="anonymous"
                    playsInline
                    loop
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={togglePlay}
                  />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                    Speaker
                  </div>
                </div>

                {/* Bottom Video: Satisfying Gameplay / Parkour (50%) */}
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
              /* Standard Full-Height Vertical 9:16 Video */
              <video
                ref={videoRef}
                src={youtubeId ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" : videoUrl}
                crossOrigin="anonymous"
                playsInline
                loop
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                className={`absolute inset-0 w-full h-full object-cover cursor-pointer ${
                  visualSettings.backgroundBlur ? 'blur-[1px]' : ''
                }`}
                onClick={togglePlay}
              />
            )}

            {/* Canvas Overlay for Dynamic Subtitles, Progress Bar, Watermark, & Stickers */}
            <canvas
              ref={canvasRef}
              width={1080}
              height={1920}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />

            {/* Center Tap Play Button (when not using embedded iframe) */}
            {!isPlaying && (!youtubeId || !useYouTubeEmbed) && (
              <div 
                onClick={togglePlay}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/50 hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 fill-white ml-1" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Custom Modern Playback Controls Bar - Clean Light UI */}
        <div className="w-full mt-4 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
          
          {/* Scrub Slider */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-red-600 font-bold w-10">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 30}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
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
                className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20 transition-all cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                  }
                  setCurrentTime(0);
                }}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {audioSettings.studioSoundEnabled && (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold">
                  Studio Sound ON
                </span>
              )}
              <button
                onClick={toggleMute}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-600" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

        </div>

      </div>
    );
  }
);

VideoPreviewPlayer.displayName = "VideoPreviewPlayer";
