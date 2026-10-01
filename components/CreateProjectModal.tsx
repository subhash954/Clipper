'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, 
  UploadCloud, 
  Youtube, 
  Sparkles, 
  Film, 
  Type, 
  Sliders, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  HardDrive,
  FileVideo,
  ExternalLink
} from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (project: any) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const router = useRouter();
  const [selectedWorkflow, setSelectedWorkflow] = useState<'discovery' | 'captions' | 'manual'>('discovery');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const analysisStages = [
    { title: "Understanding video metadata", desc: "Validating stream & cues" },
    { title: "Transcribing spoken speech", desc: "Generating word timestamps" },
    { title: "Finding strong moments", desc: "Analyzing retention hooks & narrative shifts" },
    { title: "Preparing recommendations", desc: "Synthesizing AI Editorial Signals" }
  ];

  const handleStartAnalysis = async () => {
    if (!youtubeUrl.trim() && !uploadedFile) {
      setErrorMsg("Please paste a valid video URL or upload a video file.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisStage(0);

    try {
      // Meaningful progressive stages (Section 24)
      const stageTimer1 = setTimeout(() => setAnalysisStage(1), 1000);
      const stageTimer2 = setTimeout(() => setAnalysisStage(2), 2200);
      const stageTimer3 = setTimeout(() => setAnalysisStage(3), 3600);

      const res = await fetch('/api/youtube/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          youtubeUrl: youtubeUrl.trim(),
          clipCount: 5 
        }),
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis request returned status ${res.status}`);
      }

      const data = await res.json();
      setAnalysisStage(4);

      // Save to canonical local active project
      if (typeof window !== 'undefined' && data?.clips?.length > 0) {
        localStorage.setItem('clipper_active_project', JSON.stringify({
          videoTitle: data.videoTitle,
          channelName: data.channelName,
          thumbnailUrl: data.thumbnailUrl,
          activeClip: data.clips[0],
          clips: data.clips,
          isMediaAvailable: false,
          timingPrecision: data.timingPrecision || 'approximate_cue',
        }));
      }

      if (onProjectCreated) {
        onProjectCreated(data);
      }

      // Transition smoothly to Studio
      setTimeout(() => {
        onClose();
        router.push('/studio');
      }, 700);

    } catch (err: any) {
      console.error('Ingest error:', err);
      setErrorMsg(err.message || "Failed to analyze video. Please check the URL or upload directly.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.includes('video')) {
        setUploadedFile(file);
      } else {
        setErrorMsg("Please drop a valid video file (MP4, MOV, WebM).");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#111827] border border-[#283344] p-6 shadow-2xl space-y-6 text-[#F8FAFC]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Create New Video Project</h2>
            <p className="text-xs text-slate-400">Bring your video to Clipper and unlock high-potential clips.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Switcher (Section 7) */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Select Creation Workflow
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            
            {/* Workflow A: AI Clip Discovery */}
            <button
              type="button"
              onClick={() => setSelectedWorkflow('discovery')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedWorkflow === 'discovery'
                  ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-cyan-sm'
                  : 'bg-[#161F30] border-[#283344] text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold leading-tight">Find Best Moments</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                Extract top standalone clips from long speech automatically.
              </p>
            </button>

            {/* Workflow B: Smart Captions */}
            <button
              type="button"
              onClick={() => setSelectedWorkflow('captions')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedWorkflow === 'captions'
                  ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-cyan-sm'
                  : 'bg-[#161F30] border-[#283344] text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                <Type className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold leading-tight">Create Captions</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                Apply animated kinetic typography & word-by-word sync.
              </p>
            </button>

            {/* Workflow C: Manual Studio */}
            <button
              type="button"
              onClick={() => setSelectedWorkflow('manual')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedWorkflow === 'manual'
                  ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-cyan-sm'
                  : 'bg-[#161F30] border-[#283344] text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                <Sliders className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold leading-tight">Open Studio</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                Take direct control over timing, B-roll, and multi-track cuts.
              </p>
            </button>

          </div>
        </div>

        {/* Source Selector (Section 8 & 9) */}
        <div className="space-y-4">
          
          {/* File Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              dragActive 
                ? 'border-cyan-400 bg-cyan-500/10' 
                : uploadedFile
                ? 'border-emerald-500/60 bg-emerald-950/20'
                : 'border-[#283344] bg-[#0E1524] hover:border-slate-500'
            }`}
          >
            {uploadedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileVideo className="w-8 h-8 text-emerald-400" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white truncate max-w-xs">{uploadedFile.name}</p>
                  <p className="text-[10px] text-slate-400">{(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB · Ready to process</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  className="ml-3 text-slate-400 hover:text-rose-400 text-xs"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                <div>
                  <p className="text-xs font-semibold text-white">Drop your video here</p>
                  <p className="text-[11px] text-slate-400">or click to browse local files</p>
                </div>
                <label className="inline-block mt-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-colors border border-slate-700">
                  <span>Select Video</span>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setUploadedFile(e.target.files[0]);
                    }}
                  />
                </label>
                <p className="text-[10px] text-slate-500">MP4 · MOV · WebM up to 500MB</p>
              </div>
            )}
          </div>

          {/* Paste Video Link */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
              <span>Or paste a video link</span>
              <span className="text-[10px] text-slate-400 font-normal">YouTube watch, shorts, or embed</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Youtube className="w-4 h-4 text-red-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#0E1524] border border-[#283344] focus:border-cyan-400 rounded-xl text-xs text-white placeholder-slate-500 outline-hidden transition-colors"
                />
              </div>
              <button
                type="button"
                disabled={isAnalyzing || (!youtubeUrl.trim() && !uploadedFile)}
                onClick={handleStartAnalysis}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing</span>
                  </>
                ) : (
                  <>
                    <span>Analyze</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Connected Storage Options (Section 8: honest status) */}
          <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-[#1F2937]/80">
            <span className="text-[10px]">Cloud Sources:</span>
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => alert("Google Drive integration: authenticate your Google Cloud project credentials in Admin Settings.")}
                className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <HardDrive className="w-3 h-3" /> Connect Google Drive
              </button>
              <span className="text-slate-700">·</span>
              <button 
                type="button" 
                onClick={() => alert("Dropbox integration: authenticate your Dropbox App credentials in Admin Settings.")}
                className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                Connect Dropbox
              </button>
            </div>
          </div>

          {/* AI Explanation Notice */}
          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            Clipper analyzes speech, pacing, topic changes, vocal conviction, and visual moments using real Deepgram speech synchronization and Gemini intelligence.
          </p>

        </div>

        {/* Meaningful Loading Stages (Section 24) */}
        {isAnalyzing && (
          <div className="p-4 rounded-xl bg-[#0E1524] border border-[#283344] space-y-3 animate-in fade-in">
            <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Video Ingestion in Progress
            </p>
            <div className="space-y-2">
              {analysisStages.map((stage, idx) => {
                const isDone = analysisStage > idx;
                const isCurrent = analysisStage === idx;

                return (
                  <div key={stage.title} className="flex items-center gap-2.5 text-xs">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                    )}
                    <div className="flex items-center justify-between w-full">
                      <span className={isCurrent ? "font-bold text-white" : isDone ? "text-slate-300" : "text-slate-600"}>
                        {stage.title}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{stage.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

      </div>
    </div>
  );
};
