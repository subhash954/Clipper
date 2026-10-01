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

    const secondarySrc = visualSettings.splitScreenEnabled && visualSettings.satisfyingVideoType !== 'none'
      ? SATISFYING_VIDEO_URLS[visualSettings.satisfyingVideoType]
      : null;

    return (
      <div className="flex flex-col items-center w-full max-w-sm mx-auto">
        
        {/* Device Frame Header with Split Screen Indicator */}
        <div className="flex items-center justify-between w-full px-2 mb-2 text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-purple-400" />
            <span>9:16 Shorts (1080x1920)</span>
          </div>

          {visualSettings.splitScreenEnabled && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <SplitSquareVertical className="w-3 h-3" /> Split Screen Active
            </span>
          )}
        </div>

        {/* 9:16 Vertical Phone Mockup Container */}
        <div 
          ref={containerRef}
          className="relative w-[280px] sm:w-[320px] aspect-[9/16] rounded-[38px] p-2.5 bg-gradient-to-b from-slate-700 via-slate-900 to-slate-950 shadow-2xl shadow-purple-950/40 border border-white/10 overflow-hidden"
        >
          {/* Top Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-24 h-4 rounded-full bg-black/90 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700"></div>
          </div>

          {/* Inner Display */}
          <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-black flex flex-col items-center justify-center">
            
            {/* Feature 18: Split-Screen Viewport or Full Vertical Viewport */}
            {visualSettings.splitScreenEnabled && secondarySrc ? (
              <div className="w-full h-full flex flex-col">
                {/* Top Video: Speaker (50%) */}
                <div className="relative w-full h-1/2 overflow-hidden border-b-2 border-purple-500/40">
                  <video
                    ref={videoRef}
                    src={videoUrl}
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
                src={videoUrl}
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

            {/* Center Tap Play Button */}
            {!isPlaying && (
              <div 
                onClick={togglePlay}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg shadow-purple-600/50 hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 fill-white ml-1" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Custom Modern Playback Controls Bar */}
        <div className="w-full mt-4 p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2">
          
          {/* Scrub Slider */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-purple-400 w-10">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 14.5}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="text-[11px] font-mono text-slate-500 w-10 text-right">
              {formatTime(duration || 14.5)}
            </span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                  if (secondaryVideoRef.current) {
                    secondaryVideoRef.current.currentTime = 0;
                  }
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {audioSettings.studioSoundEnabled && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Studio Sound ON
                </span>
              )}
              <button
                onClick={toggleMute}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
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

VideoPreviewPlayer.displayName = "VideoPreviewPlayer";
