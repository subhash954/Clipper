import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { AspectRatio, ReframeConfig, MultiPersonMode, TrackingMode } from '@/lib/reframe/types';
import { validateReframeConfig } from '@/lib/reframe/validation';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const targetAspectRatio = searchParams.get('targetAspectRatio') || undefined;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    await requireProjectAccess(user, projectId, 'viewer');
    const storage = getStorage();
    const config = storage.getReframeConfig
      ? await storage.getReframeConfig(projectId, targetAspectRatio)
      : null;

    if (!config) {
      return NextResponse.json({ error: 'No reframe config found for project' }, { status: 404 });
    }

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const {
      projectId,
      targetAspectRatio = '9:16',
      trackingMode = 'smart',
      multiPersonMode = 'GENERAL',
      manualSettings,
      smoothingAlpha = 0.25,
      deadZone = 0.035,
      headroom = 0.35,
    } = body;

    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    // Strict runtime input validation
    validateReframeConfig({
      targetAspectRatio,
      trackingMode,
      multiPersonMode,
      manualSettings,
      smoothingAlpha,
      deadZone,
      headroom,
    });

    await requireProjectAccess(user, projectId, 'editor');
    const storage = getStorage();

    const config: ReframeConfig = {
      id: crypto.randomUUID(),
      projectId,
      targetAspectRatio: targetAspectRatio as AspectRatio,
      trackingMode: trackingMode as TrackingMode,
      multiPersonMode: multiPersonMode as MultiPersonMode,
      manualSettings,
      smoothingAlpha,
      deadZone,
      headroom,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = storage.saveReframeConfig
      ? await storage.saveReframeConfig(config, user.id)
      : config;

    return NextResponse.json({ success: true, config: saved });
  } catch (err: any) {
    const { body, status } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
