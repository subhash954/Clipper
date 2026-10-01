'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, Sparkles, X, Check, Crown, AlertCircle, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ViralClip, SubtitleStyle, VisualLayoutSettings, EditOperation } from '@/lib/types';
import { AspectRatio, ReframeTrack } from '@/lib/reframe/types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isProUser?: boolean;
  onOpenPricing?: () => void;
  activeClip?: ViralClip | null;
  videoUrl?: string | null;
  sourceUrl?: string | null;
  subtitleStyle?: SubtitleStyle;
  visualSettings?: VisualLayoutSettings;
  videoElement?: HTMLVideoElement | null;
  canvasElement?: HTMLCanvasElement | null;
  reframeTrack?: ReframeTrack;
  aspectRatio?: AspectRatio;
  cuts?: EditOperation[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  isProUser = false,
  onOpenPricing,
  activeClip,
  videoUrl,
  sourceUrl,
  subtitleStyle,
  visualSettings,
  reframeTrack,
  aspectRatio,
  cuts,
}) => {
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling interval on unmount or close
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const activeMedia = localMediaUrl || sourceUrl || videoUrl;

  const triggerExport = async () => {
    setIsRendering(true);
    setProgress(5);
    setCurrentStage('Submitting render job to FFmpeg pipeline...');
    setErrorMessage(null);
    setDownloadUrl(null);

    try {
      const activeCutsList = cuts || activeClip?.cuts || [];
      const resolvedReframe = reframeTrack || visualSettings?.reframeTrack;
      const resolvedAspect = aspectRatio || visualSettings?.aspectRatio || resolvedReframe?.aspectRatio || '9:16';

      // 1. Submit render job to backend
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip: {
            ...(activeClip || {
              id: 'clip-default',
              start: 0,
              duration: 30,
              words: [],
            }),
            cuts: activeCutsList,
          },
          sourceUrl: activeMedia,
          subtitleStyle,
          visualSettings,
          isProUser,
          reframeTrack: resolvedReframe,
          aspectRatio: resolvedAspect,
          trackingMode: visualSettings?.trackingMode,
          manualSettings: visualSettings?.manualPosition,
          brollOperations: activeCutsList.filter((c) => c.type === 'BROLL'),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Render request failed with status ${res.status}`);
      }

      const { jobId } = await res.json();
      if (!jobId) {
        throw new Error('Server did not return a valid render Job ID.');
      }

      // 2. Poll render job status every 1000ms until completed or failed
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/render/${jobId}`);
          if (!pollRes.ok) return;

          const data = await pollRes.json();
          const job = data.job;

          if (!job) return;

          setProgress(job.progress || 10);
          setCurrentStage(job.currentStage || 'Processing media frames...');

          if (job.status === 'completed' && job.outputUrl) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setProgress(100);
            setCurrentStage('Export completed!');
            setDownloadUrl(job.outputUrl);
            setIsRendering(false);

            // Trigger celebratory confetti burst
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
            });
          } else if (job.status === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsRendering(false);
            setErrorMessage(job.errorMessage || 'FFmpeg media worker failed to render clip.');
          }
        } catch (pollErr: any) {
          console.warn('Poll error:', pollErr);
        }
      }, 1000);
    } catch (err: any) {
      console.error('Export error:', err);
      setIsRendering(false);
      setErrorMessage(err?.message || 'An unexpected error occurred while initiating export.');
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Clipper_${activeClip?.title ? activeClip.title.replace(/[^\w]/g, '_').slice(0, 30) : 'Short'}_1080x1920.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={() => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            onClose();
          }}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Export 9:16 Vertical Short</h3>
              <p className="text-xs text-slate-500">Real FFmpeg 1080x1920 composition with burned subtitles</p>
            </div>
          </div>
        </div>

        {/* Format & Watermark Info Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Output Format:</span>
            <span className="font-mono font-bold text-slate-900">1080 × 1920 MP4 (H.264 / AAC)</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Subtitle Engine:</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Word-Synced ASS Burned-In
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
            <span className="text-slate-500 font-medium">Watermark:</span>
            {isProUser ? (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-500" /> Clean Export (Pro Tier)
              </span>
            ) : (
              <span className="text-xs text-amber-700 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> Included (Free Tier)
              </span>
            )}
          </div>
        </div>

        {/* Pro Upgrade Banner for Free Users */}
        {!isProUser && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-900">Remove Watermark</p>
                <p className="text-[10px] text-amber-700">Upgrade to Pro for $19/mo (Unlimited Exports)</p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenPricing?.();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Upgrade
            </button>
          </div>
        )}

        {/* Real Progress Bar */}
        {isRendering && (
          <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <RefreshCw className="w-3.5 h-3.5 text-red-600 animate-spin" />
                <span>{currentStage || 'Processing frames...'}</span>
              </span>
              <span className="font-mono font-bold text-red-600">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
            <p className="font-bold flex items-center gap-1">
              <AlertCircle className="w-4 h-4 shrink-0" /> Render Notice
            </p>
            <p className="text-[11px] leading-relaxed">{errorMessage}</p>
            {errorMessage.includes('media is unavailable') && (
              <div className="pt-1">
                <input
                  type="file"
                  id="modal-video-picker"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setLocalMediaUrl(url);
                      setErrorMessage(null);
                    }
                  }}
                />
                <label
                  htmlFor="modal-video-picker"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  <span>Attach Video File to Render</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div>
          {downloadUrl ? (
            <button
              onClick={handleDownload}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Rendered MP4 Video</span>
            </button>
          ) : (
            <button
              onClick={triggerExport}
              disabled={isRendering}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isRendering ? 'Rendering Video...' : 'Start Real 9:16 Render'}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
