import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from './supabase';

export interface SavedProject {
  id: string;
  videoTitle: string;
  channelName: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  durationMinutes: number;
  clipsCount: number;
  clips: any[];
  costs: any;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'projects.json');

function ensureDbFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]), 'utf-8');
  }
}

export async function getSavedProjects(): Promise<SavedProject[]> {
  // 1. Try Supabase if keys provided
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data as SavedProject[];
      }
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local DB:', e);
    }
  }

  // 2. Fallback to Local Persistent File Database
  try {
    ensureDbFile();
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local db:', err);
    return [];
  }
}

export async function saveProject(project: SavedProject): Promise<SavedProject> {
  // 1. Try Supabase if keys provided
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('projects').upsert([
        {
          id: project.id,
          title: project.videoTitle,
          status: 'completed',
          metadata: {
            channelName: project.channelName,
            thumbnailUrl: project.thumbnailUrl,
            youtubeUrl: project.youtubeUrl,
            clipsCount: project.clipsCount,
            costs: project.costs,
          },
        },
      ]);
    } catch (e) {
      console.warn('Supabase upsert failed, continuing to local DB:', e);
    }
  }

  // 2. Save to Local Persistent File Database
  try {
    ensureDbFile();
    const projects = await getSavedProjects();
    const updated = [project, ...projects.filter((p) => p.id !== project.id)];
    fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return project;
  } catch (err) {
    console.error('Error saving project to local db:', err);
    return project;
  }
}
