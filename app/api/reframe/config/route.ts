import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectAccess } from '@/lib/auth/serverAuth';
import { formatErrorResponse } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { CANONICAL_ASPECT_RATIOS, AspectRatio, ReframeConfig, MultiPersonMode, TrackingMode } from '@/lib/reframe/types';

function isValidFiniteNumber(val: any, min?: number, max?: number): val is number {
  if (typeof val !== 'number') return false;
  if (!Number.isFinite(val)) return false;
  if (Number.isNaN(val)) return false;
  if (min !== undefined && val < min) return false;
  if (max !== undefined && val > max) return false;
  return true;
}

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

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 });
    }

    if (!CANONICAL_ASPECT_RATIOS.includes(targetAspectRatio)) {
      return NextResponse.json(
        { error: `Invalid targetAspectRatio: must be one of ${CANONICAL_ASPECT_RATIOS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!['center', 'smart', 'manual'].includes(trackingMode)) {
      return NextResponse.json({ error: 'Invalid trackingMode: must be center, smart, or manual' }, { status: 400 });
    }

    if (!['SINGLE', 'DUAL', 'GROUP', 'GENERAL'].includes(multiPersonMode)) {
      return NextResponse.json(
        { error: 'Invalid multiPersonMode: must be SINGLE, DUAL, GROUP, or GENERAL' },
        { status: 400 }
      );
    }

    if (manualSettings) {
      if (!isValidFiniteNumber(manualSettings.x, 0, 1) || !isValidFiniteNumber(manualSettings.y, 0, 1)) {
        return NextResponse.json({ error: 'Invalid manualSettings x/y coordinates: must be in range [0, 1]' }, { status: 400 });
      }
      if (!isValidFiniteNumber(manualSettings.zoom, 1.0, 2.5)) {
        return NextResponse.json({ error: 'Invalid manualSettings zoom: must be in range [1.0, 2.5]' }, { status: 400 });
      }
    }

    if (!isValidFiniteNumber(smoothingAlpha, 0.01, 1.0)) {
      return NextResponse.json({ error: 'Invalid smoothingAlpha: must be in range (0, 1]' }, { status: 400 });
    }

    if (!isValidFiniteNumber(deadZone, 0, 0.5)) {
      return NextResponse.json({ error: 'Invalid deadZone: must be in range [0, 0.5]' }, { status: 400 });
    }

    if (!isValidFiniteNumber(headroom, 0, 1.0)) {
      return NextResponse.json({ error: 'Invalid headroom: must be in range [0, 1.0]' }, { status: 400 });
    }

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
