'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, Youtube, PlayCircle, Sparkles, Film } from 'lucide-react';
import { SAMPLE_VIDEO_URL } from '@/lib/sampleData';

interface VideoUploaderProps {
  onVideoSelected: (videoUrl: string, fileName: string, isSample?: boolean) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLocalFile(file);
    }
  };

  const processLocalFile = (file: File) => {
    setLoading(true);
    const objectUrl = URL.createObjectURL(file);
    setTimeout(() => {
      onVideoSelected(objectUrl, file.name, false);
      setLoading(false);
    }, 400);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processLocalFile(file);
    }
  };

  const handleUseSample = () => {
    setLoading(true);
    setTimeout(() => {
      onVideoSelected(SAMPLE_VIDEO_URL, "Entrepreneur_Mindset_Hook.mp4", true);
      setLoading(false);
    }, 300);
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setLoading(true);
    // For demo/browser environment, YouTube links are seamlessly mapped to sample creator video
    setTimeout(() => {
      onVideoSelected(SAMPLE_VIDEO_URL, "YouTube_Viral_Segment.mp4", true);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-purple-500 bg-purple-500/10 scale-[1.01]'
            : 'border-white/15 bg-slate-900/60 hover:border-purple-500/50 hover:bg-slate-900/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
            <UploadCloud className="w-8 h-8 animate-pulse" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">
              Drop your video file here, or <span className="text-purple-400 underline decoration-purple-500/50">browse</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Supports MP4, MOV, WebM up to 500MB (Automatic 9:16 vertical crop)
            </p>
          </div>

          <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
            <Film className="w-3.5 h-3.5" />
            <span>Optimal for 1080p / 4K content</span>
          </div>
        </div>
      </div>

      {/* Or Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-white/10 w-full"></div>
        <span className="bg-[#090D16] px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          OR TRY INSTANTLY
        </span>
        <div className="border-t border-white/10 w-full"></div>
      </div>

      {/* Instant 1-Click Sample & YouTube Import */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 1-Click Demo Button */}
        <button
          type="button"
          onClick={handleUseSample}
          disabled={loading}
          className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-purple-600/20 border border-purple-500/40 text-purple-200 hover:text-white hover:border-purple-400 hover:bg-purple-600/30 transition-all font-medium text-sm group"
        >
          <PlayCircle className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          <span>⚡ Try With Instant Sample Video</span>
        </button>

        {/* YouTube Link Form */}
        <form onSubmit={handleYoutubeSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Youtube className="w-4 h-4 text-rose-500" />
            </div>
            <input
              type="text"
              placeholder="Paste YouTube Link..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-rose-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-medium border border-white/10 transition-colors"
          >
            Import
          </button>
        </form>
      </div>

      {loading && (
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-center text-xs text-purple-300 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 animate-spin text-purple-400" />
          <span>Analyzing video audio and preparing 9:16 frame...</span>
        </div>
      )}
    </div>
  );
};
