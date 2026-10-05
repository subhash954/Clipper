'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, Youtube, PlayCircle, Sparkles, Film, AlertCircle, Loader2 } from 'lucide-react';
import { SAMPLE_VIDEO_URL } from '@/lib/sampleData';

interface VideoUploaderProps {
  onVideoSelected: (videoUrl: string, fileName: string, isSample?: boolean) => void;
  showUrlImport?: boolean;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelected, showUrlImport = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processLocalFile(file);
    }
  };

  const processLocalFile = async (file: File) => {
    setLoading(true);
    setErrorMsg(null);
    setStatusMessage('Uploading and probing media container...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      onVideoSelected(data.mediaAsset.fileUrl, file.name, false);
    } catch (err: any) {
      console.warn('Backend upload notice, using local blob for studio preview:', err.message);
      // Fallback to local object URL for preview if server is unreachable
      const objectUrl = URL.createObjectURL(file);
      onVideoSelected(objectUrl, file.name, false);
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      await processLocalFile(file);
    } else {
      setErrorMsg('Please drop a valid video file (MP4, MOV, WebM).');
    }
  };

  const handleUseSample = () => {
    if (process.env.NODE_ENV === 'production') {
      setErrorMsg('Sample fixture is disabled in production mode. Please upload your video file.');
      return;
    }
    onVideoSelected(SAMPLE_VIDEO_URL, "Entrepreneur_Mindset_Hook.mp4", true);
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setStatusMessage('Connecting to YouTube and retrieving transcript cues...');

    try {
      const res = await fetch('/api/youtube/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: youtubeUrl.trim(), clipCount: 5 }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to ingest YouTube video.');
      }

      const data = await res.json();
      onVideoSelected(data.sourceUrl, data.title, false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process YouTube link.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
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
            ? 'border-red-500 bg-red-50/60 scale-[1.01]'
            : 'border-slate-200 bg-white hover:border-red-400 hover:bg-red-50/20 shadow-xs'
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
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-inner">
            <UploadCloud className="w-8 h-8 animate-pulse" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Drop your video file here, or <span className="text-red-600 underline decoration-red-500/50">browse</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports MP4, MOV, WebM up to 500MB (Automatic 9:16 vertical crop)
            </p>
          </div>

          <div className="pt-2 flex items-center gap-2 text-xs text-slate-400">
            <Film className="w-3.5 h-3.5" />
            <span>Optimal for 1080p / 4K content</span>
          </div>
        </div>
      </div>

      {showUrlImport && (
        <>
          {/* Or Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-[#F4F5F7] px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              OR IMPORT VIA URL
            </span>
            <div className="border-t border-slate-200 w-full"></div>
          </div>

          {/* Instant Demo & YouTube Import */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Development Demo Button */}
            <button
              type="button"
              onClick={handleUseSample}
              disabled={loading}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-red-600 hover:border-red-300 transition-all font-semibold text-xs shadow-xs group cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
              <span>⚡ Try Dev Sample Video</span>
            </button>

            {/* YouTube Link Form */}
            <form onSubmit={handleYoutubeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Youtube className="w-4 h-4 text-red-600" />
                </div>
                <input
                  type="text"
                  placeholder="Paste YouTube Link..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-hidden focus:border-red-500 shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !youtubeUrl.trim()}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                Import
              </button>
            </form>
          </div>
        </>
      )}

      {statusMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center text-xs text-red-700 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
