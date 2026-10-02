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
    router.push(`/studio?projectId=${project.id}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      }
    } catch (err) {
      console.warn('Could not delete project from database:', err);
    }
    setActiveMenuProjectId(null);
  };

  const handleDuplicateProject = async (project: Project) => {
    try {
      const newId = crypto.randomUUID();
      const duplicatedPayload = {
        ...project,
        id: newId,
        title: `${project.title} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicatedPayload),
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setProjects((prev) => [data.project, ...prev]);
      }
    } catch (err) {
      console.error('Could not persist duplicated project to database:', err);
    } finally {
      setActiveMenuProjectId(null);
    }
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
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ready
          </span>
        );
      case 'analyzing':
      case 'transcribing':
      case 'processing':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 animate-pulse shadow-xs">
            <Sparkles className="w-3 h-3 text-red-600" /> Analyzing
          </span>
        );
      case 'rendering':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 shadow-xs">
            <Clock className="w-3 h-3 text-amber-600" /> Rendering
          </span>
        );
      case 'failed':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 shadow-xs">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Needs Review
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <AppShell onOpenCreateProject={() => setIsCreateModalOpen(true)}>
      
      {/* Dashboard Container: Clean Light Grey Backdrop */}
      <div className="p-8 lg:p-12 max-w-7xl mx-auto w-full space-y-12">
        
        {/* 1. TOP HERO SECTION */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-red-700 bg-red-50 border border-red-200/80 px-2.5 py-0.5 rounded-md shadow-xs">
              CLIPPER WORKSPACE
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">AI Video Intelligence</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Turn long videos into content <br />
                <span className="red-gradient-text">people want to watch.</span>
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Upload a video and let Clipper find the moments worth publishing using deep speech sync and narrative AI.
              </p>
            </div>

            {/* Primary & Secondary Action Buttons */}
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="#projects"
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-colors"
              >
                View Projects
              </a>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Project</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. THREE ORIGINAL WORKFLOW CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Workflow A: AI Clip Discovery */}
          <div 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-red-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200/80 text-red-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-red-600 group-hover:text-white transition-all shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                  Find the Best Moments
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Analyze a long video and discover the strongest short-form moments automatically with retention reasoning.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-bold text-red-600 group-hover:text-red-700 transition-colors">
              <span>Start with Video</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Workflow B: Smart Captions */}
          <div 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-red-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200/80 text-red-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-red-600 group-hover:text-white transition-all shadow-xs">
                <Type className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                  Create Captioned Clips
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Turn your raw video into polished content with intelligent kinetic typography, presets, and word sync.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-bold text-red-600 group-hover:text-red-700 transition-colors">
              <span>Create Captions</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Workflow C: Manual Studio */}
          <Link 
            href="/studio"
            className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-red-300 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200/80 text-red-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-red-600 group-hover:text-white transition-all shadow-xs">
                <Sliders className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                  Open the Studio
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Take full control over exact timing, 9:16 re-framing, dynamic captions, audio ducks, and B-roll visual layers.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between text-xs font-bold text-red-600 group-hover:text-red-700 transition-colors">
              <span>Open Studio</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

        </div>

        {/* 3. RECENT PROJECTS SECTION */}
        <div id="projects" className="space-y-6 pt-4">
          
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Recent Projects</h2>
              <span className="text-xs text-slate-500 font-mono font-medium">({projects.length})</span>
            </div>
            
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Project
            </button>
          </div>

          {/* Empty State */}
          {!loading && projects.length === 0 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-5 my-8 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto shadow-xs">
                <Video className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">No projects yet</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your next clip starts here. Bring a YouTube video or raw footage to discover high-retention moments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-red-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Your First Project</span>
              </button>
            </div>
          )}

          {/* Project Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => {
              const isMenuOpen = activeMenuProjectId === project.id;
              const clipCount = project.clips ? project.clips.length : (project.clipsCount || 0);

              return (
                <div 
                  key={project.id}
                  className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-red-300 group flex flex-col justify-between relative transition-all"
                >
                  {/* Thumbnail Container */}
                  <div 
                    onClick={() => handleOpenProjectInStudio(project)}
                    className="relative aspect-video bg-slate-100 overflow-hidden cursor-pointer"
                  >
                    {project.thumbnailUrl ? (
                      <img 
                        src={project.thumbnailUrl} 
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                        <Film className="w-10 h-10" />
                      </div>
                    )}

                    {/* Duration Badge */}
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-xs text-[10px] font-mono font-bold text-white border border-white/20">
                      {formatDuration(project.durationSeconds)}
                    </div>

                    {/* Hover Play Button */}
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40 hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 
                          onClick={() => handleOpenProjectInStudio(project)}
                          className="text-xs font-bold text-slate-900 group-hover:text-red-600 transition-colors line-clamp-1 cursor-pointer"
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
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-6 w-38 bg-white border border-slate-200 rounded-xl p-1.5 shadow-xl z-30 text-xs space-y-0.5 text-slate-700">
                              <button
                                type="button"
                                onClick={() => handleOpenProjectInStudio(project)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-800 hover:bg-red-50 hover:text-red-700 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-red-600" />
                                <span>Open Project</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateProject(project)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Duplicate</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(project.id)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        {getStatusBadge(project.status)}
                        <span className="text-[11px] text-slate-500 font-medium">
                          {clipCount} {clipCount === 1 ? 'moment' : 'moments'}
                        </span>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenProjectInStudio(project)}
                        className="text-red-600 hover:text-red-700 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Edit</span>
                        <ArrowRight className="w-3 h-3" />
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
