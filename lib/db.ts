import { getStorage } from './storage';
import { Project, ViralClip } from './types';

export interface SavedProject {
  id: string;
  videoTitle: string;
  channelName: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  durationMinutes: number;
  clipsCount: number;
  clips: ViralClip[];
  costs: any;
  createdAt: string;
}

export async function getSavedProjects(): Promise<SavedProject[]> {
  try {
    const storage = getStorage();
    const projects = await storage.listProjects();
    return projects.map((p) => ({
      id: p.id,
      videoTitle: p.title,
      channelName: p.channelName || 'YouTube Creator',
      thumbnailUrl: p.thumbnailUrl || '',
      youtubeUrl: p.sourceUrl || '',
      durationMinutes: Math.round((p.durationSeconds || 2700) / 60),
      clipsCount: p.clips?.length || 0,
      clips: p.clips || [],
      costs: p.costs || {
        deepgramSTTCost: 0.19,
        geminiFlashLLMCost: 0.002,
        stockBRollCost: 0.0,
        totalCostUSD: 0.43,
        totalCostINR: 37,
      },
      createdAt: p.createdAt,
    }));
  } catch (err) {
    console.error('Error fetching saved projects:', err);
    return [];
  }
}

export async function saveProject(project: SavedProject): Promise<SavedProject> {
  try {
    const storage = getStorage();
    const domainProject: Project = {
      id: project.id,
      title: project.videoTitle,
      channelName: project.channelName,
      thumbnailUrl: project.thumbnailUrl,
      sourceUrl: project.youtubeUrl,
      sourceType: 'youtube',
      workflowType: 'youtube_to_shorts',
      durationSeconds: (project.durationMinutes || 45) * 60,
      status: 'completed',
      clipsCount: project.clips?.length || 0,
      clips: project.clips || [],
      costs: project.costs,
      createdAt: project.createdAt || new Date().toISOString(),
    };

    await storage.saveProject(domainProject);
    return project;
  } catch (err) {
    console.error('Error saving project to storage:', err);
    throw err;
  }
}
