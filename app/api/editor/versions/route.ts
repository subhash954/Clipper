import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { VersionService } from '@/lib/editor/versionService';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'viewer');
    const versions = await VersionService.listVersions(projectId);

    return NextResponse.json({
      projectId,
      versions,
      count: versions.length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { action = 'save', projectId, name, description, renderSpec, versionNumber, newName } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'editor');

    if (action === 'save') {
      if (!name || !renderSpec) {
        return NextResponse.json({ error: 'Missing name or renderSpec' }, { status: 400 });
      }
      const snapshot = await VersionService.saveVersion({
        projectId,
        userId: user.id,
        name,
        description,
        renderSpec,
      });
      return NextResponse.json({ success: true, version: snapshot });
    }

    if (action === 'restore') {
      if (!versionNumber) {
        return NextResponse.json({ error: 'Missing versionNumber' }, { status: 400 });
      }
      const spec = await VersionService.restoreVersion(projectId, Number(versionNumber));
      if (!spec) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, renderSpec: spec });
    }

    if (action === 'duplicate') {
      if (!versionNumber) {
        return NextResponse.json({ error: 'Missing versionNumber' }, { status: 400 });
      }
      const snapshot = await VersionService.duplicateVersion(
        projectId,
        user.id,
        Number(versionNumber),
        newName
      );
      if (!snapshot) {
        return NextResponse.json({ error: 'Source version not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, version: snapshot });
    }

    if (action === 'rename') {
      if (!versionNumber || !newName) {
        return NextResponse.json({ error: 'Missing versionNumber or newName' }, { status: 400 });
      }
      const ok = await VersionService.renameVersion(projectId, Number(versionNumber), newName);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
