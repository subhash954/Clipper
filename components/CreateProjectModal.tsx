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

  const [currentStageText, setCurrentStageText] = useState<string>('Initializing pipeline...');

  const handleStartAnalysis = async () => {
    if (!youtubeUrl.trim() && !uploadedFile) {
      setErrorMsg("Please paste a valid video URL or upload a video file.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      if (uploadedFile) {
        // Step 1: Upload media file & probe container
        setCurrentStageText('Uploading & verifying video signature with FFprobe...');
        setAnalysisStage(0);

        const uploadFormData = new FormData();
        uploadFormData.append('file', uploadedFile);

        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${uploadRes.status}`);
        }

        const uploadData = await uploadRes.json();
        const mediaAsset = uploadData.mediaAsset;

        // Step 2: Create project record
        setCurrentStageText('Registering project in database...');
        setAnalysisStage(1);

        const projectRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: uploadedFile.name.replace(/\.[^/.]+$/, ''),
            sourceUrl: mediaAsset.fileUrl,
            sourceType: 'upload',
            durationSeconds: mediaAsset.duration || 60,
            status: 'ingesting',
            workflowType: 'youtube_to_shorts',
            isMediaAvailable: true,
          }),
        });

        if (!projectRes.ok) {
          const errData = await projectRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create project.');
        }

        const projectData = await projectRes.json();
        const createdProject = projectData.project;
        const projectId = createdProject.id;

        // Step 3: Run audio extraction, transcription & AI analysis
        setCurrentStageText('Extracting audio & transcribing with Deepgram Nova-2...');
        setAnalysisStage(2);

        const ingestRes = await fetch(`/api/projects/${projectId}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipCount: 5 }),
        });

        if (!ingestRes.ok) {
          const errData = await ingestRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Speech transcription and analysis failed.');
        }

        const finalIngestData = await ingestRes.json();
        setCurrentStageText('Clips ready! Launching Studio...');
        setAnalysisStage(3);

        if (onProjectCreated) {
          onProjectCreated(finalIngestData.project);
        }

        onClose();
        router.push(`/studio?projectId=${projectId}`);

      } else {
        // YouTube Ingestion Path
        setCurrentStageText('Fetching metadata & transcript cues from YouTube...');
        setAnalysisStage(1);

        const res = await fetch('/api/youtube/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            youtubeUrl: youtubeUrl.trim(),
            clipCount: 5 
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Analysis request returned status ${res.status}`);
        }

        const data = await res.json();
        setCurrentStageText('Clips ready! Launching Studio...');
        setAnalysisStage(3);

        if (onProjectCreated) {
          onProjectCreated(data);
        }

        onClose();
        router.push(data.id ? `/studio?projectId=${data.id}` : '/studio');
      }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200/90 p-6 shadow-2xl space-y-6 text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Create New Video Project</h2>
            <p className="text-xs text-slate-500">Bring your video to Clipper and unlock high-potential clips.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Switcher */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Select Creation Workflow
          </label>
          <div className="grid grid-cols-3 gap-3">
            
            {/* Workflow A: AI Clip Discovery */}
            <button
              type="button"
              onClick={() => setSelectedWorkflow('discovery')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedWorkflow === 'discovery'
                  ? 'bg-red-50/80 border-red-500 text-slate-900 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-all ${
                selectedWorkflow === 'discovery'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold leading-tight">Find Best Moments</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                Extract top standalone clips from long speech automatically.
              </p>
            </button>

            {/* Workflow B: Smart Captions */}
            <button
              type="button"
              onClick={() => setSelectedWorkflow('captions')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedWorkflow === 'captions'
                  ? 'bg-red-50/80 border-red-500 text-slate-900 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-all ${
                selectedWorkflow === 'captions'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                <Type className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold leading-tight">Create Captions</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                Apply animated kinetic typography & word-by-word sync.
              </p>
            </button>

            {/* Workflow C: Manual Studio */}
            <button
              type="button"
              onClick={() => setSelectedWorkflow('manual')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedWorkflow === 'manual'
                  ? 'bg-red-50/80 border-red-500 text-slate-900 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-all ${
                selectedWorkflow === 'manual'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                <Sliders className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold leading-tight">Open Studio</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                Take direct control over timing, B-roll, and multi-track cuts.
              </p>
            </button>

          </div>
        </div>

        {/* Source Selector */}
        <div className="space-y-4">
          
          {/* File Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              dragActive 
                ? 'border-red-500 bg-red-50/60' 
                : uploadedFile
                ? 'border-emerald-500/60 bg-emerald-50/40'
                : 'border-slate-200 bg-slate-50/60 hover:border-red-300 hover:bg-red-50/20'
            }`}
          >
            {uploadedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileVideo className="w-8 h-8 text-emerald-600" />
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 truncate max-w-xs">{uploadedFile.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB · Ready to process</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  className="ml-3 text-slate-400 hover:text-red-600 text-xs font-bold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Drop your video here</p>
                  <p className="text-[11px] text-slate-500">or click to browse local files</p>
                </div>
                <label className="inline-block mt-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors border border-slate-200 shadow-xs">
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
                <p className="text-[10px] text-slate-400">MP4 · MOV · WebM up to 500MB</p>
              </div>
            )}
          </div>

          {/* Paste Video Link */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span>Or paste a video link</span>
              <span className="text-[10px] text-slate-400 font-normal">YouTube watch, shorts, or embed</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Youtube className="w-4 h-4 text-red-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all shadow-xs"
                />
              </div>
              <button
                type="button"
                disabled={isAnalyzing || (!youtubeUrl.trim() && !uploadedFile)}
                onClick={handleStartAnalysis}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-red-600/20 disabled:opacity-50 cursor-pointer"
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

          {/* Connected Storage Options */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
            <span className="text-[10px] font-medium text-slate-400">Cloud Sources:</span>
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => alert("Google Drive integration: authenticate your Google Cloud project credentials in Admin Settings.")}
                className="text-slate-500 hover:text-red-600 font-medium transition-colors flex items-center gap-1 cursor-pointer"
              >
                <HardDrive className="w-3 h-3 text-slate-400" /> Connect Google Drive
              </button>
              <span className="text-slate-300">·</span>
              <button 
                type="button" 
                onClick={() => alert("Dropbox integration: authenticate your Dropbox App credentials in Admin Settings.")}
                className="text-slate-500 hover:text-red-600 font-medium transition-colors flex items-center gap-1 cursor-pointer"
              >
                Connect Dropbox
              </button>
            </div>
          </div>

          {/* AI Explanation Notice */}
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Clipper analyzes speech, pacing, topic changes, vocal conviction, and visual moments using real Deepgram speech synchronization and Gemini intelligence.
          </p>

        </div>

        {/* Meaningful Loading Stages */}
        {isAnalyzing && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Video Ingestion in Progress
              </p>
              <span className="text-[11px] font-medium text-slate-600 truncate max-w-[260px]">{currentStageText}</span>
            </div>
            <div className="space-y-2">
              {analysisStages.map((stage, idx) => {
                const isDone = analysisStage > idx;
                const isCurrent = analysisStage === idx;

                return (
                  <div key={stage.title} className="flex items-center gap-2.5 text-xs">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-red-600 border-t-transparent animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                    )}
                    <div className="flex items-center justify-between w-full">
                      <span className={isCurrent ? "font-bold text-slate-900" : isDone ? "text-slate-700 font-medium" : "text-slate-400"}>
                        {stage.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{stage.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

      </div>
    </div>
  );
};
