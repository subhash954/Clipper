'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { 
  Sparkles, 
  Type, 
  Sliders, 
  Plus, 
  Film, 
  Clock, 
  Play, 
  MoreVertical, 
  Trash2, 
  Copy, 
  Edit3, 
  ExternalLink, 
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Video,
  Layers,
  Zap,
  FolderOpen
} from 'lucide-react';
import { Project, ViralClip } from '@/lib/types';

export default function WorkspaceDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);

  // Load real projects from database / persistent API
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) {
          setProjects(data.projects);
        }
      })
      .catch((err) => console.warn('Could not load workspace projects:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleOpenProjectInStudio = (project: Project) => {
    if (typeof window !== 'undefined') {
      const activeClip = project.clips && project.clips.length > 0 ? project.clips[0] : null;
      localStorage.setItem('clipper_active_project', JSON.stringify({
        id: project.id,
        videoTitle: project.title,
        channelName: project.channelName || 'Clipper Creator',
        thumbnailUrl: project.thumbnailUrl,
        activeClip: activeClip,
        clips: project.clips || [],
        isMediaAvailable: project.isMediaAvailable ?? false,
      }));
    }
    router.push('/studio');
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setActiveMenuProjectId(null);
  };

  const handleDuplicateProject = (project: Project) => {
    const duplicated: Project = {
      ...project,
      id: `proj-${Date.now()}`,
      title: `${project.title} (Copy)`,
      createdAt: new Date().toISOString(),
    };
    setProjects((prev) => [duplicated, ...prev]);
    setActiveMenuProjectId(null);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
      case 'clips_ready':
      case 'completed':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </span>
        );
      case 'analyzing':
      case 'transcribing':
      case 'processing':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 animate-pulse">
            <Sparkles className="w-3 h-3" /> Analyzing
          </span>
        );
      case 'rendering':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Rendering
          </span>
        );
      case 'failed':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Needs Review
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <AppShell onOpenCreateProject={() => setIsCreateModalOpen(true)}>
      
      {/* Dashboard Container */}
      <div className="p-8 lg:p-12 max-w-7xl mx-auto w-full space-y-12">
        
        {/* 1. TOP HERO SECTION (Section 6) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2.5 py-0.5 rounded-md">
              CLIPPER WORKSPACE
            </span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">AI Video Intelligence</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Turn long videos into content <br />
                <span className="cyan-gradient-text">people want to watch.</span>
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed font-normal">
                Upload a video and let Clipper find the moments worth publishing using deep speech sync and narrative AI.
              </p>
            </div>

            {/* Primary & Secondary Action Buttons */}
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="#projects"
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                View Projects
              </a>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Project</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. THREE ORIGINAL WORKFLOW CARDS (Section 7) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Workflow A: AI Clip Discovery */}
          <div 
            onClick={() => setIsCreateModalOpen(true)}
            className="clipper-card-feature p-6 flex flex-col justify-between group cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                  Find the Best Moments
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Analyze a long video and discover the strongest short-form moments automatically with retention reasoning.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-cyan-400">
              <span>Start with Video</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Workflow B: Smart Captions */}
          <div 
            onClick={() => setIsCreateModalOpen(true)}
            className="clipper-card-feature p-6 flex flex-col justify-between group cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Type className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                  Create Captioned Clips
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Turn your raw video into polished content with intelligent kinetic typography, presets, and word sync.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-cyan-400">
              <span>Create Captions</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Workflow C: Manual Studio */}
          <Link 
            href="/studio"
            className="clipper-card-feature p-6 flex flex-col justify-between group cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sliders className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                  Open the Editor
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Take full control over exact timing, 9:16 re-framing, dynamic captions, audio ducks, and B-roll visual layers.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-cyan-400">
              <span>Open Studio</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

        </div>

        {/* 3. RECENT PROJECTS SECTION (Section 10 & 11) */}
        <div id="projects" className="space-y-6 pt-4">
          
          <div className="flex items-center justify-between border-b border-[#1F2937] pb-4">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Recent Projects</h2>
              <span className="text-xs text-slate-500 font-mono">({projects.length})</span>
            </div>
            
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Project
            </button>
          </div>

          {/* Empty State (Section 23) */}
          {!loading && projects.length === 0 && (
            <div className="clipper-card p-12 text-center max-w-lg mx-auto space-y-5 my-8">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 flex items-center justify-center mx-auto">
                <Video className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">No projects yet</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your next clip starts here. Bring a YouTube video or raw footage to discover high-retention moments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Your First Project</span>
              </button>
            </div>
          )}

          {/* Project Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {projects.map((project) => {
              const isMenuOpen = activeMenuProjectId === project.id;
              const clipCount = project.clips ? project.clips.length : (project.clipsCount || 0);

              return (
                <div 
                  key={project.id}
                  className="clipper-card overflow-hidden group flex flex-col justify-between relative transition-all"
                >
                  {/* Thumbnail Container */}
                  <div 
                    onClick={() => handleOpenProjectInStudio(project)}
                    className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer"
                  >
                    {project.thumbnailUrl ? (
                      <img 
                        src={project.thumbnailUrl} 
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-600">
                        <Film className="w-10 h-10" />
                      </div>
                    )}

                    {/* Duration Badge */}
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-xs text-[10px] font-mono font-bold text-white border border-white/10">
                      {formatDuration(project.durationSeconds)}
                    </div>

                    {/* Hover Play Button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/40">
                        <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 
                          onClick={() => handleOpenProjectInStudio(project)}
                          className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1 cursor-pointer"
                          title={project.title}
                        >
                          {project.title}
                        </h3>

                        {/* Project Actions Menu Button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuProjectId(isMenuOpen ? null : project.id);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-6 w-36 bg-[#161F30] border border-[#283344] rounded-xl p-1 shadow-2xl z-30 text-xs space-y-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenProjectInStudio(project)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Edit3 className="w-3 h-3 text-cyan-400" />
                                <span>Open Project</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateProject(project)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Duplicate</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(project.id)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        {getStatusBadge(project.status)}
                        <span className="text-[11px] text-slate-400">
                          {clipCount} {clipCount === 1 ? 'moment' : 'moments'}
                        </span>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-2 border-t border-[#1F2937] flex items-center justify-between text-[10px] text-slate-500">
                      <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenProjectInStudio(project)}
                        className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                      >
                        Edit →
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* Creation Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={(newProject) => {
          setProjects((prev) => [newProject, ...prev]);
        }}
      />

    </AppShell>
  );
}
