import fs from 'fs';
import path from 'path';
import { CanonicalRenderSpec, StudioVersionSnapshot } from './types';
import { createClient } from '@supabase/supabase-js';

const DATA_VERSIONS_DIR = path.join(process.cwd(), 'data', 'timeline_versions');

function ensureLocalDir() {
  if (!fs.existsSync(DATA_VERSIONS_DIR)) {
    fs.mkdirSync(DATA_VERSIONS_DIR, { recursive: true });
  }
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Server-side timeline version control service (Phase 7)
 */
export class VersionService {
  /**
   * Save a new version snapshot
   */
  static async saveVersion(params: {
    projectId: string;
    userId: string;
    name: string;
    description?: string;
    renderSpec: CanonicalRenderSpec;
  }): Promise<StudioVersionSnapshot> {
    const { projectId, userId, name, description = '', renderSpec } = params;

    // Get current version count to calculate next version number
    const existing = await this.listVersions(projectId);
    const versionNumber = existing.length + 1;

    const snapshotId = crypto.randomUUID();
    const snapshot: StudioVersionSnapshot = {
      id: snapshotId,
      versionNumber,
      description: name + (description ? ` - ${description}` : ''),
      renderSpec: {
        ...renderSpec,
        version: versionNumber,
        updatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from('timeline_versions').insert({
          id: snapshot.id,
          project_id: projectId,
          user_id: userId,
          version_number: versionNumber,
          name,
          description,
          render_spec: snapshot.renderSpec,
          created_at: snapshot.createdAt,
        });
        if (error) {
          console.warn('Supabase insert timeline_version returned error:', error.message);
        } else {
          // Update active version pointer on the project
          await supabase
            .from('projects')
            .update({ active_version_id: snapshot.id })
            .eq('id', projectId);
        }
      } catch (err: any) {
        console.warn('Supabase connection failed, using local store:', err.message);
      }
    }

    // Persist to local filesystem as robust fallback / audit trail
    ensureLocalDir();
    const filePath = path.join(DATA_VERSIONS_DIR, `${projectId}.json`);
    let fileVersions: StudioVersionSnapshot[] = [];
    if (fs.existsSync(filePath)) {
      try {
        fileVersions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        fileVersions = [];
      }
    }
    fileVersions.push(snapshot);
    fs.writeFileSync(filePath, JSON.stringify(fileVersions, null, 2), 'utf-8');

    return snapshot;
  }

  /**
   * List all saved versions for a project
   */
  static async listVersions(projectId: string): Promise<StudioVersionSnapshot[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('timeline_versions')
          .select('*')
          .eq('project_id', projectId)
          .order('version_number', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            versionNumber: d.version_number,
            description: d.description ? `${d.name} - ${d.description}` : d.name,
            renderSpec: d.render_spec,
            createdAt: d.created_at,
            createdBy: d.user_id,
          }));
        }
      } catch (err) {
        // Fallback to local
      }
    }

    // Fallback to local file
    ensureLocalDir();
    const filePath = path.join(DATA_VERSIONS_DIR, `${projectId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const fileVersions: StudioVersionSnapshot[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return fileVersions.sort((a, b) => b.versionNumber - a.versionNumber);
      } catch (e) {
        return [];
      }
    }

    return [];
  }

  /**
   * Restore a specific version
   */
  static async restoreVersion(projectId: string, versionNumber: number): Promise<CanonicalRenderSpec | null> {
    const versions = await this.listVersions(projectId);
    const target = versions.find((v) => v.versionNumber === versionNumber);
    if (!target) return null;
    return target.renderSpec;
  }

  /**
   * Duplicate a version into a new version entry
   */
  static async duplicateVersion(
    projectId: string,
    userId: string,
    sourceVersionNumber: number,
    newName?: string
  ): Promise<StudioVersionSnapshot | null> {
    const spec = await this.restoreVersion(projectId, sourceVersionNumber);
    if (!spec) return null;

    return await this.saveVersion({
      projectId,
      userId,
      name: newName || `Copy of Version ${sourceVersionNumber}`,
      description: `Duplicated from version ${sourceVersionNumber}`,
      renderSpec: spec,
    });
  }

  /**
   * Rename a version's description / title
   */
  static async renameVersion(
    projectId: string,
    versionNumber: number,
    newName: string
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('timeline_versions')
          .update({ name: newName })
          .eq('project_id', projectId)
          .eq('version_number', versionNumber);
      } catch (err) {
        console.warn('Supabase rename timeline_version warning:', err);
      }
    }

    ensureLocalDir();
    const filePath = path.join(DATA_VERSIONS_DIR, `${projectId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const fileVersions: StudioVersionSnapshot[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const index = fileVersions.findIndex((v) => v.versionNumber === versionNumber);
        if (index !== -1) {
          fileVersions[index].description = newName;
          fs.writeFileSync(filePath, JSON.stringify(fileVersions, null, 2), 'utf-8');
          return true;
        }
      } catch (e) {
        return false;
      }
    }
    return true;
  }
}
